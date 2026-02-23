import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { SCHEDULED_QUEUE, SCHEDULED_JOBS } from "./scheduled-jobs.constants";

@Injectable()
export class CronService implements OnModuleInit {
    private readonly logger = new Logger(CronService.name);

    constructor(@InjectQueue(SCHEDULED_QUEUE) private readonly scheduledQueue: Queue) {}

    async onModuleInit() {
        await this.registerRepeatableJobs();
    }

    private async registerRepeatableJobs() {
        // Remove stale repeatable jobs from a previous deployment
        const existing = await this.scheduledQueue.getJobSchedulers();
        for (const job of existing) {
            await this.scheduledQueue.removeJobScheduler(job.key);
            console.log("Delete old job");
        }

        await this.scheduledQueue.add(
            SCHEDULED_JOBS.MIDNIGHT_RESET,
            {},
            { repeat: { pattern: "0 0 * * *" }, jobId: SCHEDULED_JOBS.MIDNIGHT_RESET },
        );

        await this.scheduledQueue.add(
            SCHEDULED_JOBS.STALE_SESSIONS,
            {},
            { repeat: { every: 10 * 60 * 1000 }, jobId: SCHEDULED_JOBS.STALE_SESSIONS },
        );

        await this.scheduledQueue.add(
            SCHEDULED_JOBS.DAILY_STATS,
            {},
            { repeat: { pattern: "5 0 * * *" }, jobId: SCHEDULED_JOBS.DAILY_STATS },
        );

        await this.scheduledQueue.add(
            SCHEDULED_JOBS.STREAK_UPDATE,
            {},
            { repeat: { pattern: "10 0 * * *" }, jobId: SCHEDULED_JOBS.STREAK_UPDATE },
        );

        this.logger.log("✅ BullMQ repeatable jobs registered");
    }

    /** Manually trigger a job immediately (useful for testing / admin). */
    async triggerJob(jobName: string) {
        const job = await this.scheduledQueue.add(
            jobName,
            {},
            { jobId: `manual:${jobName}:${Date.now()}` },
        );
        this.logger.log(`🚀 Manually triggered job: ${jobName} (id=${job.id})`);
        return job;
    }
}
