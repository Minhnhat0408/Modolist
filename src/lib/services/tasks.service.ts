/**
 * Tasks API — shared service logic.
 * Ported from NestJS TasksService to plain functions using Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TaskStatus,
  RecurrenceRule,
  CreateTaskInput,
  UpdateTaskInput,
  Task,
} from "@/lib/supabase/types";
import { storeEmbedding } from "@/lib/services/ai.service";

// ── Recurrence Helpers ────────────────────────────────────────────────────────

function normalizeWeeklyDays(days: number[] | undefined, fallbackDate: Date | null): number[] {
  const filtered = (days ?? [])
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  const unique = Array.from(new Set(filtered));
  if (unique.length > 0) return unique;
  return [(fallbackDate ?? new Date()).getDay()];
}

function normalizeMonthlyDay(day: number | undefined, fallbackDate: Date | null): number {
  if (typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 31) {
    return day;
  }
  return (fallbackDate ?? new Date()).getDate();
}

function normalizeRecurrenceConfig(
  recurrence: RecurrenceRule,
  recurrenceDaysOfWeek: number[] | undefined,
  recurrenceDayOfMonth: number | undefined,
  dueDate: Date | null,
) {
  if (recurrence === "WEEKLY") {
    return {
      recurrenceDaysOfWeek: normalizeWeeklyDays(recurrenceDaysOfWeek, dueDate),
      recurrenceDayOfMonth: null,
    };
  }
  if (recurrence === "MONTHLY") {
    return {
      recurrenceDaysOfWeek: [] as number[],
      recurrenceDayOfMonth: normalizeMonthlyDay(recurrenceDayOfMonth ?? undefined, dueDate),
    };
  }
  return { recurrenceDaysOfWeek: [] as number[], recurrenceDayOfMonth: null };
}

function getNextDueDate(
  current: Date | null,
  rule: RecurrenceRule,
  weeklyDays: number[] = [],
  monthDay: number | null = null,
): Date {
  const base = current ? new Date(current) : new Date();
  switch (rule) {
    case "DAILY":
      base.setDate(base.getDate() + 1);
      return base;
    case "WEEKDAY":
      base.setDate(base.getDate() + 1);
      while (base.getDay() === 0 || base.getDay() === 6) {
        base.setDate(base.getDate() + 1);
      }
      return base;
    case "WEEKLY": {
      const normalized = normalizeWeeklyDays(weeklyDays, base);
      let minDelta = 7;
      for (const day of normalized) {
        let delta = (day - base.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        if (delta < minDelta) minDelta = delta;
      }
      base.setDate(base.getDate() + minDelta);
      return base;
    }
    case "MONTHLY": {
      const desiredDay = normalizeMonthlyDay(monthDay ?? undefined, base);
      const currentMonth = base.getMonth();
      const currentYear = base.getFullYear();
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
      const clampedDay = Math.min(desiredDay, daysInNextMonth);
      return new Date(nextYear, nextMonth, clampedDay, base.getHours(), base.getMinutes());
    }
    default:
      base.setDate(base.getDate() + 1);
      return base;
  }
}

// Focus session summary select for task queries
const FOCUS_SESSION_SELECT = `
  focusSessions:focus_sessions(
    id, duration, "endedAt", "plannedDuration", "startedAt", status
  )
`;

function enqueueEmbeddingStore(
  supabase: SupabaseClient,
  task: { id: string; userId: string; title: string; description: string | null },
) {
  storeEmbedding(supabase, task.id, task.userId, task.title, task.description || "").catch((err) => {
    console.warn(`Failed to store embedding for task ${task.id}:`, err);
  });
}

// ── CRUD Functions ────────────────────────────────────────────────────────────

export async function findAllTasks(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false,
) {
  let query = supabase
    .from("tasks")
    .select(`*, ${FOCUS_SESSION_SELECT}`)
    .eq("userId", userId)
    .order("status", { ascending: true })
    .order("order", { ascending: true })
    .order("createdAt", { ascending: false });

  if (!includeArchived) {
    query = query.eq("isArchived", false);
  }

  // Filter focus sessions to only completed ones
  const { data, error } = await query;
  if (error) throw error;

  // Post-filter: only completed focus sessions
  return (data ?? []).map((task: Task & { focusSessions?: Array<{ status: string }> }) => ({
    ...task,
    focusSessions: (task.focusSessions ?? []).filter(
      (s: { status: string }) => s.status === "COMPLETED",
    ),
  }));
}

export async function findTasksByStatus(
  supabase: SupabaseClient,
  userId: string,
  status: TaskStatus,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("userId", userId)
    .eq("status", status)
    .eq("isArchived", false)
    .order("createdAt", { ascending: false });

  if (error) throw error;
  return data;
}

export async function findBacklog(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select(`*, ${FOCUS_SESSION_SELECT}`)
    .eq("userId", userId)
    .eq("status", "BACKLOG")
    .eq("isArchived", false)
    .order("order", { ascending: true })
    .order("createdAt", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((task: Task & { focusSessions?: Array<{ status: string }> }) => ({
    ...task,
    focusSessions: (task.focusSessions ?? []).filter(
      (s: { status: string }) => s.status === "COMPLETED",
    ),
  }));
}

export async function getBacklogCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId)
    .eq("status", "BACKLOG")
    .eq("isArchived", false);

  if (error) throw error;
  return count ?? 0;
}

export async function findDoneHistory(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select(`*, ${FOCUS_SESSION_SELECT}`)
    .eq("userId", userId)
    .eq("status", "DONE")
    .order("completedAt", { ascending: false, nullsFirst: false })
    .order("updatedAt", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((task: Task & { focusSessions?: Array<{ status: string }> }) => ({
    ...task,
    focusSessions: (task.focusSessions ?? []).filter(
      (s: { status: string }) => s.status === "COMPLETED",
    ),
  }));
}

export async function getDoneHistoryCount(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId)
    .eq("status", "DONE");

  if (error) throw error;
  return count ?? 0;
}

export async function findOneTask(supabase: SupabaseClient, id: string, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, focus_sessions(*)")
    .eq("id", id)
    .eq("userId", userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTaskInput,
) {
  const targetStatus = input.status || "BACKLOG";
  const dueDate = input.dueDate ? new Date(input.dueDate).toISOString() : null;
  const recurrence = input.recurrence ?? "NONE";
  const recurrenceConfig = normalizeRecurrenceConfig(
    recurrence,
    input.recurrenceDaysOfWeek,
    input.recurrenceDayOfMonth ?? undefined,
    dueDate ? new Date(dueDate) : null,
  );

  // Shift existing tasks in column up by 1
  await supabase.rpc("increment_task_order", {
    p_user_id: userId,
    p_status: targetStatus,
  });

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description ?? null,
      status: targetStatus,
      priority: input.priority ?? "MEDIUM",
      estimatedPomodoros: input.estimatedPomodoros ?? null,
      tags: input.tags ?? [],
      dueDate,
      recurrence,
      ...recurrenceConfig,
      suggestedSessionType: input.suggestedSessionType ?? null,
      suggestedSessions: input.suggestedSessions ?? null,
      suggestedTotalMinutes: input.suggestedTotalMinutes ?? null,
      userId,
      order: 0,
    })
    .select()
    .single();

  if (error) throw error;

  enqueueEmbeddingStore(supabase, {
    id: data.id,
    userId,
    title: data.title,
    description: data.description,
  });

  return data;
}

export async function createBatchTasks(
  supabase: SupabaseClient,
  userId: string,
  tasks: CreateTaskInput[],
) {
  const rows = tasks.map((dto) => {
    const dueDate = dto.dueDate ? new Date(dto.dueDate).toISOString() : null;
    const recurrence = dto.recurrence ?? "NONE";
    const recurrenceConfig = normalizeRecurrenceConfig(
      recurrence,
      dto.recurrenceDaysOfWeek,
      dto.recurrenceDayOfMonth ?? undefined,
      dueDate ? new Date(dueDate) : null,
    );

    return {
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status || "BACKLOG",
      priority: dto.priority ?? "MEDIUM",
      estimatedPomodoros: dto.estimatedPomodoros ?? null,
      tags: dto.tags ?? [],
      dueDate,
      recurrence,
      ...recurrenceConfig,
      userId,
      order: 0,
    };
  });

  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) throw error;

  for (const created of data ?? []) {
    enqueueEmbeddingStore(supabase, {
      id: created.id,
      userId,
      title: created.title,
      description: created.description,
    });
  }

  return { created: data?.length ?? 0 };
}

export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  input: UpdateTaskInput,
) {
  // Verify task exists and belongs to user
  const existing = await findOneTask(supabase, id, userId);
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { ...input };

  if (input.dueDate) {
    updateData.dueDate = new Date(input.dueDate).toISOString();
  }

  const effectiveDueDate = updateData.dueDate
    ? new Date(updateData.dueDate)
    : existing.dueDate
      ? new Date(existing.dueDate)
      : null;
  const effectiveRecurrence = input.recurrence ?? existing.recurrence ?? "NONE";
  const effectiveWeeklyDays = input.recurrenceDaysOfWeek ?? existing.recurrenceDaysOfWeek;
  const effectiveMonthlyDay = input.recurrenceDayOfMonth ?? existing.recurrenceDayOfMonth;

  const recurrenceConfig = normalizeRecurrenceConfig(
    effectiveRecurrence,
    effectiveWeeklyDays,
    effectiveMonthlyDay ?? undefined,
    effectiveDueDate,
  );
  Object.assign(updateData, recurrenceConfig);

  // Auto-set completedAt when status = DONE
  if (input.status === "DONE") {
    updateData.completedAt = new Date().toISOString();
  } else if (input.status) {
    updateData.completedAt = null;
    updateData.isArchived = false;
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", id)
    .eq("userId", userId)
    .select(`*, ${FOCUS_SESSION_SELECT}`)
    .single();

  if (error) throw error;

  // Filter focus sessions to completed only
  if (task?.focusSessions) {
    task.focusSessions = task.focusSessions.filter(
      (s: { status: string }) => s.status === "COMPLETED",
    );
  }

  if (task && (typeof input.title !== "undefined" || typeof input.description !== "undefined")) {
    enqueueEmbeddingStore(supabase, {
      id: task.id,
      userId,
      title: task.title,
      description: task.description,
    });
  }

  // Auto-spawn next recurring instance when marked DONE
  let spawnedTask = null;
  if (
    input.status === "DONE" &&
    existing.recurrence &&
    existing.recurrence !== "NONE"
  ) {
    spawnedTask = await spawnRecurring(supabase, existing);
  }

  return { ...task, spawnedTask };
}

async function spawnRecurring(
  supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  original: any,
) {
  const nextDue = getNextDueDate(
    original.dueDate ? new Date(original.dueDate) : null,
    original.recurrence,
    original.recurrenceDaysOfWeek,
    original.recurrenceDayOfMonth,
  );

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: original.title,
      description: original.description,
      status: "BACKLOG",
      priority: original.priority,
      tags: original.tags,
      estimatedPomodoros: original.estimatedPomodoros,
      suggestedSessionType: original.suggestedSessionType,
      suggestedSessions: original.suggestedSessions,
      suggestedTotalMinutes: original.suggestedTotalMinutes,
      embedding: original.embedding ?? null,
      recurrence: original.recurrence,
      recurrenceDaysOfWeek: original.recurrenceDaysOfWeek,
      recurrenceDayOfMonth: original.recurrenceDayOfMonth,
      dueDate: nextDue.toISOString(),
      userId: original.userId,
      order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  if (!original.embedding) {
    enqueueEmbeddingStore(supabase, {
      id: data.id,
      userId: original.userId,
      title: data.title,
      description: data.description,
    });
  }
  return data;
}

export async function duplicateTask(supabase: SupabaseClient, id: string, userId: string) {
  const original = await findOneTask(supabase, id, userId);
  if (!original) return null;

  // Shift existing TODAY tasks up
  await supabase.rpc("increment_task_order", {
    p_user_id: userId,
    p_status: "TODAY",
  });

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: original.title,
      description: original.description,
      status: "TODAY",
      priority: original.priority,
      tags: original.tags,
      estimatedPomodoros: original.estimatedPomodoros,
      suggestedSessionType: original.suggestedSessionType,
      suggestedSessions: original.suggestedSessions,
      suggestedTotalMinutes: original.suggestedTotalMinutes,
      embedding: original.embedding ?? null,
      recurrence: original.recurrence,
      recurrenceDaysOfWeek: original.recurrenceDaysOfWeek,
      recurrenceDayOfMonth: original.recurrenceDayOfMonth,
      dueDate: null,
      userId,
      order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  if (!original.embedding) {
    enqueueEmbeddingStore(supabase, {
      id: data.id,
      userId,
      title: data.title,
      description: data.description,
    });
  }
  return data;
}

export async function removeTask(supabase: SupabaseClient, id: string, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("userId", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveTask(supabase: SupabaseClient, id: string, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .update({ isArchived: true })
    .eq("id", id)
    .eq("userId", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTaskStats(supabase: SupabaseClient, userId: string) {
  const [total, backlog, today, done, archived] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("isArchived", false),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("status", "BACKLOG")
      .eq("isArchived", false),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("status", "TODAY")
      .eq("isArchived", false),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("status", "DONE")
      .eq("isArchived", false),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("isArchived", true),
  ]);

  return {
    total: total.count ?? 0,
    backlog: backlog.count ?? 0,
    today: today.count ?? 0,
    done: done.count ?? 0,
    archived: archived.count ?? 0,
  };
}

export async function updateTaskOrder(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  newOrder: number,
  status: TaskStatus,
) {
  // Get all tasks in the column
  const { data: columnTasks, error: fetchErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("userId", userId)
    .eq("status", status)
    .eq("isArchived", false)
    .order("order", { ascending: true });

  if (fetchErr) throw fetchErr;
  if (!columnTasks) return { success: false };

  const otherTasks = columnTasks.filter((t) => t.id !== id);
  otherTasks.splice(newOrder, 0, { id });

  // Update order for all tasks
  for (let i = 0; i < otherTasks.length; i++) {
    await supabase
      .from("tasks")
      .update({ order: i })
      .eq("id", otherTasks[i]!.id);
  }

  return { success: true, message: "Task order updated" };
}
