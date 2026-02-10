import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    Min,
    IsDateString,
    IsArray,
    IsBoolean,
} from "class-validator";
import { TaskStatus, TaskPriority } from "@repo/database";

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    title?: string;

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
    @Min(0)
    completedPomodoros?: number;

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

    @IsOptional()
    @IsBoolean()
    isArchived?: boolean;
}
