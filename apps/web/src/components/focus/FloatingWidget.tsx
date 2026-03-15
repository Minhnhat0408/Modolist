"use client";

/**
 * Floating widget with three tabs: Timer, Focus World, Spotify.
 *
 * - Timer & World: ALL original controls always visible.
 * - Spotify tab: shows when user minimised the Spotify modal.
 * - Hides when PiP is active.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { spotifyActions } from "@/hooks/useSpotifyPlayer";
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
  Search,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";

type Tab = "timer" | "world" | "spotify";

export function FloatingWidget() {
  const { data: session } = useSession();
  const isPip = usePipActive();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [widgetWidth, setWidgetWidth] = useState(380);
  useEffect(() => {
    if (widgetRef.current) setWidgetWidth(widgetRef.current.offsetWidth);
  }, []);

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
    toggleMinimize: toggleTimerMinimize,
    sessionId,
  } = useFocusStore();

  /* ── Focus world state ────────────────────────────────────────────── */
  const {
    isOpen: worldOpen,
    isMinimized: worldMinimized,
    openWorld,
    toggleMinimize: toggleWorldMinimize,
    closeWorld,
    setOnlineData,
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
    openWidget: spotifyOpenWidget,
    closeWidget: spotifyCloseWidget,
    openWidgetWithSearch: spotifyOpenSearch,
  } = useSpotifyStore();

  /* ── Socket connection (Focus World) ──────────────────────────────── */
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

  useEffect(() => {
    setOnlineData(otherUsers.length, isConnected);
  }, [otherUsers.length, isConnected, setOnlineData]);

  /* ── Tab logic ────────────────────────────────────────────────────── */
  const hasTimerTab = !!activeTask && timerMinimized;
  const hasWorldTab = !!activeTask && worldOpen && worldMinimized;
  const hasSpotifyTab = spotifyWidgetMinimized;

  const availableTabs: Tab[] = [];
  if (hasTimerTab) availableTabs.push("timer");
  if (hasWorldTab) availableTabs.push("world");
  if (hasSpotifyTab) availableTabs.push("spotify");

  const showTabs = availableTabs.length > 1;
  const [activeTab, setActiveTab] = useState<Tab>("timer");

  // Auto-select first available tab when tabs change
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]!);
    }
  }, [hasTimerTab, hasWorldTab, hasSpotifyTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Spotify local seek state ─────────────────────────────────────── */
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

  /* ── Visibility ───────────────────────────────────────────────────── */
  const visible = !isPip && availableTabs.length > 0;
  if (!visible) return null;

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

  const tabBtnCls = (tab: Tab, color: string) =>
    `flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
      activeTab === tab
        ? `text-gray-900 dark:text-white border-b-2 ${color} bg-black/5 dark:bg-white/5`
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    }`;

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <motion.div
      ref={widgetRef}
      layoutId="floating-widget"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 right-6 z-50"
      drag
      dragConstraints={{
        top: -window.innerHeight + 200,
        // Allow dragging flush to the left edge: offset = initial right-6 position minus widget width
        left: -(window.innerWidth - widgetWidth - 24),
        right: 0,
        bottom: 0,
      }}
      dragElastic={0.1}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-white/95 dark:bg-linear-to-br dark:from-gray-900 dark:to-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-lg w-95">
        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        {showTabs && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {hasTimerTab && (
              <button
                onClick={() => setActiveTab("timer")}
                className={tabBtnCls("timer", "border-blue-500")}
              >
                <Timer className="w-3.5 h-3.5" />
                Bộ Đếm
              </button>
            )}
            {hasWorldTab && (
              <button
                onClick={() => setActiveTab("world")}
                className={tabBtnCls("world", "border-indigo-500")}
              >
                <Users className="w-3.5 h-3.5" />
                Focus World
                {otherUsers.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-500 text-[9px] flex items-center justify-center text-white">
                    {otherUsers.length}
                  </span>
                )}
              </button>
            )}
            {hasSpotifyTab && (
              <button
                onClick={() => setActiveTab("spotify")}
                className={tabBtnCls("spotify", "border-green-500")}
              >
                <Music className="w-3.5 h-3.5" />
                Spotify
                {spotifyPlaying && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                )}
              </button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ══════════════ TIMER TAB ══════════════ */}
          {(activeTab === "timer" || !showTabs) && hasTimerTab && (
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
                    {activeTask!.title}
                  </div>
                  <div className="text-lg font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatTime(timeLeft)}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  {mode === "WORK" && !worldOpen && (
                    <button
                      onClick={openWorld}
                      className={btnCls}
                      aria-label="Focus World"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  )}
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
          {activeTab === "world" && hasWorldTab && (
            <motion.div
              key="world"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="px-4 py-3 flex items-center gap-3">
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

                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <Wifi className="w-3 h-3 text-green-500 dark:text-green-400" />
                        <span className="text-green-500 dark:text-green-400">
                          Online
                        </span>
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

                <div className="flex items-center gap-2">
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

          {/* ══════════════ SPOTIFY TAB ══════════════ */}
          {(activeTab === "spotify" ||
            (!showTabs && hasSpotifyTab && !hasTimerTab)) &&
            hasSpotifyTab && (
              <motion.div
                key="spotify"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Not connected */}
                {!spotifyConnected && !spotifyLoading && (
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-[#1DB954]" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                      Kết nối Spotify để nghe nhạc
                    </span>
                    <a
                      href="/api/spotify/connect"
                      className="px-3 py-1.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Kết Nối
                    </a>
                    <button
                      onClick={spotifyCloseWidget}
                      className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center text-red-500 dark:text-white shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Loading */}
                {spotifyLoading && (
                  <div className="px-4 py-3 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Đang kết nối Spotify...
                    </span>
                  </div>
                )}

                {/* Not premium */}
                {spotifyConnected && spotifyPremium === false && (
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-yellow-600 dark:text-yellow-300 font-medium">
                        Cần Spotify Premium
                      </p>
                      <p className="text-xs text-gray-500">
                        Web Playback SDK yêu cầu Premium
                      </p>
                    </div>
                    <button
                      onClick={() => spotifyDisconnect()}
                      className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-500"
                    >
                      <Unplug className="w-4 h-4" />
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
                        <div className="w-10 h-10 rounded-md bg-black/10 dark:bg-white/10 overflow-hidden shrink-0 relative">
                          {currentTrack?.albumArt ? (
                            <Image
                              src={currentTrack.albumArt}
                              alt={currentTrack.albumName}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                        </div>

                        {/* Track info */}
                        <div className="flex-1 min-w-0">
                          {currentTrack ? (
                            <>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {currentTrack.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {currentTrack.artists}
                              </p>
                            </>
                          ) : spotifyReady ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Chưa phát nhạc
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
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
                              className="shrink-0 px-2 py-1 rounded-full bg-green-500/20 hover:bg-green-500/30 text-green-600 dark:text-green-400 text-[11px] font-medium transition-colors"
                            >
                              Phát ở đây
                            </button>
                          )}

                        {/* Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => spotifyActions.toggleShuffle()}
                            disabled={!spotifyReady}
                            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 ${spotifyShuffle ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}
                            title={spotifyShuffle ? "Tắt trộn bài" : "Trộn bài"}
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => spotifyActions.previous()}
                            disabled={!spotifyReady}
                            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30"
                          >
                            <SkipBack className="w-4 h-4 text-gray-700 dark:text-white" />
                          </button>

                          <button
                            onClick={() => spotifyActions.togglePlay()}
                            disabled={!spotifyReady}
                            className="w-8 h-8 rounded-full bg-[#1DB954] hover:bg-[#1ed760] transition-colors flex items-center justify-center disabled:opacity-30 text-white"
                          >
                            {spotifyPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" fill="currentColor" />
                            )}
                          </button>

                          <button
                            onClick={() => spotifyActions.next()}
                            disabled={!spotifyReady}
                            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30"
                          >
                            <SkipForward className="w-4 h-4 text-gray-700 dark:text-white" />
                          </button>

                          <button
                            onClick={() => spotifyActions.cycleRepeat()}
                            disabled={!spotifyReady}
                            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 ${spotifyRepeat !== "off" ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}
                            title={
                              spotifyRepeat === "off"
                                ? "Lặp lại"
                                : spotifyRepeat === "context"
                                  ? "Đang lặp playlist"
                                  : "Đang lặp bài"
                            }
                          >
                            {spotifyRepeat === "track" ? (
                              <Repeat1 className="w-3.5 h-3.5" />
                            ) : (
                              <Repeat className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Search → open modal with search */}
                          <button
                            onClick={spotifyOpenSearch}
                            disabled={!spotifyReady}
                            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30"
                            title="Tìm kiếm"
                          >
                            <Search className="w-4 h-4 text-gray-700 dark:text-white" />
                          </button>

                          <button
                            onClick={() => spotifyDisconnect()}
                            className="p-1.5 rounded-full hover:bg-red-500/10 transition-colors text-gray-500 hover:text-red-500"
                            title="Ngắt kết nối"
                          >
                            <Unplug className="w-3.5 h-3.5" />
                          </button>

                          {/* Expand to modal */}
                          <button
                            onClick={spotifyOpenWidget}
                            className={btnCls}
                            aria-label="Phóng to"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>

                          {/* Close */}
                          <button
                            onClick={spotifyCloseWidget}
                            className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center text-red-500 dark:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Seek bar */}
                      {currentTrack && (
                        <div className="px-4 pb-2 flex items-center gap-2">
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
                            className="flex-1 h-1 accent-green-500 cursor-pointer disabled:opacity-40"
                          />
                          <span className="text-[10px] text-gray-500 tabular-nums w-8 shrink-0">
                            {formatMs(spotifyDuration)}
                          </span>
                        </div>
                      )}

                      {/* Volume bar (horizontal, always visible) */}
                      <div className="px-4 pb-3 flex items-center gap-2">
                        <button
                          onClick={toggleMute}
                          className="p-1 rounded-full text-gray-700 dark:text-white shrink-0"
                        >
                          {spotifyVolume === 0 ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
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
                      </div>
                    </>
                  )}
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
