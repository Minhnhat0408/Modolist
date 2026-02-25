import { Test, TestingModule } from "@nestjs/testing";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

const mockTasksService = {
    findAll: jest.fn(),
    findByStatus: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    archive: jest.fn(),
    getStats: jest.fn(),
    updateOrder: jest.fn(),
};

describe("TasksController", () => {
    let controller: TasksController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TasksController],
            providers: [{ provide: TasksService, useValue: mockTasksService }],
        }).compile();

        controller = module.get<TasksController>(TasksController);
    });

    it("should be defined", () => {
        expect(controller).toBeDefined();
    });
});
