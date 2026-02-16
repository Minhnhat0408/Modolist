import { Injectable, Logger } from "@nestjs/common";
import { FocusSessionStatus } from "@repo/database";
import { PrismaService } from "../prisma.service";

@Injectable()
export class FocusWorldService {
    private readonly logger = new Logger(FocusWorldService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Validate that a session exists and belongs to the user.
     * Accepts IN_PROGRESS and PAUSED (resumable).
     */
    async validateSession(sessionId: string, userId: string) {
        try {
            const session = await this.prisma.focusSession.findFirst({
                where: {
                    id: sessionId,
                    userId: userId,
                    status: {
                        in: [FocusSessionStatus.IN_PROGRESS, FocusSessionStatus.PAUSED],
                    },
                },
                select: {
                    id: true,
                    startedAt: true,
                    plannedDuration: true,
                    elapsedTime: true,
                    taskId: true,
                },
            });

            return session;
        } catch (error: unknown) {
            this.logger.error(`Error validating session: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Get user information
     */
    async getUserInfo(userId: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            });

            return user;
        } catch (error: unknown) {
            this.logger.error(`Error getting user info: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Get task information
     */
    async getTaskInfo(taskId: string) {
        try {
            const task = await this.prisma.task.findUnique({
                where: { id: taskId },
                select: {
                    id: true,
                    title: true,
                },
            });

            return task;
        } catch (error: unknown) {
            this.logger.error(`Error getting task info: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Handle socket disconnect:
     * Set session to PAUSED with elapsedTime saved.
     * The grace period logic is in GET /focus-sessions/current.
     */
    async handleDisconnect(sessionId: string, elapsedTime: number) {
        try {
            const session = await this.prisma.focusSession.findUnique({
                where: { id: sessionId },
                select: { status: true },
            });

            // Only update if session is still IN_PROGRESS
            if (session && session.status === FocusSessionStatus.IN_PROGRESS) {
                await this.prisma.focusSession.update({
                    where: { id: sessionId },
                    data: {
                        status: FocusSessionStatus.PAUSED,
                        elapsedTime,
                    },
                });

                this.logger.log(
                    `Session ${sessionId} set to PAUSED (elapsed: ${elapsedTime}s) due to disconnect`,
                );
            }
        } catch (error: unknown) {
            this.logger.error(`Error handling disconnect: ${(error as Error).message}`);
        }
    }
}
