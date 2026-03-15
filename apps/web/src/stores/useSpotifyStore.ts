"use client";

import { create } from "zustand";

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  albumName: string;
  albumArt: string;
  durationMs: number;
}

export interface SpotifyHostState {
  hostUserId: string;
  hostName: string | null;
  trackUri: string;
  trackName: string;
  artistName: string;
  albumArt?: string;
  positionMs: number;
  isPlaying: boolean;
  updatedAt: number;
}

interface SpotifyStore {
  // Connection
  isConnected: boolean;
  isPremium: boolean | null;
  isLoading: boolean;

  // Token
  accessToken: string | null;
  tokenExpiresAt: number | null;

  // Player
  isReady: boolean;
  hasPlayer: boolean;
  isPlaying: boolean;
  currentTrack: SpotifyTrack | null;
  position: number;
  duration: number;
  volume: number;
  deviceId: string | null;
  shuffle: boolean;
  repeatMode: "off" | "context" | "track";
  isActiveDevice: boolean;

  // DJ / Co-listening
  isDJ: boolean;
  djState: SpotifyHostState | null;
  isListening: boolean;

  // Widget (modal/floating) state
  isWidgetOpen: boolean;
  isWidgetMinimized: boolean;
  showSearch: boolean;

  // Actions
  checkConnection: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  setPlayerReady: (deviceId: string) => void;
  setPlayerNotReady: () => void;
  updatePlaybackState: (state: Spotify.PlaybackState | null) => void;
  setExternalPlaybackState: (data: Record<string, unknown>) => void;
  setVolume: (volume: number) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeatMode: (mode: "off" | "context" | "track") => void;
  setIsActiveDevice: (v: boolean) => void;
  setHasPlayer: (v: boolean) => void;
  disconnect: () => Promise<void>;
  reset: () => void;

  // DJ / Co-listening actions
  setDJ: (v: boolean) => void;
  setDjState: (state: SpotifyHostState | null) => void;
  setListening: (v: boolean) => void;

  // Widget actions
  openWidget: () => void;
  closeWidget: () => void;
  minimizeWidget: () => void;
  openWidgetWithSearch: () => void;
  setShowSearch: (v: boolean) => void;
}

const initialState = {
  isConnected: false,
  isPremium: null,
  isLoading: false,
  accessToken: null,
  tokenExpiresAt: null,
  isReady: false,
  hasPlayer: false,
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  volume: 0.5,
  deviceId: null,
  shuffle: false,
  repeatMode: "off" as const,
  isActiveDevice: false,
  isDJ: false,
  djState: null,
  isListening: false,
  isWidgetOpen: false,
  isWidgetMinimized: false,
  showSearch: false,
};

export const useSpotifyStore = create<SpotifyStore>((set, get) => ({
  ...initialState,

  checkConnection: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/spotify/token");
      const data = await res.json();

      if (data.connected && data.accessToken) {
        set({
          isConnected: true,
          accessToken: data.accessToken,
          tokenExpiresAt: data.expiresAt,
        });

        const profileRes = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          set({ isPremium: profile.product === "premium" });
        }
      } else {
        set({ isConnected: false, isPremium: null });
      }
    } catch {
      set({ isConnected: false });
    } finally {
      set({ isLoading: false });
    }
  },

  getAccessToken: async () => {
    const { accessToken, tokenExpiresAt } = get();
    const now = Math.floor(Date.now() / 1000);

    // Return cached token if still valid (60s buffer)
    if (accessToken && tokenExpiresAt && tokenExpiresAt > now + 60) {
      return accessToken;
    }

    // Refresh
    try {
      const res = await fetch("/api/spotify/token");
      const data = await res.json();
      if (data.connected && data.accessToken) {
        set({
          accessToken: data.accessToken,
          tokenExpiresAt: data.expiresAt,
        });
        return data.accessToken;
      }
    } catch {
      // Token refresh failed
    }

    set({ isConnected: false, accessToken: null });
    return null;
  },

  setPlayerReady: (deviceId: string) => {
    set({ isReady: true, deviceId });
  },

  setPlayerNotReady: () => {
    set({ isReady: false, deviceId: null });
  },

  // Parse playback state from the Web API (/me/player) — used when the SDK
  // player is not the active device yet (i.e. playing on phone/desktop).
  setExternalPlaybackState: (data: Record<string, unknown>) => {
    const item = data.item as Record<string, unknown> | null;
    if (!item) return;
    const artists = (item.artists as Array<{ name: string }>) ?? [];
    const album = item.album as Record<string, unknown>;
    const images = (album?.images as Array<{ url: string }>) ?? [];
    const repeatState = (data.repeat_state as string) ?? "off";
    set({
      isPlaying: data.is_playing as boolean,
      position: data.progress_ms as number,
      duration: item.duration_ms as number,
      shuffle: (data.shuffle_state as boolean) ?? false,
      repeatMode: (repeatState === "track" || repeatState === "context"
        ? repeatState
        : "off") as "off" | "context" | "track",
      currentTrack: {
        id: item.id as string,
        uri: item.uri as string,
        name: item.name as string,
        artists: artists.map((a) => a.name).join(", "),
        albumName: album?.name as string,
        albumArt: images[0]?.url ?? "",
        durationMs: item.duration_ms as number,
      },
    });
  },

  updatePlaybackState: (state: Spotify.PlaybackState | null) => {
    if (!state) {
      // SDK fires null when it has no loaded track (e.g. just connected, idle).
      // Only mark as not playing — preserve currentTrack from external /me/player fetch
      // so the UI keeps showing what was paused on another device.
      set({ isPlaying: false });
      return;
    }

    const track = state.track_window.current_track;
    set({
      isPlaying: !state.paused,
      // NOTE: do NOT set isActiveDevice here. The SDK fires player_state_changed
      // (with paused:true) even when another device takes over — that does NOT mean
      // the browser is the active audio source. isActiveDevice is set by polling only.
      position: state.position,
      duration: track.duration_ms,
      currentTrack: {
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map((a) => a.name).join(", "),
        albumName: track.album.name,
        albumArt: track.album.images[0]?.url ?? "",
        durationMs: track.duration_ms,
      },
    });
  },

  setVolume: (volume: number) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  setShuffle: (shuffle: boolean) => {
    set({ shuffle });
  },

  setRepeatMode: (mode: "off" | "context" | "track") => {
    set({ repeatMode: mode });
  },

  setIsActiveDevice: (v: boolean) => {
    set({ isActiveDevice: v });
  },

  setHasPlayer: (v: boolean) => {
    set({ hasPlayer: v });
  },

  disconnect: async () => {
    try {
      await fetch("/api/spotify/disconnect", { method: "DELETE" });
    } catch {
      // Ignore
    }
    set({ ...initialState });
  },

  reset: () => {
    set({ ...initialState });
  },

  setDJ: (v: boolean) => {
    set({ isDJ: v });
  },

  setDjState: (state: SpotifyHostState | null) => {
    set({ djState: state });
  },

  setListening: (v: boolean) => {
    set({ isListening: v });
  },

  openWidget: () => {
    set({ isWidgetOpen: true, isWidgetMinimized: false });
  },

  closeWidget: () => {
    set({ isWidgetOpen: false, isWidgetMinimized: false, showSearch: false });
  },

  minimizeWidget: () => {
    set({ isWidgetOpen: true, isWidgetMinimized: true, showSearch: false });
  },

  openWidgetWithSearch: () => {
    set({ isWidgetOpen: true, isWidgetMinimized: false, showSearch: true });
  },

  setShowSearch: (v: boolean) => {
    set({ showSearch: v });
  },
}));
