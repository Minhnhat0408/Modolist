import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Query,
} from "@nestjs/common";
import { FocusSessionsService } from "./focus-sessions.service";
import { CreateFocusSessionDto } from "./dto/create-focus-session.dto";
import { UpdateFocusSessionDto } from "./dto/update-focus-session.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../decorators/current-user.decorator";

@Controller("focus-sessions")
@UseGuards(JwtAuthGuard)
export class FocusSessionsController {
    constructor(private readonly focusSessionsService: FocusSessionsService) {}

    // POST /focus-sessions/start - Bắt đầu session mới (25 phút)
    @Post("start")
    startSession(
        @CurrentUser() user: CurrentUserData,
        @Body() body: { taskId?: string; plannedDuration: number },
    ) {
        return this.focusSessionsService.startSession(
            user.id,
            body.taskId || null,
            body.plannedDuration,
        );
    }

    // PATCH /focus-sessions/:id/complete - Hoàn thành session
    @Patch(":id/complete")
    completeSession(
        @Param("id") id: string,
        @CurrentUser() user: CurrentUserData,
        @Body() body: { actualDuration: number },
    ) {
        return this.focusSessionsService.completeSession(id, user.id, body.actualDuration);
    }

    @Patch(":id/pause")
    pauseSession(
        @Param("id") id: string,
        @CurrentUser() user: CurrentUserData,
        @Body() body: { elapsedTime?: number },
    ) {
        return this.focusSessionsService.pauseSession(id, user.id, body.elapsedTime);
    }

    @Patch(":id/resume")
    resumeSession(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.focusSessionsService.resumeSession(id, user.id);
    }

    @Get("current")
    getCurrentSession(@CurrentUser() user: CurrentUserData) {
        return this.focusSessionsService.getCurrentSession(user.id);
    }

    @Post()
    create(@CurrentUser() user: CurrentUserData, @Body() createDto: CreateFocusSessionDto) {
        return this.focusSessionsService.create(user.id, createDto);
    }

    @Get()
    findAll(@CurrentUser() user: CurrentUserData) {
        return this.focusSessionsService.findAll(user.id);
    }

    @Get("stats")
    getStats(@CurrentUser() user: CurrentUserData) {
        return this.focusSessionsService.getStats(user.id);
    }

    @Get("incomplete")
    getIncompleteSession(@CurrentUser() user: CurrentUserData, @Query("taskId") taskId: string) {
        return this.focusSessionsService.getIncompleteSession(user.id, taskId);
    }

    @Get(":id")
    findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.focusSessionsService.findOne(id, user.id);
    }

    // PATCH /focus-sessions/:id - Cập nhật session
    @Patch(":id")
    update(
        @Param("id") id: string,
        @CurrentUser() user: CurrentUserData,
        @Body() updateDto: UpdateFocusSessionDto,
    ) {
        return this.focusSessionsService.update(id, user.id, updateDto);
    }

    // DELETE /focus-sessions/:id - Xóa session
    @Delete(":id")
    remove(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.focusSessionsService.remove(id, user.id);
    }
}
