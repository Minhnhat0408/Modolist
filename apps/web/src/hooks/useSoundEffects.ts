"use client";

import { useCallback } from "react";

export type SoundName =
  | "focus-start"
  | "session-end"
  | "session-complete"
  | "task-click-drag"
  | "task-drop";

// Singleton cache — one Audio instance per sfx, reused across renders
const audioCache = new Map<SoundName, HTMLAudioElement>();

// Track the currently playing audio so we can stop it on interrupt
let currentAudio: HTMLAudioElement | null = null;

function getAudio(name: SoundName): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioCache.has(name)) {
    const audio = new Audio(`/sfx/${name}.mp3`);
    audio.preload = "auto";
    audioCache.set(name, audio);
  }
  return audioCache.get(name)!;
}

export function useSoundEffects(volume = 0.5) {
  const play = useCallback(
    (name: SoundName) => {
      try {
        const audio = getAudio(name);
        if (!audio) return;

        // Stop whatever is currently playing before starting the new one
        if (currentAudio && currentAudio !== audio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }

        currentAudio = audio;
        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch(() => {
          // Autoplay policy blocked — clear reference
          currentAudio = null;
        });

        // Clear reference when done
        const onEnd = () => {
          if (currentAudio === audio) currentAudio = null;
          audio.removeEventListener("ended", onEnd);
        };
        audio.addEventListener("ended", onEnd);
      } catch {
        currentAudio = null;
      }
    },
    [volume],
  );

    const stop = useCallback(() => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
    }, []);

  return { play, stop };
}
