"use client";

/**
 * Fullscreen Spotify modal — opened from the header button.
 * Contains the full SpotifyWidget with minimize / close controls.
 * Minimize → floating widget tab. Close → hide entirely.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { useFocusStore } from "@/stores/useFocusStore";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { SpotifyWidget } from "@/components/focus/SpotifyWidget";
import { openPip, resizePIP, calcPIPHeight } from "@/hooks/usePictureInPicture";
import { Minimize2, X, Music } from "lucide-react";

export function SpotifyModal() {
  const { isWidgetOpen, isWidgetMinimized, minimizeWidget, closeWidget } =
    useSpotifyStore();
  const { activeTask } = useFocusStore();
  const { isOpen: worldOpen, isMinimized: worldMinimized } =
    useFocusWorldStore();

  const visible = isWidgetOpen && !isWidgetMinimized;

  const handleMinimize = async () => {
    await openPip(140, 460);
    // Spotify always needs 220px content; check other existing tabs
    const timerInPip = !!activeTask;
    const worldInPip = worldOpen && worldMinimized;
    // Always resize: Spotify alone = 220, with others = tab bar + 220
    if (worldInPip || timerInPip) {
      resizePIP(
        calcPIPHeight({
          timer: timerInPip,
          world: worldInPip,
          spotify: true,
          target: "spotify",
        }),
      );
    }
    minimizeWidget();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={handleMinimize}
          />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative z-10 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 flex items-center justify-center">
                  <Music className="w-5 h-5 text-[#1DB954]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Spotify</h2>
                  <p className="text-xs text-gray-400">
                    Nghe nhạc khi làm việc
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMinimize}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                  title="Thu nhỏ"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={closeWidget}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SpotifyWidget (full version) */}
            <SpotifyWidget />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
