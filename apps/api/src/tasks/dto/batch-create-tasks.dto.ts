import { Type } from "class-transformer";
import { IsArray, ValidateNested, ArrayMaxSize } from "class-validator";
import { CreateTaskDto } from "./create-task.dto";

export class BatchCreateTasksDto {
    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMaxSize(100)
    @Type(() => CreateTaskDto)
    tasks: CreateTaskDto[];
}
