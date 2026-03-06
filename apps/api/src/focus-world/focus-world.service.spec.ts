import { Test, TestingModule } from "@nestjs/testing";
import { FocusSessionStatus } from "@repo/database";
import { FocusWorldService } from "./focus-world.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
    focusSession: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    task: {
        findUnique: jest.fn(),
    },
};

describe("FocusWorldService", () => {
    let service: FocusWorldService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [FocusWorldService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<FocusWorldService>(FocusWorldService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    // ─── validateSession ────────────────────────────────────────────────────
    describe("validateSession", () => {
        it("should return session when valid IN_PROGRESS session exists", async () => {
            const session = {
                id: "s1",
                startedAt: new Date(),
                plannedDuration: 1500,
                elapsedTime: 0,
                taskId: "t1",
            };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);

            const result = await service.validateSession("s1", "u1");
            expect(result).toEqual(session);
            expect(mockPrisma.focusSession.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: "s1",
                        userId: "u1",
                        status: { in: [FocusSessionStatus.IN_PROGRESS, FocusSessionStatus.PAUSED] },
                    },
                }),
            );
        });

        it("should return PAUSED session", async () => {
            const session = {
                id: "s1",
                startedAt: new Date(),
                plannedDuration: 1500,
                elapsedTime: 200,
                taskId: null,
            };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            const result = await service.validateSession("s1", "u1");
            expect(result).toEqual(session);
        });

        it("should return null when session not found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            const result = await service.validateSession("s1", "u1");
            expect(result).toBeNull();
        });

        it("should return null on database error", async () => {
            mockPrisma.focusSession.findFirst.mockRejectedValue(new Error("DB error"));
            const result = await service.validateSession("s1", "u1");
            expect(result).toBeNull();
        });
    });

    // ─── getUserInfo ────────────────────────────────────────────────────────
    describe("getUserInfo", () => {
        it("should return user info when user exists", async () => {
            const user = { id: "u1", name: "Alice", image: "img.png" };
            mockPrisma.user.findUnique.mockResolvedValue(user);

            const result = await service.getUserInfo("u1");
            expect(result).toEqual(user);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "u1" } }),
            );
        });

        it("should return null when user not found", async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            const result = await service.getUserInfo("u1");
            expect(result).toBeNull();
        });

        it("should return null on database error", async () => {
            mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
            const result = await service.getUserInfo("u1");
            expect(result).toBeNull();
        });
    });

    // ─── getTaskInfo ────────────────────────────────────────────────────────
    describe("getTaskInfo", () => {
        it("should return task info when task exists", async () => {
            const task = { id: "t1", title: "Write tests" };
            mockPrisma.task.findUnique.mockResolvedValue(task);

            const result = await service.getTaskInfo("t1");
            expect(result).toEqual(task);
        });

        it("should return null when task not found", async () => {
            mockPrisma.task.findUnique.mockResolvedValue(null);
            const result = await service.getTaskInfo("t1");
            expect(result).toBeNull();
        });

        it("should return null on database error", async () => {
            mockPrisma.task.findUnique.mockRejectedValue(new Error("DB error"));
            const result = await service.getTaskInfo("t1");
            expect(result).toBeNull();
        });
    });

    // ─── handleDisconnect ───────────────────────────────────────────────────
    describe("handleDisconnect", () => {
        it("should set session to PAUSED with elapsedTime when IN_PROGRESS", async () => {
            mockPrisma.focusSession.findUnique.mockResolvedValue({
                status: FocusSessionStatus.IN_PROGRESS,
            });
            mockPrisma.focusSession.update.mockResolvedValue({});

            await service.handleDisconnect("s1", 300);
            expect(mockPrisma.focusSession.update).toHaveBeenCalledWith({
                where: { id: "s1" },
                data: { status: FocusSessionStatus.PAUSED, elapsedTime: 300 },
            });
        });

        it("should not update session when it is already COMPLETED", async () => {
            mockPrisma.focusSession.findUnique.mockResolvedValue({
                status: FocusSessionStatus.COMPLETED,
            });
            await service.handleDisconnect("s1", 300);
            expect(mockPrisma.focusSession.update).not.toHaveBeenCalled();
        });

        it("should not throw when session not found", async () => {
            mockPrisma.focusSession.findUnique.mockResolvedValue(null);
            await expect(service.handleDisconnect("s1", 300)).resolves.not.toThrow();
        });

        it("should not throw on database error", async () => {
            mockPrisma.focusSession.findUnique.mockRejectedValue(new Error("DB error"));
            await expect(service.handleDisconnect("s1", 300)).resolves.not.toThrow();
        });
    });
});
