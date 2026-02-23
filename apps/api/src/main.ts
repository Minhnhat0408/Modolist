import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import basicAuth from "express-basic-auth";
import { AppModule } from "./app.module";
import { SCHEDULED_QUEUE } from "./cron/scheduled-jobs.constants";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Enable validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Enable CORS
    app.enableCors();
    const boardPath = "/admin/queues";
    const bullUser = process.env.BULL_BOARD_USER as string;
    const bullPass = process.env.BULL_BOARD_PASSWORD as string;

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(boardPath);

    const scheduledQueue = app.get<Queue>(getQueueToken(SCHEDULED_QUEUE));

    createBullBoard({
        queues: [new BullMQAdapter(scheduledQueue)],
        serverAdapter,
    });

    app.use(
        boardPath,
        basicAuth({
            users: { [bullUser]: bullPass },
            challenge: true, // sends WWW-Authenticate header
            realm: "Bull Board",
        }),
        serverAdapter.getRouter(),
    );
    const port = process.env.PORT ?? 3001;
    await app.listen(port);
    console.log(`🚀 API running on: http://localhost:${port}`);
    console.log(`📋 Bull Board:     http://localhost:${port}${boardPath}`);
}
void bootstrap();
