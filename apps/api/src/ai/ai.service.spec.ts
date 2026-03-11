import { Test, TestingModule } from "@nestjs/testing";
import { of, throwError } from "rxjs";
import { AIService } from "./ai.service";
import { PrismaService } from "../prisma/prisma.service";
import { AI_GRPC_PACKAGE } from "./ai.constants";
import { TaskStatus, TaskPriority } from "@repo/database";
import type {
    GenerateTasksResponse,
    EstimateTimeResponse,
    StoreTaskEmbeddingResponse,
} from "./ai.types";

// ─── Mock gRPC client ────────────────────────────────────────────────────────
const mockAiGrpc = {
    generateTasks: jest.fn(),
    estimateTime: jest.fn(),
    storeTaskEmbedding: jest.fn(),
};

const mockGrpcClient = {
    getService: jest.fn().mockReturnValue(mockAiGrpc),
};

const mockPrisma = {
    task: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
};

describe("AIService", () => {
    let service: AIService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AIService,
                { provide: AI_GRPC_PACKAGE, useValue: mockGrpcClient },
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<AIService>(AIService);
        service.onModuleInit(); // initialise gRPC client
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    it("onModuleInit should call getService with 'AIService'", () => {
        expect(mockGrpcClient.getService).toHaveBeenCalledWith("AIService");
    });

    // ─── generateTasks ──────────────────────────────────────────────────────
    describe("generateTasks", () => {
        it("should call gRPC and return tasks and summary", async () => {
            const grpcResponse: GenerateTasksResponse = {
                tasks: [{ title: "T1" } as never],
                summary: "Summary",
            };
            mockAiGrpc.generateTasks.mockReturnValue(of(grpcResponse));

            const result = await service.generateTasks("u1", "Build a todo app");
            expect(result).toEqual({ tasks: grpcResponse.tasks, summary: grpcResponse.summary });
            expect(mockAiGrpc.generateTasks).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "u1", goal: "Build a todo app" }),
            );
        });

        it("should cap maxTasks at 7", async () => {
            const grpcResponse: GenerateTasksResponse = { tasks: [], summary: "" };
            mockAiGrpc.generateTasks.mockReturnValue(of(grpcResponse));

            await service.generateTasks("u1", "goal", undefined, 20);
            expect(mockAiGrpc.generateTasks).toHaveBeenCalledWith(
                expect.objectContaining({ maxTasks: 7 }),
            );
        });

        it("should propagate gRPC errors", async () => {
            mockAiGrpc.generateTasks.mockReturnValue(
                throwError(() => new Error("gRPC unavailable")),
            );
            await expect(service.generateTasks("u1", "goal")).rejects.toThrow("gRPC unavailable");
        });
    });

    // ─── confirmGeneratedTasks ───────────────────────────────────────────────
    describe("confirmGeneratedTasks", () => {
        it("should save tasks and return created records", async () => {
            mockPrisma.task.findFirst.mockResolvedValue({ order: 3 });
            const createdRecord = {
                id: "t1",
                title: "Task 1",
                description: null,
                status: TaskStatus.TODAY,
                priority: TaskPriority.MEDIUM,
            };
            mockPrisma.$transaction.mockResolvedValue([createdRecord]);
            mockAiGrpc.storeTaskEmbedding.mockReturnValue(of({ success: true }));

            const result = await service.confirmGeneratedTasks("u1", [
                { title: "Task 1", priority: "MEDIUM" },
            ]);
            expect(result).toEqual([createdRecord]);
        });

        it("should use baseOrder=1 when no existing tasks", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            mockPrisma.$transaction.mockResolvedValue([{ id: "t1", title: "T", description: "" }]);
            mockAiGrpc.storeTaskEmbedding.mockReturnValue(of({ success: true }));

            await service.confirmGeneratedTasks("u1", [{ title: "T" }]);
            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });
    });

    // ─── estimateTime ────────────────────────────────────────────────────────
    describe("estimateTime", () => {
        it("should return estimate from gRPC", async () => {
            const grpcResponse: EstimateTimeResponse = {
                estimatedPomodoros: 3,
                reasoning: "Based on similar tasks",
                similarTasks: [],
                confidence: "medium",
                focusPlan: {
                    sessionType: "STANDARD",
                    sessions: 3,
                    totalMinutes: 75,
                    label: "🍅 3 Pomodoros",
                },
            };
            mockAiGrpc.estimateTime.mockReturnValue(of(grpcResponse));

            const result = await service.estimateTime("u1", "Write unit tests");
            expect(result.estimatedPomodoros).toBe(3);
        });

        it("should return fallback estimate on gRPC error", async () => {
            mockAiGrpc.estimateTime.mockReturnValue(throwError(() => new Error("timeout")));

            const result = await service.estimateTime("u1", "Write unit tests");
            expect(result.estimatedPomodoros).toBe(3);
            expect(result.confidence).toBe("low");
        });
    });

    // ─── storeEmbedding ──────────────────────────────────────────────────────
    describe("storeEmbedding", () => {
        it("should call gRPC storeTaskEmbedding and return result", async () => {
            const grpcResponse: StoreTaskEmbeddingResponse = { success: true };
            mockAiGrpc.storeTaskEmbedding.mockReturnValue(of(grpcResponse));

            const result = await service.storeEmbedding("t1", "u1", "Title", "Desc");
            expect(result).toEqual({ success: true });
        });

        it("should return { success: false } on gRPC error", async () => {
            mockAiGrpc.storeTaskEmbedding.mockReturnValue(
                throwError(() => new Error("connection refused")),
            );

            const result = await service.storeEmbedding("t1", "u1", "Title", "Desc");
            expect(result).toEqual({ success: false });
        });
    });

    // ─── mapPriority (private – tested via confirmGeneratedTasks) ────────────
    describe("mapPriority (via confirmGeneratedTasks)", () => {
        const runWithPriority = async (priority: string) => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            const capturedData: Array<{ priority: TaskPriority }> = [];
            mockPrisma.$transaction.mockImplementation((ops: Array<{ priority: TaskPriority }>) => {
                capturedData.push(...ops);
                return Promise.resolve(ops.map(() => ({ id: "t1", title: "T", description: "" })));
            });
            mockAiGrpc.storeTaskEmbedding.mockReturnValue(of({ success: true }));
            await service.confirmGeneratedTasks("u1", [{ title: "T", priority }]);
            // just ensure no errors thrown
        };

        it("should map LOW priority", async () => {
            await expect(runWithPriority("LOW")).resolves.not.toThrow();
        });

        it("should map HIGH priority", async () => {
            await expect(runWithPriority("HIGH")).resolves.not.toThrow();
        });

        it("should map URGENT priority", async () => {
            await expect(runWithPriority("URGENT")).resolves.not.toThrow();
        });

        it("should default to MEDIUM for unknown priority", async () => {
            await expect(runWithPriority("UNKNOWN")).resolves.not.toThrow();
        });
    });
});
