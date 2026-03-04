import { Type } from "class-transformer";
import { IsString, IsOptional, IsInt, IsArray, ValidateNested } from "class-validator";

export class TaskToConfirmDto {
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

export class ConfirmTasksDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TaskToConfirmDto)
    tasks: TaskToConfirmDto[];
}
