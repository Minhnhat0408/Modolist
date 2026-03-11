"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSpotifyStore } from "@/stores/useSpotifyStore";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const PLAYER_NAME = "Todolist Focus Player";

let sdkLoaded = false;

function loadSpotifySDK(): Promise<void> {
  if (sdkLoaded || typeof window === "undefined") return Promise.resolve();
  if (document.querySelector(`script[src="${SDK_URL}"]`)) {
    sdkLoaded = true;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      sdkLoaded = true;
      resolve();
    };
    document.body.appendChild(script);
  });
}

export function useSpotifyPlayer() {
  const playerRef = useRef<Spotify.Player | null>(null);
  const {
    isConnected,
    isPremium,
    isReady,
    isPlaying,
    currentTrack,
    position,
    duration,
    volume,
    deviceId,
    getAccessToken,
    setPlayerReady,
    setPlayerNotReady,
    updatePlaybackState,
    setVolume: setStoreVolume,
  } = useSpotifyStore();

  // Initialize player when connected + premium
  useEffect(() => {
    if (!isConnected || isPremium === false) return;

    let cancelled = false;

    async function init() {
      await loadSpotifySDK();
      if (cancelled) return;

      // Wait for SDK ready callback
      const waitForSDK = (): Promise<void> =>
        new Promise((resolve) => {
          if (window.Spotify) {
            resolve();
          } else {
            window.onSpotifyWebPlaybackSDKReady = () => resolve();
          }
        });

      await waitForSDK();
      if (cancelled || playerRef.current) return;

      const player = new window.Spotify.Player({
        name: PLAYER_NAME,
        getOAuthToken: async (cb) => {
          const token = await getAccessToken();
          if (token) cb(token);
        },
        volume: useSpotifyStore.getState().volume,
      });

      player.addListener("ready", ({ device_id }) => {
        if (!cancelled) setPlayerReady(device_id);
      });

      player.addListener("not_ready", () => {
        if (!cancelled) setPlayerNotReady();
      });

      player.addListener("player_state_changed", (state) => {
        if (!cancelled) updatePlaybackState(state);
      });

      player.addListener("initialization_error", (e) =>
        console.error("Spotify init error:", e.message),
      );
      player.addListener("authentication_error", (e) =>
        console.error("Spotify auth error:", e.message),
      );
      player.addListener("account_error", (e) =>
        console.error("Spotify account error:", e.message),
      );

      await player.connect();
      playerRef.current = player;
    }

    init();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
        setPlayerNotReady();
      }
    };
  }, [isConnected, isPremium, getAccessToken, setPlayerReady, setPlayerNotReady, updatePlaybackState]);

  // Sync volume to player
  useEffect(() => {
    if (playerRef.current && isReady) {
      playerRef.current.setVolume(volume).catch(() => {});
    }
  }, [volume, isReady]);

  const play = useCallback(
    async (uriOrContext?: string) => {
      const token = await getAccessToken();
      if (!token || !deviceId) return;

      const body: Record<string, unknown> = {};
      if (uriOrContext) {
        if (uriOrContext.includes("playlist") || uriOrContext.includes("album") || uriOrContext.includes("artist")) {
          body.context_uri = uriOrContext;
        } else {
          body.uris = [uriOrContext];
        }
      }

      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
    },
    [getAccessToken, deviceId],
  );

  const pause = useCallback(async () => {
    playerRef.current?.pause();
  }, []);

  const resume = useCallback(async () => {
    playerRef.current?.resume();
  }, []);

  const togglePlay = useCallback(async () => {
    playerRef.current?.togglePlay();
  }, []);

  const next = useCallback(async () => {
    playerRef.current?.nextTrack();
  }, []);

  const previous = useCallback(async () => {
    playerRef.current?.previousTrack();
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    playerRef.current?.seek(positionMs);
  }, []);

  const changeVolume = useCallback(
    (v: number) => {
      setStoreVolume(v);
    },
    [setStoreVolume],
  );

  return {
    isReady,
    isPlaying,
    currentTrack,
    position,
    duration,
    volume,
    deviceId,
    play,
    pause,
    resume,
    togglePlay,
    next,
    previous,
    seek,
    changeVolume,
  };
}
