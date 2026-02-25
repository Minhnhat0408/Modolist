import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FocusSessionStatus } from "@repo/database";
import { FocusSessionsService } from "./focus-sessions.service";
import { PrismaService } from "../prisma.service";
import { FOCUS_SESSION_EVENTS } from "./events/focus-session.events";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockTx = {
    focusSession: { update: jest.fn() },
    task: { update: jest.fn() },
    user: { update: jest.fn() },
    dailyStats: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
};

const mockPrisma = {
    focusSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    },
    task: { update: jest.fn() },
    user: {
        update: jest.fn(),
        findUnique: jest.fn(),
    },
    dailyStats: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
};

const mockEventEmitter = { emit: jest.fn() };

describe("FocusSessionsService", () => {
    let service: FocusSessionsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FocusSessionsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<FocusSessionsService>(FocusSessionsService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    // ─── startSession ────────────────────────────────────────────────────────
    describe("startSession", () => {
        it("should create and return a new focus session", async () => {
            const session = { id: "s1", userId: "u1", taskId: "t1", status: "IN_PROGRESS" };
            mockPrisma.focusSession.create.mockResolvedValue(session);

            const result = await service.startSession("u1", "t1", 1500);
            expect(result).toEqual(session);
            expect(mockPrisma.focusSession.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: "u1",
                        taskId: "t1",
                        plannedDuration: 1500,
                        status: "IN_PROGRESS",
                    }),
                }),
            );
        });

        it("should allow null taskId", async () => {
            const session = { id: "s1", userId: "u1", taskId: null };
            mockPrisma.focusSession.create.mockResolvedValue(session);
            const result = await service.startSession("u1", null, 1500);
            expect(result.taskId).toBeNull();
        });
    });

    // ─── completeSession ─────────────────────────────────────────────────────
    describe("completeSession", () => {
        const session = { id: "s1", userId: "u1", taskId: "t1", startedAt: new Date() };
        const updatedSession = { ...session, status: "COMPLETED", duration: 1500 };

        beforeEach(() => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockTx.focusSession.update.mockResolvedValue(updatedSession);
            mockTx.task.update.mockResolvedValue({});
            mockTx.user.update.mockResolvedValue({});
            mockTx.dailyStats.upsert.mockResolvedValue({});
        });

        it("should complete session and emit event", async () => {
            const result = await service.completeSession("s1", "u1", 1500);
            expect(result).toEqual(updatedSession);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                FOCUS_SESSION_EVENTS.COMPLETED,
                expect.objectContaining({ userId: "u1", sessionId: "s1", taskId: "t1" }),
            );
        });

        it("should throw NotFoundException when session not found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            await expect(service.completeSession("s1", "u1", 1500)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ─── create ──────────────────────────────────────────────────────────────
    describe("create", () => {
        it("should create a non-completed session without updating stats", async () => {
            const session = { id: "s1", status: "IN_PROGRESS", task: undefined };
            mockPrisma.focusSession.create.mockResolvedValue(session);

            const result = await service.create("u1", {
                plannedDuration: 1500,
                taskId: undefined,
                status: "IN_PROGRESS",
            });
            expect(result).toEqual(session);
            expect(mockPrisma.task.update).not.toHaveBeenCalled();
        });

        it("should update task pomodoros when session is created as COMPLETED", async () => {
            const session = { id: "s1", status: "COMPLETED", taskId: "t1", task: {} };
            mockPrisma.focusSession.create.mockResolvedValue(session);
            mockPrisma.task.update.mockResolvedValue({});
            mockPrisma.user.update.mockResolvedValue({});
            mockPrisma.dailyStats.findFirst.mockResolvedValue(undefined);
            mockPrisma.dailyStats.create.mockResolvedValue({});

            const result = await service.create("u1", {
                plannedDuration: 1500,
                duration: 1500,
                taskId: "t1",
                status: "COMPLETED",
            });
            expect(result).toEqual(session);
            expect(mockPrisma.task.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "t1" } }),
            );
        });
    });

    // ─── findAll ─────────────────────────────────────────────────────────────
    describe("findAll", () => {
        it("should return all sessions for user ordered by startedAt desc", async () => {
            const sessions = [{ id: "s1" }, { id: "s2" }];
            mockPrisma.focusSession.findMany.mockResolvedValue(sessions);
            const result = await service.findAll("u1");
            expect(result).toEqual(sessions);
            expect(mockPrisma.focusSession.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { userId: "u1" } }),
            );
        });
    });

    // ─── findOne ─────────────────────────────────────────────────────────────
    describe("findOne", () => {
        it("should return session when found", async () => {
            const session = { id: "s1", task: null };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            const result = await service.findOne("s1", "u1");
            expect(result).toEqual(session);
        });

        it("should throw NotFoundException when session not found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            await expect(service.findOne("s1", "u1")).rejects.toThrow(NotFoundException);
        });
    });

    // ─── update ──────────────────────────────────────────────────────────────
    describe("update", () => {
        it("should update and return session", async () => {
            const session = {
                id: "s1",
                task: null,
                taskId: null,
                duration: 1000,
                plannedDuration: 1500,
            };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockPrisma.focusSession.update.mockResolvedValue({ ...session, status: "PAUSED" });

            const result = await service.update("s1", "u1", { status: "PAUSED" });
            expect(result.status).toBe("PAUSED");
        });

        it("should update task pomodoros when updated to COMPLETED with taskId", async () => {
            const session = {
                id: "s1",
                task: null,
                taskId: "t1",
                duration: 1000,
                plannedDuration: 1500,
            };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockPrisma.focusSession.update.mockResolvedValue({
                ...session,
                status: "COMPLETED",
                taskId: "t1",
            });
            mockPrisma.task.update.mockResolvedValue({});
            mockPrisma.user.update.mockResolvedValue({});
            mockPrisma.dailyStats.findFirst.mockResolvedValue(null);
            mockPrisma.dailyStats.create.mockResolvedValue({});

            await service.update("s1", "u1", { status: "COMPLETED", duration: 1000 });
            expect(mockPrisma.task.update).toHaveBeenCalled();
        });

        it("should throw NotFoundException when session not found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            await expect(service.update("s1", "u1", { status: "PAUSED" })).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ─── remove ──────────────────────────────────────────────────────────────
    describe("remove", () => {
        it("should delete session", async () => {
            const session = { id: "s1", task: null };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockPrisma.focusSession.delete.mockResolvedValue(session);

            const result = await service.remove("s1", "u1");
            expect(result).toEqual(session);
        });

        it("should throw NotFoundException when session not found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            await expect(service.remove("s1", "u1")).rejects.toThrow(NotFoundException);
        });
    });

    // ─── getStats ────────────────────────────────────────────────────────────
    describe("getStats", () => {
        it("should calculate stats from completed sessions", async () => {
            const now = new Date();
            const sessions = [
                { id: "s1", duration: 1500, startedAt: now, status: "COMPLETED" },
                { id: "s2", duration: 3000, startedAt: now, status: "COMPLETED" },
            ];
            mockPrisma.focusSession.findMany.mockResolvedValue(sessions);

            const result = await service.getStats("u1");
            expect(result.totalSessions).toBe(2);
            expect(result.totalFocusTime).toBe(4500);
            expect(result.averageSessionDuration).toBe(2250);
        });

        it("should return 0 averageSessionDuration when no sessions", async () => {
            mockPrisma.focusSession.findMany.mockResolvedValue([]);
            const result = await service.getStats("u1");
            expect(result.averageSessionDuration).toBe(0);
        });
    });

    // ─── getDashboardStats ───────────────────────────────────────────────────
    describe("getDashboardStats", () => {
        it("should return dashboard stats structure", async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                totalFocusTime: 10000,
                currentStreak: 5,
                longestStreak: 10,
            });
            mockPrisma.dailyStats.findMany.mockResolvedValue([]);
            mockPrisma.focusSession.count.mockResolvedValue(20);
            mockPrisma.task = {
                ...mockPrisma.task,
                count: jest.fn().mockResolvedValue(8),
            } as typeof mockPrisma.task;

            const result = await service.getDashboardStats("u1");
            expect(result).toHaveProperty("user");
            expect(result).toHaveProperty("today");
            expect(result).toHaveProperty("week");
            expect(result).toHaveProperty("totals");
            expect(result.user.totalFocusTime).toBe(10000);
            expect(result.week.data).toHaveLength(7);
        });

        it("should return defaults when user not found", async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.dailyStats.findMany.mockResolvedValue([]);
            mockPrisma.focusSession.count.mockResolvedValue(0);
            mockPrisma.task = {
                ...mockPrisma.task,
                count: jest.fn().mockResolvedValue(0),
            } as typeof mockPrisma.task;

            const result = await service.getDashboardStats("u1");
            expect(result.user.totalFocusTime).toBe(0);
            expect(result.user.currentStreak).toBe(0);
        });
    });

    // ─── pauseSession ────────────────────────────────────────────────────────
    describe("pauseSession", () => {
        it("should pause session with provided elapsed time", async () => {
            const session = { id: "s1", userId: "u1", taskId: null, startedAt: new Date() };
            const paused = { ...session, status: FocusSessionStatus.PAUSED, elapsedTime: 300 };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockPrisma.focusSession.update.mockResolvedValue(paused);

            const result = await service.pauseSession("s1", "u1", 300);
            expect(result.status).toBe(FocusSessionStatus.PAUSED);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                FOCUS_SESSION_EVENTS.PAUSED,
                expect.objectContaining({ userId: "u1", sessionId: "s1" }),
            );
        });

        it("should calculate elapsed time from startedAt when not provided", async () => {
            const startedAt = new Date(Date.now() - 600_000); // 10 minutes ago
            const session = { id: "s1", userId: "u1", taskId: null, startedAt };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockPrisma.focusSession.update.mockResolvedValue({ ...session, status: "PAUSED" });

            await service.pauseSession("s1", "u1");
            const updateCall = mockPrisma.focusSession.update.mock.calls[0][0] as {
                data: { elapsedTime: number };
            };
            expect(updateCall.data.elapsedTime).toBeGreaterThanOrEqual(590);
        });

        it("should throw NotFoundException when session not found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            await expect(service.pauseSession("s1", "u1", 300)).rejects.toThrow(NotFoundException);
        });
    });

    // ─── resumeSession ───────────────────────────────────────────────────────
    describe("resumeSession", () => {
        it("should resume a paused session", async () => {
            const session = { id: "s1", elapsedTime: 300 };
            const resumed = { id: "s1", status: "IN_PROGRESS", task: null };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            mockPrisma.focusSession.update.mockResolvedValue(resumed);

            const result = await service.resumeSession("s1", "u1");
            expect(result.status).toBe("IN_PROGRESS");
            const updateData = (
                mockPrisma.focusSession.update.mock.calls[0][0] as {
                    data: { startedAt: Date; status: string };
                }
            ).data;
            expect(updateData.status).toBe("IN_PROGRESS");
            expect(updateData.startedAt).toBeInstanceOf(Date);
        });

        it("should throw NotFoundException when no paused session found", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            await expect(service.resumeSession("s1", "u1")).rejects.toThrow(NotFoundException);
        });
    });

    // ─── getCurrentSession ───────────────────────────────────────────────────
    describe("getCurrentSession", () => {
        it("should return IN_PROGRESS session immediately", async () => {
            const activeSession = { id: "s1", status: "IN_PROGRESS", task: null };
            mockPrisma.focusSession.findFirst.mockResolvedValueOnce(activeSession); // IN_PROGRESS query

            const result = await service.getCurrentSession("u1");
            expect(result).toEqual({ session: activeSession, canResume: true });
        });

        it("should return PAUSED session within grace period", async () => {
            const pausedTime = new Date(Date.now() - 60_000); // 1 minute ago
            const pausedSession = {
                id: "s1",
                status: "PAUSED",
                elapsedTime: 200,
                updatedAt: pausedTime,
                task: null,
                plannedDuration: 1500,
            };
            mockPrisma.focusSession.findFirst
                .mockResolvedValueOnce(null) // no IN_PROGRESS
                .mockResolvedValueOnce(pausedSession); // PAUSED

            const result = await service.getCurrentSession("u1");
            expect(result).toEqual({ session: pausedSession, canResume: true });
        });

        it("should mark PAUSED session as INTERRUPTED after grace period", async () => {
            const expiredTime = new Date(Date.now() - 10 * 60_000); // 10 minutes ago
            const pausedSession = {
                id: "s1",
                status: "PAUSED",
                elapsedTime: 300,
                updatedAt: expiredTime,
                task: null,
                plannedDuration: 1500,
            };
            mockPrisma.focusSession.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(pausedSession);
            mockPrisma.focusSession.update.mockResolvedValue({});

            const result = await service.getCurrentSession("u1");
            expect(result).toEqual({ session: null, canResume: false });
            expect(mockPrisma.focusSession.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: "INTERRUPTED" }),
                }),
            );
        });

        it("should return null when no sessions exist", async () => {
            mockPrisma.focusSession.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            const result = await service.getCurrentSession("u1");
            expect(result).toEqual({ session: null, canResume: false });
        });
    });

    // ─── getIncompleteSession ────────────────────────────────────────────────
    describe("getIncompleteSession", () => {
        it("should return incomplete session for task", async () => {
            const session = { id: "s1", status: "IN_PROGRESS" };
            mockPrisma.focusSession.findFirst.mockResolvedValue(session);
            const result = await service.getIncompleteSession("u1", "t1");
            expect(result).toEqual({ session });
        });

        it("should return null session when taskId is falsy", async () => {
            const result = await service.getIncompleteSession("u1", "");
            expect(result).toEqual({ session: null });
        });

        it("should return null when no incomplete session exists", async () => {
            mockPrisma.focusSession.findFirst.mockResolvedValue(null);
            const result = await service.getIncompleteSession("u1", "t1");
            expect(result).toEqual({ session: null });
        });
    });
});
