import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    Min,
    Max,
    IsDateString,
    IsArray,
    IsBoolean,
} from "class-validator";
import { TaskStatus, TaskPriority, RecurrenceRule } from "@repo/database";

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
    focusTotalSessions?: number;

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

    @IsOptional()
    @IsString()
    suggestedSessionType?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    suggestedSessions?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    suggestedTotalMinutes?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    estimatedPomodoros?: number;

    @IsOptional()
    @IsEnum(RecurrenceRule)
    recurrence?: RecurrenceRule;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(6, { each: true })
    recurrenceDaysOfWeek?: number[];

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(31)
    recurrenceDayOfMonth?: number;
}
