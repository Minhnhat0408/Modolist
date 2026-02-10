import type { Task } from "@/types/database";
import { TaskStatus } from "@/types/database";

export interface KanbanTask extends Task {
  focusSessions?: {
    id: string;
    duration: number;
    endedAt: Date | null;
  }[];
}

export const KANBAN_COLUMNS = {
  [TaskStatus.BACKLOG]: {
    id: TaskStatus.BACKLOG,
    title: "📋 Danh sách chờ",
    color: "bg-gray-100 dark:bg-gray-800",
  },
  [TaskStatus.TODAY]: {
    id: TaskStatus.TODAY,
    title: "🎯 Hôm nay",
    color: "bg-blue-50 dark:bg-blue-900/20",
  },
  [TaskStatus.DONE]: {
    id: TaskStatus.DONE,
    title: "✅ Hoàn thành",
    color: "bg-green-50 dark:bg-green-900/20",
  },
} as const;

export const COLUMN_ORDER = [
  TaskStatus.BACKLOG,
  TaskStatus.TODAY,
  TaskStatus.DONE,
];
