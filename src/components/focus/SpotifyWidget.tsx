"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { spotifyActions } from "@/hooks/useSpotifyPlayer";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { focusWorldSocket } from "@/lib/focusWorldSocket";
import { useSession } from "@/hooks/useSupabaseSession";
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
  Shuffle,
  Repeat,
  Repeat1,
  Search,
} from "lucide-react";
import Image from "next/image";
import { SpotifySearchPanel } from "./SpotifySearchModal";
import { useTranslations } from "next-intl";

/**
 * Compact Spotify mini-player for the focus timer.
 * Renders as a collapsible bar below the timer controls.
 */
export function SpotifyWidget() {
  const t = useTranslations("spotify");
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const {
    isConnected,
    isPremium,
    isLoading,
    isReady,
    hasPlayer,
    isPlaying,
    isActiveDevice,
    currentTrack,
    position,
    duration,
    volume,
    shuffle,
    repeatMode,
    isDJ,
    djState,
    isListening,
    disconnect,
    setDJ,
    setListening,
    showSearch,
    setShowSearch,
  } = useSpotifyStore();
  const {
    togglePlay,
    transferAndPlay,
    next,
    previous,
    play,
    seek,
    changeVolume,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
  } = spotifyActions;
  const { isOpen: worldOpen, focusUsers } = useFocusWorldStore();

  const listeners = focusUsers.filter(
    (u) => u.userId !== userId && u.isListeningToDj,
  );

  const initials = (name: string | null) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const [showVolume, setShowVolume] = useState(false);
  const prevVolume = useRef(volume);
  const [localPosition, setLocalPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Sync localPosition from store when not dragging
  useEffect(() => {
    if (!isSeeking) setLocalPosition(position);
  }, [position, isSeeking]);

  // Tick every second while playing for smooth display
  useEffect(() => {
    if (!isPlaying || isSeeking) return;
    const id = setInterval(() => {
      setLocalPosition((p) => Math.min(p + 1000, duration));
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, isSeeking, duration]);

  // ── Co-listening: broadcast only on genuine state changes (event-driven) ──
  const djPrevTrackRef = useRef<string | null>(null);
  const djPrevIsPlayingRef = useRef<boolean | null>(null);

  const emitDjUpdate = useCallback(() => {
    const socket = focusWorldSocket.get();
    const track = useSpotifyStore.getState().currentTrack;
    const { position: pos, isPlaying: playing } = useSpotifyStore.getState();
    if (!socket || !track) return;
    socket.send({ type: "broadcast", event: "spotify:dj_update", payload: {
      trackUri: track.uri,
      trackName: track.name,
      artistName: track.artists,
      albumArt: track.albumArt,
      positionMs: pos,
      isPlaying: playing,
    } });
  }, []);

  // Track change → emit once
  useEffect(() => {
    if (!isDJ || !currentTrack) return;
    if (djPrevTrackRef.current !== currentTrack.uri) {
      djPrevTrackRef.current = currentTrack.uri;
      emitDjUpdate();
    }
  }, [isDJ, currentTrack, emitDjUpdate]);

  // Play/Pause toggle → emit once (only on actual change)
  useEffect(() => {
    if (!isDJ) return;
    if (djPrevIsPlayingRef.current === null) {
      djPrevIsPlayingRef.current = isPlaying;
      return; // skip initial mount
    }
    if (djPrevIsPlayingRef.current !== isPlaying) {
      djPrevIsPlayingRef.current = isPlaying;
      emitDjUpdate();
    }
  }, [isDJ, isPlaying, emitDjUpdate]);

  // Safety net: heartbeat every 30s so late-joiners get a reasonably fresh state
  useEffect(() => {
    if (!isDJ) return;
    const id = setInterval(emitDjUpdate, 30_000);
    return () => clearInterval(id);
  }, [isDJ, emitDjUpdate]);

  const handleClaimDJ = () => {
    const socket = focusWorldSocket.get();
    if (!socket || !currentTrack) return;
    socket.send({ type: "broadcast", event: "spotify:dj_claim", payload: {
      trackUri: currentTrack.uri,
      trackName: currentTrack.name,
      artistName: currentTrack.artists,
      albumArt: currentTrack.albumArt,
      positionMs: position,
      isPlaying,
    } });
    setDJ(true);
  };

  const handleReleaseDJ = () => {
    const socket = focusWorldSocket.get();
    if (!socket) return;
    socket.send({ type: "broadcast", event: "spotify:dj_release", payload: {} });
    setDJ(false);
    djPrevTrackRef.current = null;
    djPrevIsPlayingRef.current = null;
  };

  const handleToggleListening = () => {
    const next = !isListening;
    const socket = focusWorldSocket.get();
    if (socket) {
      socket.send({ type: "broadcast", event: "spotify:listening_toggle", payload: { isListening: next } });
    }
    setListening(next);
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
          {t("connectToListen")}
        </span>
        <button
          onClick={() => {
            const target = (window.opener as Window | null) ?? window;
            target.location.href = "/api/spotify/connect";
          }}
          className="px-3 py-1.5 rounded-full border-0 bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-3 h-3" />
          {t("connect")}
        </button>
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
        <span className="text-sm text-gray-400">{t("connectingSpotify")}</span>
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
            {t("needPremium")}
          </p>
          <p className="text-xs text-gray-500">
            {t("premiumRequired")}
          </p>
        </div>
        <button
          onClick={() => disconnect()}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-500"
          title={t("disconnect")}
        >
          <Unplug className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  // Connected + premium → show player
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
      className="mt-6 rounded-xl bg-white/5 border border-white/10"
    >
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
            <>
              {isReady ? (
                <>
                  <p className="text-sm text-gray-400">{t("noTrackPlaying")}</p>
                  <p className="text-[10px] text-gray-600">
                    {t("openSpotifyToPlay")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">{t("connectingPlayer")}</p>
              )}
            </>
          )}
        </div>

        {/* Transfer button — only when SDK player exists but audio is playing on another device */}
        {hasPlayer && currentTrack && !isActiveDevice && (
          <button
            onClick={transferAndPlay}
            className="shrink-0 px-2.5 py-1 rounded-full bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[11px] font-medium transition-colors"
            title={t("transferPlayback")}
          >
            {t("playHere")}
          </button>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Connection indicator */}
          <div
            className="p-1.5"
            title={isReady ? t("playerReady") : t("connectingPlayer")}
          >
            {isReady ? (
              <Wifi className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-gray-600" />
            )}
          </div>

          {/* Search / browse */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            disabled={!isReady}
            className={`p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30 ${showSearch ? "text-green-400 bg-white/10" : ""}`}
            aria-label={t("search")}
            title={t("searchSongsPlaylistAlbum")}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            disabled={!isReady}
            className={`p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30 ${
              shuffle ? "text-green-400" : "text-gray-400"
            }`}
            aria-label="Shuffle"
            title={shuffle ? t("shuffleOn") : t("shuffleOff")}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={previous}
            disabled={!isReady}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
            aria-label={t("previousTrack")}
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center disabled:opacity-30"
            aria-label={isPlaying ? t("pausePlay") : t("play")}
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
            aria-label={t("nextTrack")}
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            disabled={!isReady}
            className={`p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30 ${
              repeatMode !== "off" ? "text-green-400" : "text-gray-400"
            }`}
            aria-label="Repeat"
            title={
              repeatMode === "off"
                ? t("repeat")
                : repeatMode === "context"
                  ? t("repeatPlaylist")
                  : t("repeatTrack")
            }
          >
            {repeatMode === "track" ? (
              <Repeat1 className="w-3.5 h-3.5" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Volume */}
          <div className="relative">
            <button
              onClick={toggleMute}
              onMouseEnter={() => setShowVolume(true)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label={t("volume")}
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
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-3 rounded-lg bg-gray-800 border border-gray-700 shadow-xl z-50"
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
            title={t("disconnectSpotify")}
          >
            <Unplug className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Seekable progress bar with timestamps */}
      {currentTrack && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right shrink-0">
            {formatMs(localPosition)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            value={localPosition}
            onChange={(e) => {
              setIsSeeking(true);
              setLocalPosition(Number(e.target.value));
            }}
            onMouseUp={(e) => {
              seek(Number((e.target as HTMLInputElement).value));
              setIsSeeking(false);
            }}
            onTouchEnd={(e) => {
              seek(Number((e.target as HTMLInputElement).value));
              setIsSeeking(false);
            }}
            disabled={!isReady}
            className="flex-1 h-1 accent-green-500 cursor-pointer disabled:opacity-40"
            aria-label="Seek"
          />
          <span className="text-[10px] text-gray-500 tabular-nums w-8 shrink-0">
            {formatMs(duration)}
          </span>
        </div>
      )}

      {/* Inline search panel */}
      {showSearch && isReady && (
        <div className="px-4 pb-3">
          <SpotifySearchPanel
            onPlayUri={(uri) => play(uri)}
            onAddToQueue={(uri) => addToQueue(uri)}
          />
        </div>
      )}

      {/* Co-listening bar */}
      {worldOpen && isReady && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2">
          {isDJ ? (
            /* I am the DJ */
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioTower className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                <span className="text-xs text-green-400 flex-1">
                  {t("djStatus", { count: listeners.length })}
                </span>
                <button
                  onClick={handleReleaseDJ}
                  className="text-xs px-2 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                >
                  {t("stopDj")}
                </button>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/10 px-2 py-2">
                {listeners.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    {listeners.map((u) => (
                      <div
                        key={u.userId}
                        className="shrink-0 flex items-center gap-2 rounded-full bg-white/10 border border-white/10 pl-1 pr-2 py-1"
                        title={u.name || "Anonymous"}
                      >
                        <div className="relative w-6 h-6 rounded-full overflow-hidden bg-white/15 flex items-center justify-center text-[10px] text-white font-semibold">
                          {u.image ? (
                            <Image
                              src={u.image}
                              alt={u.name || "listener"}
                              fill
                              className="object-cover"
                              sizes="24px"
                            />
                          ) : (
                            initials(u.name)
                          )}
                        </div>
                        <span className="text-[11px] text-gray-300 max-w-27.5 truncate">
                          {u.name || "Anonymous"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    {t("noListeners")}
                  </p>
                )}
              </div>
            </div>
          ) : djState && djState.hostUserId !== userId ? (
            /* Someone else is DJ */
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="text-xs text-indigo-400 flex-1 truncate">
                {t("someoneIsDj", { name: djState.hostName || "Anonymous" })}
              </span>
              <button
                onClick={handleToggleListening}
                className={`text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap ${
                  isListening
                    ? "bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50"
                    : "bg-white/10 text-gray-400 hover:text-indigo-400"
                }`}
                title={
                  isListening
                    ? t("listeningToPrivate")
                    : t("syncWithDj")
                }
              >
                {isListening ? t("listeningTogether") : t("listenTogether")}
              </button>
              {/* Mic-steal: take over DJ */}
              {currentTrack && (
                <button
                  onClick={handleClaimDJ}
                  className="text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-green-500/20 text-gray-400 hover:text-green-400 transition-colors"
                  title={t("stealDj")}
                >
                  <RadioTower className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : currentTrack ? (
            /* No DJ yet — offer to claim */
            <button
              onClick={handleClaimDJ}
              className="flex items-center gap-2 w-full text-xs text-gray-400 hover:text-green-400 transition-colors group"
              title={t("becomeDj")}
            >
              <RadioTower className="w-3.5 h-3.5 group-hover:animate-pulse" />
              <span>{t("becomeDj")}</span>
            </button>
          ) : (
            /* No track & no DJ */
            <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
              <Radio className="w-3 h-3 shrink-0" />
              {t("playToBecomeDj")}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
