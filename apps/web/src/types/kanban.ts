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
    color: "bg-white/10 border border-white/10",
  },
  [TaskStatus.TODAY]: {
    id: TaskStatus.TODAY,
    title: "🎯 Hôm nay",
    color:
      "bg-linear-to-br from-secondary/20 via-secondary/10 to-transparent border-2 border-secondary/20",
  },
  [TaskStatus.DONE]: {
    id: TaskStatus.DONE,
    title: "✅ Hoàn thành",
    color:
      "bg-linear-to-br from-primary/20 via-primary/10 to-transparent border-2 border-primary/20",
  },
} as const;

export const COLUMN_ORDER = [
  TaskStatus.BACKLOG,
  TaskStatus.TODAY,
  TaskStatus.DONE,
];
