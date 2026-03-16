import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  useSpotifyStore,
  type SpotifyHostState,
} from "@/stores/useSpotifyStore";
import { focusWorldSocket } from "@/lib/focusWorldSocket";
import { useFocusWorldStore } from "@/stores/useFocusWorldStore";

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
  timeLeft?: number; // Current remaining time in seconds
  focusStatus?: string; // 'focusing' | 'paused' | etc. - auto emits pause_focus
  enabled?: boolean;
}

export function useFocusWorld({
  userId,
  sessionId,
  taskId,
  timeLeft,
  focusStatus,
  enabled = true,
}: UseFocusWorldOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [focusUsers, setFocusUsers] = useState<FocusUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const timeLeftRef = useRef<number | undefined>(timeLeft);

  // Update ref when timeLeft changes, but don't trigger reconnect
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (userId) {
        socketRef.current.emit("leave_floor", { userId });
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      focusWorldSocket.set(null);
      setIsConnected(false);
      setFocusUsers([]);
      useFocusWorldStore.getState().setFocusUsers([]);
    }
  }, [userId]);

  const connect = useCallback(() => {
    if (!enabled || !userId || !sessionId) {
      console.log("Focus World: Cannot connect", {
        enabled,
        userId: !!userId,
        sessionId: !!sessionId,
      });
      return;
    }

    // Don't reconnect if already connected
    if (socketRef.current?.connected) {
      console.log("Focus World: Already connected");
      return;
    }

    // Disconnect existing socket if any
    if (socketRef.current) {
      disconnect();
    }

    console.log("Focus World: Connecting...", { userId, sessionId });

    const apiUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3001";
    const socket = io(`${apiUrl}/focus-world`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;
    focusWorldSocket.set(socket);

    socket.on("connect", () => {
      console.log("Focus World: Connected to server");
      setIsConnected(true);

      // Join the floor
      console.log("Focus World: Sending join_floor", {
        userId,
        sessionId,
        taskId,
        timeLeft: timeLeftRef.current,
      });
      socket.emit("join_floor", {
        userId,
        sessionId,
        taskId,
        timeLeft: timeLeftRef.current, // Use ref to get latest value
      });
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Focus World");
      setIsConnected(false);
      setFocusUsers([]);
    });

    socket.on("world_state", (users: FocusUser[]) => {
      console.log("Received world state:", users);
      setFocusUsers(users);
      useFocusWorldStore.getState().setFocusUsers(users);
    });

    socket.on("user_joined", (user: FocusUser) => {
      console.log("User joined:", user);
      setFocusUsers((prev) => {
        // Check if user already exists
        const existingIndex = prev.findIndex((u) => u.userId === user.userId);
        if (existingIndex !== -1) {
          console.log("User already exists, updating:", user.userId);
          // Update existing user (handles reconnection with new timeLeft)
          const updated = [...prev];
          updated[existingIndex] = user;
          useFocusWorldStore.getState().setFocusUsers(updated);
          return updated;
        }
        const next = [...prev, user];
        useFocusWorldStore.getState().setFocusUsers(next);
        return next;
      });
    });

    socket.on("user_left", ({ userId }: { userId: string }) => {
      console.log("User left:", userId);
      setFocusUsers((prev) => {
        const next = prev.filter((u) => u.userId !== userId);
        useFocusWorldStore.getState().setFocusUsers(next);
        return next;
      });
    });

    socket.on(
      "user_paused",
      ({ userId, isPaused }: { userId: string; isPaused: boolean }) => {
        console.log("User paused:", userId, isPaused);
        setFocusUsers((prev) => {
          const next = prev.map((u) =>
            u.userId === userId ? { ...u, isPaused } : u,
          );
          useFocusWorldStore.getState().setFocusUsers(next);
          return next;
        });
      },
    );

    socket.on(
      "spotify:listening_changed",
      ({ userId, isListening }: { userId: string; isListening: boolean }) => {
        setFocusUsers((prev) => {
          const next = prev.map((u) =>
            u.userId === userId ? { ...u, isListeningToDj: isListening } : u,
          );
          useFocusWorldStore.getState().setFocusUsers(next);
          return next;
        });
      },
    );

    socket.on("spotify:listeners_reset", () => {
      setFocusUsers((prev) => {
        const next = prev.map((u) => ({ ...u, isListeningToDj: false }));
        useFocusWorldStore.getState().setFocusUsers(next);
        return next;
      });
    });

    socket.on(
      "user_progress_updated",
      ({ userId, progress }: { userId: string; progress: number }) => {
        console.log("User progress updated:", userId, progress);
        // Could update progress in the UI if needed
      },
    );

    socket.on("error", (error: { message: string }) => {
      console.error("Focus World error:", error.message);
    });

    // ── Spotify DJ co-listening events ──
    socket.on("spotify:dj_changed", (state: SpotifyHostState | null) => {
      const store = useSpotifyStore.getState();
      store.setDjState(state);
      // If I was the DJ but someone else claimed → auto-release
      if (store.isDJ && state && state.hostUserId !== userId) {
        store.setDJ(false);
      }
      // If DJ was released (null) and I was the DJ → release
      if (!state && store.isDJ) {
        store.setDJ(false);
      }
    });

    socket.on("spotify:dj_update", (state: SpotifyHostState) => {
      useSpotifyStore.getState().setDjState(state);
    });

    socket.on("spotify:sync_response", (state: SpotifyHostState | null) => {
      useSpotifyStore.getState().setDjState(state);
    });

    return socket;
  }, [enabled, userId, sessionId, taskId, disconnect]);

  const updateProgress = useCallback(
    (progress: number) => {
      if (socketRef.current && sessionId) {
        socketRef.current.emit("update_progress", {
          sessionId,
          progress,
        });
      }
    },
    [sessionId],
  );

  const emitPause = useCallback(
    (isPaused: boolean) => {
      if (socketRef.current && userId) {
        socketRef.current.emit("pause_focus", {
          userId,
          isPaused,
        });
      }
    },
    [userId],
  );

  // Auto-emit pause_focus when focusStatus changes
  const prevStatusRef = useRef<string | undefined>(focusStatus);
  useEffect(() => {
    if (!socketRef.current?.connected || !userId) return;
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
    console.log("Focus World: useEffect triggered", {
      enabled,
      hasUserId: !!userId,
      hasSessionId: !!sessionId,
      isConnected: !!socketRef.current,
    });

    // Only connect if enabled and not already connected
    if (enabled && userId && sessionId && !socketRef.current) {
      console.log("Focus World: Calling connect()");
      connect();
    }

    // Disconnect when no longer enabled
    if (!enabled && socketRef.current) {
      console.log("Focus World: Disabled, disconnecting");
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log("Focus World: Cleanup on unmount");
        disconnect();
      }
    };
  }, [enabled, userId, sessionId, connect, disconnect]);

  // ── Spotify co-listening emitters ──
  const startBroadcasting = useCallback(
    (data: {
      trackUri: string;
      trackName: string;
      artistName: string;
      albumArt?: string;
      positionMs: number;
      isPlaying: boolean;
    }) => {
      if (socketRef.current) {
        socketRef.current.emit("spotify:dj_claim", data);
        useSpotifyStore.getState().setDJ(true);
      }
    },
    [],
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
      if (socketRef.current) {
        socketRef.current.emit("spotify:dj_update", data);
      }
    },
    [],
  );

  const stopBroadcasting = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit("spotify:dj_release", {});
      useSpotifyStore.getState().setDJ(false);
    }
  }, []);

  const requestSync = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit("spotify:sync_request", {});
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
