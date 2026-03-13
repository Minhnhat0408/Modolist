"use client";

/**
 * Content rendered inside the Picture-in-Picture window.
 *
 * Three tabs: Timer, Focus World, Spotify — responsive to PiP window width.
 * Timer & World: all controls always visible; wider → extra buttons (mark done, skip).
 * Spotify: responsive playback controls.
 *
 * Uses Zustand stores (global singletons) to share state with the main app.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { spotifyActions } from "@/hooks/useSpotifyPlayer";
import { resizePIP, PIP_CONTENT_H, PIP_TAB_BAR_H } from "@/hooks/usePictureInPicture";
import {
  Play,
  Pause,
  Maximize2,
  X,
  Users,
  Timer,
  Music,
  Wifi,
  WifiOff,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Unplug,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
} from "lucide-react";

/* ─── Responsive breakpoints ───────────────────────────────────────── */
const BP_FULL = 640;

type Tab = "timer" | "world" | "spotify";

interface PipContentProps {
  onClose: () => void;
}

export function PipContent({ onClose }: PipContentProps) {
  /* ── Width tracking (PiP window resize) ────────────────────────────── */
  const [cw, setCw] = useState(
    typeof window !== "undefined" ? window.innerWidth : 460,
  );
  useEffect(() => {
    const handleResize = () => setCw(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const full = cw >= BP_FULL;

  /* ── Focus timer state ────────────────────────────────────────────── */
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
    toggleMinimize,
    tick,
    skipWorkSession,
    markWorkDone,
  } = useFocusStore();

  /* ── Focus world state ────────────────────────────────────────────── */
  const {
    isOpen: worldOpen,
    isMinimized: worldMinimized,
    onlineCount,
    isWorldConnected,
    toggleMinimize: toggleWorldMinimize,
    closeWorld,
    openWorld,
  } = useFocusWorldStore();

  /* ── Spotify state ────────────────────────────────────────────────── */
  const {
    isConnected: spotifyConnected,
    isPremium: spotifyPremium,
    isLoading: spotifyLoading,
    isReady: spotifyReady,
    hasPlayer: spotifyHasPlayer,
    isPlaying: spotifyPlaying,
    isActiveDevice: spotifyActiveDevice,
    currentTrack,
    position: spotifyPosition,
    duration: spotifyDuration,
    volume: spotifyVolume,
    shuffle: spotifyShuffle,
    repeatMode: spotifyRepeat,
    isWidgetMinimized: spotifyWidgetMinimized,
    disconnect: spotifyDisconnect,
    closeWidget: spotifyCloseWidget,
    openWidgetWithSearch: spotifyOpenSearch,
  } = useSpotifyStore();

  /* ── Tab logic ────────────────────────────────────────────────────── */
  // Only show timer tab when the FocusTimerModal is actually minimized to PiP
  const hasTimerTab = !!activeTask && timerMinimized;
  const hasWorldTab = worldOpen && worldMinimized;
  const hasSpotifyTab = spotifyWidgetMinimized;

  const availableTabs: Tab[] = [];
  if (hasTimerTab) availableTabs.push("timer");
  if (hasWorldTab) availableTabs.push("world");
  if (hasSpotifyTab) availableTabs.push("spotify");

  const showTabs = availableTabs.length > 1;
  const [activeTab, setActiveTab] = useState<Tab>("timer");

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]!);
    }
  }, [hasTimerTab, hasWorldTab, hasSpotifyTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Close PiP window when no tabs remain (e.g. Spotify widget closed) */
  useEffect(() => {
    if (!hasTimerTab && !hasWorldTab && !hasSpotifyTab) {
      onClose();
    }
  }, [hasTimerTab, hasWorldTab, hasSpotifyTab, onClose]);

  /**
   * Resize PiP after a tab is removed (must be called inside user-gesture handler).
   * Pass which tabs will remain AFTER the action (not current state).
   */
  const resizeAfterRemove = useCallback(
    (remainTimer: boolean, remainWorld: boolean, remainSpotify: boolean) => {
      const remaining = [remainTimer, remainWorld, remainSpotify].filter(Boolean);
      if (remaining.length === 0) return; // PiP will close, no resize needed
      if (remaining.length === 1) {
        // Single tab left → no tab bar
        const h = remainSpotify
          ? PIP_CONTENT_H.spotify
          : remainWorld
            ? PIP_CONTENT_H.world
            : PIP_CONTENT_H.timer;
        console.log(h)
        resizePIP(h);
      } else {
        // Multiple tabs remain → keep tab bar, show tallest content
        const h = remainSpotify ? PIP_CONTENT_H.spotify : PIP_CONTENT_H.timer;
        resizePIP(PIP_TAB_BAR_H + h);
      }
    },
    [],
  );

  /* ── Spotify local seek ───────────────────────────────────────────── */
  const [localPos, setLocalPos] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const prevVol = useRef(spotifyVolume);

  useEffect(() => {
    if (!isSeeking) setLocalPos(spotifyPosition);
  }, [spotifyPosition, isSeeking]);
  useEffect(() => {
    if (!spotifyPlaying || isSeeking) return;
    const id = setInterval(
      () => setLocalPos((p) => Math.min(p + 1000, spotifyDuration)),
      1000,
    );
    return () => clearInterval(id);
  }, [spotifyPlaying, isSeeking, spotifyDuration]);

  const toggleMute = useCallback(() => {
    if (spotifyVolume > 0) {
      prevVol.current = spotifyVolume;
      spotifyActions.changeVolume(0);
    } else {
      spotifyActions.changeVolume(prevVol.current || 0.5);
    }
  }, [spotifyVolume]);

  /* ── Timer tick ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (status === "focusing" || status === "break") {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [status, tick]);

  /* ── Auto-close PiP when session ends (only if no other tabs remain) ── */
  useEffect(() => {
    if (
      (status === "idle" ||
        status === "completed" ||
        status === "all_completed") &&
      !hasSpotifyTab &&
      !hasWorldTab
    ) {
      toggleMinimize();
      onClose();
    }
  }, [status, hasSpotifyTab, hasWorldTab, toggleMinimize, onClose]);

  /* ── Helpers ──────────────────────────────────────────────────────── */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };
  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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

  const btnCls =
    "w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 " +
    "bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 " +
    "text-gray-700 dark:text-white transition-colors";

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="overflow-hidden font-sans w-full">
      {/* ── Tab bar ── */}
      {showTabs && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {hasTimerTab && (
            <button
              onClick={() => {
                setActiveTab("timer");
                resizePIP(PIP_TAB_BAR_H + PIP_CONTENT_H.timer);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 border-0 cursor-pointer text-[11px] font-medium transition-colors ${
                activeTab === "timer"
                  ? "bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white"
                  : "bg-transparent text-gray-500 dark:text-gray-400"
              } border-b-2 ${activeTab === "timer" ? "border-blue-500" : "border-transparent"}`}
            >
              <Timer size={12} />
              {" Bộ Đếm"}
            </button>
          )}
          {hasWorldTab && (
            <button
              onClick={() => {
                setActiveTab("world");
                resizePIP(PIP_TAB_BAR_H + PIP_CONTENT_H.world);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 border-0 cursor-pointer text-[11px] font-medium transition-colors ${
                activeTab === "world"
                  ? "bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white"
                  : "bg-transparent text-gray-500 dark:text-gray-400"
              } border-b-2 ${activeTab === "world" ? "border-indigo-500" : "border-transparent"}`}
            >
              <Users size={12} />
              {" Focus World"}
              {onlineCount > 0 && ` (${onlineCount})`}
            </button>
          )}
          {hasSpotifyTab && (
            <button
              onClick={() => {
                setActiveTab("spotify");
                resizePIP(PIP_TAB_BAR_H + PIP_CONTENT_H.spotify);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 border-0 cursor-pointer text-[11px] font-medium transition-colors ${
                activeTab === "spotify"
                  ? "bg-black/5 dark:bg-white/5 text-gray-900 dark:text-white"
                  : "bg-transparent text-gray-500 dark:text-gray-400"
              } border-b-2 ${activeTab === "spotify" ? "border-green-500" : "border-transparent"}`}
            >
              <Music size={12} />
              {" Spotify"}
            </button>
          )}
        </div>
      )}

      {/* ══ TIMER PANEL ══ */}
      {(activeTab === "timer" || !showTabs) && hasTimerTab && (
        <>
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

          <div className="px-4 py-3 flex items-center gap-4">
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

            <div className="flex gap-2 items-center">
              {mode === "WORK" && !worldOpen && (
                <button
                  onClick={() => {
                    openWorld();
                    // if (!worldMinimized) toggleWorldMinimize();
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
              {full && mode === "WORK" && (
                <>
                  <button
                    onClick={skipWorkSession}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-400 transition-colors"
                    title="Bỏ qua"
                  >
                    <XCircle size={16} />
                  </button>
                  <button
                    onClick={markWorkDone}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-green-500/20 hover:bg-green-500/30 text-green-500 dark:text-green-400 transition-colors"
                    title="Hoàn thành"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  stopFocus();
                  // Only close PiP if no other tabs remain after this
                  if (!hasWorldTab && !hasSpotifyTab) {
                    onClose();
                  } else {
                    resizeAfterRemove(false, hasWorldTab, hasSpotifyTab);
                  }
                }}
                className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-white transition-colors"
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
      {activeTab === "world" && hasWorldTab && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Users size={20} color="#818cf8" />
            </div>
            {isWorldConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
            )}
          </div>

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

          <div className="flex gap-2">
            <button
              onClick={() => {
                toggleWorldMinimize();
                // Only close PiP if no other tabs remain
                if (!hasTimerTab && !hasSpotifyTab) {
                  onClose();
                } else {
                  resizeAfterRemove(hasTimerTab, false, hasSpotifyTab);
                }
              }}
              className={btnCls}
              title="Phóng to"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={() => {
                closeWorld();
                resizeAfterRemove(hasTimerTab, false, hasSpotifyTab);
              }}
              className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ══ SPOTIFY PANEL ══ */}
      {(activeTab === "spotify" ||
        (!showTabs && hasSpotifyTab && !hasTimerTab)) &&
        hasSpotifyTab && (
          <>
            {/* Not connected */}
            {!spotifyConnected && !spotifyLoading && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 flex items-center justify-center shrink-0">
                  <Music size={20} className="text-[#1DB954]" />
                </div>
                <span className="text-[13px] text-gray-500 dark:text-gray-400 flex-1">
                  Kết nối Spotify để nghe nhạc
                </span>
                <a
                  href="/api/spotify/connect"
                  className="px-3 py-1.5 rounded-full border-0 bg-[#1DB954] hover:bg-[#1ed760] text-white text-[11px] font-medium transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Kết Nối
                </a>
                <button
                  onClick={() => {
                    spotifyCloseWidget();
                    resizeAfterRemove(hasTimerTab, hasWorldTab, false);
                  }}
                  className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Loading */}
            {spotifyLoading && (
              <div className="px-4 py-3 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] text-gray-500 dark:text-gray-400">
                  Đang kết nối Spotify...
                </span>
              </div>
            )}

            {/* Not premium */}
            {spotifyConnected && spotifyPremium === false && (
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Music size={20} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-yellow-600 dark:text-yellow-300 font-medium">
                    Cần Spotify Premium
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Web Playback SDK yêu cầu Premium
                  </p>
                </div>
                <button
                  onClick={() => spotifyDisconnect()}
                  className="p-1.5 rounded-full border-0 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 text-gray-500"
                >
                  <Unplug size={14} />
                </button>
              </div>
            )}

            {/* Connected + premium → playback */}
            {spotifyConnected &&
              spotifyPremium !== false &&
              !spotifyLoading && (
                <>
                  <div className="px-4 py-3 flex items-center gap-3">
                    {/* Album art */}
                    <div className="w-10 h-10 rounded-md bg-white/10 overflow-hidden shrink-0 relative">
                      {currentTrack?.albumArt ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentTrack.albumArt}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music size={20} className="text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      {currentTrack ? (
                        <>
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                            {currentTrack.name}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {currentTrack.artists}
                          </p>
                        </>
                      ) : spotifyReady ? (
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">
                          Chưa phát nhạc
                        </p>
                      ) : (
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">
                          Đang kết nối...
                        </p>
                      )}
                    </div>

                    {/* Transfer */}
                    {spotifyHasPlayer &&
                      currentTrack &&
                      !spotifyActiveDevice && (
                        <button
                          onClick={() => spotifyActions.transferAndPlay()}
                          className="shrink-0 px-2 py-1 rounded-full border-0 cursor-pointer bg-green-500/20 text-green-600 dark:text-green-400 text-[11px] font-medium"
                        >
                          Phát ở đây
                        </button>
                      )}

                    {/* Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => spotifyActions.toggleShuffle()}
                        disabled={!spotifyReady}
                        className={`p-1.5 rounded-full border-0 cursor-pointer disabled:opacity-30 ${spotifyShuffle ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}
                        title={spotifyShuffle ? "Tắt trộn bài" : "Trộn bài"}
                      >
                        <Shuffle size={14} />
                      </button>

                      <button
                        onClick={() => spotifyActions.previous()}
                        disabled={!spotifyReady}
                        className="p-1.5 rounded-full border-0 cursor-pointer disabled:opacity-30 text-gray-700 dark:text-white"
                      >
                        <SkipBack size={16} />
                      </button>

                      <button
                        onClick={() => spotifyActions.togglePlay()}
                        disabled={!spotifyReady}
                        className="w-8 h-8 rounded-full border-0 cursor-pointer bg-[#1DB954] hover:bg-[#1ed760] text-white flex items-center justify-center disabled:opacity-30"
                      >
                        {spotifyPlaying ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} fill="currentColor" />
                        )}
                      </button>

                      <button
                        onClick={() => spotifyActions.next()}
                        disabled={!spotifyReady}
                        className="p-1.5 rounded-full border-0 cursor-pointer disabled:opacity-30 text-gray-700 dark:text-white"
                      >
                        <SkipForward size={16} />
                      </button>

                      <button
                        onClick={() => spotifyActions.cycleRepeat()}
                        disabled={!spotifyReady}
                        className={`p-1.5 rounded-full border-0 cursor-pointer disabled:opacity-30 ${spotifyRepeat !== "off" ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}
                        title={
                          spotifyRepeat === "off"
                            ? "Lặp lại"
                            : spotifyRepeat === "context"
                              ? "Đang lặp playlist"
                              : "Đang lặp bài"
                        }
                      >
                        {spotifyRepeat === "track" ? (
                          <Repeat1 size={14} />
                        ) : (
                          <Repeat size={14} />
                        )}
                      </button>

                       {/* Close spotify widget */}
                      <button
                        onClick={() => {
                          spotifyCloseWidget();
                          resizeAfterRemove(hasTimerTab, hasWorldTab, false);
                        }}
                        className="w-8 h-8 rounded-full border-0 cursor-pointer flex items-center justify-center shrink-0 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-white transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Seek bar */}
                  

                  {/* Volume bar (horizontal, always visible in PIP) */}
                  <div className="px-5 pb-2 flex items-center gap-2">
                 
                    <button
                      onClick={toggleMute}
                      className="p-1 rounded-full border-0 cursor-pointer text-gray-700 dark:text-white shrink-0"
                    >
                      {spotifyVolume === 0 ? (
                        <VolumeX size={14} />
                      ) : (
                        <Volume2 size={14} />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(spotifyVolume * 100)}
                      onChange={(e) =>
                        spotifyActions.changeVolume(
                          Number(e.target.value) / 100,
                        )
                      }
                      className="flex-1 h-1 accent-green-500 cursor-pointer"
                    />
                    <button
                        onClick={() => {
                          spotifyOpenSearch();
                          onClose();
                        }}
                        disabled={!spotifyReady}
                        className="p-1.5 rounded-full border-0 cursor-pointer disabled:opacity-30 text-gray-700 dark:text-white"
                        title="Tìm kiếm"
                      >
                        <Search size={16} />
                      </button>

                      <button
                        onClick={() => spotifyDisconnect()}
                        className="p-1.5 rounded-full border-0 cursor-pointer text-gray-500 hover:text-red-500"
                        title="Ngắt kết nối"
                      >
                        <Unplug size={14} />
                      </button>

                     
                  </div>
                  {currentTrack && (
                    <div className="px-2 pb-4 flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right shrink-0">
                        {formatMs(localPos)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={spotifyDuration || 1}
                        value={localPos}
                        onChange={(e) => {
                          setIsSeeking(true);
                          setLocalPos(Number(e.target.value));
                        }}
                        onMouseUp={(e) => {
                          spotifyActions.seek(
                            Number((e.target as HTMLInputElement).value),
                          );
                          setIsSeeking(false);
                        }}
                        onTouchEnd={(e) => {
                          spotifyActions.seek(
                            Number((e.target as HTMLInputElement).value),
                          );
                          setIsSeeking(false);
                        }}
                        disabled={!spotifyReady}
                        className="flex-1 h-1.5 accent-green-500 cursor-pointer disabled:opacity-40"
                      />
                      <span className="text-[10px] text-gray-500 tabular-nums w-8 shrink-0">
                        {formatMs(spotifyDuration)}
                      </span>
                    </div>
                  )}
                </>
              )}

          </>
        )}
    </div>
  );
}
