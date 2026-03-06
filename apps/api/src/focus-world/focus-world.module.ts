import { Module } from "@nestjs/common";
import { FocusWorldGateway } from "./focus-world.gateway";
import { FocusWorldService } from "./focus-world.service";

@Module({
    providers: [FocusWorldGateway, FocusWorldService],
    exports: [FocusWorldService],
})
export class FocusWorldModule {}
