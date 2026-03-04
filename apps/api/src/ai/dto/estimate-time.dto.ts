import { IsString, IsOptional } from "class-validator";

export class EstimateTimeDto {
    @IsString()
    taskTitle: string;

    @IsOptional()
    @IsString()
    taskDescription?: string;
}
