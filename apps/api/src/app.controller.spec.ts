import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

const mockAppService = {
    getHello: jest.fn().mockResolvedValue("Hello World! Database connected. Users: 0"),
};

describe("AppController", () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [{ provide: AppService, useValue: mockAppService }],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe("root", () => {
        it("should return a greeting string", async () => {
            const result = await appController.getHello();
            expect(result).toContain("Hello World!");
        });
    });
});
