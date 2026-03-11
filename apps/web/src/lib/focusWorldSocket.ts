/**
 * Module-level singleton ref for the Focus World socket.
 * Set by useFocusWorld hook; read by SpotifyWidget for co-listening emits.
 */
import type { Socket } from "socket.io-client";

let socket: Socket | null = null;

export const focusWorldSocket = {
  set: (s: Socket | null) => {
    socket = s;
  },
  get: () => socket,
};
