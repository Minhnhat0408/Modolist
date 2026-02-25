import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { TasksService } from "./tasks.service";
import { PrismaService } from "../prisma.service";
import { TaskStatus } from "@repo/database";
import type {
    FocusSessionPausedEvent,
    FocusSessionCompletedEvent,
} from "../focus-sessions/events/focus-session.events";

const mockPrisma = {
    task: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
};

const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
};

describe("TasksService", () => {
    let service: TasksService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TasksService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CACHE_MANAGER, useValue: mockCacheManager },
            ],
        }).compile();

        service = module.get<TasksService>(TasksService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    // ─── invalidateUserCache ────────────────────────────────────────────────────
    describe("invalidateUserCache", () => {
        it("should delete all cache keys for user", async () => {
            mockCacheManager.del.mockResolvedValue(undefined);
            await service.invalidateUserCache("user1");
            expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:user1:false");
            expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:user1:true");
            expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:user1");
            expect(mockCacheManager.del).toHaveBeenCalledWith("tasks:stats:user1");
        });
    });

    // ─── handleFocusSessionPaused ───────────────────────────────────────────────
    describe("handleFocusSessionPaused", () => {
        it("should invalidate cache when taskId is present", async () => {
            const spy = jest.spyOn(service, "invalidateUserCache").mockResolvedValue(undefined);
            const event: FocusSessionPausedEvent = { userId: "u1", sessionId: "s1", taskId: "t1" };
            await service.handleFocusSessionPaused(event);
            expect(spy).toHaveBeenCalledWith("u1");
        });

        it("should skip cache invalidation when taskId is null", async () => {
            const spy = jest.spyOn(service, "invalidateUserCache").mockResolvedValue(undefined);
            const event: FocusSessionPausedEvent = { userId: "u1", sessionId: "s1", taskId: null };
            await service.handleFocusSessionPaused(event);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ─── handleFocusSessionCompleted ────────────────────────────────────────────
    describe("handleFocusSessionCompleted", () => {
        it("should invalidate cache when taskId is present", async () => {
            const spy = jest.spyOn(service, "invalidateUserCache").mockResolvedValue(undefined);
            const event: FocusSessionCompletedEvent = {
                userId: "u1",
                sessionId: "s1",
                taskId: "t1",
            };
            await service.handleFocusSessionCompleted(event);
            expect(spy).toHaveBeenCalledWith("u1");
        });

        it("should skip when taskId is null", async () => {
            const spy = jest.spyOn(service, "invalidateUserCache").mockResolvedValue(undefined);
            const event: FocusSessionCompletedEvent = {
                userId: "u1",
                sessionId: "s1",
                taskId: null,
            };
            await service.handleFocusSessionCompleted(event);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ─── findAll ────────────────────────────────────────────────────────────────
    describe("findAll", () => {
        const tasks = [{ id: "t1", title: "Task 1" }];

        it("should return cached data on cache hit", async () => {
            mockCacheManager.get.mockResolvedValue(tasks);
            const result = await service.findAll("u1");
            expect(result).toEqual(tasks);
            expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
        });

        it("should query DB and cache result on cache miss", async () => {
            mockCacheManager.get.mockResolvedValue(null);
            mockPrisma.task.findMany.mockResolvedValue(tasks);
            const result = await service.findAll("u1");
            expect(result).toEqual(tasks);
            expect(mockPrisma.task.findMany).toHaveBeenCalled();
            expect(mockCacheManager.set).toHaveBeenCalledWith("tasks:u1:false", tasks, 30000);
        });

        it("should include all tasks when includeArchived=true", async () => {
            mockCacheManager.get.mockResolvedValue(null);
            mockPrisma.task.findMany.mockResolvedValue(tasks);
            await service.findAll("u1", true);
            const callArgs = mockPrisma.task.findMany.mock.calls[0][0] as {
                where: Record<string, unknown>;
            };
            expect(callArgs.where).not.toHaveProperty("isArchived");
        });

        it("should exclude archived by default (includeArchived=false)", async () => {
            mockCacheManager.get.mockResolvedValue(null);
            mockPrisma.task.findMany.mockResolvedValue(tasks);
            await service.findAll("u1", false);
            const callArgs = mockPrisma.task.findMany.mock.calls[0][0] as {
                where: Record<string, unknown>;
            };
            expect(callArgs.where).toHaveProperty("isArchived", false);
        });
    });

    // ─── findByStatus ───────────────────────────────────────────────────────────
    describe("findByStatus", () => {
        it("should query tasks filtered by status", async () => {
            const tasks = [{ id: "t1" }];
            mockPrisma.task.findMany.mockResolvedValue(tasks);
            const result = await service.findByStatus("u1", TaskStatus.TODAY);
            expect(result).toEqual(tasks);
            expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: "u1", status: TaskStatus.TODAY, isArchived: false },
                }),
            );
        });
    });

    // ─── findOne ────────────────────────────────────────────────────────────────
    describe("findOne", () => {
        it("should return task when found", async () => {
            const task = { id: "t1", title: "Task", focusSessions: [] };
            mockPrisma.task.findFirst.mockResolvedValue(task);
            const result = await service.findOne("t1", "u1");
            expect(result).toEqual(task);
        });

        it("should throw NotFoundException when task not found", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            await expect(service.findOne("t1", "u1")).rejects.toThrow(NotFoundException);
        });
    });

    // ─── create ─────────────────────────────────────────────────────────────────
    describe("create", () => {
        it("should create task with order = maxOrder + 1", async () => {
            mockPrisma.task.findFirst.mockResolvedValue({ order: 5 });
            const newTask = { id: "t1", title: "New Task", order: 6 };
            mockPrisma.task.create.mockResolvedValue(newTask);
            mockCacheManager.del.mockResolvedValue(undefined);

            const result = await service.create("u1", { title: "New Task" });
            expect(result).toEqual(newTask);
            expect(mockPrisma.task.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ order: 6, userId: "u1" }),
                }),
            );
        });

        it("should use order=1 when there are no existing tasks", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            mockPrisma.task.create.mockResolvedValue({ id: "t1", order: 1 });
            mockCacheManager.del.mockResolvedValue(undefined);

            await service.create("u1", { title: "First Task" });
            const createData = (
                mockPrisma.task.create.mock.calls[0][0] as { data: Record<string, unknown> }
            ).data;
            expect(createData.order).toBe(1);
        });

        it("should convert dueDate string to Date object", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            mockPrisma.task.create.mockResolvedValue({ id: "t1" });
            mockCacheManager.del.mockResolvedValue(undefined);

            await service.create("u1", { title: "Task", dueDate: "2026-01-15" });
            const createData = (
                mockPrisma.task.create.mock.calls[0][0] as { data: Record<string, unknown> }
            ).data;
            expect(createData.dueDate).toBeInstanceOf(Date);
        });

        it("should invalidate user cache after creation", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            mockPrisma.task.create.mockResolvedValue({ id: "t1" });
            mockCacheManager.del.mockResolvedValue(undefined);

            await service.create("u1", { title: "Task" });
            expect(mockCacheManager.del).toHaveBeenCalled();
        });
    });

    // ─── update ─────────────────────────────────────────────────────────────────
    describe("update", () => {
        const existingTask = { id: "t1", userId: "u1", focusSessions: [] };

        beforeEach(() => {
            mockPrisma.task.findFirst.mockResolvedValue(existingTask);
            mockCacheManager.del.mockResolvedValue(undefined);
        });

        it("should update task fields normally", async () => {
            const updated = { id: "t1", title: "Updated" };
            mockPrisma.task.update.mockResolvedValue(updated);
            const result = await service.update("t1", "u1", { title: "Updated" });
            expect(result).toEqual(updated);
        });

        it("should set completedAt when status changes to DONE", async () => {
            mockPrisma.task.update.mockResolvedValue({ id: "t1" });
            await service.update("t1", "u1", { status: TaskStatus.DONE });
            const updateData = (
                mockPrisma.task.update.mock.calls[0][0] as { data: Record<string, unknown> }
            ).data;
            expect(updateData.completedAt).toBeInstanceOf(Date);
        });

        it("should clear completedAt when status changes away from DONE", async () => {
            mockPrisma.task.update.mockResolvedValue({ id: "t1" });
            await service.update("t1", "u1", { status: TaskStatus.BACKLOG });
            const updateData = (
                mockPrisma.task.update.mock.calls[0][0] as { data: Record<string, unknown> }
            ).data;
            expect(updateData.completedAt).toBeNull();
        });

        it("should convert dueDate string to Date on update", async () => {
            mockPrisma.task.update.mockResolvedValue({ id: "t1" });
            await service.update("t1", "u1", { dueDate: "2026-03-01" });
            const updateData = (
                mockPrisma.task.update.mock.calls[0][0] as { data: Record<string, unknown> }
            ).data;
            expect(updateData.dueDate).toBeInstanceOf(Date);
        });

        it("should throw NotFoundException if task does not exist", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            await expect(service.update("t1", "u1", { title: "x" })).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // ─── remove ─────────────────────────────────────────────────────────────────
    describe("remove", () => {
        it("should delete task and invalidate cache", async () => {
            const task = { id: "t1", focusSessions: [] };
            mockPrisma.task.findFirst.mockResolvedValue(task);
            mockPrisma.task.delete.mockResolvedValue(task);
            mockCacheManager.del.mockResolvedValue(undefined);

            const result = await service.remove("t1", "u1");
            expect(result).toEqual(task);
            expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
        });

        it("should throw NotFoundException if task not found", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(null);
            await expect(service.remove("t1", "u1")).rejects.toThrow(NotFoundException);
        });
    });

    // ─── archive ────────────────────────────────────────────────────────────────
    describe("archive", () => {
        it("should set isArchived=true and invalidate cache", async () => {
            const task = { id: "t1", focusSessions: [] };
            const archived = { ...task, isArchived: true };
            mockPrisma.task.findFirst.mockResolvedValue(task);
            mockPrisma.task.update.mockResolvedValue(archived);
            mockCacheManager.del.mockResolvedValue(undefined);

            const result = await service.archive("t1", "u1");
            expect(result).toEqual(archived);
            expect(mockPrisma.task.update).toHaveBeenCalledWith({
                where: { id: "t1" },
                data: { isArchived: true },
            });
        });
    });

    // ─── getStats ───────────────────────────────────────────────────────────────
    describe("getStats", () => {
        it("should return correct aggregated stats", async () => {
            mockPrisma.task.count
                .mockResolvedValueOnce(10) // total
                .mockResolvedValueOnce(4) // backlog
                .mockResolvedValueOnce(3) // today
                .mockResolvedValueOnce(2) // done
                .mockResolvedValueOnce(1); // archived

            const result = await service.getStats("u1");
            expect(result).toEqual({ total: 10, backlog: 4, today: 3, done: 2, archived: 1 });
        });
    });

    // ─── updateOrder ────────────────────────────────────────────────────────────
    describe("updateOrder", () => {
        it("should reorder all tasks in the column", async () => {
            const task = { id: "t2", order: 1, focusSessions: [] };
            const columnTasks = [
                { id: "t1", order: 0 },
                { id: "t2", order: 1 },
                { id: "t3", order: 2 },
            ];
            mockPrisma.task.findFirst.mockResolvedValue(task);
            mockPrisma.task.findMany.mockResolvedValue(columnTasks);
            mockPrisma.task.update.mockResolvedValue({});
            mockCacheManager.del.mockResolvedValue(undefined);

            const result = await service.updateOrder("t2", "u1", 0, TaskStatus.TODAY);
            expect(result).toEqual({ success: true, message: "Task order updated" });
            expect(mockPrisma.task.update).toHaveBeenCalledTimes(3);
        });
    });
});
