/**
 * Module-level singleton ref for the Focus World Supabase Realtime channel.
 * Set by useFocusWorld hook; read by SpotifyWidget for co-listening emits.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

let channel: RealtimeChannel | null = null;

export const focusWorldSocket = {
  set: (ch: RealtimeChannel | null) => {
    channel = ch;
  },
  get: () => channel,
};
