import { create } from "zustand";
import { KanbanTask } from "@/types/kanban";
import { api } from "@/lib/api-client";

type SessionResponse = { id: string };

export type FocusType = "SHORT" | "STANDARD";
export type FocusMode = "WORK" | "SHORT_BREAK" | "LONG_BREAK";
export type FocusStatus =
  | "idle"
  | "focusing"
  | "break"
  | "paused"
  | "completed"
  | "all_completed";

export const FOCUS_DURATIONS = {
  WORK: 25 * 60, // 25 minutes in seconds
  SHORT_BREAK: 5 * 60, // 5 minutes
  LONG_BREAK: 15 * 60, // 15 minutes
  QUICK_5: 5 * 60, // 5 minutes quick focus
  QUICK_25: 25 * 60, // 25 minutes quick focus
} as const;

interface FocusStore {
  // Core state
  activeTask: KanbanTask | null;
  status: FocusStatus;
  timeLeft: number;
  isMinimized: boolean;
  mode: FocusMode;
  sessionId: string | null;
  focusType: FocusType;
  shortFocusDuration: number; // Actual duration for SHORT type (QUICK_5 or QUICK_25)

  // Date-based timer: stores the wall-clock timestamp when timer should reach 0
  targetEndTime: number | null; // Date.now() + timeLeft*1000

  // For STANDARD type (Type B - Pomodoro loop)
  totalSessions: number; // Total sessions planned
  currentSession: number; // Current session number (1-based)
  completedSessions: number; // Sessions completed

  // UI State
  showCompletionModal: boolean; // Show when all sessions complete

  // Actions
  startShortFocus: (task: KanbanTask, minutes: 5 | 25) => void;
  startStandardFocus: (task: KanbanTask, sessionCount: number) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => void;
  completeFocus: () => void;
  toggleMinimize: () => void;
  tick: () => void;
  reset: () => void;
  skipToNext: () => void;
  skipWorkSession: () => void;
  markWorkDone: () => void;
  addOneSession: () => void;
  completeAndExit: () => void;
  takeLongBreak: () => void;
  restoreSession: () => Promise<void>;
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  // Initial state
  activeTask: null,
  status: "idle",
  timeLeft: FOCUS_DURATIONS.WORK,
  isMinimized: false,
  mode: "WORK",
  sessionId: null,
  focusType: "SHORT",
  shortFocusDuration: FOCUS_DURATIONS.QUICK_25,
  targetEndTime: null,
  totalSessions: 1,
  currentSession: 1,
  completedSessions: 0,
  showCompletionModal: false,

  // Type A: Short Focus (5 or 25 minutes, no break)
  startShortFocus: (task, minutes) => {
    const duration =
      minutes === 5 ? FOCUS_DURATIONS.QUICK_5 : FOCUS_DURATIONS.QUICK_25;

    // Quick Focus logic: detect if adding more session after completion
    const currentCompleted = task.focusCompletedSessions || 0;
    const currentTotal = task.focusTotalSessions || 0;
    const isAddingMore = currentTotal > 0 && currentCompleted >= currentTotal;

    // Calculate new total sessions for Quick Focus (always +1)
    const newTotalSessions = isAddingMore ? currentTotal + 1 : 1;

    set({
      activeTask: task,
      status: "focusing",
      timeLeft: duration,
      mode: "WORK",
      isMinimized: false,
      focusType: "SHORT",
      shortFocusDuration: duration,
      totalSessions: newTotalSessions,
      currentSession: 1,
      completedSessions: 0,
      sessionId: null,
      showCompletionModal: false,
      targetEndTime: Date.now() + duration * 1000,
    });

    // Update task's focusTotalSessions if adding more
    if (isAddingMore) {
      api
        .patch(`/tasks/${task.id}`, {
          focusTotalSessions: newTotalSessions,
        })
        .catch((error) => {
          console.error("Failed to update task focus total sessions:", error);
        });
    }

    api
      .post("/focus-sessions/start", {
        taskId: task.id,
        plannedDuration: duration,
      })
      .then((data) => {
        set({ sessionId: (data as SessionResponse).id });
      })
      .catch((error) => {
        console.error("Failed to create focus session:", error);
        alert("Không thể bắt đầu focus session. Vui lòng thử lại.");
        get().reset();
      });
  },

