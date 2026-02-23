import { Controller, Post, Body, UseGuards, Param } from "@nestjs/common";
import { AIService } from "./ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../decorators/current-user.decorator";
import { IsString, IsOptional, IsInt, Min, Max, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

// ── DTOs ────────────────────────────────────────────────────────────────────────
class GenerateTasksDto {
    @IsString()
    goal: string;

    @IsOptional()
    @IsString()
    context?: string;

    @IsOptional()
    @IsInt()
    @Min(2)
    @Max(7)
    maxTasks?: number;
}

class TaskToConfirmDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    priority?: string;

    @IsOptional()
    @IsInt()
    estimatedPomodoros?: number;

    @IsOptional()
    @IsInt()
    order?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsString()
    suggestedSessionType?: string;

    @IsOptional()
    @IsInt()
    suggestedSessions?: number;

    @IsOptional()
    @IsInt()
    suggestedTotalMinutes?: number;
}

class ConfirmTasksDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TaskToConfirmDto)
    tasks: TaskToConfirmDto[];
}

class EstimateTimeDto {
    @IsString()
    taskTitle: string;

    @IsOptional()
    @IsString()
    taskDescription?: string;
}

// ── Controller ──────────────────────────────────────────────────────────────────
@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AIController {
    constructor(private readonly aiService: AIService) {}

    /**
     * POST /ai/generate-tasks
     * Generate tasks from a goal using Gemini + RAG.
     * Returns suggested tasks for user review (not yet saved).
     */
    @Post("generate-tasks")
    async generateTasks(@CurrentUser() user: CurrentUserData, @Body() dto: GenerateTasksDto) {
        return this.aiService.generateTasks(user.id, dto.goal, dto.context, dto.maxTasks);
    }

    /**
     * POST /ai/confirm-tasks
     * Save confirmed AI-generated tasks to DB.
     */
    @Post("confirm-tasks")
    async confirmTasks(@CurrentUser() user: CurrentUserData, @Body() dto: ConfirmTasksDto) {
        return this.aiService.confirmGeneratedTasks(user.id, dto.tasks);
    }

    /**
     * POST /ai/estimate-time
     * Estimate pomodoros for a single task via RAG.
     */
    @Post("estimate-time")
    async estimateTime(@CurrentUser() user: CurrentUserData, @Body() dto: EstimateTimeDto) {
        return this.aiService.estimateTime(user.id, dto.taskTitle, dto.taskDescription);
    }

    /**
     * POST /ai/store-embedding/:taskId
     * Manually trigger embedding storage for a task.
     */
    @Post("store-embedding/:taskId")
    async storeEmbedding(@CurrentUser() user: CurrentUserData, @Param("taskId") taskId: string) {
        // Find task to get title/description
        return this.aiService.storeEmbedding(taskId, user.id, "", "");
    }
}
