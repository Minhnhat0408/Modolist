import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FocusSessionStatus } from "@repo/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFocusSessionDto } from "./dto/create-focus-session.dto";
import { UpdateFocusSessionDto } from "./dto/update-focus-session.dto";
import {
    FOCUS_SESSION_EVENTS,
    FocusSessionPausedEvent,
    FocusSessionCompletedEvent,
} from "./events/focus-session.events";

@Injectable()
export class FocusSessionsService {
    constructor(
        private prisma: PrismaService,
        private eventEmitter: EventEmitter2,
    ) {}

    async startSession(userId: string, taskId: string | null, plannedDuration: number) {
        const session = await this.prisma.focusSession.create({
            data: {
                userId,
                taskId,
                plannedDuration,
                status: "IN_PROGRESS",
                startedAt: new Date(),
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
            },
        });

        return session;
    }

    async completeSession(sessionId: string, userId: string, actualDuration: number) {
        const session = await this.prisma.focusSession.findFirst({
            where: { id: sessionId, userId },
        });

        if (!session) {
            throw new NotFoundException(`Focus session với ID ${sessionId} không tồn tại`);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
        const result = await this.prisma.$transaction(async (tx: any) => {
            const updatedSession = await tx.focusSession.update({
                where: { id: sessionId },
                data: {
                    status: "COMPLETED",
                    duration: actualDuration,
                    endedAt: new Date(),
                },
                include: {
                    task: true,
                },
            });

            if (session.taskId) {
                await tx.task.update({
                    where: { id: session.taskId },
                    data: {
                        completedPomodoros: { increment: 1 },
                        focusCompletedSessions: { increment: 1 },
                    },
                });
            }

            await tx.user.update({
                where: { id: userId },
                data: {
                    totalFocusTime: { increment: actualDuration },
                },
            });

            await tx.dailyStats.upsert({
                where: {
                    userId_date: {
                        userId,
                        date: today,
                    },
                },
                update: {
                    totalFocusTime: { increment: actualDuration },
                    completedPomodoros: { increment: 1 },
                },
                create: {
                    userId,
                    date: today,
                    totalFocusTime: actualDuration,
                    completedPomodoros: 1,
                    completedTasks: 0,
                },
            });

            return updatedSession;
        });

        this.eventEmitter.emit(FOCUS_SESSION_EVENTS.COMPLETED, {
            userId,
            sessionId,
            taskId: session.taskId,
        } as FocusSessionCompletedEvent);

        return result;
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    }

    async create(userId: string, createDto: CreateFocusSessionDto) {
        const session = await this.prisma.focusSession.create({
            data: {
                userId,
                taskId: createDto.taskId,
                plannedDuration: createDto.plannedDuration,
                duration: createDto.duration,
                status: createDto.status || "IN_PROGRESS",
                breakDuration: createDto.breakDuration,
                startedAt: new Date(),
                endedAt: createDto.status === "COMPLETED" ? new Date() : null,
            },
            include: {
                task: true,
            },
        });

        if (createDto.status === "COMPLETED" && createDto.taskId) {
            await this.prisma.task.update({
                where: { id: createDto.taskId },
                data: {
                    completedPomodoros: {
                        increment: 1,
                    },
                },
            });

            await this.updateUserStats(userId, createDto.duration || createDto.plannedDuration);
        }

        return session;
    }

    async findAll(userId: string) {
        return await this.prisma.focusSession.findMany({
            where: { userId },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                startedAt: "desc",
            },
        });
    }

    async findOne(id: string, userId: string) {
        const session = await this.prisma.focusSession.findFirst({
            where: {
                id,
                userId,
            },
            include: {
                task: true,
            },
        });

        if (!session) {
            throw new NotFoundException(`Focus session với ID ${id} không tồn tại`);
        }

        return session;
    }

