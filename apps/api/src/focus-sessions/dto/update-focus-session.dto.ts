import { PartialType } from "@nestjs/mapped-types";
import { CreateFocusSessionDto } from "./create-focus-session.dto";
import { IsOptional, IsInt, IsEnum } from "class-validator";
import { FocusSessionStatus } from "@repo/database";

export class UpdateFocusSessionDto extends PartialType(CreateFocusSessionDto) {
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
