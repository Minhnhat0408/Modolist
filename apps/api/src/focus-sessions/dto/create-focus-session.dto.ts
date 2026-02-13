import { IsString, IsInt, IsOptional, IsEnum } from "class-validator";
import { FocusSessionStatus } from "@repo/database";

export class CreateFocusSessionDto {
    @IsOptional()
    @IsString()
    taskId?: string;

    @IsInt()
    plannedDuration: number;

    @IsOptional()
    @IsInt()
    duration?: number;

    @IsOptional()
    @IsEnum(["IN_PROGRESS", "COMPLETED", "CANCELLED"])
    status?: FocusSessionStatus;

    @IsOptional()
    @IsInt()
    breakDuration?: number;
}
