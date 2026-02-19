import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { TasksModule } from "./tasks/tasks.module";
import { AuthModule } from "./auth/auth.module";
import { FocusSessionsModule } from "./focus-sessions/focus-sessions.module";
import { FocusWorldModule } from "./focus-world/focus-world.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),
        CacheModule.register({
            isGlobal: true,
            ttl: 60000, // 60 seconds default TTL
            max: 100, // Maximum number of items in cache
        }),
        EventEmitterModule.forRoot({
            wildcard: false,
            delimiter: ".",
            maxListeners: 10,
            verboseMemoryLeak: true,
        }),
        AuthModule,
        TasksModule,
        FocusSessionsModule,
        FocusWorldModule,
    ],
    controllers: [AppController],
    providers: [AppService, PrismaService],
})
export class AppModule {}
