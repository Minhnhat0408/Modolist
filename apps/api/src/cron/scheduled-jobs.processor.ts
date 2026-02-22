import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { FocusSessionStatus } from "@repo/database";
import { PrismaService } from "../prisma.service";
import { SCHEDULED_QUEUE, SCHEDULED_JOBS } from "./scheduled-jobs.constants";

@Processor(SCHEDULED_QUEUE)
export class ScheduledJobsProcessor extends WorkerHost {
    private readonly logger = new Logger(ScheduledJobsProcessor.name);

    constructor(private prisma: PrismaService) {
        super();
    }

    async process(job: Job): Promise<void> {
        switch (job.name) {
            case SCHEDULED_JOBS.MIDNIGHT_RESET:
                await this.handleMidnightReset();
                break;
            case SCHEDULED_JOBS.STALE_SESSIONS:
                await this.handleStaleSessions();
                break;
            case SCHEDULED_JOBS.DAILY_STATS:
                await this.handleDailyStatsReconciliation();
                break;
            case SCHEDULED_JOBS.STREAK_UPDATE:
                await this.handleStreakUpdate();
                break;
            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
        }
    }

    // ─── Job Handlers ─────────────────────────────────────────────────────────

    /**
     * Midnight (00:00) — Move unfinished TODAY tasks back to BACKLOG
     * and archive DONE tasks completed before today.
     */
    private async handleMidnightReset() {
        this.logger.log("⏰ Running midnight reset...");

        const todayToBacklog = await this.prisma.task.updateMany({
            where: { status: "TODAY", completedAt: null, isArchived: false },
            data: { status: "BACKLOG" },
        });
        this.logger.log(`📋 Moved ${todayToBacklog.count} unfinished TODAY tasks → BACKLOG`);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const archivedDone = await this.prisma.task.updateMany({
            where: { status: "DONE", isArchived: false, completedAt: { lt: todayStart } },
            data: { isArchived: true },
        });
        this.logger.log(`🗄️  Archived ${archivedDone.count} completed DONE tasks`);
    }

    /**
     * Every 10 minutes — Mark stale IN_PROGRESS/PAUSED sessions (> 2h) as INTERRUPTED.
     */
    private async handleStaleSessions() {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const staleInProgress = await this.prisma.focusSession.updateMany({
            where: { status: FocusSessionStatus.IN_PROGRESS, startedAt: { lt: twoHoursAgo } },
            data: { status: FocusSessionStatus.INTERRUPTED, endedAt: new Date() },
        });

        const stalePaused = await this.prisma.focusSession.updateMany({
            where: { status: FocusSessionStatus.PAUSED, updatedAt: { lt: twoHoursAgo } },
            data: { status: FocusSessionStatus.INTERRUPTED, endedAt: new Date() },
        });

        const total = staleInProgress.count + stalePaused.count;
        if (total > 0) {
            this.logger.log(
                `🧹 Cleaned up ${total} stale sessions (${staleInProgress.count} in-progress, ${stalePaused.count} paused)`,
            );
        }
    }

    /**
     * 00:05 — Reconcile completedTasks count in DailyStats for yesterday.
     */
    private async handleDailyStatsReconciliation() {
        this.logger.log("📊 Running daily stats reconciliation...");

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const completedTasks = await this.prisma.task.groupBy({
            by: ["userId"],
            _count: { id: true },
            where: { completedAt: { gte: yesterday, lte: yesterdayEnd } },
        });

        for (const row of completedTasks) {
            await this.prisma.dailyStats.upsert({
                where: { userId_date: { userId: row.userId, date: yesterday } },
                update: { completedTasks: row._count.id },
                create: {
                    userId: row.userId,
                    date: yesterday,
                    completedTasks: row._count.id,
                    totalFocusTime: 0,
                    completedPomodoros: 0,
                },
            });
        }

        this.logger.log(`📊 Reconciled daily stats for ${completedTasks.length} users`);
    }

    /**
     * 00:10 — Increment or reset currentStreak / longestStreak per user.
     */
    private async handleStreakUpdate() {
        this.logger.log("🔥 Updating user streaks...");

        const users = await this.prisma.user.findMany({
            select: { id: true, currentStreak: true, longestStreak: true },
        });

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        for (const user of users) {
            const yesterdayStats = await this.prisma.dailyStats.findUnique({
                where: { userId_date: { userId: user.id, date: yesterday } },
            });

            if (yesterdayStats && yesterdayStats.completedPomodoros > 0) {
                const newStreak = user.currentStreak + 1;
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        currentStreak: newStreak,
                        longestStreak: Math.max(newStreak, user.longestStreak),
                    },
                });
            } else if (user.currentStreak > 0) {
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { currentStreak: 0 },
                });
            }
        }

        this.logger.log(`🔥 Updated streaks for ${users.length} users`);
    }
}
