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

    get focusSession(): PrismaClient["focusSession"] {
        return prisma.focusSession;
    }

    get user(): PrismaClient["user"] {
        return prisma.user;
    }

    get dailyStats(): PrismaClient["dailyStats"] {
        return prisma.dailyStats;
    }

    // Expose $transaction for atomic operations

    get $transaction(): PrismaClient["$transaction"] {
        return prisma.$transaction.bind(prisma) as PrismaClient["$transaction"];
    }
}
