/** gRPC interfaces matching ai_service.proto — used by both service and controller. */

export interface FocusPlan {
    sessionType: string; // "QUICK_5" | "QUICK_25" | "STANDARD"
    sessions: number; // 1 for quick, N for standard
    totalMinutes: number; // Total estimated time in minutes
    label: string; // Human-readable, e.g. "⚡ Quick 5 phút" or "🍅 3 Pomodoros (~1h15)"
}

export interface GeneratedTask {
    title: string;
    description: string;
    priority: string;
    estimatedPomodoros: number;
    reasoning: string;
    order: number;
    tags: string[];
    focusPlan: FocusPlan;
}

export interface GenerateTasksResponse {
    tasks: GeneratedTask[];
    summary: string;
}

export interface SimilarTask {
    title: string;
    actualPomodoros: number;
    similarity: number;
}

export interface EstimateTimeResponse {
    estimatedPomodoros: number;
    reasoning: string;
    similarTasks: SimilarTask[];
    confidence: string;
    focusPlan: FocusPlan;
}

export interface StoreTaskEmbeddingResponse {
    success: boolean;
}
