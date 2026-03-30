"use client";

import { api } from "@/lib/api-client";
import { useGuestStore } from "@/stores/useGuestStore";
import { useIsGuest } from "@/hooks/useIsGuest";
import { useCallback, useMemo } from "react";

type SessionResponse = { id: string };

export interface FocusLogger {
  isGuest: boolean;
  startSession: (taskId: string, plannedDuration: number) => Promise<string | null>;
  pauseSession: (sessionId: string, elapsedTime: number) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  completeSession: (sessionId: string, actualDuration: number) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  getIncomplete: (taskId: string) => Promise<{ id: string } | null>;
  getCurrent: () => Promise<{
    session?: {
      id: string;
      plannedDuration: number;
      elapsedTime: number;
      startedAt: string;
      status: string;
      task?: {
        id: string;
        title: string;
        status: string;
        focusTotalSessions?: number | null;
        completedPomodoros?: number;
      };
    };
    canResume?: boolean;
  } | null>;
  updateTask: (taskId: string, data: Record<string, unknown>) => Promise<void>;
  logGuestFocus: (pomodoros: number, focusTime: number) => void;
}

export function useFocusLogger(): FocusLogger {
  const isGuest = useIsGuest();
  const logFocusSession = useGuestStore((s) => s.logFocusSession);
  const guestUpdateTask = useGuestStore((s) => s.updateTask);

  const startSession = useCallback(
    async (taskId: string, plannedDuration: number): Promise<string | null> => {
      if (isGuest) return `guest-${crypto.randomUUID()}`;
      try {
        const data = await api.post<SessionResponse>("/focus-sessions/start", {
          taskId,
          plannedDuration,
        });
        return data.id;
      } catch (error) {
        console.error("Failed to create focus session:", error);
        return null;
      }
    },
    [isGuest],
  );

  const pauseSession = useCallback(
    async (sessionId: string, elapsedTime: number) => {
      if (isGuest) return;
      try {
        await api.patch(`/focus-sessions/${sessionId}/pause`, { elapsedTime });
      } catch (error) {
        console.error("Failed to pause session:", error);
      }
    },
    [isGuest],
  );

  const resumeSession = useCallback(
    async (sessionId: string) => {
      if (isGuest) return;
      try {
        await api.patch(`/focus-sessions/${sessionId}/resume`);
      } catch (error) {
        console.error("Failed to resume session:", error);
      }
    },
    [isGuest],
  );

  const completeSession = useCallback(
    async (sessionId: string, actualDuration: number) => {
      if (isGuest) {
        logFocusSession({ pomodoros: 1, focusTime: actualDuration });
        return;
      }
      try {
        await api.patch(`/focus-sessions/${sessionId}/complete`, {
          actualDuration,
        });
      } catch (error) {
        console.error("Failed to complete focus session:", error);
      }
    },
    [isGuest, logFocusSession],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (isGuest) return;
      try {
        await api.delete(`/focus-sessions/${sessionId}`);
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [isGuest],
  );

  const getIncomplete = useCallback(
    async (taskId: string): Promise<{ id: string } | null> => {
      if (isGuest) return null;
      try {
        const response = await api.get<{ session?: { id?: string } | null }>(
          `/focus-sessions/incomplete?taskId=${taskId}`,
        );
        return response?.session?.id ? { id: response.session.id } : null;
      } catch {
        return null;
      }
    },
    [isGuest],
  );

  const getCurrent = useCallback(async () => {
    if (isGuest) return null; // Guests don't restore from backend
    try {
      return await api.get<{
        session?: {
          id: string;
          plannedDuration: number;
          elapsedTime: number;
          startedAt: string;
          status: string;
          task?: {
            id: string;
            title: string;
            status: string;
            focusTotalSessions?: number | null;
            completedPomodoros?: number;
          };
        };
        canResume?: boolean;
      }>("/focus-sessions/current");
    } catch {
      return null;
    }
  }, [isGuest]);

  const updateTask = useCallback(
    async (taskId: string, data: Record<string, unknown>) => {
      if (isGuest) {
        guestUpdateTask(taskId, data);
        return;
      }
      try {
        await api.patch(`/tasks/${taskId}`, data);
      } catch (error) {
        console.error("Failed to update task:", error);
      }
    },
    [isGuest, guestUpdateTask],
  );

  const logGuestFocus = useCallback(
    (pomodoros: number, focusTime: number) => {
      if (isGuest) {
        logFocusSession({ pomodoros, focusTime });
      }
    },
    [isGuest, logFocusSession],
  );

  return useMemo(
    () => ({
      isGuest,
      startSession,
      pauseSession,
      resumeSession,
      completeSession,
      deleteSession,
      getIncomplete,
      getCurrent,
      updateTask,
      logGuestFocus,
    }),
    [
      isGuest,
      startSession,
      pauseSession,
      resumeSession,
      completeSession,
      deleteSession,
      getIncomplete,
      getCurrent,
      updateTask,
      logGuestFocus,
    ],
  );
}