    async update(id: string, userId: string, updateDto: UpdateFocusSessionDto) {
        await this.findOne(id, userId);

        const session = await this.prisma.focusSession.update({
            where: { id },
            data: {
                duration: updateDto.duration,
                status: updateDto.status,
                breakDuration: updateDto.breakDuration,
                endedAt: updateDto.status === "COMPLETED" ? new Date() : null,
            },
            include: {
                task: true,
            },
        });

        if (updateDto.status === "COMPLETED" && session.taskId) {
            await this.prisma.task.update({
                where: { id: session.taskId },
                data: {
                    completedPomodoros: {
                        increment: 1,
                    },
                },
            });

            await this.updateUserStats(
                userId,
                updateDto.duration || session.duration || session.plannedDuration,
            );
        }

        return session;
    }

    async remove(id: string, userId: string) {
        await this.findOne(id, userId);

        return await this.prisma.focusSession.delete({
            where: { id },
        });
    }

    async getStats(userId: string) {
        const sessions = await this.prisma.focusSession.findMany({
            where: {
                userId,
                status: "COMPLETED",
            },
        });

        const totalSessions = sessions.length;
        const totalFocusTime = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
        const averageSessionDuration = totalSessions > 0 ? totalFocusTime / totalSessions : 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySessions = sessions.filter((s) => s.startedAt >= today);

        const todayFocusTime = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);