  // Type B: Standard Focus (Pomodoro loop with breaks)
  startStandardFocus: (task, sessionCount) => {
    const currentCompleted = task.focusCompletedSessions || 0;
    const currentTotal = task.focusTotalSessions || 0;

    // Check if resuming existing session (not yet completed all)
    const isResuming = currentTotal > 0 && currentCompleted < currentTotal;

    // Check if all sessions are completed (need to add more)
    const isAddingMore = currentTotal > 0 && currentCompleted >= currentTotal;

    // Calculate new total sessions
    const newTotalSessions = isAddingMore
      ? currentTotal + sessionCount // Add to existing
      : isResuming
        ? currentTotal
        : sessionCount; // Resume or new

    set({
      activeTask: task,
      status: "focusing",
      timeLeft: FOCUS_DURATIONS.WORK,
      mode: "WORK",
      isMinimized: false,
      focusType: "STANDARD",
      totalSessions: newTotalSessions,
      currentSession: currentCompleted + 1,
      completedSessions: currentCompleted,
      sessionId: null,
      showCompletionModal: false,
      targetEndTime: Date.now() + FOCUS_DURATIONS.WORK * 1000,
    });

    if (!isResuming || isAddingMore) {
      api
        .patch(`/tasks/${task.id}`, {
          focusTotalSessions: newTotalSessions,
        })
        .catch((error) => {
          console.error("Failed to save session data:", error);
        });
    }

    api
      .get(`/focus-sessions/incomplete?taskId=${task.id}`)
      .then((response) => {
        const incompleteSession = (
          response as { session?: { id?: string } | null }
        )?.session;
        if (incompleteSession?.id) {
          set({ sessionId: incompleteSession.id });
          return null;
        } else {
          return api.post("/focus-sessions/start", {
            taskId: task.id,
            plannedDuration: FOCUS_DURATIONS.WORK,
          });
        }
      })
      .then((data) => {
        if (data) {
          set({ sessionId: (data as SessionResponse).id });
        }
      })
      .catch((error) => {
        console.error(
          "Failed to check incomplete session, creating new:",
          error,
        );
        api
          .post("/focus-sessions/start", {
            taskId: task.id,
            plannedDuration: FOCUS_DURATIONS.WORK,
          })
          .then((data) => {
            set({ sessionId: (data as SessionResponse).id });
          })
          .catch((fallbackError) => {
            console.error("Fallback session creation failed:", fallbackError);
            alert("Không thể bắt đầu focus session. Vui lòng thử lại.");
            get().reset();
          });
      });
  },

  pauseFocus: () => {
    const { status, sessionId, timeLeft, mode } = get();
    if (status === "focusing" || status === "break") {
      // Calculate how much time has been used
      const maxDuration =
        mode === "WORK"
          ? FOCUS_DURATIONS.WORK
          : mode === "SHORT_BREAK"
            ? FOCUS_DURATIONS.SHORT_BREAK
            : FOCUS_DURATIONS.LONG_BREAK;
      const elapsedTime = maxDuration - timeLeft;

      set({ status: "paused", targetEndTime: null });

      // Notify backend to set session PAUSED with elapsedTime
      if (sessionId && mode === "WORK") {
        api
          .patch(`/focus-sessions/${sessionId}/pause`, { elapsedTime })
          .catch((error) => {
            console.error("Failed to pause session:", error);
          });
      }
    }
  },

  resumeFocus: () => {
    const { status, mode, timeLeft, sessionId } = get();
    if (status === "paused") {
      const newStatus = mode === "WORK" ? "focusing" : "break";
      set({
        status: newStatus,
        targetEndTime: Date.now() + timeLeft * 1000,
      });

      // Notify backend to set session IN_PROGRESS
      if (sessionId && mode === "WORK") {
        api.patch(`/focus-sessions/${sessionId}/resume`).catch((error) => {
          console.error("Failed to resume session:", error);
        });
      }
    }
  },

