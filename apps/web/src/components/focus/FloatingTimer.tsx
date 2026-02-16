"use client";

import { motion } from "framer-motion";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { Maximize2, X, Play, Pause, Users } from "lucide-react";

export function FloatingTimer() {
  const {
    activeTask,
    status,
    timeLeft,
    isMinimized,
    mode,
    focusType,
    currentSession,
    totalSessions,
    pauseFocus,
    resumeFocus,
    stopFocus,
    toggleMinimize,
  } = useFocusStore();

  const { openWorld } = useFocusWorldStore();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getMaxDuration = () => {
    if (mode === "WORK") return FOCUS_DURATIONS.WORK;
    if (mode === "SHORT_BREAK") return FOCUS_DURATIONS.SHORT_BREAK;
    if (mode === "LONG_BREAK") return FOCUS_DURATIONS.LONG_BREAK;
    return FOCUS_DURATIONS.WORK;
  };

  const progress = (1 - timeLeft / getMaxDuration()) * 100;

  if (!activeTask || !isMinimized) return null;

  return (
    <motion.div
      layoutId="focus-timer"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 right-6 z-50"
      drag
      dragConstraints={{
        top: -window.innerHeight + 200,
        left: -window.innerWidth + 400,
        right: 0,
        bottom: 0,
      }}
      dragElastic={0.1}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-linear-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden backdrop-blur-lg">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-700">
          <motion.div
            className={`h-full ${mode === "WORK" ? "bg-blue-500" : "bg-green-500"}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Content */}
        <div className="px-4 py-3 flex items-center gap-4">
          {/* Timer Circle Indicator */}
          <div className="relative shrink-0">
            <svg width="48" height="48" className="transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="3"
                fill="none"
              />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                stroke={mode === "WORK" ? "#3b82f6" : "#10b981"}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - progress / 100)}
                transition={{ duration: 0.3 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono font-bold text-white">
                {Math.floor(timeLeft / 60)}
              </span>
            </div>
          </div>

          {/* Task Info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
              {mode === "WORK"
                ? focusType === "STANDARD"
                  ? `🎯 Phiên ${currentSession}/${totalSessions}`
                  : "🎯 Đang Tập Trung"
                : mode === "SHORT_BREAK"
                  ? "☕ Nghỉ Ngắn"
                  : "🌴 Nghỉ Dài"}
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {activeTask.title}
            </div>
            <div className="text-lg font-mono font-bold text-white tabular-nums">
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {/* Focus World */}
            {mode === "WORK" && (
              <button
                onClick={openWorld}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                aria-label="Focus World"
              >
                <Users className="w-4 h-4" />
              </button>
            )}

            {/* Pause/Resume */}
            <button
              onClick={() =>
                status === "paused" ? resumeFocus() : pauseFocus()
              }
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
              aria-label={status === "paused" ? "Tiếp tục" : "Tạm dừng"}
            >
              {status === "paused" ? (
                <Play className="w-4 h-4" fill="currentColor" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>

            {/* Maximize */}
            <button
              onClick={toggleMinimize}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
              aria-label="Phóng to"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Stop */}
            <button
              onClick={stopFocus}
              className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center text-white"
              aria-label="Dừng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        {status === "paused" && (
          <div className="px-4 pb-2 pt-1">
            <div className="text-xs text-yellow-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Đang Tạm Dừng
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
