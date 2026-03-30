/**
 * Database types matching the Supabase schema.
 * These replace the Prisma-generated types.
 */

export type TaskStatus = "BACKLOG" | "TODAY" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type RecurrenceRule = "NONE" | "DAILY" | "WEEKDAY" | "WEEKLY" | "MONTHLY";
export type FocusSessionStatus = "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "INTERRUPTED";
export type AIInteractionType = "TASK_SUGGESTION" | "TASK_BREAKDOWN" | "MOTIVATION" | "PRODUCTIVITY_TIP";
export type BadgeCategory = "FOCUS" | "CONSISTENCY" | "PRODUCTIVITY" | "SOCIAL" | "MILESTONE";

export interface User {
  id: string;
  email: string;
  emailVerified: string | null;
  name: string | null;
  bio: string | null;
  timezone: string | null;
  totalFocusTime: number;
  currentStreak: number;
  longestStreak: number;
  password: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  completedPomodoros: number;
  focusTotalSessions: number | null;
  order: number;
  tags: string[];
  dueDate: string | null;
  completedAt: string | null;
  estimatedPomodoros: number | null;
  suggestedSessionType: string | null;
  suggestedSessions: number | null;
  suggestedTotalMinutes: number | null;
  isArchived: boolean;
  recurrence: RecurrenceRule;
  recurrenceDaysOfWeek: number[];
  recurrenceDayOfMonth: number | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  focusSessions?: FocusSessionSummary[];
}

export interface FocusSessionSummary {
  id: string;
  duration: number | null;
  endedAt: string | null;
  plannedDuration: number;
  startedAt: string;
  status: FocusSessionStatus;
}

export interface FocusSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  plannedDuration: number;
  elapsedTime: number;
  status: FocusSessionStatus;
  taskId: string | null;
  userId: string;
  breakDuration: number | null;
  createdAt: string;
  updatedAt: string;
  task?: TaskSummary | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  focusTotalSessions?: number | null;
  completedPomodoros?: number;
}

export interface DailyStats {
  id: string;
  date: string;
  totalFocusTime: number;
  completedPomodoros: number;
  completedTasks: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedPomodoros?: number | null;
  tags?: string[];
  dueDate?: string | null;
  recurrence?: RecurrenceRule;
  recurrenceDaysOfWeek?: number[];
  recurrenceDayOfMonth?: number | null;
  suggestedSessionType?: string | null;
  suggestedSessions?: number | null;
  suggestedTotalMinutes?: number | null;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  isArchived?: boolean;
  focusTotalSessions?: number | null;
  completedPomodoros?: number;
}

export interface CreateFocusSessionInput {
  taskId?: string | null;
  plannedDuration: number;
  duration?: number | null;
  status?: FocusSessionStatus;
  breakDuration?: number | null;
}