        return {
            totalSessions,
            totalFocusTime,
            averageSessionDuration,
            todayFocusTime,
            todaySessions: todaySessions.length,
        };
    }

    /**
     * Dashboard stats: last 7 days of daily data, streaks, totals.
     */
    async getDashboardStats(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                totalFocusTime: true,
                currentStreak: true,
                longestStreak: true,
            },
        });

        // Last 7 days
        const days: { date: Date; label: string }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
            days.push({ date: d, label: dayNames[d.getDay()] });
        }

        const weekStart = days[0].date;
        const weekEnd = new Date();
        weekEnd.setHours(23, 59, 59, 999);

        const dailyStats = await this.prisma.dailyStats.findMany({
            where: {
                userId,
                date: { gte: weekStart, lte: weekEnd },
            },
            orderBy: { date: "asc" },
        });

        const statsMap = new Map(dailyStats.map((s) => [s.date.toISOString().split("T")[0], s]));

        const weeklyData = days.map((d) => {
            const key = d.date.toISOString().split("T")[0];
            const stat = statsMap.get(key);
            return {
                label: d.label,
                date: key,
                focusTime: stat?.totalFocusTime || 0,
                pomodoros: stat?.completedPomodoros || 0,
                tasks: stat?.completedTasks || 0,
            };
        });

        // Today's data
        const todayKey = days[6].date.toISOString().split("T")[0];
        const todayStat = statsMap.get(todayKey);

        // Total completed sessions
        const totalSessions = await this.prisma.focusSession.count({
            where: { userId, status: "COMPLETED" },
        });

        // Total tasks completed
        const totalTasksCompleted = await this.prisma.task.count({
            where: { userId, status: "DONE" },
        });

        // Week totals
        const weekFocusTime = weeklyData.reduce((acc, d) => acc + d.focusTime, 0);
        const weekPomodoros = weeklyData.reduce((acc, d) => acc + d.pomodoros, 0);

        return {
            user: {
                totalFocusTime: user?.totalFocusTime || 0,
                currentStreak: user?.currentStreak || 0,
                longestStreak: user?.longestStreak || 0,
            },
            today: {
                focusTime: todayStat?.totalFocusTime || 0,
                pomodoros: todayStat?.completedPomodoros || 0,
                tasks: todayStat?.completedTasks || 0,
            },
            week: {
                focusTime: weekFocusTime,
                pomodoros: weekPomodoros,
                data: weeklyData,
            },
            totals: {
                sessions: totalSessions,
                tasks: totalTasksCompleted,
            },
        };
    }

    private async updateUserStats(userId: string, duration: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                totalFocusTime: {
                    increment: duration,
                },
            },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyStats = await this.prisma.dailyStats.findFirst({
            where: {
                userId,
                date: today,
            },
        });

        if (dailyStats) {
            await this.prisma.dailyStats.update({
                where: { id: dailyStats.id },
                data: {
                    totalFocusTime: {
                        increment: duration,
                    },
                    completedPomodoros: {
                        increment: 1,
                    },
                },
            });
        } else {
            await this.prisma.dailyStats.create({
                data: {
                    userId,
                    date: today,
                    totalFocusTime: duration,
                    completedPomodoros: 1,
                },
            });
        }
    }

    async pauseSession(sessionId: string, userId: string, elapsedTimeFromClient?: number) {
        const session = await this.prisma.focusSession.findFirst({
            where: { id: sessionId, userId },
        });

        if (!session) {
            throw new NotFoundException(`Focus session với ID ${sessionId} không tồn tại`);
        }

        // Use client-provided elapsed time if available, otherwise calculate from startedAt
        const elapsedTime =
            elapsedTimeFromClient !== undefined
                ? elapsedTimeFromClient
                : Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

        const result = await this.prisma.focusSession.update({
            where: { id: sessionId },
            data: {
                status: FocusSessionStatus.PAUSED,
                elapsedTime,
            },
        });

        this.eventEmitter.emit(FOCUS_SESSION_EVENTS.PAUSED, {
            userId,
            sessionId,
            taskId: session.taskId,
        } as FocusSessionPausedEvent);

        return result;
    }

    /**
     * Resume a PAUSED session - set status back to IN_PROGRESS
     * and adjust startedAt so timer math works correctly.
     */
    async resumeSession(sessionId: string, userId: string) {
        const session = await this.prisma.focusSession.findFirst({
            where: { id: sessionId, userId, status: FocusSessionStatus.PAUSED },
            select: { id: true, elapsedTime: true },
        });

        if (!session) {
            throw new NotFoundException(`No paused session found`);
        }

        // Set new startedAt = now - elapsedTime so that
        // now - startedAt = elapsedTime (time already spent)
        const newStartedAt = new Date(Date.now() - session.elapsedTime * 1000);

        const result = await this.prisma.focusSession.update({
            where: { id: sessionId },
            data: {
                status: "IN_PROGRESS",
                startedAt: newStartedAt,
            },
            include: { task: true },
        });

        return result;
    }

    /**
     * Get the current active/paused session for a user (grace period: 5 minutes)
     * - IN_PROGRESS → return immediately
     * - PAUSED within 5 min → return (user can Resume)
     * - PAUSED > 5 min → mark INTERRUPTED, return null
     */
    async getCurrentSession(userId: string) {
        // First check for IN_PROGRESS session
        const activeSession = await this.prisma.focusSession.findFirst({
            where: {
                userId,
                status: FocusSessionStatus.IN_PROGRESS,
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        focusTotalSessions: true,
                        focusCompletedSessions: true,
                    },
                },
            },
            orderBy: { startedAt: "desc" },
        });

        if (activeSession) {
            return { session: activeSession, canResume: true };
        }

        // Check for PAUSED session with grace period
        const pausedSession = await this.prisma.focusSession.findFirst({
            where: {
                userId,
                status: FocusSessionStatus.PAUSED,
            },
            select: {
                id: true,
                plannedDuration: true,
                elapsedTime: true,
                updatedAt: true,
                status: true,
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        focusTotalSessions: true,
                        focusCompletedSessions: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        if (!pausedSession) {
            return { session: null, canResume: false };
        }

        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - pausedSession.updatedAt.getTime()) / 1000);
        const GRACE_PERIOD_SECONDS = 5 * 60; // 5 minutes

        if (diffSeconds <= GRACE_PERIOD_SECONDS) {
            // Within grace period → user can resume
            return { session: pausedSession, canResume: true };
        } else {
            // Grace period expired → mark as INTERRUPTED
            await this.prisma.focusSession.update({
                where: { id: pausedSession.id },
                data: {
                    status: "INTERRUPTED",
                    endedAt: pausedSession.updatedAt,
                    duration: pausedSession.elapsedTime,
                },
            });

            return { session: null, canResume: false };
        }
    }

    async getIncompleteSession(userId: string, taskId: string) {
        if (!taskId) {
            return { session: null };
        }

        const incompleteSession = await this.prisma.focusSession.findFirst({
            where: {
                userId,
                taskId,
                status: {
                    in: [FocusSessionStatus.IN_PROGRESS, FocusSessionStatus.PAUSED],
                },
            },
            orderBy: {
                startedAt: "desc",
            },
        });

        return { session: incompleteSession };
    }
}
