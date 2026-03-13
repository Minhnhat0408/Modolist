"use client";

/**
 * Spotify button for the dashboard header — Spotify-themed.
 * Click → opens the SpotifyModal.
 */

import { useSpotifyStore } from "@/stores/useSpotifyStore";
import { Music } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpotifyHeaderButton() {
  const { isPlaying, openWidget } = useSpotifyStore();

  return (
    <Button
      variant="ghost"
      onClick={openWidget}
      className="relative h-10 gap-2 rounded-full bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] px-4"
      title="Mở Spotify"
    >
      <Music className="h-4 w-4" />
      <span className="text-sm font-medium hidden sm:inline">Spotify</span>
      {isPlaying && (
        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1DB954]" />
        </span>
      )}
    </Button>
  );
}
