import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Injectable()
export class AppService {
    constructor(private prisma: PrismaService) {}

    async getHello(): Promise<string> {
        // Test database connection by counting users
        const userCount = await this.prisma.client.user.count();
        return `Hello World! Database connected. Users: ${userCount}`;
    }
}
