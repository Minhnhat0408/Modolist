"use client";

/**
 * Spotify Dealer WebSocket
 *
 * This is the same real-time channel that open.spotify.com uses internally.
 * It pushes events whenever playback state changes on ANY device — track change,
 * play/pause, device switch, volume change, etc.
 *
 * Protocol (reverse-engineered from the official web player):
 * 1. Open WS: wss://dealer.spotify.com/?access_token=<token>
 * 2. Server → first message contains headers["Spotify-Connection-Id"]
 * 3. Client → PUT /me/notifications/user?connection_id=<id>  (HTTP, not WS)
 *    This registers the connection to receive Connect-state events.
 * 4. Server → sends {"type":"ping"} every ~30 s; client must reply {"type":"pong"}
 * 5. State-change events arrive as {"type":"message","uri":"hm://connect-state/...",...}
 *    The payload can be inspected, but it's easiest to just re-fetch /me/player on any event.
 *
 * On token expiry or WS close the hook reconnects automatically with a fresh token.
 */

import { useEffect, useRef, useCallback } from "react";
import { useSpotifyStore } from "@/stores/useSpotifyStore";

const DEALER_URL = "wss://dealer.spotify.com/";
const SPOTIFY_API = "https://api.spotify.com/v1";

// URIs that indicate actual playback state changes — filter out noisy ones
const STATE_CHANGE_URIS = [
  "hm://connect-state/v1/",
  "hm://pusher/v1/connections/",
  "hm://remote/3/",
];

interface DealerMessage {
  type: "message" | "ping" | "pong" | "request";
  uri?: string;
  headers?: Record<string, string>;
  payloads?: unknown[];
}

interface UseSpotifyDealerOptions {
  enabled: boolean;
  onStateChange: () => void; // called whenever a meaningful event arrives
}

export function useSpotifyDealer({
  enabled,
  onStateChange,
}: UseSpotifyDealerOptions) {
  const getAccessToken = useSpotifyStore((s) => s.getAccessToken);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const reconnectDelayRef = useRef(1000); // exponential back-off starting at 1s

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect loop on manual close
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;
    cleanup();

    const token = await getAccessToken();
    if (!token || !isMountedRef.current) return;

    const ws = new WebSocket(`${DEALER_URL}?access_token=${token}`);
    wsRef.current = ws;
    let connectionId: string | null = null;

    ws.onopen = () => {
      reconnectDelayRef.current = 1000; // reset back-off on successful connect

      // Start client-side ping every 25s as a keep-alive (server pings every ~30s)
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);
    };

    ws.onmessage = async (event: MessageEvent) => {
      let msg: DealerMessage;
      try {
        msg = JSON.parse(event.data as string) as DealerMessage;
      } catch {
        return;
      }

      // Server ping → reply pong
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // First real message contains the connection ID in headers
      if (!connectionId && msg.headers?.["Spotify-Connection-Id"]) {
        connectionId = msg.headers["Spotify-Connection-Id"];

        // Register this connection to receive playback/connect-state events
        const freshToken = await getAccessToken();
        if (freshToken && isMountedRef.current) {
          await fetch(
            `${SPOTIFY_API}/me/notifications/user?connection_id=${encodeURIComponent(connectionId)}`,
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${freshToken}` },
            },
          );
        }
        return;
      }

      // Playback/connect-state change event — fire callback
      if (
        msg.type === "message" &&
        msg.uri &&
        STATE_CHANGE_URIS.some((prefix) => msg.uri!.startsWith(prefix))
      ) {
        onStateChange();
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — handle reconnect there
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (!isMountedRef.current) return;

      // Exponential back-off reconnect (cap at 30s)
      const delay = Math.min(reconnectDelayRef.current, 30_000);
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [getAccessToken, cleanup, onStateChange]);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) connect();

    return () => {
      isMountedRef.current = false;
      cleanup();
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
    };
  }, [enabled, connect, cleanup]);
}
