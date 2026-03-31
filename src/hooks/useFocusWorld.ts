import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  useSpotifyStore,
  type SpotifyHostState,
} from "@/stores/useSpotifyStore";
import { focusWorldSocket } from "@/lib/focusWorldSocket";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";
import { playSfx } from "@/hooks/useSoundEffects";

export interface FocusUser {
  userId: string;
  name: string | null;
  image: string | null;
  currentTask: string;
  isPaused: boolean;
  isListeningToDj: boolean;
  focusProps: {
    startTime: string;
    duration: number;
  };
}

interface UseFocusWorldOptions {
  userId: string | null;
  sessionId: string | null;
  taskId?: string | null;
  timeLeft?: number;
  focusStatus?: string;
  enabled?: boolean;
  userName?: string | null;
  userImage?: string | null;
}

const CHANNEL_NAME = "focus-world";

export function useFocusWorld({
  userId,
  sessionId,
  taskId,
  timeLeft,
  focusStatus,
  enabled = true,
  userName,
  userImage,
}: UseFocusWorldOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [focusUsers, setFocusUsers] = useState<FocusUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeLeftRef = useRef<number | undefined>(timeLeft);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      focusWorldSocket.set(null);
      setIsConnected(false);
      setFocusUsers([]);
      useFocusWorldStore.getState().setFocusUsers([]);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !userId || !sessionId) return;
    if (channelRef.current) return;

    const supabase = createClient();
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;
    focusWorldSocket.set(channel);

    // Presence: track user join/leave
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{
        userId: string;
        name: string | null;
        image: string | null;
        currentTask: string;
        isPaused: boolean;
        isListeningToDj: boolean;
        focusProps: { startTime: string; duration: number };
      }>();

      const users: FocusUser[] = Object.values(state).flatMap((presences) =>
        presences.map((p) => ({
          userId: p.userId,
          name: p.name,
          image: p.image,
          currentTask: p.currentTask,
          isPaused: p.isPaused,
          isListeningToDj: p.isListeningToDj,
          focusProps: p.focusProps,
        })),
      );

      setFocusUsers(users);
      useFocusWorldStore.getState().setFocusUsers(users);
    });

    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      const joinedUser = newPresences[0];
      if (joinedUser && joinedUser.userId !== userId) {
        playSfx("focus-world-update");
      }
    });

    channel.on("presence", { event: "leave" }, () => {
      playSfx("focus-world-update");
    });

    // Broadcast: Spotify DJ events
    channel.on("broadcast", { event: "spotify:dj_changed" }, ({ payload }) => {
      playSfx("listen-along-update");
      const store = useSpotifyStore.getState();
      store.setDjState(payload as SpotifyHostState | null);
      if (store.isDJ && payload && (payload as SpotifyHostState).hostUserId !== userId) {
        store.setDJ(false);
      }
      if (!payload && store.isDJ) {
        store.setDJ(false);
      }
    });

    channel.on("broadcast", { event: "spotify:dj_update" }, ({ payload }) => {
      useSpotifyStore.getState().setDjState(payload as SpotifyHostState);
    });

    channel.on("broadcast", { event: "spotify:sync_response" }, ({ payload }) => {
      useSpotifyStore.getState().setDjState(payload as SpotifyHostState | null);
    });

    channel.on("broadcast", { event: "spotify:listening_changed" }, ({ payload }) => {
      const { userId: changedUserId, isListening } = payload as {
        userId: string;
        isListening: boolean;
      };
      playSfx("listen-along-update");
      setFocusUsers((prev) => {
        const next = prev.map((u) =>
          u.userId === changedUserId ? { ...u, isListeningToDj: isListening } : u,
        );
        useFocusWorldStore.getState().setFocusUsers(next);
        return next;
      });
    });

    channel.on("broadcast", { event: "spotify:listeners_reset" }, () => {
      playSfx("listen-along-update");
      setFocusUsers((prev) => {
        const next = prev.map((u) => ({ ...u, isListeningToDj: false }));
        useFocusWorldStore.getState().setFocusUsers(next);
        return next;
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true);

        // Track presence with real user profile data
        await channel.track({
          userId,
          sessionId,
          taskId: taskId ?? null,
          name: userName ?? null,
          image: userImage ?? null,
          currentTask: "",
          isPaused: false,
          isListeningToDj: false,
          focusProps: {
            startTime: new Date().toISOString(),
            duration: timeLeftRef.current ?? 1500,
          },
        });
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setIsConnected(false);
      }
    });
  }, [enabled, userId, sessionId, taskId, userName, userImage]);

  const updateProgress = useCallback(
    (progress: number) => {
      if (channelRef.current && sessionId) {
        channelRef.current.send({
          type: "broadcast",
          event: "user_progress_updated",
          payload: { userId, sessionId, progress },
        });
      }
    },
    [userId, sessionId],
  );

  const emitPause = useCallback(
    (isPaused: boolean) => {
      if (channelRef.current && userId) {
        // Update presence state with new pause status
        channelRef.current.track({
          userId,
          isPaused,
        });
      }
    },
    [userId],
  );

  // Auto-emit pause when focusStatus changes
  const prevStatusRef = useRef<string | undefined>(focusStatus);
  useEffect(() => {
    if (!channelRef.current || !userId) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = focusStatus;

    if (prev !== focusStatus) {
      if (focusStatus === "paused" && prev !== "paused") {
        emitPause(true);
      } else if (focusStatus !== "paused" && prev === "paused") {
        emitPause(false);
      }
    }
  }, [focusStatus, userId, emitPause]);

  useEffect(() => {
    if (enabled && userId && sessionId && !channelRef.current) {
      connect();
    }
    if (!enabled && channelRef.current) {
      disconnect();
    }
    return () => {
      if (channelRef.current) {
        disconnect();
      }
    };
  }, [enabled, userId, sessionId, connect, disconnect]);

  // Spotify co-listening emitters
  const startBroadcasting = useCallback(
    (data: {
      trackUri: string;
      trackName: string;
      artistName: string;
      albumArt?: string;
      positionMs: number;
      isPlaying: boolean;
    }) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "spotify:dj_changed",
          payload: { ...data, hostUserId: userId, hostName: null },
        });
        useSpotifyStore.getState().setDJ(true);
      }
    },
    [userId],
  );

  const updateBroadcast = useCallback(
    (data: {
      trackUri?: string;
      trackName?: string;
      artistName?: string;
      albumArt?: string;
      positionMs?: number;
      isPlaying?: boolean;
    }) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "spotify:dj_update",
          payload: data,
        });
      }
    },
    [],
  );

  const stopBroadcasting = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "spotify:dj_changed",
        payload: null,
      });
      useSpotifyStore.getState().setDJ(false);
    }
  }, []);

  const requestSync = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "spotify:sync_request",
        payload: {},
      });
    }
  }, []);

  return {
    isConnected,
    focusUsers,
    disconnect,
    updateProgress,
    emitPause,
    startBroadcasting,
    updateBroadcast,
    stopBroadcasting,
    requestSync,
  };
}
