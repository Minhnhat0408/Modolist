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
  QUICK_25: 25 + 60, // 25 minutes quick focus
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
      totalSessions: newTotalSessions,
      currentSession: 1,
      completedSessions: 0,
      sessionId: null,
      showCompletionModal: false,
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
        plannedDuration: duration * 60,
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
            plannedDuration: FOCUS_DURATIONS.WORK * 60,
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
            plannedDuration: FOCUS_DURATIONS.WORK * 60,
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
    const currentStatus = get().status;
    if (currentStatus === "focusing" || currentStatus === "break") {
      set({ status: "paused" });
    }
  },

  resumeFocus: () => {
    const currentStatus = get().status;
    const mode = get().mode;
    if (currentStatus === "paused") {
      set({ status: mode === "WORK" ? "focusing" : "break" });
    }
  },

  stopFocus: () => {
    const { sessionId, mode, activeTask } = get();

    if (sessionId && mode === "WORK") {
      api
        .patch(`/focus-sessions/${sessionId}/pause`)
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
        });
      }

      if (sessionId) {
        api
          .patch(`/focus-sessions/${sessionId}/complete`, {
            actualDuration: FOCUS_DURATIONS.WORK * 60,
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
      });

      if (activeTask) {
        api
          .post("/focus-sessions/start", {
            taskId: activeTask.id,
            plannedDuration: FOCUS_DURATIONS.WORK * 60,
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
    const { timeLeft, status } = get();

    if (status === "focusing" || status === "break") {
      if (timeLeft > 0) {
        set({ timeLeft: timeLeft - 1 });
      } else {
        // Timer reached 0
        get().completeFocus();
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
      });

      if (activeTask) {
        api
          .post("/focus-sessions/start", {
            taskId: activeTask.id,
            plannedDuration: FOCUS_DURATIONS.WORK * 60,
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
      });
    } else {
      set({
        status: "break",
        mode: "SHORT_BREAK",
        timeLeft: FOCUS_DURATIONS.SHORT_BREAK,
        sessionId: null,
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
      });
    } else {
      set({
        status: "break",
        mode: "SHORT_BREAK",
        timeLeft: FOCUS_DURATIONS.SHORT_BREAK,
        completedSessions: newCompletedSessions,
        sessionId: null,
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
          plannedDuration: FOCUS_DURATIONS.WORK * 60,
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
    });
  },
}));
