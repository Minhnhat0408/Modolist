"use client";

import { useCallback } from "react";
import { useIsGuest } from "@/hooks/useIsGuest";
import { useGuestStore, type GuestFocusLog } from "@/stores/useGuestStore";
import { api } from "@/lib/api-client";
import { TaskStatus } from "@/types/database";

interface WeeklyDataPoint {
  label: string;
  date: string;
  focusTime: number;
  pomodoros: number;
  tasks: number;
}

interface DashboardStats {
  user: {
    totalFocusTime: number;
    currentStreak: number;
    longestStreak: number;
  };
  today: {
    focusTime: number;
    pomodoros: number;
    tasks: number;
  };
  week: {
    focusTime: number;
    pomodoros: number;
    data: WeeklyDataPoint[];
  };
  totals: {
    sessions: number;
    tasks: number;
  };
  heatmap?: { date: string; count: number; focusTime: number; tasks: number }[];
}

function toYMD(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function buildGuestStats(
  focusLog: GuestFocusLog[],
  taskCount: number,
  doneCount: number,
): DashboardStats {
  const todayStr = toYMD(new Date());

  const todayLog = focusLog.find((l) => l.date === todayStr);

  // Total focus time across all logs
  const totalFocusTime = focusLog.reduce((s, l) => s + l.focusTime, 0);
  const totalPomodoros = focusLog.reduce((s, l) => s + l.pomodoros, 0);

  // Build streak from sorted log dates
  const sortedDates = [...new Set(focusLog.map((l) => l.date))].sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  const checkDate = new Date();

  for (let i = 0; i < sortedDates.length; i++) {
    const expected = toYMD(checkDate);
    if (sortedDates[i] === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      if (i === 0) {
        // Allow today to be missing — check if yesterday matches
        checkDate.setDate(checkDate.getDate() - 1);
        if (sortedDates[i] === toYMD(checkDate)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }
  currentStreak = streak;
  // Simple longest streak
  streak = 0;
  const allDatesSet = new Set(sortedDates);
  const allSorted = [...allDatesSet].sort();
  for (let i = 0; i < allSorted.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(allSorted[i - 1]!);
      const curr = new Date(allSorted[i]!);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      streak = diffDays === 1 ? streak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }

  // Weekly data (last 7 days)
  const weekData: WeeklyDataPoint[] = [];
  let weekFocus = 0;
  let weekPomo = 0;
  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toYMD(d);
    const log = focusLog.find((l) => l.date === dateStr);
    weekData.push({
      label: dayNames[d.getDay()]!,
      date: dateStr,
      focusTime: log?.focusTime ?? 0,
      pomodoros: log?.pomodoros ?? 0,
      tasks: 0,
    });
    weekFocus += log?.focusTime ?? 0;
    weekPomo += log?.pomodoros ?? 0;
  }

  // Heatmap — all log entries
  const heatmap = focusLog.map((l) => ({ date: l.date, count: l.pomodoros, focusTime: l.focusTime, tasks: 0 }));

  return {
    user: { totalFocusTime, currentStreak, longestStreak },
    today: {
      focusTime: todayLog?.focusTime ?? 0,
      pomodoros: todayLog?.pomodoros ?? 0,
      tasks: doneCount,
    },
    week: { focusTime: weekFocus, pomodoros: weekPomo, data: weekData },
    totals: { sessions: totalPomodoros, tasks: taskCount },
    heatmap,
  };
}

export function useStatsSource() {
  const isGuest = useIsGuest();
  const focusLog = useGuestStore((s) => s.focusLog);
  const tasks = useGuestStore((s) => s.tasks);

  const fetchStats = useCallback(async (): Promise<DashboardStats> => {
    if (isGuest) {
      const doneCount = tasks.filter((t) => t.status === TaskStatus.DONE).length;
      return buildGuestStats(focusLog, tasks.length, doneCount);
    }
    return api.get<DashboardStats>("/focus-sessions/stats/dashboard");
  }, [isGuest, focusLog, tasks]);

  return { fetchStats };
}
