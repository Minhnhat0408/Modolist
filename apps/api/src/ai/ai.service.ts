import { Injectable, Inject, OnModuleInit, Logger } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, timeout, catchError, of } from "rxjs";
import { PrismaService } from "../prisma.service";
import { AI_GRPC_PACKAGE } from "./ai.constants";
import { TaskStatus, TaskPriority } from "@repo/database";
import { SimilarTask } from "./ai.types";
import { AIServiceGrpc } from "./interfaces/grpc.interface";

@Injectable()
export class AIService implements OnModuleInit {
    private readonly logger = new Logger(AIService.name);
    private aiServiceGrpc: AIServiceGrpc;

    constructor(
        @Inject(AI_GRPC_PACKAGE) private readonly client: ClientGrpc,
        private readonly prisma: PrismaService,
    ) {}

    onModuleInit() {
        this.aiServiceGrpc = this.client.getService<AIServiceGrpc>("AIService");
        this.logger.log("✅ gRPC AIService client initialized");
    }

    /**
     * Generate tasks from a goal, then create them in DB.
     * Returns the created tasks so the frontend can show them.
     */
    async generateTasks(userId: string, goal: string, context?: string, maxTasks = 5) {
        this.logger.log(`📋 generateTasks: user=${userId}, goal="${goal.slice(0, 50)}..."`);

        const response = await firstValueFrom(
            this.aiServiceGrpc
                .generateTasks({
                    userId,
                    goal,
                    context: context || "",
                    maxTasks: Math.min(maxTasks, 7),
                })
                .pipe(
                    timeout(30000),
                    catchError((err) => {
                        this.logger.error(`❌ gRPC GenerateTasks failed: ${err.message}`);
                        throw err;
                    }),
                ),
        );

        return {
            tasks: response.tasks,
            summary: response.summary,
        };
    }

    /**
     * Confirm and save AI-generated tasks to DB.
     * Called after user reviews and accepts the generated tasks.
     */
    async confirmGeneratedTasks(
        userId: string,
        tasks: Array<{
            title: string;
            description?: string;
            priority?: string;
            estimatedPomodoros?: number;
            order?: number;
            tags?: string[];
            suggestedSessionType?: string;
            suggestedSessions?: number;
            suggestedTotalMinutes?: number;
        }>,
    ) {
        const existingMaxOrder = await this.prisma.task.findFirst({
            where: { userId, status: TaskStatus.BACKLOG, isArchived: false },
            orderBy: { order: "desc" },
            select: { order: true },
        });
        const baseOrder = (existingMaxOrder?.order ?? 0) + 1;

        const createdTasks = await this.prisma.$transaction(
            tasks.map((task, index) =>
                this.prisma.task.create({
                    data: {
                        title: task.title,
                        description: task.description || null,
                        status: TaskStatus.TODAY,
                        priority: this.mapPriority(task.priority),
                        estimatedPomodoros: task.estimatedPomodoros || null,
                        suggestedSessionType: task.suggestedSessionType || null,
                        suggestedSessions: task.suggestedSessions || null,
                        suggestedTotalMinutes: task.suggestedTotalMinutes || null,
                        tags: task.tags || [],
                        order: baseOrder + (task.order ?? index),
                        userId,
                    },
                }),
            ),
        );

        // Store embeddings in background (fire-and-forget)
        for (const created of createdTasks) {
            this.storeEmbedding(created.id, userId, created.title, created.description || "").catch(
                (err) =>
                    this.logger.warn(`⚠️ Embedding store failed for ${created.id}: ${err.message}`),
            );
        }

        return createdTasks;
    }

    /**
     * Estimate pomodoros for a single task via RAG.
     */
    async estimateTime(userId: string, taskTitle: string, taskDescription?: string) {
        this.logger.log(`⏱️ estimateTime: user=${userId}, title="${taskTitle.slice(0, 50)}"`);

        const response = await firstValueFrom(
            this.aiServiceGrpc
                .estimateTime({
                    userId,
                    taskTitle,
                    taskDescription: taskDescription || "",
                })
                .pipe(
                    timeout(15000),
                    catchError((err) => {
                        this.logger.error(`❌ gRPC EstimateTime failed: ${err.message}`);
                        return of({
                            estimatedPomodoros: 3,
                            reasoning: "Không thể kết nối AI service — sử dụng giá trị mặc định.",
                            similarTasks: [] as SimilarTask[],
                            confidence: "low",
                        });
                    }),
                ),
        );

        return response;
    }

    /**
     * Store embedding for a task (call after task creation/completion).
     */
    async storeEmbedding(taskId: string, userId: string, title: string, description: string) {
        const response = await firstValueFrom(
            this.aiServiceGrpc.storeTaskEmbedding({ taskId, userId, title, description }).pipe(
                timeout(10000),
                catchError((err) => {
                    this.logger.warn(`⚠️ StoreEmbedding failed: ${err.message}`);
                    return of({ success: false });
                }),
            ),
        );
        return response;
    }

    private mapPriority(priority?: string): TaskPriority {
        switch (priority?.toUpperCase()) {
            case "LOW":
                return TaskPriority.LOW;
            case "HIGH":
                return TaskPriority.HIGH;
            case "URGENT":
                return TaskPriority.URGENT;
            default:
                return TaskPriority.MEDIUM;
        }
    }
}
