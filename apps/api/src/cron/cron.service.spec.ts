import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { CronService } from "./cron.service";
import { SCHEDULED_QUEUE, SCHEDULED_JOBS } from "./scheduled-jobs.constants";

const mockQueue = {
    getJobSchedulers: jest.fn(),
    removeJobScheduler: jest.fn(),
    add: jest.fn(),
};

describe("CronService", () => {
    let service: CronService;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockQueue.getJobSchedulers.mockResolvedValue([]);
        mockQueue.removeJobScheduler.mockResolvedValue(undefined);
        mockQueue.add.mockResolvedValue({ id: "job-1" });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CronService,
                { provide: getQueueToken(SCHEDULED_QUEUE), useValue: mockQueue },
            ],
        }).compile();

        service = module.get<CronService>(CronService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    // ─── onModuleInit / registerRepeatableJobs ───────────────────────────────
    describe("onModuleInit", () => {
        it("should remove stale jobs and register all repeatable jobs", async () => {
            const staleJob = { key: "old-job" };
            mockQueue.getJobSchedulers.mockResolvedValue([staleJob]);

            await service.onModuleInit();

            expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith("old-job");
            expect(mockQueue.add).toHaveBeenCalledWith(
                SCHEDULED_JOBS.MIDNIGHT_RESET,
                {},
                expect.objectContaining({
                    repeat: expect.objectContaining({ pattern: "0 0 * * *" }),
                }),
            );
            expect(mockQueue.add).toHaveBeenCalledWith(
                SCHEDULED_JOBS.STALE_SESSIONS,
                {},
                expect.objectContaining({
                    repeat: expect.objectContaining({ every: 10 * 60 * 1000 }),
                }),
            );
            expect(mockQueue.add).toHaveBeenCalledWith(
                SCHEDULED_JOBS.DAILY_STATS,
                {},
                expect.objectContaining({
                    repeat: expect.objectContaining({ pattern: "5 0 * * *" }),
                }),
            );
            expect(mockQueue.add).toHaveBeenCalledWith(
                SCHEDULED_JOBS.STREAK_UPDATE,
                {},
                expect.objectContaining({
                    repeat: expect.objectContaining({ pattern: "10 0 * * *" }),
                }),
            );
        });

        it("should handle empty list of stale jobs gracefully", async () => {
            mockQueue.getJobSchedulers.mockResolvedValue([]);
            await expect(service.onModuleInit()).resolves.not.toThrow();
            expect(mockQueue.removeJobScheduler).not.toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalledTimes(4);
        });

        it("should remove multiple stale jobs", async () => {
            const staleJobs = [{ key: "job-a" }, { key: "job-b" }];
            mockQueue.getJobSchedulers.mockResolvedValue(staleJobs);

            await service.onModuleInit();
            expect(mockQueue.removeJobScheduler).toHaveBeenCalledTimes(2);
            expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith("job-a");
            expect(mockQueue.removeJobScheduler).toHaveBeenCalledWith("job-b");
        });
    });

    // ─── triggerJob ──────────────────────────────────────────────────────────
    describe("triggerJob", () => {
        it("should add a job to the queue immediately and return it", async () => {
            const job = { id: "manual:midnight-reset:123456" };
            mockQueue.add.mockResolvedValue(job);

            const result = await service.triggerJob(SCHEDULED_JOBS.MIDNIGHT_RESET);
            expect(result).toEqual(job);
            expect(mockQueue.add).toHaveBeenCalledWith(
                SCHEDULED_JOBS.MIDNIGHT_RESET,
                {},
                expect.objectContaining({ jobId: expect.stringContaining("manual:") }),
            );
        });

        it("should trigger any arbitrary job name", async () => {
            const job = { id: "job-xyz" };
            mockQueue.add.mockResolvedValue(job);

            const result = await service.triggerJob("custom-job");
            expect(result).toEqual(job);
            expect(mockQueue.add).toHaveBeenCalledWith("custom-job", {}, expect.anything());
        });
    });
});
