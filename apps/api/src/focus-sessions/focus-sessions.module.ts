import { Module } from "@nestjs/common";
import { FocusSessionsController } from "./focus-sessions.controller";
import { FocusSessionsService } from "./focus-sessions.service";
import { PrismaService } from "../prisma.service";

@Module({
    controllers: [FocusSessionsController],
    providers: [FocusSessionsService, PrismaService],
    exports: [FocusSessionsService],
})
export class FocusSessionsModule {}
