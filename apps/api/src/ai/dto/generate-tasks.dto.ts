import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class GenerateTasksDto {
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
