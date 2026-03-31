"use client";

import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

function SpotifyLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function EqualizerBars() {
  return (
    <div className="flex items-end gap-px shrink-0" style={{ height: 14 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] bg-current rounded-sm"
          style={{ originY: 1, height: 14 }}
          animate={{ scaleY: [0.2, 1, 0.2] }}
          transition={{
            duration: 0.5 + i * 0.08,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function SpotifyHeaderButton() {
  const t = useTranslations("spotify");
  const { isConnected, isPlaying, currentTrack, openWidget } =
    useSpotifyStore();

  return (
    <motion.button
      onClick={openWidget}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={
        !isConnected
          ? t("connectSpotify")
          : currentTrack
            ? `${currentTrack.name} — ${currentTrack.artists}`
            : t("openSpotify")
      }
      className={[
        "relative flex items-center gap-2 h-10 px-3.5 rounded-full overflow-hidden",
        "transition-colors duration-300 text-sm font-medium select-none cursor-pointer outline-none",
        isPlaying
          ? "bg-[#1DB954] text-white shadow-lg shadow-[#1DB954]/40 hover:bg-[#1ed760]"
          : isConnected
            ? "bg-[#1DB954]/15 border border-[#1DB954]/40 text-[#1DB954] hover:bg-[#1DB954]/25"
            : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10",
      ].join(" ")}
    >
      {/* Glow pulse when playing */}
      {isPlaying && (
        <motion.span
          className="absolute inset-0 bg-white/20 rounded-full pointer-events-none"
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Spotify logo */}
      <SpotifyLogo className="h-[18px] w-[18px] relative z-10 shrink-0" />

      {/* Dynamic right side */}
      <AnimatePresence mode="wait">
        {isPlaying ? (
          <motion.div
            key="eq"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-2 relative z-10 overflow-hidden"
          >
            <EqualizerBars />
            <span className="hidden sm:block max-w-[90px] truncate text-xs leading-none">
              {currentTrack?.name ?? t("playing")}
            </span>
          </motion.div>
        ) : (
          <motion.span
            key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden sm:block relative z-10"
          >
            {isConnected ? t("listenSpotify") : t("connectSpotify")}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Pulsing dot when not connected */}
      {!isConnected && (
        <span className="relative z-10 flex h-2 w-2 ml-0.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1DB954]/70" />
        </span>
      )}
    </motion.button>
  );
}
