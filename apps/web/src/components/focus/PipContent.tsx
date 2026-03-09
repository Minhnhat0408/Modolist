"use client";

/**
 * Content rendered inside the Picture-in-Picture window.
 *
 * This component lives in a SEPARATE React root (not the main app tree),
 * but Zustand stores are global singletons so it reads the same state.
 *
 * Mirrors FloatingTimer's layout and visual style exactly.
 * Uses inline styles + Lucide SVG icons (self-contained SVGs, no font dependency).
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

  // ── Shared button style ───────────────────────────────────────────────

  const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    background: "rgba(255,255,255,0.1)",
    flexShrink: 0,
    ...extra,
  });

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        overflow: "hidden",
        fontFamily: "system-ui,-apple-system,sans-serif",
        width: "100%",
      }}
    >
      {/* ── Tab bar ── */}
      {showTabs && (
        <div style={{ display: "flex", borderBottom: "1px solid #374151" }}>
          {(["timer", "world"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "6px 0",
                border: "none",
                cursor: "pointer",
                background:
                  activeTab === tab ? "rgba(255,255,255,0.05)" : "transparent",
                color: activeTab === tab ? "#fff" : "#6b7280",
                fontSize: 11,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderBottom:
                  activeTab === tab
                    ? `2px solid ${tab === "timer" ? "#3b82f6" : "#6366f1"}`
                    : "2px solid transparent",
              }}
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
          <div style={{ height: 4, background: "#374151" }}>
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
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* SVG ring */}
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                width: 48,
                height: 48,
              }}
            >
              <svg
                width="48"
                height="48"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="rgba(255,255,255,0.1)"
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
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "monospace",
                }}
              >
                {Math.floor(timeLeft / 60)}
              </span>
            </div>

            {/* Task info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 2,
                }}
              >
                {modeLabel}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {activeTask?.title ?? ""}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "monospace",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {mode === "WORK" && !worldOpen && (
                <button
                  onClick={() => {
                    openWorld();
                    if (!worldMinimized) toggleWorldMinimize();
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                  aria-label="Focus World"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() =>
                  status === "paused" ? resumeFocus() : pauseFocus()
                }
                style={btn(
                  status === "paused"
                    ? { color: "#fbbf24" }
                    : { color: "#fff" },
                )}
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
                style={btn()}
                title="Phóng to"
              >
                <Maximize2 size={16} />
              </button>
              <button
                onClick={() => {
                  stopFocus();
                  onClose();
                }}
                style={btn({ background: "rgba(239,68,68,0.2)" })}
                title="Dừng"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {status === "paused" && (
            <div
              style={{
                padding: "0 16px 10px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "#fbbf24",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#fbbf24",
                  display: "inline-block",
                }}
              />
              Đang Tạm Dừng
            </div>
          )}
        </>
      )}

      {/* ══ WORLD PANEL ══ */}
      {showTabs && activeTab === "world" && (
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Icon */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(99,102,241,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} color="#818cf8" />
            </div>
            {isWorldConnected && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: "2px solid #111827",
                }}
              />
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                color: isWorldConnected ? "#4ade80" : "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginBottom: 2,
              }}
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
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
              {onlineCount === 0
                ? "Chưa có ai"
                : `${onlineCount} người đang focus`}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                toggleWorldMinimize();
                onClose();
              }}
              style={btn()}
              title="Phóng to"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={() => {
                closeWorld();
              }}
              style={btn({ background: "rgba(239,68,68,0.2)" })}
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
