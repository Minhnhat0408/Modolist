import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { BatchCreateTasksDto } from "./dto/batch-create-tasks.dto";
import { TaskStatus } from "@repo/database";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../decorators/current-user.decorator";

@Controller("tasks")
@UseGuards(JwtAuthGuard) // Protect tất cả endpoints
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    // GET /tasks - Lấy tất cả tasks
    @Get()
    findAll(
        @CurrentUser() user: CurrentUserData,
        @Query("includeArchived") includeArchived?: string,
    ) {
        return this.tasksService.findAll(user.id, includeArchived === "true");
    }

    // GET /tasks/stats - Thống kê tasks
    @Get("stats")
    getStats(@CurrentUser() user: CurrentUserData) {
        return this.tasksService.getStats(user.id);
    }

    // GET /tasks/status/:status - Lấy tasks theo status
    @Get("status/:status")
    findByStatus(@CurrentUser() user: CurrentUserData, @Param("status") status: TaskStatus) {
        return this.tasksService.findByStatus(user.id, status);
    }

    @Get("done-history/count")
    getDoneHistoryCount(@CurrentUser() user: CurrentUserData) {
        return this.tasksService.getDoneHistoryCount(user.id);
    }

    @Get("done-history")
    findDoneHistory(@CurrentUser() user: CurrentUserData) {
        return this.tasksService.findDoneHistory(user.id);
    }

    @Get("backlog/count")
    getBacklogCount(@CurrentUser() user: CurrentUserData) {
        return this.tasksService.getBacklogCount(user.id);
    }

    @Get("backlog")
    findBacklog(@CurrentUser() user: CurrentUserData) {
        return this.tasksService.findBacklog(user.id);
    }

    // GET /tasks/:id - Lấy 1 task
    @Get(":id")
    findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.tasksService.findOne(id, user.id);
    }

    // POST /tasks - Tạo task mới
    @Post()
    create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: CurrentUserData) {
        return this.tasksService.create(user.id, createTaskDto);
    }

    // POST /tasks/batch - Batch create tasks (guest migration)
    @Post("batch")
    createBatch(@Body() dto: BatchCreateTasksDto, @CurrentUser() user: CurrentUserData) {
        return this.tasksService.createBatch(user.id, dto.tasks);
    }

    // POST /tasks/:id/duplicate - Nhân bản task vào TODAY
    @Post(":id/duplicate")
    duplicate(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.tasksService.duplicate(id, user.id);
    }

    // PATCH /tasks/:id - Cập nhật task
    @Patch(":id")
    update(
        @Param("id") id: string,
        @CurrentUser() user: CurrentUserData,
        @Body() updateTaskDto: UpdateTaskDto,
    ) {
        return this.tasksService.update(id, user.id, updateTaskDto);
    }

    // PATCH /tasks/:id/archive - Archive task
    @Patch(":id/archive")
    archive(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.tasksService.archive(id, user.id);
    }

    // PATCH /tasks/:id/order - Update task order (reordering)
    @Patch(":id/order")
    updateOrder(
        @Param("id") id: string,
        @CurrentUser() user: CurrentUserData,
        @Body() body: { newOrder: number; status: TaskStatus },
    ) {
        return this.tasksService.updateOrder(id, user.id, body.newOrder, body.status);
    }

    // DELETE /tasks/:id - Xóa task
    @Delete(":id")
    remove(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
        return this.tasksService.remove(id, user.id);
    }
}
