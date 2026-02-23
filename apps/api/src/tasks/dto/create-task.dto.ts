import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsInt, Min } from "class-validator";
import { TaskStatus, TaskPriority } from "@repo/database";

export class CreateTaskDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(TaskStatus)
    status?: TaskStatus;

    @IsOptional()
    @IsEnum(TaskPriority)
    priority?: TaskPriority;

    @IsOptional()
    @IsInt()
    @Min(1)
    estimatedPomodoros?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsDateString()
    dueDate?: string;
}
