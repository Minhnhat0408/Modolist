"use client";

/**
 * Invisible component that initializes the Spotify Web Playback SDK.
 * Mount once in the dashboard layout so the player stays alive
 * regardless of whether a focus session is active.
 *
 * All control functions are synced to `spotifyActions` (module-level export
 * from useSpotifyPlayer) so other components can call them without
 * re-initializing the SDK.
 */

import { useEffect, useState } from "react";
import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

export function SpotifyPlayerInit() {
  const { checkConnection } = useSpotifyStore();
  const [checked, setChecked] = useState(false);

  // Check Spotify connection on mount
  useEffect(() => {
    if (!checked) {
      checkConnection();
      setChecked(true);
    }
  }, [checked, checkConnection]);

  // Initialize player (no-ops when not connected / not premium)
  useSpotifyPlayer();

  return null;
}
