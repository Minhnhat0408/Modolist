"use client";

/**
 * Content rendered inside the Picture-in-Picture window.
 *
 * This component lives in a SEPARATE React root (not the main app tree),
 * but Zustand stores are global singletons so it reads the same state.
 *
 * Mirrors FloatingTimer's layout and visual style exactly.
 * All Tailwind CSS is copied from the main document into the PiP window,
 * and the dark class is propagated, so dark: variants work correctly.
 */

import { useEffect, useState } from "react";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import {
  Play,
  Pause,
  Maximize2,
  X,
  Users,
  Timer,
  Wifi,
  WifiOff,
} from "lucide-react";

interface PipContentProps {
  onClose: () => void;
}

export function PipContent({ onClose }: PipContentProps) {
  const {
    activeTask,
    status,
    timeLeft,
    mode,
    focusType,
    shortFocusDuration,
    currentSession,
    totalSessions,
    pauseFocus,
    resumeFocus,
    stopFocus,
    toggleMinimize,
    tick,
  } = useFocusStore();

  const {
    isOpen: worldOpen,
    isMinimized: worldMinimized,
    onlineCount,
    isWorldConnected,
    toggleMinimize: toggleWorldMinimize,
    closeWorld,
    openWorld,
  } = useFocusWorldStore();

  const showTabs = worldOpen && worldMinimized;
  const [activeTab, setActiveTab] = useState<"timer" | "world">("timer");

  // Safety-net tick
  useEffect(() => {
    if (status === "focusing" || status === "break") {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [status, tick]);

  // Auto-close PiP when session ends
  useEffect(() => {
    if (
      status === "idle" ||
      status === "completed" ||
      status === "all_completed"
    ) {
      toggleMinimize();
      onClose();
    }
  }, [status, toggleMinimize, onClose]);

  // ── Derived values ────────────────────────────────────────────────────

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

  const progress = 1 - timeLeft / getMaxDuration();
  const isWork = mode === "WORK";
  const color = isWork ? "#3b82f6" : "#10b981";

  const modeLabel =
    mode === "WORK"
      ? focusType === "STANDARD"
        ? `🎯 Phiên ${currentSession}/${totalSessions}`
        : "🎯 Đang Tập Trung"
      : mode === "SHORT_BREAK"
        ? "☕ Nghỉ Ngắn"
        : "🌴 Nghỉ Dài";

  // ── Shared button class ───────────────────────────────────────────────

  const btnCls =
    "w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 " +
    "bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 " +
    "text-gray-700 dark:text-white transition-colors";

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden font-sans w-full">
      {/* ── Tab bar ── */}
      {showTabs && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(["timer", "world"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 border-0 cursor-pointer text-[11px] font-medium transition-colors ${
                activeTab === tab
                  ? "bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white"
                  : "bg-transparent text-gray-500 dark:text-gray-400"
              } border-b-2 ${
                activeTab === tab
                  ? tab === "timer"
                    ? "border-blue-500"
                    : "border-indigo-500"
                  : "border-transparent"
              }`}
            >
              {tab === "timer" ? (
                <>
                  <Timer size={12} /> Bộ Đếm
                </>
              ) : (
                <>
                  <Users size={12} /> Focus World{" "}
                  {onlineCount > 0 && `(${onlineCount})`}
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ══ TIMER PANEL ══ */}
      {(!showTabs || activeTab === "timer") && (
        <>
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700">
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                background: color,
                transition: "width 0.3s",
              }}
            />
          </div>

          {/* Content row */}
          <div className="px-4 py-3 flex items-center gap-4">
            {/* SVG ring */}
            <div className="relative shrink-0 w-12 h-12">
              <svg
                width="48"
                height="48"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  className="stroke-black/10 dark:stroke-white/10"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke={color}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={2 * Math.PI * 20 * (1 - progress)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono text-gray-800 dark:text-white">
                {Math.floor(timeLeft / 60)}
              </span>
            </div>

            {/* Task info */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                {modeLabel}
              </div>
              <div className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                {activeTask?.title ?? ""}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 items-center">
              {mode === "WORK" && !worldOpen && (
                <button
                  onClick={() => {
                    openWorld();
                    if (!worldMinimized) toggleWorldMinimize();
                  }}
                  className={btnCls}
                  aria-label="Focus World"
                >
                  <Users size={16} />
                </button>
              )}
              <button
                onClick={() =>
                  status === "paused" ? resumeFocus() : pauseFocus()
                }
                className={`${btnCls} ${status === "paused" ? "text-yellow-500 dark:text-yellow-400" : ""}`}
                title={status === "paused" ? "Tiếp tục" : "Tạm dừng"}
              >
                {status === "paused" ? (
                  <Play size={16} fill="currentColor" />
                ) : (
                  <Pause size={16} />
                )}
              </button>
              <button
                onClick={() => {
                  toggleMinimize();
                  onClose();
                }}
                className={btnCls}
                title="Phóng to"
              >
                <Maximize2 size={16} />
              </button>
              <button
                onClick={() => {
                  stopFocus();
                  onClose();
                }}
                className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-white transition-colors"
                title="Dừng"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {status === "paused" && (
            <div className="px-4 pb-2.5 flex items-center gap-1.5 text-[11px] text-yellow-500 dark:text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400 inline-block" />
              Đang Tạm Dừng
            </div>
          )}
        </>
      )}

      {/* ══ WORLD PANEL ══ */}
      {showTabs && activeTab === "world" && (
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Icon */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Users size={20} color="#818cf8" />
            </div>
            {isWorldConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div
              className={`text-[10px] flex items-center gap-1 mb-0.5 ${isWorldConnected ? "text-green-500 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
            >
              {isWorldConnected ? (
                <>
                  <Wifi size={10} /> Online
                </>
              ) : (
                <>
                  <WifiOff size={10} /> Offline
                </>
              )}
            </div>
            <div className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {onlineCount === 0
                ? "Chưa có ai"
                : `${onlineCount} người đang focus`}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                toggleWorldMinimize();
                onClose();
              }}
              className={btnCls}
              title="Phóng to"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={() => {
                closeWorld();
              }}
              className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-white transition-colors"
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
