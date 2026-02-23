import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BullModule } from "@nestjs/bullmq";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma.service";
import { TasksModule } from "./tasks/tasks.module";
import { AuthModule } from "./auth/auth.module";
import { FocusSessionsModule } from "./focus-sessions/focus-sessions.module";
import { FocusWorldModule } from "./focus-world/focus-world.module";
import { CronModule } from "./cron/cron.module";
import { AIModule } from "./ai/ai.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),
        CacheModule.register({
            isGlobal: true,
            ttl: 60000,
            max: 100,
        }),
        EventEmitterModule.forRoot({
            wildcard: false,
            delimiter: ".",
            maxListeners: 10,
            verboseMemoryLeak: true,
        }),
        // Global BullMQ Redis connection — all queues inherit this
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
                },
            }),
        }),
        AuthModule,
        TasksModule,
        FocusSessionsModule,
        FocusWorldModule,
        CronModule,
        AIModule,
    ],
    controllers: [AppController],
    providers: [AppService, PrismaService],
})
export class AppModule {}
