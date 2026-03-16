"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSpotifyStore } from "@/stores/useSpotifyStore";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const PLAYER_NAME = "Todolist Focus Player";
const SPOTIFY_API = "https://api.spotify.com/v1";

// Singleton promise — ensures onSpotifyWebPlaybackSDKReady is set BEFORE the
// script tag is appended, which is required by the Spotify SDK.
let sdkReadyPromise: Promise<void> | null = null;

function loadSpotifySDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();

  if (!sdkReadyPromise) {
    sdkReadyPromise = new Promise((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }

  return sdkReadyPromise;
}

/* ─── Global actions reference ─────────────────────────────────────────
 * Populated by the single component that calls useSpotifyPlayer().
 * Other components import this to call player controls without re-initializing.
 */
const noopAsync = async () => {};

export const spotifyActions = {
  togglePlay: noopAsync as () => Promise<void>,
  next: noopAsync as () => Promise<void>,
  previous: noopAsync as () => Promise<void>,
  seek: noopAsync as (positionMs: number) => Promise<void>,
  play: noopAsync as (uriOrContext?: string) => Promise<void>,
  transferAndPlay: noopAsync as () => Promise<void>,
  toggleShuffle: noopAsync as () => Promise<void>,
  cycleRepeat: noopAsync as () => Promise<void>,
  addToQueue: noopAsync as (uri: string) => Promise<void>,
  changeVolume: (() => {}) as (v: number) => void,
};

export function useSpotifyPlayer() {
  const playerRef = useRef<Spotify.Player | null>(null);
  const apiDeviceIdRef = useRef<string | null>(null);
  // fetchPlaybackStateRef lets SDK listener callbacks always call the latest
  // version of fetchPlaybackState without stale closure issues.
  const fetchPlaybackStateRef = useRef<() => void>(() => {});
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // When true, SDK state_changed events are from listen-along sync → skip re-fetch
  const isSyncingRef = useRef(false);
  const [hasPlayer, setHasPlayer] = useState(false);
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
    shuffle,
    repeatMode,
    isActiveDevice,
    getAccessToken,
    setPlayerReady,
    setPlayerNotReady,
    updatePlaybackState,
    setExternalPlaybackState,
    setVolume: setStoreVolume,
    setShuffle: setStoreShuffle,
    setRepeatMode: setStoreRepeat,
    setIsActiveDevice,
    setHasPlayer: setStoreHasPlayer,
  } = useSpotifyStore();

  // Initialize player when connected + premium
  useEffect(() => {
    if (!isConnected || isPremium === false) return;
    let cancelled = false;

    async function init() {
      await loadSpotifySDK();
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
        if (!cancelled) {
          setPlayerReady(device_id);
          setHasPlayer(true);
          setStoreHasPlayer(true);
        }
      });
      player.addListener("not_ready", () => {
        if (!cancelled) {
          setPlayerNotReady();
          // Another device likely took over — fetch true state immediately
          fetchPlaybackStateRef.current();
        }
      });
      player.addListener("player_state_changed", (state) => {
        if (cancelled) return;
        updatePlaybackState(state);
        // If this event is from a listen-along sync, don't re-fetch (avoids echo)
        if (isSyncingRef.current) return;
        // Debounce: SDK can fire multiple times in quick succession.
        // Wait 400ms then fetch /me/player to confirm active device + full state.
        clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = setTimeout(
          () => fetchPlaybackStateRef.current(),
          400,
        );
      });
      player.addListener("initialization_error", (e) =>
        console.error("[Spotify] init error:", e.message),
      );
      player.addListener("authentication_error", (e) =>
        console.error("[Spotify] auth error:", e.message),
      );
      player.addListener("account_error", (e) =>
        console.error("[Spotify] account error:", e.message),
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
        setHasPlayer(false);
        setStoreHasPlayer(false);
      }
    };
  }, [
    isConnected,
    isPremium,
    getAccessToken,
    setPlayerReady,
    setPlayerNotReady,
    updatePlaybackState,
    setStoreHasPlayer,
  ]);

  // Sync volume to player
  useEffect(() => {
    if (playerRef.current && isReady) {
      playerRef.current.setVolume(volume).catch(() => {});
    }
  }, [volume, isReady]);

  // Helper: find our device ID from API (SDK id may differ)
  const findApiDeviceId = useCallback(
    async (token: string): Promise<string | null> => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await fetch(`${SPOTIFY_API}/me/player/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { devices } = (await res.json()) as {
            devices: Array<{ id: string; name: string }>;
          };
          const ours = devices.find((d) => d.name === PLAYER_NAME);
          if (ours?.id) return ours.id;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      return null;
    },
    [],
  );

  // Helper: fetch current playback state and update store + isActiveDevice
  const fetchPlaybackState = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    // Ensure API device ID is cached
    if (!apiDeviceIdRef.current) {
      const apiId = await findApiDeviceId(token);
      if (apiId) apiDeviceIdRef.current = apiId;
    }

    const res = await fetch(`${SPOTIFY_API}/me/player`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 200) {
      const data = await res.json();
      setExternalPlaybackState(data);
      const activeDeviceId = (data.device as { id?: string } | null)?.id;
      setIsActiveDevice(
        !!(apiDeviceIdRef.current && activeDeviceId === apiDeviceIdRef.current),
      );
    } else if (res.status === 204) {
      setIsActiveDevice(false);
    }
  }, [
    getAccessToken,
    findApiDeviceId,
    setExternalPlaybackState,
    setIsActiveDevice,
  ]);

  // Keep fetchPlaybackStateRef pointing at the latest fetchPlaybackState
  useEffect(() => {
    fetchPlaybackStateRef.current = fetchPlaybackState;
  });

  // Remove dealer (subscription endpoint is 410 Gone).
  // Primary real-time mechanism: SDK player_state_changed + not_ready (above) →
  // debounced fetchPlaybackState. Fallback: poll every 10s + visibilitychange.

  // Initial fetch when player becomes ready
  useEffect(() => {
    if (hasPlayer) fetchPlaybackState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPlayer]);

  // Re-fetch when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && hasPlayer)
        fetchPlaybackState();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [hasPlayer, fetchPlaybackState]);

  // Fallback poll every 10s to catch any missed events
  useEffect(() => {
    if (!hasPlayer) return;
    const id = setInterval(fetchPlaybackState, 10_000);
    return () => clearInterval(id);
  }, [hasPlayer, fetchPlaybackState]);

  const play = useCallback(
    async (uriOrContext?: string) => {
      if (!playerRef.current) return;

      // activateElement must come first (synchronous in gesture)
      const activatePromise = playerRef.current.activateElement();
      const token = await getAccessToken();
      await activatePromise;
      if (!token) return;

      // Ensure we have correct API device id
      let targetDevice = deviceId;
      const apiId = await findApiDeviceId(token);
      if (apiId) targetDevice = apiId;
      if (!targetDevice) return;

      const body: Record<string, unknown> = {};
      if (uriOrContext) {
        if (
          uriOrContext.includes("playlist") ||
          uriOrContext.includes("album") ||
          uriOrContext.includes("artist")
        ) {
          body.context_uri = uriOrContext;
        } else {
          body.uris = [uriOrContext];
        }
      }

      await fetch(
        `${SPOTIFY_API}/me/player/play?device_id=${encodeURIComponent(targetDevice)}`,
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
    [getAccessToken, deviceId, findApiDeviceId],
  );

  // Transfer playback to this web player and start playing
  const transferAndPlay = useCallback(async () => {
    if (!playerRef.current) return;
    const activatePromise = playerRef.current.activateElement();
    const token = await getAccessToken();
    await activatePromise;
    if (!token) return;

    let apiDeviceId = apiDeviceIdRef.current;
    if (!apiDeviceId) {
      apiDeviceId = await findApiDeviceId(token);
      if (apiDeviceId) apiDeviceIdRef.current = apiDeviceId;
    }
    if (!apiDeviceId) return;

    const res = await fetch(`${SPOTIFY_API}/me/player`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids: [apiDeviceId], play: true }),
    });
    if (res.status === 204) {
      setIsActiveDevice(true);
      // Fetch fresh state after a short delay so SDK can initialize
      setTimeout(fetchPlaybackState, 1000);
    }
  }, [getAccessToken, findApiDeviceId, setIsActiveDevice, fetchPlaybackState]);

  // Use Web API for all transport controls — works regardless of which device is active
  const togglePlay = useCallback(async () => {
    if (!playerRef.current) return;
    // activateElement must be called synchronously first (browser autoplay policy)
    const activatePromise = playerRef.current.activateElement();
    const token = await getAccessToken();
    await activatePromise;
    if (!token) return;
    if (useSpotifyStore.getState().isPlaying) {
      await fetch(`${SPOTIFY_API}/me/player/pause`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await fetch(`${SPOTIFY_API}/me/player/play`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setTimeout(() => fetchPlaybackStateRef.current(), 600);
  }, [getAccessToken]);

  const next = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    await fetch(`${SPOTIFY_API}/me/player/next`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setTimeout(() => fetchPlaybackStateRef.current(), 600);
  }, [getAccessToken]);

  const previous = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    await fetch(`${SPOTIFY_API}/me/player/previous`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setTimeout(() => fetchPlaybackStateRef.current(), 600);
  }, [getAccessToken]);

  const seek = useCallback(
    async (positionMs: number) => {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(
        `${SPOTIFY_API}/me/player/seek?position_ms=${Math.round(positionMs)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    },
    [getAccessToken],
  );

  const changeVolume = useCallback(
    (v: number) => setStoreVolume(v),
    [setStoreVolume],
  );

  // Shuffle toggle via Web API
  const toggleShuffle = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const newState = !shuffle;
    const res = await fetch(
      `${SPOTIFY_API}/me/player/shuffle?state=${newState}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 204) setStoreShuffle(newState);
  }, [getAccessToken, shuffle, setStoreShuffle]);

  // Repeat cycle: off → context → track → off
  const cycleRepeat = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const cycle = ["off", "context", "track"] as const;
    const idx = cycle.indexOf(repeatMode);
    const nextMode = cycle[(idx + 1) % cycle.length]!;
    const res = await fetch(
      `${SPOTIFY_API}/me/player/repeat?state=${nextMode}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 204) setStoreRepeat(nextMode);
  }, [getAccessToken, repeatMode, setStoreRepeat]);

  // Add to queue
  const addToQueue = useCallback(
    async (uri: string) => {
      const token = await getAccessToken();
      if (!token) return;
      await fetch(
        `${SPOTIFY_API}/me/player/queue?uri=${encodeURIComponent(uri)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    },
    [getAccessToken],
  );

  // ── Listen-along sync: threshold-based "Desync Tolerance" ──────────────
  //
  // Rules:
  //  1. Track change  → play() only if DJ trackUri !== local trackUri
  //  2. Play/Pause    → toggle only when DJ state actually differs from local
  //  3. Position drift → seek() only when |expected − local| > DESYNC_TOLERANCE_MS
  //
  // Everything below is intentionally conservative to avoid Spotify SDK
  // rebuffering. We never fire play()/seek()/togglePlay() unless strictly
  // required.

  const DESYNC_TOLERANCE_MS = 5000;

  const syncTrackRef = useRef<string | null>(null);
  const syncPlayingRef = useRef<boolean | null>(null);
  const prevDjStateRef =
    useRef<ReturnType<typeof useSpotifyStore.getState>["djState"]>(null);
  const prevIsListeningRef = useRef(false);

  useEffect(() => {
    const unsub = useSpotifyStore.subscribe((state) => {
      const justStartedListening =
        state.isListening && !prevIsListeningRef.current;
      prevIsListeningRef.current = state.isListening;

      // Skip if neither djState nor isListening changed
      if (state.djState === prevDjStateRef.current && !justStartedListening)
        return;
      prevDjStateRef.current = state.djState;

      const { isListening, isDJ, isReady, djState } = state;
      if (!isListening || isDJ || !djState || !isReady) return;

      // ── 1. Track change ──
      if (djState.trackUri !== syncTrackRef.current) {
        syncTrackRef.current = djState.trackUri;
        syncPlayingRef.current = djState.isPlaying;
        isSyncingRef.current = true;

        const elapsed = Date.now() - djState.updatedAt;
        const startPos = djState.positionMs + (djState.isPlaying ? elapsed : 0);

        spotifyActions.play(djState.trackUri).then(() => {
          // Small delay for SDK to start the new track before seeking
          setTimeout(async () => {
            await spotifyActions.seek(startPos);
            setTimeout(() => {
              isSyncingRef.current = false;
            }, 2000);
          }, 600);
        });
        return; // track change handled — skip drift & play/pause checks
      }

      // ── 2. Play / Pause toggle ──
      if (djState.isPlaying !== syncPlayingRef.current) {
        syncPlayingRef.current = djState.isPlaying;
        // Only send command if local state actually disagrees
        if (djState.isPlaying !== state.isPlaying) {
          isSyncingRef.current = true;
          spotifyActions.togglePlay().then(() => {
            setTimeout(() => {
              isSyncingRef.current = false;
            }, 1500);
          });
        }
        // When DJ pauses, no drift correction needed
        if (!djState.isPlaying) return;
      }

      // ── 3. Position drift (only while both are playing) ──
      if (djState.isPlaying && state.isPlaying) {
        const elapsed = Date.now() - djState.updatedAt;
        const expectedPosition = djState.positionMs + elapsed;
        const drift = Math.abs(state.position - expectedPosition);

        if (drift > DESYNC_TOLERANCE_MS) {
          isSyncingRef.current = true;
          spotifyActions.seek(expectedPosition).then(() => {
            setTimeout(() => {
              isSyncingRef.current = false;
            }, 1500);
          });
        }
        // drift ≤ 3s → do nothing, let SDK play smoothly
      }
    });
    return unsub;
  }, []);

  // When listener stops listening, reset sync state
  useEffect(() => {
    const unsub = useSpotifyStore.subscribe((state) => {
      if (!state.isListening && syncTrackRef.current) {
        syncTrackRef.current = null;
        syncPlayingRef.current = null;
        isSyncingRef.current = false;
        // Don't reset prevIsListeningRef here — it's updated in the main subscriber
      }
    });
    return unsub;
  }, []);

  // ── Sync control functions to module-level ref for global access ──
  useEffect(() => {
    spotifyActions.togglePlay = togglePlay;
    spotifyActions.next = next;
    spotifyActions.previous = previous;
    spotifyActions.seek = seek;
    spotifyActions.play = play;
    spotifyActions.transferAndPlay = transferAndPlay;
    spotifyActions.toggleShuffle = toggleShuffle;
    spotifyActions.cycleRepeat = cycleRepeat;
    spotifyActions.addToQueue = addToQueue;
    spotifyActions.changeVolume = changeVolume;
  });

  return {
    isReady,
    hasPlayer,
    isPlaying,
    isActiveDevice,
    currentTrack,
    position,
    duration,
    volume,
    deviceId,
    shuffle,
    repeatMode,
    play,
    togglePlay,
    transferAndPlay,
    next,
    previous,
    seek,
    changeVolume,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
  };
}
