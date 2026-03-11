"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { focusWorldSocket } from "@/lib/focusWorldSocket";
import { useSession } from "next-auth/react";
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  ExternalLink,
  Unplug,
  Radio,
  RadioTower,
} from "lucide-react";
import Image from "next/image";

/**
 * Compact Spotify mini-player for the focus timer.
 * Renders as a collapsible bar below the timer controls.
 */
export function SpotifyWidget() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const {
    isConnected,
    isPremium,
    isLoading,
    isHosting,
    hostPlayback,
    checkConnection,
    disconnect,
    setHosting,
  } = useSpotifyStore();
  const {
    isReady,
    isPlaying,
    currentTrack,
    position,
    duration,
    volume,
    togglePlay,
    next,
    previous,
    play,
    changeVolume,
  } = useSpotifyPlayer();
  const { isOpen: worldOpen } = useFocusWorldStore();

  const [showVolume, setShowVolume] = useState(false);
  const prevVolume = useRef(volume);
  const [checked, setChecked] = useState(false);

  // Check connection on mount
  useEffect(() => {
    if (!checked) {
      checkConnection();
      setChecked(true);
    }
  }, [checked, checkConnection]);

  // ── Co-listening: broadcast playback state when hosting ──
  const prevTrackRef = useRef<string | null>(null);
  const broadcastInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const emitHostUpdate = useCallback(() => {
    const socket = focusWorldSocket.get();
    if (!socket || !userId || !currentTrack) return;
    socket.emit("spotify:host_update", {
      userId,
      trackUri: currentTrack.uri,
      trackName: currentTrack.name,
      artistName: currentTrack.artists,
      albumArt: currentTrack.albumArt,
      positionMs: position,
      isPlaying,
    });
  }, [userId, currentTrack, position, isPlaying]);

  useEffect(() => {
    if (!isHosting || !currentTrack) return;

    // When track changes, emit update immediately
    if (prevTrackRef.current !== currentTrack.uri) {
      prevTrackRef.current = currentTrack.uri;
      emitHostUpdate();
    }

    // Periodic updates every 5 seconds
    broadcastInterval.current = setInterval(emitHostUpdate, 5000);
    return () => {
      if (broadcastInterval.current) clearInterval(broadcastInterval.current);
    };
  }, [isHosting, currentTrack, emitHostUpdate]);

  // When play/pause changes while hosting, emit immediately
  useEffect(() => {
    if (isHosting) emitHostUpdate();
  }, [isPlaying, isHosting, emitHostUpdate]);

  // ── Co-listening: listener auto-sync ──
  const lastSyncedTrack = useRef<string | null>(null);
  useEffect(() => {
    if (!hostPlayback || !isReady || isHosting) return;
    if (hostPlayback.hostUserId === userId) return;

    // Auto-sync: play the host's track
    if (hostPlayback.isPlaying && hostPlayback.trackUri !== lastSyncedTrack.current) {
      lastSyncedTrack.current = hostPlayback.trackUri;
      play(hostPlayback.trackUri);
    }
  }, [hostPlayback, isReady, isHosting, userId, play]);

  const handleStartBroadcasting = () => {
    const socket = focusWorldSocket.get();
    if (!socket || !userId || !currentTrack) return;
    socket.emit("spotify:host_start", {
      userId,
      trackUri: currentTrack.uri,
      trackName: currentTrack.name,
      artistName: currentTrack.artists,
      albumArt: currentTrack.albumArt,
      positionMs: position,
      isPlaying,
    });
    setHosting(true);
  };

  const handleStopBroadcasting = () => {
    const socket = focusWorldSocket.get();
    if (!socket || !userId) return;
    socket.emit("spotify:host_stop", { userId });
    setHosting(false);
    prevTrackRef.current = null;
    if (broadcastInterval.current) clearInterval(broadcastInterval.current);
  };

  // Not connected → show connect button
  if (!isConnected && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
      >
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-green-400" />
        </div>
        <span className="text-sm text-gray-400 flex-1">
          Kết nối Spotify để nghe nhạc khi focus
        </span>
        <a
          href="/api/spotify/connect"
          className="px-3 py-1.5 rounded-full bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          Kết Nối
        </a>
      </motion.div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
      >
        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">
          Đang kết nối Spotify...
        </span>
      </motion.div>
    );
  }

  // Connected but not premium
  if (isPremium === false) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
      >
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-yellow-300 font-medium">
            Cần Spotify Premium
          </p>
          <p className="text-xs text-gray-500">
            Web Playback SDK yêu cầu tài khoản Premium
          </p>
        </div>
        <button
          onClick={() => disconnect()}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-500"
          title="Ngắt kết nối"
        >
          <Unplug className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  // Connected + premium → show player
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const toggleMute = () => {
    if (volume > 0) {
      prevVolume.current = volume;
      changeVolume(0);
    } else {
      changeVolume(prevVolume.current || 0.5);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-xl bg-white/5 border border-white/10 overflow-hidden"
    >
      {/* Playback progress bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full bg-green-500 transition-all duration-1000"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-4 py-3 flex items-center gap-3">
        {/* Album art */}
        <div className="w-10 h-10 rounded-md bg-white/10 overflow-hidden shrink-0 relative">
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
              <p className="text-sm font-medium text-white truncate">
                {currentTrack.name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {currentTrack.artists}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              {isReady ? "Chưa phát nhạc" : "Đang kết nối player..."}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Connection indicator */}
          <div
            className="p-1.5"
            title={isReady ? "Player sẵn sàng" : "Đang kết nối..."}
          >
            {isReady ? (
              <Wifi className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-gray-600" />
            )}
          </div>

          <button
            onClick={previous}
            disabled={!isReady}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="Bài trước"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center disabled:opacity-30"
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" fill="currentColor" />
            )}
          </button>

          <button
            onClick={next}
            disabled={!isReady}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label="Bài tiếp"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div className="relative">
            <button
              onClick={toggleMute}
              onMouseEnter={() => setShowVolume(true)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Âm lượng"
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4 text-gray-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {showVolume && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  onMouseLeave={() => setShowVolume(false)}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-3 rounded-lg bg-gray-800 border border-gray-700 shadow-xl"
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(e) => changeVolume(Number(e.target.value) / 100)}
                    className="w-20 h-1 accent-green-500 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3"
                    aria-label="Volume"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Disconnect */}
          <button
            onClick={() => disconnect()}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-500 hover:text-red-400"
            title="Ngắt kết nối Spotify"
          >
            <Unplug className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Time stamps */}
      {currentTrack && (
        <div className="px-4 pb-2 flex justify-between text-[10px] text-gray-500 tabular-nums">
          <span>{formatMs(position)}</span>
          <span>{formatMs(duration)}</span>
        </div>
      )}

      {/* Co-listening bar */}
      {worldOpen && isReady && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2">
          {isHosting ? (
            <div className="flex items-center gap-2">
              <RadioTower className="w-3.5 h-3.5 text-green-400 animate-pulse" />
              <span className="text-xs text-green-400 flex-1">
                Đang phát cho Focus World
              </span>
              <button
                onClick={handleStopBroadcasting}
                className="text-xs px-2 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
              >
                Dừng
              </button>
            </div>
          ) : hostPlayback && hostPlayback.hostUserId !== userId ? (
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-indigo-400 flex-1 truncate">
                {hostPlayback.hostName || "Host"}: {hostPlayback.trackName}
              </span>
            </div>
          ) : currentTrack ? (
            <button
              onClick={handleStartBroadcasting}
              className="flex items-center gap-2 w-full text-xs text-gray-400 hover:text-green-400 transition-colors"
            >
              <RadioTower className="w-3.5 h-3.5" />
              <span>Phát cho Focus World</span>
            </button>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
