"use client";

/**
 * useSessionLifecycle
 *
 * Ensures the active focus session is set to PAUSED when the user:
 *   1. Closes / refreshes the tab   (beforeunload → fetch keepalive)
 *   2. Loses network connectivity   (offline  → local store pause)
 *
 * Mount this hook inside a component that lives for the entire duration of
 * a focus session (e.g. FocusTimer.tsx).
 */

import { useEffect, useRef } from "react";
import { useFocusStore, FOCUS_DURATIONS } from "@/stores/useFocusStore";
import { getCachedToken } from "@/lib/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function useSessionLifecycle() {
  const sessionId = useFocusStore((s) => s.sessionId);
  const status = useFocusStore((s) => s.status);
  const mode = useFocusStore((s) => s.mode);
  const timeLeft = useFocusStore((s) => s.timeLeft);
  const pauseFocus = useFocusStore((s) => s.pauseFocus);

  const stateRef = useRef({ sessionId, status, mode, timeLeft });
  useEffect(() => {
    stateRef.current = { sessionId, status, mode, timeLeft };
  });

  useEffect(() => {
    const handleBeforeUnload = () => {
      const { sessionId, status, mode, timeLeft } = stateRef.current;
      const token = getCachedToken();

      if (!sessionId || !token || status !== "focusing" || mode !== "WORK") {
        return;
      }

      const elapsedTime = FOCUS_DURATIONS.WORK - timeLeft;
      void fetch(`${API_BASE_URL}/focus-sessions/${sessionId}/pause`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ elapsedTime }),
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // mount once — stateRef always has latest values

  // ─── 2. Network goes offline ─────────────────────────────────────────────
  useEffect(() => {
    const handleOffline = () => {
      const { status } = stateRef.current;
      // Stop the local timer immediately so the display freezes.
      // The API call inside pauseFocus will fail silently (we're offline),
      // but local state is updated synchronously.
      // If the user was in Co-Focus World the socket disconnect will set
      // the DB record to PAUSED server-side.
      if (status === "focusing" || status === "break") {
        pauseFocus();
      }
    };

    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, [pauseFocus]);
}
