import { TaskStatus, TaskPriority } from "@repo/database";

export class TaskEntity {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    estimatedPomodoros: number;
    completedPomodoros: number;
    tags: string[];
    dueDate: Date | null;
    completedAt: Date | null;
    isArchived: boolean;
    userId: string;
    createdAt: Date;
    updatedAt: Date;

    // Optional relations
    focusSessions?: {
        id: string;
        duration: number;
        completedAt: Date | null;
    }[];

    constructor(partial: Partial<TaskEntity>) {
        Object.assign(this, partial);
    }
}
