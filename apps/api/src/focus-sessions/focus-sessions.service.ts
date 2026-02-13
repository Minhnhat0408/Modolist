import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma.service";
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

    async pauseSession(sessionId: string, userId: string) {
        const session = await this.prisma.focusSession.findFirst({
            where: { id: sessionId, userId },
        });

        if (!session) {
            throw new NotFoundException(`Focus session với ID ${sessionId} không tồn tại`);
        }

        const result = await this.prisma.focusSession.update({
            where: { id: sessionId },
            data: {
                status: "INTERRUPTED",
            },
        });

        this.eventEmitter.emit(FOCUS_SESSION_EVENTS.PAUSED, {
            userId,
            sessionId,
            taskId: session.taskId,
        } as FocusSessionPausedEvent);

        return result;
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
                    in: ["IN_PROGRESS", "INTERRUPTED"],
                },
            },
            orderBy: {
                startedAt: "desc",
            },
        });

        return { session: incompleteSession };
    }
}
