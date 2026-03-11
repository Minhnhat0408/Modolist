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
  isPlaying: boolean;
  currentTrack: SpotifyTrack | null;
  position: number;
  duration: number;
  volume: number;
  deviceId: string | null;

  // Co-listening
  isHosting: boolean;
  hostPlayback: SpotifyHostState | null;

  // Actions
  checkConnection: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  setPlayerReady: (deviceId: string) => void;
  setPlayerNotReady: () => void;
  updatePlaybackState: (state: Spotify.PlaybackState | null) => void;
  setVolume: (volume: number) => void;
  disconnect: () => Promise<void>;
  reset: () => void;

  // Co-listening actions
  setHosting: (hosting: boolean) => void;
  setHostPlayback: (state: SpotifyHostState | null) => void;
}

const initialState = {
  isConnected: false,
  isPremium: null,
  isLoading: false,
  accessToken: null,
  tokenExpiresAt: null,
  isReady: false,
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  volume: 0.5,
  deviceId: null,
  isHosting: false,
  hostPlayback: null,
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

        // Check premium status via Spotify API
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

  updatePlaybackState: (state: Spotify.PlaybackState | null) => {
    if (!state) {
      set({ isPlaying: false, currentTrack: null, position: 0, duration: 0 });
      return;
    }

    const track = state.track_window.current_track;
    set({
      isPlaying: !state.paused,
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

  setHosting: (hosting: boolean) => {
    set({ isHosting: hosting });
  },

  setHostPlayback: (state: SpotifyHostState | null) => {
    set({ hostPlayback: state });
  },
}));
