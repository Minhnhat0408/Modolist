import { Observable } from "rxjs";
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

export interface GenerateTasksRequest {
    userId: string;
    goal: string;
    context: string;
    maxTasks: number;
}

export interface EstimateTimeRequest {
    userId: string;
    taskTitle: string;
    taskDescription: string;
}

export interface StoreTaskEmbeddingRequest {
    taskId: string;
    userId: string;
    title: string;
    description: string;
}

export interface AIServiceGrpc {
    generateTasks(req: GenerateTasksRequest): Observable<GenerateTasksResponse>;
    estimateTime(req: EstimateTimeRequest): Observable<EstimateTimeResponse>;
    storeTaskEmbedding(req: StoreTaskEmbeddingRequest): Observable<StoreTaskEmbeddingResponse>;
}
