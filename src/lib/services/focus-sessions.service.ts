/**
 * Focus Sessions API — shared service logic.
 * Ported from NestJS FocusSessionsService to plain functions using Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateFocusSessionInput, FocusSessionStatus } from "@/lib/supabase/types";

const TASK_SELECT = `task:tasks(id, title, status, "focusTotalSessions", "completedPomodoros")`;

export async function startSession(
  supabase: SupabaseClient,
  userId: string,
  taskId: string | null,
  plannedDuration: number,
) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      userId,
      taskId,
      plannedDuration,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
    })
    .select(`*, ${TASK_SELECT}`)
    .single();

  if (error) throw error;
  return data;
}

export async function completeSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  actualDuration: number,
) {
  // Verify session exists
  const { data: session, error: findErr } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("userId", userId)
    .single();

  if (findErr || !session) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Update session
  const { data: updatedSession, error: updateErr } = await supabase
    .from("focus_sessions")
    .update({
      status: "COMPLETED",
      duration: actualDuration,
      endedAt: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select(`*, ${TASK_SELECT}`)
    .single();

  if (updateErr) throw updateErr;

  // Increment task completedPomodoros
  if (session.taskId) {
    await supabase.rpc("increment_task_pomodoros", { p_task_id: session.taskId });
  }

  // Update user totalFocusTime
  await supabase.rpc("increment_user_focus_time", {
    p_user_id: userId,
    p_duration: actualDuration,
  });

  // Upsert daily stats
  await supabase.rpc("upsert_daily_stats_on_complete", {
    p_user_id: userId,
    p_date: todayStr,
    p_duration: actualDuration,
  });

  return updatedSession;
}

export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  input: CreateFocusSessionInput,
) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      userId,
      taskId: input.taskId ?? null,
      plannedDuration: input.plannedDuration,
      duration: input.duration ?? null,
      status: input.status || "IN_PROGRESS",
      breakDuration: input.breakDuration ?? null,
      startedAt: new Date().toISOString(),
      endedAt: input.status === "COMPLETED" ? new Date().toISOString() : null,
    })
    .select(`*, ${TASK_SELECT}`)
    .single();

  if (error) throw error;

  // If created as completed, update stats
  if (input.status === "COMPLETED" && input.taskId) {
    await supabase.rpc("increment_task_pomodoros", { p_task_id: input.taskId });
    const duration = input.duration || input.plannedDuration;
    await supabase.rpc("increment_user_focus_time", {
      p_user_id: userId,
      p_duration: duration,
    });
  }

  return data;
}

export async function findAllSessions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select(`*, ${TASK_SELECT}`)
    .eq("userId", userId)
    .order("startedAt", { ascending: false });

  if (error) throw error;
  return data;
}

export async function findSessionsByTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("id, startedAt, endedAt, plannedDuration, duration, status")
    .eq("userId", userId)
    .eq("taskId", taskId)
    .in("status", ["COMPLETED", "INTERRUPTED"])
    .order("startedAt", { ascending: false });

  if (error) throw error;
  return data;
}

export async function findOneSession(
  supabase: SupabaseClient,
  id: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select(`*, ${TASK_SELECT}`)
    .eq("id", id)
    .eq("userId", userId)
    .single();

  if (error) return null;
  return data;
}

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  input: { duration?: number; status?: FocusSessionStatus; breakDuration?: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (input.duration !== undefined) updateData.duration = input.duration;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.breakDuration !== undefined) updateData.breakDuration = input.breakDuration;
  if (input.status === "COMPLETED") updateData.endedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("focus_sessions")
    .update(updateData)
    .eq("id", id)
    .eq("userId", userId)
    .select(`*, ${TASK_SELECT}`)
    .single();

  if (error) throw error;

  // If completed, update task pomodoros and user stats
  if (input.status === "COMPLETED" && data?.taskId) {
    await supabase.rpc("increment_task_pomodoros", { p_task_id: data.taskId });
    const duration = input.duration || data.duration || data.plannedDuration;
    await supabase.rpc("increment_user_focus_time", {
      p_user_id: userId,
      p_duration: duration,
    });
  }

  return data;
}

export async function removeSession(supabase: SupabaseClient, id: string, userId: string) {
  const { data, error } = await supabase
    .from("focus_sessions")
    .delete()
    .eq("id", id)
    .eq("userId", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function pauseSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  elapsedTimeFromClient?: number,
) {
  const { data: session, error: findErr } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("userId", userId)
    .single();

  if (findErr || !session) return null;

  const elapsedTime =
    elapsedTimeFromClient !== undefined
      ? elapsedTimeFromClient
      : Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);

  const { data, error } = await supabase
    .from("focus_sessions")
    .update({ status: "PAUSED", elapsedTime })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resumeSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
) {
  const { data: session, error: findErr } = await supabase
    .from("focus_sessions")
    .select("id, elapsedTime")
    .eq("id", sessionId)
    .eq("userId", userId)
    .eq("status", "PAUSED")
    .single();

  if (findErr || !session) return null;

  const newStartedAt = new Date(Date.now() - session.elapsedTime * 1000).toISOString();

  const { data, error } = await supabase
    .from("focus_sessions")
    .update({ status: "IN_PROGRESS", startedAt: newStartedAt })
    .eq("id", sessionId)
    .select(`*, ${TASK_SELECT}`)
    .single();

  if (error) throw error;
  return data;
}

export async function getCurrentSession(supabase: SupabaseClient, userId: string) {
  // Check for IN_PROGRESS session
  const { data: activeSession } = await supabase
    .from("focus_sessions")
    .select(`*, ${TASK_SELECT}`)
    .eq("userId", userId)
    .eq("status", "IN_PROGRESS")
    .order("startedAt", { ascending: false })
    .limit(1)
    .single();

  if (activeSession) {
    return { session: activeSession, canResume: true };
  }

  // Check for PAUSED session with grace period
  const { data: pausedSession } = await supabase
    .from("focus_sessions")
    .select(`id, "plannedDuration", "elapsedTime", "updatedAt", status, ${TASK_SELECT}`)
    .eq("userId", userId)
    .eq("status", "PAUSED")
    .order("updatedAt", { ascending: false })
    .limit(1)
    .single();

  if (!pausedSession) {
    return { session: null, canResume: false };
  }

  const now = new Date();
  const diffSeconds = Math.floor(
    (now.getTime() - new Date(pausedSession.updatedAt).getTime()) / 1000,
  );
  const GRACE_PERIOD_SECONDS = 5 * 60;

  if (diffSeconds <= GRACE_PERIOD_SECONDS) {
    return { session: pausedSession, canResume: true };
  }

  // Grace period expired → mark as INTERRUPTED
  await supabase
    .from("focus_sessions")
    .update({
      status: "INTERRUPTED",
      endedAt: pausedSession.updatedAt,
      duration: pausedSession.elapsedTime,
    })
    .eq("id", pausedSession.id);

  return { session: null, canResume: false };
}

export async function getIncompleteSession(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
) {
  if (!taskId) return { session: null };

  const { data } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("userId", userId)
    .eq("taskId", taskId)
    .in("status", ["IN_PROGRESS", "PAUSED"])
    .order("startedAt", { ascending: false })
    .limit(1)
    .single();

  return { session: data ?? null };
}

export async function getSessionStats(supabase: SupabaseClient, userId: string) {
  const { data: sessions } = await supabase
    .from("focus_sessions")
    .select("duration, startedAt")
    .eq("userId", userId)
    .eq("status", "COMPLETED");

  const allSessions = sessions ?? [];
  const totalSessions = allSessions.length;
  const totalFocusTime = allSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const averageSessionDuration = totalSessions > 0 ? totalFocusTime / totalSessions : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySessions = allSessions.filter((s) => new Date(s.startedAt) >= today);
  const todayFocusTime = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);

  return {
    totalSessions,
    totalFocusTime,
    averageSessionDuration,
    todayFocusTime,
    todaySessions: todaySessions.length,
  };
}

export async function getDashboardStats(supabase: SupabaseClient, userId: string) {
  // User info
  const { data: user } = await supabase
    .from("users")
    .select("totalFocusTime, currentStreak, longestStreak")
    .eq("id", userId)
    .single();

  // Last 7 days
  const days: { date: Date; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    days.push({ date: d, label: dayNames[d.getDay()]! });
  }

  const weekStart = days[0]!.date.toISOString();
  const weekEnd = new Date();
  weekEnd.setHours(23, 59, 59, 999);

  const { data: dailyStats } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("userId", userId)
    .gte("date", weekStart)
    .lte("date", weekEnd.toISOString())
    .order("date", { ascending: true });

  const statsMap = new Map(
    (dailyStats ?? []).map((s: { date: string; totalFocusTime: number; completedPomodoros: number; completedTasks: number }) => [
      s.date.split("T")[0],
      s,
    ]),
  );

  const weeklyData = days.map((d) => {
    const key = d.date.toISOString().split("T")[0];
    const stat = statsMap.get(key) as { totalFocusTime?: number; completedPomodoros?: number; completedTasks?: number } | undefined;
    return {
      label: d.label,
      date: key,
      focusTime: stat?.totalFocusTime || 0,
      pomodoros: stat?.completedPomodoros || 0,
      tasks: stat?.completedTasks || 0,
    };
  });

  const todayKey = days[6]!.date.toISOString().split("T")[0];
  const todayStat = statsMap.get(todayKey) as { totalFocusTime?: number; completedPomodoros?: number; completedTasks?: number } | undefined;

  // Totals
  const { count: totalSessions } = await supabase
    .from("focus_sessions")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId)
    .eq("status", "COMPLETED");

  const { count: totalTasksCompleted } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId)
    .eq("status", "DONE");

  const weekFocusTime = weeklyData.reduce((acc, d) => acc + d.focusTime, 0);
  const weekPomodoros = weeklyData.reduce((acc, d) => acc + d.pomodoros, 0);

  // Heatmap: last 182 days
  const heatmapDays = 182;
  const heatmapStart = new Date();
  heatmapStart.setDate(heatmapStart.getDate() - heatmapDays + 1);
  heatmapStart.setHours(0, 0, 0, 0);

  const { data: heatmapRaw } = await supabase
    .from("daily_stats")
    .select("date, completedPomodoros, totalFocusTime, completedTasks")
    .eq("userId", userId)
    .gte("date", heatmapStart.toISOString())
    .order("date", { ascending: true });

  const heatmapMap = new Map(
    (heatmapRaw ?? []).map((s: { date: string; completedPomodoros: number; totalFocusTime: number; completedTasks: number }) => [
      s.date.split("T")[0],
      { count: s.completedPomodoros, focusTime: s.totalFocusTime ?? 0, tasks: s.completedTasks ?? 0 },
    ]),
  );

  const heatmap: { date: string; count: number; focusTime: number; tasks: number }[] = [];
  for (let i = heatmapDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    const entry = heatmapMap.get(key);
    heatmap.push({ date: key, count: entry?.count ?? 0, focusTime: entry?.focusTime ?? 0, tasks: entry?.tasks ?? 0 });
  }

  return {
    user: {
      totalFocusTime: user?.totalFocusTime || 0,
      currentStreak: user?.currentStreak || 0,
      longestStreak: user?.longestStreak || 0,
    },
    today: {
      focusTime: todayStat?.totalFocusTime || 0,
      pomodoros: todayStat?.completedPomodoros || 0,
      tasks: todayStat?.completedTasks || 0,
    },
    week: {
      focusTime: weekFocusTime,
      pomodoros: weekPomodoros,
      data: weeklyData,
    },
    totals: {
      sessions: totalSessions ?? 0,
      tasks: totalTasksCompleted ?? 0,
    },
    heatmap,
  };
}
