import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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

    await app.listen(process.env.PORT ?? 3001);
    console.log(`🚀 API running on: http://localhost:${process.env.PORT ?? 3001}`);
}
void bootstrap();
