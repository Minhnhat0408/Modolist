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
    // Accent tokens used in sheets / overflow drawers
    accent: {
      /** Handle pill on bottom sheet */
      handle: "bg-white/25",
      /** Header area gradient background */
      headerBg: "bg-white/5",
      /** Header bottom border */
      headerBorder: "border-white/15",
      /** Badge background + text */
      badgeCls: "bg-white/15 text-white/80 border-white/20",
      /** Date-group section label */
      dateLabelCls: "text-white/60",
      /** Date-group icon color */
      dateIconCls: "text-white/40",
      /** Sticky date header background */
      dateStickyBg: "bg-white/5",
    },
  },
  [TaskStatus.TODAY]: {
    id: TaskStatus.TODAY,
    title: "🎯 Hôm nay",
    color:
      "bg-linear-to-br from-secondary/20 via-secondary/10 to-transparent border-2 border-secondary/20",
    accent: {
      handle: "bg-secondary/40",
      headerBg: "bg-secondary/10",
      headerBorder: "border-secondary/25",
      badgeCls: "bg-secondary/25 text-secondary border-secondary/30",
      dateLabelCls: "text-secondary/80",
      dateIconCls: "text-secondary/60",
      dateStickyBg: "bg-secondary/5",
    },
  },
  [TaskStatus.DONE]: {
    id: TaskStatus.DONE,
    title: "✅ Hoàn thành",
    color:
      "bg-linear-to-br from-primary/20 via-primary/10 to-transparent border-2 border-primary/20",
    accent: {
      handle: "bg-primary/40",
      headerBg: "bg-primary/10",
      headerBorder: "border-primary/25",
      badgeCls: "bg-primary/25 text-primary border-primary/30",
      dateLabelCls: "text-primary/80",
      dateIconCls: "text-primary/60",
      dateStickyBg: "bg-primary/5",
    },
  },
} as const;

export const COLUMN_ORDER = [
  TaskStatus.BACKLOG,
  TaskStatus.TODAY,
  TaskStatus.DONE,
];
