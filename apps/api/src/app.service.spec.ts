import { Test, TestingModule } from "@nestjs/testing";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma/prisma.service";

const mockPrisma = {
    client: {
        user: {
            count: jest.fn(),
        },
    },
};

describe("AppService", () => {
    let service: AppService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [AppService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<AppService>(AppService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    describe("getHello", () => {
        it("should return greeting with user count", async () => {
            mockPrisma.client.user.count.mockResolvedValue(42);
            const result = await service.getHello();
            expect(result).toContain("Hello World!");
            expect(result).toContain("42");
        });

        it("should return greeting with 0 users when db is empty", async () => {
            mockPrisma.client.user.count.mockResolvedValue(0);
            const result = await service.getHello();
            expect(result).toContain("0");
        });
    });
});