  stopFocus: () => {
    const { sessionId, mode, activeTask, timeLeft } = get();

    if (sessionId && mode === "WORK") {
      const elapsedTime = FOCUS_DURATIONS.WORK - timeLeft;
      api
        .patch(`/focus-sessions/${sessionId}/pause`, { elapsedTime })
        .then(() => {
          if (activeTask) {
            window.dispatchEvent(
              new CustomEvent("sessionCompleted", {
                detail: { taskId: activeTask.id },
              }),
            );
          }
        })
        .catch((error) => {
          console.error("Failed to pause session:", error);
        });
    }

    set({
      activeTask: null,
      status: "idle",
      timeLeft: FOCUS_DURATIONS.WORK,
      isMinimized: false,
      mode: "WORK",
      sessionId: null,
      focusType: "SHORT",
      targetEndTime: null,
      totalSessions: 1,
      currentSession: 1,
      completedSessions: 0,
      showCompletionModal: false,
    });
  },

  completeFocus: () => {
    const {
      mode,
      focusType,
      currentSession,
      totalSessions,
      completedSessions,
      sessionId,
    } = get();

    if (focusType === "SHORT") {
      set({
        status: "completed",
        timeLeft: 0,
        showCompletionModal: true,
      });

      if (sessionId) {
        api
          .patch(`/focus-sessions/${sessionId}/complete`, {
            actualDuration: 25 * 60,
          })
          .catch((error) => {
            console.error("Failed to complete focus session:", error);
          });
      }
      return;
    }

    if (mode === "WORK") {
      const newCompletedSessions = completedSessions + 1;

      if (newCompletedSessions >= totalSessions) {
        set({
          status: "all_completed",
          timeLeft: 0,
          completedSessions: newCompletedSessions,
          sessionId: null,
          showCompletionModal: true,
        });
      } else {
        set({
          status: "break",
          mode: "SHORT_BREAK",
          timeLeft: FOCUS_DURATIONS.SHORT_BREAK,
          completedSessions: newCompletedSessions,
          sessionId: null,
          targetEndTime: Date.now() + FOCUS_DURATIONS.SHORT_BREAK * 1000,
        });
      }

      if (sessionId) {
        api
          .patch(`/focus-sessions/${sessionId}/complete`, {
            actualDuration: FOCUS_DURATIONS.WORK,
          })
          .then(() => {
            const task = get().activeTask;
            if (task) {
              window.dispatchEvent(
                new CustomEvent("sessionCompleted", {
                  detail: { taskId: task.id },
                }),
              );
            }
          })
          .catch((error) => {
            console.error("Failed to complete focus session:", error);
          });
      }
    } else {
      const nextSession = currentSession + 1;
      const activeTask = get().activeTask;

      set({
        status: "focusing",
        mode: "WORK",
        timeLeft: FOCUS_DURATIONS.WORK,
        currentSession: nextSession,
        sessionId: null,
        targetEndTime: Date.now() + FOCUS_DURATIONS.WORK * 1000,
      });

      if (activeTask) {
        api
          .post("/focus-sessions/start", {
            taskId: activeTask.id,
            plannedDuration: FOCUS_DURATIONS.WORK,
          })
          .then((data) => {
            set({ sessionId: (data as SessionResponse).id });
          })
          .catch((error) => {
            console.error("Failed to create focus session:", error);
          });
      }
    }
  },

  toggleMinimize: () => {
    set((state) => ({ isMinimized: !state.isMinimized }));
  },

  tick: () => {
    const { status, targetEndTime } = get();

    if (status === "focusing" || status === "break") {
      if (targetEndTime) {
        const newTimeLeft = Math.max(
          0,
          Math.ceil((targetEndTime - Date.now()) / 1000),
        );
        if (newTimeLeft > 0) {
          set({ timeLeft: newTimeLeft });
        } else {
          set({ timeLeft: 0, targetEndTime: null });
          get().completeFocus();
        }
      } else {
        // Fallback: no targetEndTime (e.g. restored paused session)
        const { timeLeft } = get();
        if (timeLeft > 0) {
          set({ timeLeft: timeLeft - 1 });
        } else {
          get().completeFocus();
        }
      }
    }
  },

