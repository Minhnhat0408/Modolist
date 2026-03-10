"use client";

/**
 * Unified floating widget — replaces both FloatingTimer and FloatingWorldButton.
 *
 * Behaviour:
 *  - Renders at bottom-right when the focus timer is minimized.
 *  - If Focus World is also open+minimized: shows a two-tab bar (Timer / World).
 *  - Hides entirely when PiP is active (PipContent takes over).
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { useFocusWorld } from "@/hooks/useFocusWorld";
import { usePipActive, closePip } from "@/hooks/usePictureInPicture";
import { useSession } from "next-auth/react";
import {
  Maximize2,
  X,
  Play,
  Pause,
  Users,
  Timer,
  Wifi,
  WifiOff,
} from "lucide-react";
import Image from "next/image";

type Tab = "timer" | "world";

export function FloatingWidget() {
  const { data: session } = useSession();
  const isPip = usePipActive();

  // ── Focus timer state ────────────────────────────────────────────────
  const {
    activeTask,
    status,
    timeLeft,
    isMinimized: timerMinimized,
    mode,
    focusType,
    shortFocusDuration,
    currentSession,
    totalSessions,
    pauseFocus,
    resumeFocus,
    stopFocus,
    toggleMinimize: toggleTimerMinimize,
    sessionId,
  } = useFocusStore();

  // ── Focus world state ────────────────────────────────────────────────
  const {
    isOpen: worldOpen,
    isMinimized: worldMinimized,
    openWorld,
    toggleMinimize: toggleWorldMinimize,
    closeWorld,
    setOnlineData,
  } = useFocusWorldStore();

  // ── Socket connection ────────────────────────────────────────────────
  const userId = session?.user?.id || null;
  const taskId = activeTask?.id || null;
  const canConnect =
    (status === "focusing" || status === "paused") && !!sessionId && !!userId;
  const socketEnabled = canConnect && worldOpen && worldMinimized;

  const { isConnected, focusUsers } = useFocusWorld({
    userId,
    sessionId,
    taskId,
    timeLeft,
    focusStatus: status,
    enabled: socketEnabled,
  });

  const otherUsers = focusUsers.filter((u) => u.userId !== userId);

  // Sync to store for PipContent
  useEffect(() => {
    setOnlineData(otherUsers.length, isConnected);
  }, [otherUsers.length, isConnected, setOnlineData]);

  // ── Tab state ────────────────────────────────────────────────────────
  const showTabs = timerMinimized && worldOpen && worldMinimized;
  const [activeTab, setActiveTab] = useState<Tab>("timer");

  // Auto-switch to timer tab when world is closed
  useEffect(() => {
    if (!worldMinimized) setActiveTab("timer");
  }, [worldMinimized]);

  // ── Visibility ───────────────────────────────────────────────────────
  const visible =
    !isPip && !!activeTask && (timerMinimized || (worldOpen && worldMinimized));

  if (!visible) return null;

  // ── Helpers ──────────────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const getMaxDuration = () => {
    if (focusType === "SHORT") return shortFocusDuration;
    if (mode === "WORK") return FOCUS_DURATIONS.WORK;
    if (mode === "SHORT_BREAK") return FOCUS_DURATIONS.SHORT_BREAK;
    if (mode === "LONG_BREAK") return FOCUS_DURATIONS.LONG_BREAK;
    return FOCUS_DURATIONS.WORK;
  };

  const progress = (1 - timeLeft / getMaxDuration()) * 100;
  const modeLabel =
    mode === "WORK"
      ? focusType === "STANDARD"
        ? `🎯 Phiên ${currentSession}/${totalSessions}`
        : "🎯 Đang Tập Trung"
      : mode === "SHORT_BREAK"
        ? "☕ Nghỉ Ngắn"
        : "🌴 Nghỉ Dài";

  const btnCls =
    "w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center text-gray-700 dark:text-white";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <motion.div
      layoutId="floating-widget"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 right-6 z-50"
      drag
      dragConstraints={{
        top: -window.innerHeight + 200,
        left: -window.innerWidth + 420,
        right: 0,
        bottom: 0,
      }}
      dragElastic={0.1}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-white/95 dark:bg-linear-to-br dark:from-gray-900 dark:to-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-lg w-95">
        {/* ── Tab bar (only when both timer and world are minimized) ── */}
        {showTabs && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("timer")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                activeTab === "timer"
                  ? "text-gray-900 dark:text-white border-b-2 border-blue-500 bg-black/5 dark:bg-white/5"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              Bộ Đếm
            </button>
            <button
              onClick={() => setActiveTab("world")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                activeTab === "world"
                  ? "text-gray-900 dark:text-white border-b-2 border-indigo-500 bg-black/5 dark:bg-white/5"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Focus World
              {otherUsers.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-500 text-[9px] flex items-center justify-center">
                  {otherUsers.length}
                </span>
              )}
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ══════════════ TIMER TAB ══════════════ */}
          {(!showTabs || activeTab === "timer") && timerMinimized && (
            <motion.div
              key="timer"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Progress bar */}
              <div className="h-1 bg-gray-200 dark:bg-gray-700">
                <motion.div
                  className={`h-full ${mode === "WORK" ? "bg-blue-500" : "bg-green-500"}`}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Content */}
              <div className="px-4 py-3 flex items-center gap-4">
                {/* Timer ring */}
                <div className="relative shrink-0">
                  <svg width="48" height="48" className="transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      className="stroke-black/10 dark:stroke-white/10"
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
                    <span className="text-xs font-mono font-bold text-gray-800 dark:text-white">
                      {Math.floor(timeLeft / 60)}
                    </span>
                  </div>
                </div>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                    {modeLabel}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {activeTask.title}
                  </div>
                  <div className="text-lg font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatTime(timeLeft)}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  {/* Open world (if not already open) */}
                  {mode === "WORK" && !worldOpen && (
                    <button
                      onClick={openWorld}
                      className={btnCls}
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
                    className={btnCls}
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
                    onClick={() => {
                      closePip();
                      toggleTimerMinimize();
                    }}
                    className={btnCls}
                    aria-label="Phóng to"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {/* Stop */}
                  <button
                    onClick={() => {
                      closePip();
                      stopFocus();
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center text-red-500 dark:text-white"
                    aria-label="Dừng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Paused indicator */}
              {status === "paused" && (
                <div className="px-4 pb-2 pt-1">
                  <div className="text-xs text-yellow-500 dark:text-yellow-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400 animate-pulse" />
                    Đang Tạm Dừng
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════ WORLD TAB ══════════════ */}
          {showTabs && activeTab === "world" && (
            <motion.div
              key="world"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Icon */}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-indigo-400" />
                  </div>
                  {isConnected && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <Wifi className="w-3 h-3 text-green-500 dark:text-green-400" />
                        <span className="text-green-500 dark:text-green-400">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        <span>Offline</span>
                      </>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {otherUsers.length === 0
                      ? "Chưa có ai"
                      : `${otherUsers.length} người đang focus`}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  {/* Expand world modal */}
                  <button
                    onClick={() => {
                      closePip();
                      toggleWorldMinimize();
                    }}
                    className={btnCls}
                    aria-label="Phóng to"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {/* Close world */}
                  <button
                    onClick={() => {
                      closePip();
                      closeWorld();
                    }}
                    className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center text-red-500 dark:text-white"
                    aria-label="Đóng Focus World"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Avatar row */}
              {isConnected && otherUsers.length > 0 && (
                <div className="px-4 pb-3 flex -space-x-2">
                  {otherUsers.slice(0, 6).map((user) => (
                    <div
                      key={user.userId}
                      className={`w-8 h-8 rounded-full border-2 border-gray-100 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden relative ${
                        user.isPaused ? "opacity-40 grayscale" : ""
                      }`}
                      title={`${user.name || "User"}${user.isPaused ? " (Paused)" : ""}`}
                    >
                      {user.image ? (
                        <Image
                          src={user.image}
                          alt={user.name || "User"}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-800 dark:text-white">
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                  ))}
                  {otherUsers.length > 6 && (
                    <div className="w-8 h-8 rounded-full border-2 border-gray-100 dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-800 dark:text-white">
                      +{otherUsers.length - 6}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
