export interface FocusSessionPausedEvent {
    userId: string;
    sessionId: string;
    taskId: string | null;
}

export interface FocusSessionCompletedEvent {
    userId: string;
    sessionId: string;
    taskId: string | null;
}

export const FOCUS_SESSION_EVENTS = {
    PAUSED: "focus.session.paused",
    COMPLETED: "focus.session.completed",
} as const;
