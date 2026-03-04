import { Module } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { TasksController } from "./tasks.controller";
import { PrismaService } from "../prisma.service";
import { AIModule } from "../ai/ai.module";

@Module({
    imports: [AIModule],
    providers: [TasksService, PrismaService],
    controllers: [TasksController],
    exports: [TasksService],
})
export class TasksModule {}