  reset: () => {
    set({
      activeTask: null,
      status: "idle",
      timeLeft: FOCUS_DURATIONS.WORK,
      isMinimized: false,
      mode: "WORK",
      sessionId: null,
      focusType: "SHORT",
      targetEndTime: null,
      totalSessions: 1,
      currentSession: 1,
      completedSessions: 0,
      showCompletionModal: false,
    });
  },

  // Skip to next phase
  skipToNext: () => {
    const { mode, focusType, currentSession, activeTask } = get();

    if (focusType === "SHORT") return;

    if (mode !== "WORK") {
      const nextSession = currentSession + 1;

      set({
        status: "focusing",
        mode: "WORK",
        timeLeft: FOCUS_DURATIONS.WORK,
        currentSession: nextSession,
        sessionId: null,
        targetEndTime: Date.now() + FOCUS_DURATIONS.WORK * 1000,
      });

      if (activeTask) {
        api
          .post("/focus-sessions/start", {
            taskId: activeTask.id,
            plannedDuration: FOCUS_DURATIONS.WORK,
          })
          .then((data) => {
            set({ sessionId: (data as SessionResponse).id });
          })
          .catch((error) => {
            console.error("Failed to create focus session:", error);
          });
      }
    }
  },

  skipWorkSession: () => {
    const { focusType, totalSessions, completedSessions, sessionId } = get();

    if (focusType === "SHORT") return;

    if (sessionId) {
      api.delete(`/focus-sessions/${sessionId}`).catch((error) => {
        console.error("Failed to delete skipped session:", error);
      });
    }

    if (completedSessions + 1 >= totalSessions) {
      set({
        status: "all_completed",
        timeLeft: 0,
        sessionId: null,
        showCompletionModal: true,
        targetEndTime: null,
      });
    } else {
      set({
        status: "break",
        mode: "SHORT_BREAK",
        timeLeft: FOCUS_DURATIONS.SHORT_BREAK,
        sessionId: null,
        targetEndTime: Date.now() + FOCUS_DURATIONS.SHORT_BREAK * 1000,
      });
    }
  },

  markWorkDone: () => {
    const { focusType, totalSessions, completedSessions, sessionId, timeLeft } =
      get();

    if (focusType === "SHORT") {
      set({
        status: "completed",
        timeLeft: 0,
        showCompletionModal: true,
      });

      if (sessionId) {
        const actualDuration = (FOCUS_DURATIONS.QUICK_25 - timeLeft) * 60;
        api
          .patch(`/focus-sessions/${sessionId}/complete`, {
            actualDuration,
          })
          .catch((error) => {
            console.error("Failed to complete focus session:", error);
          });
      }
      return;
    }

    const newCompletedSessions = completedSessions + 1;

    if (sessionId) {
      const actualDuration = (FOCUS_DURATIONS.WORK - timeLeft) * 60;
      api
        .patch(`/focus-sessions/${sessionId}/complete`, {
          actualDuration,
        })
        .then(() => {
          const task = get().activeTask;
          if (task) {
            window.dispatchEvent(
              new CustomEvent("sessionCompleted", {
                detail: { taskId: task.id },
              }),
            );
          }
        })
        .catch((error) => {
          console.error("Failed to complete focus session:", error);
        });
    }

    if (newCompletedSessions >= totalSessions) {
      set({
        status: "all_completed",
        timeLeft: 0,
        completedSessions: newCompletedSessions,
        sessionId: null,
        showCompletionModal: true,
        targetEndTime: null,
      });
    } else {
      set({
        status: "break",
        mode: "SHORT_BREAK",
        timeLeft: FOCUS_DURATIONS.SHORT_BREAK,
        completedSessions: newCompletedSessions,
        sessionId: null,
        targetEndTime: Date.now() + FOCUS_DURATIONS.SHORT_BREAK * 1000,
      });
    }
  },

