import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { prisma, PrismaClient } from "@repo/database";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await prisma.$connect();
        console.log("✅ Database connected successfully");
    }

    async onModuleDestroy() {
        await prisma.$disconnect();
    }

    get client(): PrismaClient {
        return prisma;
    }

    get task(): PrismaClient["task"] {
        return prisma.task;
    }
}
