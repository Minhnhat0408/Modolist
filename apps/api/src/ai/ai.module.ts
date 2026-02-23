import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { join } from "path";
import { AIService } from "./ai.service";
import { AIController } from "./ai.controller";
import { PrismaService } from "../prisma.service";
import { AI_GRPC_PACKAGE } from "./ai.constants";

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: AI_GRPC_PACKAGE,
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.GRPC,
                    options: {
                        url: config.get<string>("AI_SERVICE_URL", "localhost:50051"),
                        package: "ai",
                        protoPath: join(__dirname, "../../../../proto/ai_service.proto"),
                        loader: {
                            keepCase: false,
                            longs: Number,
                            enums: String,
                            defaults: true,
                        },
                    },
                }),
            },
        ]),
    ],
    controllers: [AIController],
    providers: [AIService, PrismaService],
    exports: [AIService],
})
export class AIModule {}