  // Add one more session cycle (25m + 5m)
  addOneSession: () => {
    const { activeTask, totalSessions } = get();
    const newTotalSessions = totalSessions + 1;

    set((state) => ({
      totalSessions: newTotalSessions,
      status: "focusing",
      mode: "WORK",
      timeLeft: FOCUS_DURATIONS.WORK,
      currentSession: state.completedSessions + 1,
      sessionId: null,
      showCompletionModal: false,
      targetEndTime: Date.now() + FOCUS_DURATIONS.WORK * 1000,
    }));

    if (activeTask) {
      api
        .patch(`/tasks/${activeTask.id}`, {
          focusTotalSessions: newTotalSessions,
        })
        .catch((error) => {
          console.error("Failed to update total sessions:", error);
        });

      api
        .post("/focus-sessions/start", {
          taskId: activeTask.id,
          plannedDuration: FOCUS_DURATIONS.WORK,
        })
        .then((data) => {
          set({ sessionId: (data as SessionResponse).id });
        })
        .catch((error) => {
          console.error("Failed to create focus session:", error);
        });
    }
  },

  completeAndExit: () => {
    const { activeTask } = get();

    get().reset();

    if (activeTask) {
      api
        .patch(`/tasks/${activeTask.id}`, {
          status: "DONE",
        })
        .then(() => {
          window.dispatchEvent(
            new CustomEvent("taskCompleted", {
              detail: { taskId: activeTask.id },
            }),
          );
        })
        .catch((error) => {
          console.error("Failed to move task to DONE:", error);
        });
    }
  },

  // Take long break (15m)
  takeLongBreak: () => {
    set({
      status: "break",
      mode: "LONG_BREAK",
      timeLeft: FOCUS_DURATIONS.LONG_BREAK,
      showCompletionModal: false,
      targetEndTime: Date.now() + FOCUS_DURATIONS.LONG_BREAK * 1000,
    });
  },

  // Restore session from backend (e.g. on page reload)
  restoreSession: async () => {
    try {
      const response = (await api.get("/focus-sessions/current")) as {
        session?: {
          id: string;
          plannedDuration: number;
          elapsedTime: number;
          startedAt: string; // ISO string – present for IN_PROGRESS sessions
          status: string; // "IN_PROGRESS" | "PAUSED"
          task?: {
            id: string;
            title: string;
            status: string;
            focusTotalSessions?: number | null;
            focusCompletedSessions?: number;
          };
        };
        canResume?: boolean;
      };

      if (!response?.session || !response.canResume) return;

      const { session } = response;
      const task = session.task;
      if (!task) return;

      const isInProgress = session.status === "IN_PROGRESS";

      // For IN_PROGRESS: time left = planned - (now - startedAt)
      // For PAUSED:      time left = planned - elapsedTime (saved when paused)
      const timeLeft = isInProgress
        ? Math.max(
            0,
            session.plannedDuration -
              Math.floor(
                (Date.now() - new Date(session.startedAt).getTime()) / 1000,
              ),
          )
        : Math.max(0, session.plannedDuration - session.elapsedTime);

      if (timeLeft <= 0) return;

      const focusStatus: FocusStatus = isInProgress ? "focusing" : "paused";
      const targetEndTime = isInProgress ? Date.now() + timeLeft * 1000 : null;

      set({
        activeTask: {
          id: task.id,
          title: task.title,
          status: task.status as "TODO" | "IN_PROGRESS" | "DONE",
          focusTotalSessions: task.focusTotalSessions ?? 1,
          focusCompletedSessions: task.focusCompletedSessions ?? 0,
        } as unknown as KanbanTask,
        status: focusStatus,
        timeLeft,
        mode: "WORK",
        isMinimized: false,
        sessionId: session.id,
        focusType:
          session.plannedDuration <= FOCUS_DURATIONS.QUICK_25
            ? "SHORT"
            : "STANDARD",
        targetEndTime,
        totalSessions: task.focusTotalSessions ?? 1,
        currentSession: (task.focusCompletedSessions ?? 0) + 1,
        completedSessions: task.focusCompletedSessions ?? 0,
        showCompletionModal: false,
      });
    } catch (error) {
      console.error("Failed to restore session:", error);
    }
  },
}));
