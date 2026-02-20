export const SCHEDULED_QUEUE = "scheduled-tasks";

export const SCHEDULED_JOBS = {
    MIDNIGHT_RESET: "midnight-reset",
    STALE_SESSIONS: "stale-sessions",
    DAILY_STATS: "daily-stats",
    STREAK_UPDATE: "streak-update",
} as const;

export type ScheduledJobName = (typeof SCHEDULED_JOBS)[keyof typeof SCHEDULED_JOBS];
