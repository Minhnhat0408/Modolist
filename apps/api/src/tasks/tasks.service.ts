import { Injectable, NotFoundException, Inject, Optional, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskStatus, RecurrenceRule } from "@repo/database";
import { AIService } from "../ai/ai.service";
import {
    FOCUS_SESSION_EVENTS,
    FocusSessionPausedEvent,
    FocusSessionCompletedEvent,
} from "../focus-sessions/events/focus-session.events";

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Optional() private readonly aiService: AIService,
    ) {}

    public async invalidateUserCache(userId: string) {
        await this.cacheManager.del(`tasks:${userId}:false`);
        await this.cacheManager.del(`tasks:${userId}:true`);
        await this.cacheManager.del(`tasks:${userId}`);
        await this.cacheManager.del(`tasks:stats:${userId}`);
    }

    @OnEvent(FOCUS_SESSION_EVENTS.PAUSED)
    async handleFocusSessionPaused(payload: FocusSessionPausedEvent) {
        if (payload.taskId) {
            await this.invalidateUserCache(payload.userId);
        }
    }

    @OnEvent(FOCUS_SESSION_EVENTS.COMPLETED)
    async handleFocusSessionCompleted(payload: FocusSessionCompletedEvent) {
        if (payload.taskId) {
            await this.invalidateUserCache(payload.userId);
        }
    }

    private normalizeWeeklyDays(days: number[] | undefined, fallbackDate: Date | null): number[] {
        const filtered = (days ?? [])
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            .sort((a, b) => a - b);
        const unique = Array.from(new Set(filtered));
        if (unique.length > 0) return unique;

        // Default to dueDate's weekday (or today) when user does not provide custom weekdays
        return [(fallbackDate ?? new Date()).getDay()];
    }

    private normalizeMonthlyDay(day: number | undefined, fallbackDate: Date | null): number {
        if (typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 31) {
            return day;
        }
        return (fallbackDate ?? new Date()).getDate();
    }

    private normalizeRecurrenceConfig(
        recurrence: RecurrenceRule,
        recurrenceDaysOfWeek: number[] | undefined,
        recurrenceDayOfMonth: number | undefined,
        dueDate: Date | null,
    ) {
        if (recurrence === RecurrenceRule.WEEKLY) {
            return {
                recurrenceDaysOfWeek: this.normalizeWeeklyDays(recurrenceDaysOfWeek, dueDate),
                recurrenceDayOfMonth: null,
            };
        }

        if (recurrence === RecurrenceRule.MONTHLY) {
            return {
                recurrenceDaysOfWeek: [],
                recurrenceDayOfMonth: this.normalizeMonthlyDay(recurrenceDayOfMonth, dueDate),
            };
        }

        return {
            recurrenceDaysOfWeek: [],
            recurrenceDayOfMonth: null,
        };
    }

    // Lấy tất cả tasks của user
    async findAll(userId: string, includeArchived = false) {
        const cacheKey = `tasks:${userId}:${includeArchived}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const tasks = await this.prisma.task.findMany({
            where: {
                userId,
                ...(includeArchived ? {} : { isArchived: false }),
            },
            orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "desc" }],
            include: {
                focusSessions: {
                    where: { status: "COMPLETED" },
                    select: {
                        id: true,
                        duration: true,
                        endedAt: true,
                        plannedDuration: true,
                        startedAt: true,
                        status: true,
                    },
                    orderBy: { startedAt: "asc" },
                },
            },
        });

        await this.cacheManager.set(cacheKey, tasks, 30000); // Cache 30s
        return tasks;
    }

    // Lấy tasks theo status
    async findByStatus(userId: string, status: TaskStatus) {
        return await this.prisma.task.findMany({
            where: {
                userId,
                status,
                isArchived: false,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    // Lấy task theo ID
    async findOne(id: string, userId: string) {
        const task = await this.prisma.task.findFirst({
            where: {
                id,
                userId,
            },
            include: {
                focusSessions: true,
            },
        });

        if (!task) {
            throw new NotFoundException(`Task với ID ${id} không tồn tại`);
        }

        return task;
    }

    // Tạo task mới
    async create(userId: string, createTaskDto: CreateTaskDto) {
        const targetStatus = createTaskDto.status || TaskStatus.BACKLOG;
        const dueDate = createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : null;
        const recurrence = createTaskDto.recurrence ?? RecurrenceRule.NONE;
        const recurrenceConfig = this.normalizeRecurrenceConfig(
            recurrence,
            createTaskDto.recurrenceDaysOfWeek,
            createTaskDto.recurrenceDayOfMonth,
            dueDate,
        );

        // Shift all existing tasks in the column up by 1 to make room at top
        await this.prisma.task.updateMany({
            where: { userId, status: targetStatus },
            data: { order: { increment: 1 } },
        });

        const task = await this.prisma.task.create({
            data: {
                ...createTaskDto,
                ...recurrenceConfig,
                userId,
                order: 0,
                dueDate,
            },
        });

        await this.invalidateUserCache(userId);

        // Store embedding in background so RAG has data for future estimates
        if (this.aiService) {
            this.aiService
                .storeEmbedding(task.id, userId, task.title, task.description ?? "")
                .catch((err: unknown) =>
                    this.logger.warn(
                        `⚠️ Embedding store failed for task ${task.id}: ${(err as Error).message}`,
                    ),
                );
        }

        return task;
    }

    // Batch create tasks (guest migration)
    async createBatch(userId: string, tasks: CreateTaskDto[]) {
        const created = await this.prisma.$transaction(
            tasks.map((dto) => {
                const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
                const recurrence = dto.recurrence ?? RecurrenceRule.NONE;
                const recurrenceConfig = this.normalizeRecurrenceConfig(
                    recurrence,
                    dto.recurrenceDaysOfWeek,
                    dto.recurrenceDayOfMonth,
                    dueDate,
                );

                return this.prisma.task.create({
                    data: {
                        ...dto,
                        ...recurrenceConfig,
                        userId,
                        order: 0,
                        dueDate,
                    },
                });
            }),
        );

        await this.invalidateUserCache(userId);
        return { created: created.length };
    }

    // Cập nhật task
    async update(id: string, userId: string, updateTaskDto: UpdateTaskDto) {
        // Kiểm tra task tồn tại — throws NotFoundException nếu không tìm thấy
        const existing = await this.findOne(id, userId);

        const updateData: Record<string, any> = { ...updateTaskDto };

        // Xử lý dueDate
        if (updateTaskDto.dueDate) {
            updateData.dueDate = new Date(updateTaskDto.dueDate);
        }

        const effectiveDueDate =
            (updateData.dueDate as Date | undefined) ?? existing.dueDate ?? null;
        const effectiveRecurrence =
            updateTaskDto.recurrence ?? existing.recurrence ?? RecurrenceRule.NONE;
        const effectiveWeeklyDays =
            updateTaskDto.recurrenceDaysOfWeek ??
            (existing.recurrenceDaysOfWeek as number[] | undefined);
        const effectiveMonthlyDay =
            updateTaskDto.recurrenceDayOfMonth ??
            (existing.recurrenceDayOfMonth as number | undefined);

        Object.assign(
            updateData,
            this.normalizeRecurrenceConfig(
                effectiveRecurrence,
                effectiveWeeklyDays,
                effectiveMonthlyDay,
                effectiveDueDate,
            ),
        );

        // Tự động set completedAt khi status = DONE
        if (updateTaskDto.status === TaskStatus.DONE) {
            updateData.completedAt = new Date();
        } else if (updateTaskDto.status) {
            updateData.completedAt = null;
        }

        const task = await this.prisma.task.update({
            where: { id },
            data: updateData,
        });

        await this.invalidateUserCache(userId);

        // Re-index embedding only when title or description actually changed
        const titleChanged =
            updateTaskDto.title !== undefined && updateTaskDto.title !== existing.title;
        const descChanged =
            updateTaskDto.description !== undefined &&
            (updateTaskDto.description ?? "") !== (existing.description ?? "");

        if (this.aiService && (titleChanged || descChanged)) {
            this.aiService
                .storeEmbedding(task.id, userId, task.title, task.description ?? "")
                .catch((err: unknown) =>
                    this.logger.warn(
                        `⚠️ Re-embedding failed for task ${task.id}: ${(err as Error).message}`,
                    ),
                );
        }

        // Auto-spawn next recurring instance when marked DONE
        let spawnedTask: Awaited<ReturnType<typeof this.spawnRecurring>> | null = null;
        if (
            updateTaskDto.status === TaskStatus.DONE &&
            existing.recurrence &&
            existing.recurrence !== RecurrenceRule.NONE
        ) {
            spawnedTask = await this.spawnRecurring(existing);
        }

        return { ...task, spawnedTask };
    }

    // Tính ngày tiếp theo cho recurring task
    private getNextDueDate(
        current: Date | null,
        rule: RecurrenceRule,
        weeklyDays: number[] = [],
        monthDay: number | null = null,
    ): Date {
        const base = current ? new Date(current) : new Date();
        switch (rule) {
            case RecurrenceRule.DAILY:
                base.setDate(base.getDate() + 1);
                return base;
            case RecurrenceRule.WEEKDAY: {
                base.setDate(base.getDate() + 1);
                // Skip weekend
                while (base.getDay() === 0 || base.getDay() === 6) {
                    base.setDate(base.getDate() + 1);
                }
                return base;
            }
            case RecurrenceRule.WEEKLY: {
                const normalized = this.normalizeWeeklyDays(weeklyDays, base);
                let minDelta = 7;

                for (const day of normalized) {
                    let delta = (day - base.getDay() + 7) % 7;
                    if (delta === 0) delta = 7;
                    if (delta < minDelta) minDelta = delta;
                }

                base.setDate(base.getDate() + minDelta);
                return base;
            }
            case RecurrenceRule.MONTHLY: {
                const desiredDay = this.normalizeMonthlyDay(monthDay ?? undefined, base);
                const currentMonth = base.getMonth();
                const currentYear = base.getFullYear();
                const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
                const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
                const clampedDay = Math.min(desiredDay, daysInNextMonth);

                return new Date(
                    nextYear,
                    nextMonth,
                    clampedDay,
                    base.getHours(),
                    base.getMinutes(),
                    base.getSeconds(),
                    base.getMilliseconds(),
                );
            }
            default:
                base.setDate(base.getDate() + 1);
                return base;
        }
    }

    // Tạo bản sao recurring task mới
    private async spawnRecurring(original: {
        id: string;
        title: string;
        description: string | null;
        priority: any;
        tags: string[];
        estimatedPomodoros: number | null;
        suggestedSessionType: string | null;
        suggestedSessions: number | null;
        suggestedTotalMinutes: number | null;
        recurrence: RecurrenceRule;
        recurrenceDaysOfWeek: number[];
        recurrenceDayOfMonth: number | null;
        dueDate: Date | null;
        userId: string;
    }) {
        const nextDue = this.getNextDueDate(
            original.dueDate,
            original.recurrence,
            original.recurrenceDaysOfWeek,
            original.recurrenceDayOfMonth,
        );

        const task = await this.prisma.task.create({
            data: {
                title: original.title,
                description: original.description,
                status: TaskStatus.BACKLOG,
                priority: original.priority,
                tags: original.tags,
                estimatedPomodoros: original.estimatedPomodoros,
                suggestedSessionType: original.suggestedSessionType,
                suggestedSessions: original.suggestedSessions,
                suggestedTotalMinutes: original.suggestedTotalMinutes,
                recurrence: original.recurrence,
                recurrenceDaysOfWeek: original.recurrenceDaysOfWeek,
                recurrenceDayOfMonth: original.recurrenceDayOfMonth,
                dueDate: nextDue,
                userId: original.userId,
                order: 0,
            },
        });

        await this.invalidateUserCache(original.userId);
        this.logger.log(
            `🔁 Spawned recurring task "${task.title}" → due ${nextDue.toISOString().split("T")[0]}`,
        );
        return task;
    }

    // Nhân bản task vào TODAY
    async duplicate(id: string, userId: string) {
        const original = await this.findOne(id, userId);

        // Shift existing TODAY tasks up
        await this.prisma.task.updateMany({
            where: { userId, status: TaskStatus.TODAY },
            data: { order: { increment: 1 } },
        });

        const task = await this.prisma.task.create({
            data: {
                title: original.title,
                description: original.description,
                status: TaskStatus.TODAY,
                priority: original.priority,
                tags: original.tags,
                estimatedPomodoros: original.estimatedPomodoros,
                suggestedSessionType: original.suggestedSessionType,
                suggestedSessions: original.suggestedSessions,
                suggestedTotalMinutes: original.suggestedTotalMinutes,
                recurrence: original.recurrence,
                recurrenceDaysOfWeek: original.recurrenceDaysOfWeek,
                recurrenceDayOfMonth: original.recurrenceDayOfMonth,
                dueDate: null, // TODAY task — no due date needed
                userId,
                order: 0,
            },
        });

        await this.invalidateUserCache(userId);
        return task;
    }

    // Xóa task
    async remove(id: string, userId: string) {
        // Kiểm tra task tồn tại
        await this.findOne(id, userId);

        const task = await this.prisma.task.delete({
            where: { id },
        });

        await this.invalidateUserCache(userId);
        return task;
    }

    // Archive task thay vì xóa
    async archive(id: string, userId: string) {
        await this.findOne(id, userId);

        const task = await this.prisma.task.update({
            where: { id },
            data: { isArchived: true },
        });

        await this.invalidateUserCache(userId);
        return task;
    }

    // Thống kê tasks của user
    async getStats(userId: string) {
        const [total, backlog, today, done, archived] = await Promise.all([
            this.prisma.task.count({ where: { userId, isArchived: false } }),
            this.prisma.task.count({
                where: { userId, status: TaskStatus.BACKLOG, isArchived: false },
            }),
            this.prisma.task.count({
                where: { userId, status: TaskStatus.TODAY, isArchived: false },
            }),
            this.prisma.task.count({
                where: { userId, status: TaskStatus.DONE, isArchived: false },
            }),
            this.prisma.task.count({ where: { userId, isArchived: true } }),
        ]);

        return {
            total,
            backlog,
            today,
            done,
            archived,
        };
    }

    // Cập nhật thứ tự task (reordering)
    async updateOrder(id: string, userId: string, newOrder: number, status: TaskStatus) {
        // Verify task exists and belongs to user
        const task = await this.findOne(id, userId);

        // Get all tasks in the same column
        const columnTasks = await this.prisma.task.findMany({
            where: {
                userId,
                status,
                isArchived: false,
            },
            orderBy: { order: "asc" },
        });

        // Remove the task being moved from the list
        const otherTasks = columnTasks.filter((t) => t.id !== id);

        // Insert at new position
        otherTasks.splice(newOrder, 0, task);

        // Update order for all tasks in this column
        const updatePromises = otherTasks.map((t, index) =>
            this.prisma.task.update({
                where: { id: t.id },
                data: { order: index },
            }),
        );

        await Promise.all(updatePromises);
        await this.invalidateUserCache(userId);

        return { success: true, message: "Task order updated" };
    }
}
