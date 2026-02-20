import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CronService } from "./cron.service";
import { ScheduledJobsProcessor } from "./scheduled-jobs.processor";
import { PrismaService } from "../prisma.service";
import { SCHEDULED_QUEUE } from "./scheduled-jobs.constants";

@Module({
    imports: [BullModule.registerQueue({ name: SCHEDULED_QUEUE })],
    providers: [CronService, ScheduledJobsProcessor, PrismaService],
    exports: [CronService],
})
export class CronModule {}
