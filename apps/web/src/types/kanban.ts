import type { Task } from "@/types/database";
import { TaskStatus } from "@/types/database";

export interface KanbanTask extends Task {
  focusSessions?: {
    id: string;
    duration: number | null;
    endedAt: Date | null;
    plannedDuration: number;
    startedAt: Date;
    status: string;
  }[];
}

export const KANBAN_COLUMNS = {
  [TaskStatus.BACKLOG]: {
    id: TaskStatus.BACKLOG,
    title: "📋 Danh sách chờ",
    color:
      "bg-white/50 border border-slate-200/70 dark:bg-white/10 dark:border-white/10",
    // Accent tokens used in sheets / overflow drawers
    accent: {
      /** Handle pill on bottom sheet */
      handle: "bg-muted dark:bg-white/25",
      /** Header area gradient background */
      headerBg: "bg-muted/60 dark:bg-white/5",
      /** Header bottom border */
      headerBorder: "border-border dark:border-white/15",
      /** Badge background + text */
      badgeCls:
        "bg-muted text-muted-foreground border-border dark:bg-white/15 dark:text-white/80 dark:border-white/20",
      /** Date-group section label */
      dateLabelCls: "text-muted-foreground dark:text-white/60",
      /** Date-group icon color */
      dateIconCls: "text-muted-foreground/70 dark:text-white/40",
      /** Sticky date header background */
      dateStickyBg: "bg-muted/30 dark:bg-white/5",
    },
  },
  [TaskStatus.TODAY]: {
    id: TaskStatus.TODAY,
    title: "🎯 Hôm nay",
    color:
      "bg-linear-to-br from-secondary/10 via-secondary/5 to-transparent border-2 border-secondary/20 dark:from-secondary/20 dark:via-secondary/10",
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
      "bg-linear-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/15 dark:from-primary/20 dark:via-primary/10 dark:border-primary/20",
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
