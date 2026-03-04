import { Controller, Post, Body, UseGuards, Param } from "@nestjs/common";
import { AIService } from "./ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../decorators/current-user.decorator";
import { ConfirmTasksDto } from "./dto/confirm-tasks.dto";
import { EstimateTimeDto } from "./dto/estimate-time.dto";
import { GenerateTasksDto } from "./dto/generate-tasks.dto";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AIController {
    constructor(private readonly aiService: AIService) {}

    // Returns suggested tasks for user review (not yet saved).
    @Post("generate-tasks")
    async generateTasks(@CurrentUser() user: CurrentUserData, @Body() dto: GenerateTasksDto) {
        return this.aiService.generateTasks(user.id, dto.goal, dto.context, dto.maxTasks);
    }

    //Save confirmed AI-generated tasks to DB.
    @Post("confirm-tasks")
    async confirmTasks(@CurrentUser() user: CurrentUserData, @Body() dto: ConfirmTasksDto) {
        return this.aiService.confirmGeneratedTasks(user.id, dto.tasks);
    }

    // Estimate pomodoros for a single task via RAG.
    @Post("estimate-time")
    async estimateTime(@CurrentUser() user: CurrentUserData, @Body() dto: EstimateTimeDto) {
        return this.aiService.estimateTime(user.id, dto.taskTitle, dto.taskDescription);
    }

    // Manually trigger embedding storage for a task.
    @Post("store-embedding/:taskId")
    async storeEmbedding(@CurrentUser() user: CurrentUserData, @Param("taskId") taskId: string) {
        // Find task to get title/description
        return this.aiService.storeEmbedding(taskId, user.id, "", "");
    }
}
