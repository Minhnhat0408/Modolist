import { Module } from "@nestjs/common";
import { FocusWorldGateway } from "./focus-world.gateway";
import { FocusWorldService } from "./focus-world.service";
import { PrismaService } from "../prisma.service";

@Module({
    providers: [FocusWorldGateway, FocusWorldService, PrismaService],
    exports: [FocusWorldService],
})
export class FocusWorldModule {}
