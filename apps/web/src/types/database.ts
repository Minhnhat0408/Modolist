/**
 * Client-safe database types
 * These types match the database schema but don't import any server-side code
 */

// Task type without importing from database package
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  completedPomodoros: number;
  estimatedPomodoros?: number | null;
  suggestedSessionType?: string | null; // "QUICK_5" | "QUICK_15" | "STANDARD"
  suggestedSessions?: number | null;
  suggestedTotalMinutes?: number | null;
  focusTotalSessions?: number | null; // Total sessions planned for current focus cycle
  order: number;
  tags: string[];
  dueDate: Date | null;
  completedAt: Date | null;
  isArchived: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// TaskStatus enum - MUST match database schema exactly
export enum TaskStatus {
  BACKLOG = "BACKLOG",
  TODAY = "TODAY",
  DONE = "DONE",
}

// TaskPriority enum - MUST match database schema exactly
export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
