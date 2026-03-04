import { Observable } from "rxjs";
import {
    GenerateTasksResponse,
    EstimateTimeResponse,
    StoreTaskEmbeddingResponse,
} from "../ai.types";

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
