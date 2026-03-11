export {};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: typeof Spotify;
  }

  namespace Spotify {
    class Player {
      constructor(options: PlayerOptions);
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(event: "ready", callback: (data: { device_id: string }) => void): void;
      addListener(event: "not_ready", callback: (data: { device_id: string }) => void): void;
      addListener(event: "player_state_changed", callback: (state: PlaybackState | null) => void): void;
      addListener(event: "initialization_error" | "authentication_error" | "account_error" | "playback_error", callback: (error: WebPlaybackError) => void): void;
      removeListener(event: string, callback?: (...args: unknown[]) => void): void;
      getCurrentState(): Promise<PlaybackState | null>;
      getVolume(): Promise<number>;
      setVolume(volume: number): Promise<void>;
      pause(): Promise<void>;
      resume(): Promise<void>;
      togglePlay(): Promise<void>;
      seek(positionMs: number): Promise<void>;
      previousTrack(): Promise<void>;
      nextTrack(): Promise<void>;
      activateElement(): Promise<void>;
    }

    interface PlayerOptions {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume?: number;
    }

    interface PlaybackState {
      context: { uri: string; metadata: Record<string, unknown> };
      disallows: Record<string, boolean>;
      paused: boolean;
      position: number;
      repeat_mode: number;
      shuffle: boolean;
      track_window: {
        current_track: Track;
        previous_tracks: Track[];
        next_tracks: Track[];
      };
    }

    interface Track {
      uri: string;
      id: string;
      type: string;
      media_type: string;
      name: string;
      is_playable: boolean;
      album: {
        uri: string;
        name: string;
        images: { url: string; height: number; width: number }[];
      };
      artists: { uri: string; name: string }[];
      duration_ms: number;
    }

    interface WebPlaybackError {
      message: string;
    }
  }
}
