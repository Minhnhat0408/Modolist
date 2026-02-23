"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import {
  Play,
  Pause,
  X,
  Minimize2,
  SkipForward,
  CheckCircle2,
  XCircle,
  Users,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api-client";

export function FocusTimerModal() {
  const {
    activeTask,
    status,
    timeLeft,
    isMinimized,
    mode,
    focusType,
    shortFocusDuration,
    totalSessions,
    currentSession,
    completedSessions,
    pauseFocus,
    resumeFocus,
    stopFocus,
    toggleMinimize,
    tick,
    skipToNext,
    skipWorkSession,
    markWorkDone,
  } = useFocusStore();

  const { openWorld } = useFocusWorldStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timer logic: setInterval + visibilitychange for tab-switch resilience.
  // tick() uses Date-based targetEndTime so the countdown auto-corrects
  // even if the interval was paused/throttled by the browser.
  useEffect(() => {
    if (status === "focusing" || status === "break") {
      // Tick immediately on entry
      tick();

      const interval = setInterval(tick, 1000);

      // When user returns to this tab, tick immediately to catch up
      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          tick();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }
  }, [status, tick]);

  const handleSaveSession = useCallback(async () => {
    if (!activeTask) return;

    try {
      const duration = FOCUS_DURATIONS.WORK;
      await api.post("/focus-sessions", {
        taskId: activeTask.id,
        duration,
        plannedDuration: duration,
        status: "COMPLETED",
      });

      // Update task's completed pomodoros
      await api.patch(`/tasks/${activeTask.id}`, {
        completedPomodoros: (activeTask.completedPomodoros || 0) + 1,
      });
    } catch (error) {
      console.error("Failed to save focus session:", error);
    }
  }, [activeTask]);

  // Handle completion - play sound and notify
  useEffect(() => {
    if (status === "completed" || status === "all_completed") {
      // Play completion sound
      if (audioRef.current) {
        audioRef.current
          .play()
          .catch((err) => console.error("Audio play failed:", err));
      }

      // Show notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Session Completed!", {
          body: `Great job completing your ${mode === "WORK" ? "focus" : "break"} session!`,
          icon: "/favicon.ico",
        });
      }

      // Auto-save session to API
      if (mode === "WORK" && activeTask) {
        handleSaveSession();
      }
    }
  }, [status, mode, activeTask, handleSaveSession]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Initialize audio (disabled - file not found)
    // audioRef.current = new Audio('/sounds/timer-complete.mp3');
    // audioRef.current.load();

    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getMaxDuration = () => {
    if (focusType === "SHORT") return shortFocusDuration;
    if (mode === "WORK") return FOCUS_DURATIONS.WORK;
    if (mode === "SHORT_BREAK") return FOCUS_DURATIONS.SHORT_BREAK;
    if (mode === "LONG_BREAK") return FOCUS_DURATIONS.LONG_BREAK;
    return FOCUS_DURATIONS.WORK;
  };

  const progress = (1 - timeLeft / getMaxDuration()) * 100;

  // Session progress (for STANDARD type only)
  const sessionProgress =
    focusType === "STANDARD" ? (completedSessions / totalSessions) * 100 : 0;

  if (!activeTask || isMinimized) return null;

  return (
    <AnimatePresence>
      <motion.div
        layoutId="focus-timer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop with blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={() => toggleMinimize()}
        />

        {/* Main Timer Content */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative z-10 flex flex-col items-center justify-center p-8 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Task Info & Session Progress */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8 text-center"
          >
            <p className="text-sm uppercase tracking-wider text-gray-400 mb-2">
              {mode === "WORK"
                ? "🎯 Tập Trung"
                : mode === "SHORT_BREAK"
                  ? "☕ Nghỉ Ngắn"
                  : "🌴 Nghỉ Dài"}
            </p>
            <h2 className="text-2xl font-semibold mb-2">{activeTask.title}</h2>

            {/* AI Estimate badge */}
            {activeTask.estimatedPomodoros &&
              activeTask.estimatedPomodoros > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI ước tính {activeTask.estimatedPomodoros} 🍅</span>
                </div>
              )}

            {/* Session Counter for STANDARD type */}
            {focusType === "STANDARD" && (
              <div className="mt-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-lg font-bold text-primary">
                    Phiên {currentSession} / {totalSessions}
                  </span>
                </div>
                {/* Session Progress Bar */}
                <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-linear-to-r from-green-500 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${sessionProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {completedSessions} / {totalSessions} phiên đã hoàn thành
                </p>
              </div>
            )}

            {/* Quick Focus indicator */}
            {focusType === "SHORT" && (
              <p className="text-xs text-gray-400 mt-2">
                ⚡ Chế Độ Focus Nhanh
              </p>
            )}
          </motion.div>

          {/* Circular Progress + Timer */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative mb-12"
          >
            {/* SVG Circle Progress */}
            <svg className="transform -rotate-90" width="320" height="320">
              {/* Background circle */}
              <circle
                cx="160"
                cy="160"
                r="140"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress circle */}
              <motion.circle
                cx="160"
                cy="160"
                r="140"
                stroke={mode === "WORK" ? "#3b82f6" : "#10b981"}
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 140}
                strokeDashoffset={2 * Math.PI * 140 * (1 - progress / 100)}
                initial={{ strokeDashoffset: 2 * Math.PI * 140 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 140 * (1 - progress / 100),
                }}
                transition={{ duration: 0.5 }}
              />
            </svg>

            {/* Timer Display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl font-mono font-bold tabular-nums">
                {formatTime(timeLeft)}
              </span>
            </div>
          </motion.div>

          {/* Control Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4"
          >
            {/* Focus World Button (only during work) */}
            {mode === "WORK" && (
              <button
                onClick={() => {
                  openWorld();
                  toggleMinimize();
                }}
                className="w-16 h-16 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors flex items-center justify-center group"
                aria-label="Mở Focus World"
                title="Xem ai đang focus cùng bạn"
              >
                <Users className="w-8 h-8 text-primary group-hover:text-primary/80" />
              </button>
            )}

            {/* Pause/Resume */}
            <button
              onClick={() =>
                status === "paused" ? resumeFocus() : pauseFocus()
              }
              className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
              aria-label={status === "paused" ? "Tiếp tục" : "Tạm dừng"}
            >
              {status === "paused" ? (
                <Play className="w-8 h-8" fill="currentColor" />
              ) : (
                <Pause className="w-8 h-8" />
              )}
            </button>

            {/* Work Mode Buttons */}
            {focusType === "STANDARD" && mode === "WORK" && (
              <>
                {/* Skip Work Session */}
                <button
                  onClick={skipWorkSession}
                  className="w-16 h-16 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center group"
                  aria-label="Bỏ qua phiên làm việc này"
                  title="Bỏ qua phiên làm việc (không tính)"
                >
                  <XCircle className="w-8 h-8 text-red-400 group-hover:text-red-300" />
                </button>

                {/* Mark Work as Done */}
                <button
                  onClick={markWorkDone}
                  className="w-16 h-16 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-colors flex items-center justify-center group"
                  aria-label="Đánh dấu hoàn thành"
                  title="Hoàn thành phiên này sớm"
                >
                  <CheckCircle2 className="w-8 h-8 text-green-400 group-hover:text-green-300" />
                </button>
              </>
            )}

            {/* Skip Break Button */}
            {focusType === "STANDARD" && mode !== "WORK" && (
              <button
                onClick={skipToNext}
                className="w-16 h-16 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors flex items-center justify-center group"
                aria-label="Bỏ qua nghỉ"
                title="Bỏ qua giờ nghỉ và bắt đầu làm việc tiếp"
              >
                <SkipForward className="w-8 h-8 text-yellow-400 group-hover:text-yellow-300" />
              </button>
            )}

            {/* Minimize */}
            <button
              onClick={toggleMinimize}
              className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
              aria-label="Thu nhỏ"
            >
              <Minimize2 className="w-6 h-6" />
            </button>

            {/* Stop */}
            <button
              onClick={stopFocus}
              className="w-16 h-16 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center"
              aria-label="Dừng"
            >
              <X className="w-8 h-8" />
            </button>
          </motion.div>

          {/* Status indicator when paused */}
          {status === "paused" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 px-4 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30"
            >
              <p className="text-yellow-300 text-sm font-medium">
                ⏸️ Đang Tạm Dừng
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
