"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search,
  X,
  Music,
  ListMusic,
  Clock,
  Play,
  Loader2,
  Plus,
} from "lucide-react";
import { useSpotifyStore } from "@/stores/useSpotifyStore";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SearchTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
  duration_ms: number;
}

interface SearchPlaylist {
  id: string;
  uri: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string };
}

interface SearchAlbum {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  images: SpotifyImage[];
  total_tracks: number;
}

interface UserPlaylist {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string };
}

interface RecentTrack {
  track: SearchTrack;
  played_at: string;
}

type Tab = "search" | "playlists" | "recent";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMs(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPOTIFY_API = "https://api.spotify.com/v1";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  open: boolean;
  onClose: () => void;
  onPlayUri: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}

export function SpotifySearchModal({
  open,
  onClose,
  onPlayUri,
  onAddToQueue,
}: Props) {
  const getAccessToken = useSpotifyStore((s) => s.getAccessToken);
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Search results
  const [tracks, setTracks] = useState<SearchTrack[]>([]);
  const [playlists, setPlaylists] = useState<SearchPlaylist[]>([]);
  const [albums, setAlbums] = useState<SearchAlbum[]>([]);

  // My playlists
  const [myPlaylists, setMyPlaylists] = useState<UserPlaylist[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);

  // Recently played
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input when opening search tab
  useEffect(() => {
    if (open && tab === "search") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, tab]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery("");
      setTracks([]);
      setPlaylists([]);
      setAlbums([]);
      setPlaylistsLoaded(false);
      setRecentLoaded(false);
    }
  }, [open]);

  /* ---------- API calls ---------- */

  const searchSpotify = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setTracks([]);
        setPlaylists([]);
        setAlbums([]);
        return;
      }
      const token = await getAccessToken();
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          type: "track,playlist,album",
          limit: "10",
        });
        const res = await fetch(`${SPOTIFY_API}/search?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        // Spotify API can include null entries in results — filter them out
        setTracks((data.tracks?.items ?? []).filter(Boolean));
        setPlaylists((data.playlists?.items ?? []).filter(Boolean));
        setAlbums((data.albums?.items ?? []).filter(Boolean));
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken],
  );

  const loadMyPlaylists = useCallback(async () => {
    if (playlistsLoaded) return;
    const token = await getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${SPOTIFY_API}/me/playlists?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyPlaylists((data.items ?? []).filter(Boolean));
      setPlaylistsLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, playlistsLoaded]);

  const loadRecentTracks = useCallback(async () => {
    if (recentLoaded) return;
    const token = await getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SPOTIFY_API}/me/player/recently-played?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return;
      const data = await res.json();
      // Filter out items where track is null (can happen with local files etc.)
      setRecentTracks(
        (data.items ?? []).filter((r: RecentTrack) => r?.track != null),
      );
      setRecentLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, recentLoaded]);

  // Load data when switching tabs
  useEffect(() => {
    if (!open) return;
    if (tab === "playlists") loadMyPlaylists();
    if (tab === "recent") loadRecentTracks();
  }, [tab, open, loadMyPlaylists, loadRecentTracks]);

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSpotify(value), 350);
  };

  const handlePlay = (uri: string) => {
    onPlayUri(uri);
    onClose();
  };

  const handleQueue = (uri: string) => {
    onAddToQueue(uri);
  };

  if (!open) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "search",
      label: "Tìm kiếm",
      icon: <Search className="w-3.5 h-3.5" />,
    },
    {
      key: "playlists",
      label: "Playlist",
      icon: <ListMusic className="w-3.5 h-3.5" />,
    },
    {
      key: "recent",
      label: "Gần đây",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-gray-900 border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-green-400" />
                Spotify
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 pb-3">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    tab === t.key
                      ? "bg-green-500/20 text-green-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search input */}
            {tab === "search" && (
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Tìm bài hát, playlist, album..."
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-green-500/50 transition-colors"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setTracks([]);
                        setPlaylists([]);
                        setAlbums([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                </div>
              )}

              {!loading && tab === "search" && (
                <SearchResults
                  query={query}
                  tracks={tracks}
                  playlists={playlists}
                  albums={albums}
                  onPlay={handlePlay}
                  onQueue={handleQueue}
                />
              )}

              {!loading && tab === "playlists" && (
                <PlaylistList playlists={myPlaylists} onPlay={handlePlay} />
              )}

              {!loading && tab === "recent" && (
                <RecentList
                  recentTracks={recentTracks}
                  onPlay={handlePlay}
                  onQueue={handleQueue}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline search panel (used inside SpotifyWidget)                    */
/* ------------------------------------------------------------------ */

interface PanelProps {
  onPlayUri: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}

export function SpotifySearchPanel({ onPlayUri, onAddToQueue }: PanelProps) {
  const getAccessToken = useSpotifyStore((s) => s.getAccessToken);
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [tracks, setTracks] = useState<SearchTrack[]>([]);
  const [playlists, setPlaylists] = useState<SearchPlaylist[]>([]);
  const [albums, setAlbums] = useState<SearchAlbum[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<UserPlaylist[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (tab === "search") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [tab]);

  const searchSpotify = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setTracks([]);
        setPlaylists([]);
        setAlbums([]);
        return;
      }
      const token = await getAccessToken();
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          type: "track,playlist,album",
          limit: "10",
        });
        const res = await fetch(`${SPOTIFY_API}/search?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setTracks((data.tracks?.items ?? []).filter(Boolean));
        setPlaylists((data.playlists?.items ?? []).filter(Boolean));
        setAlbums((data.albums?.items ?? []).filter(Boolean));
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken],
  );

  const loadMyPlaylists = useCallback(async () => {
    if (playlistsLoaded) return;
    const token = await getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${SPOTIFY_API}/me/playlists?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyPlaylists((data.items ?? []).filter(Boolean));
      setPlaylistsLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, playlistsLoaded]);

  const loadRecentTracks = useCallback(async () => {
    if (recentLoaded) return;
    const token = await getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SPOTIFY_API}/me/player/recently-played?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data = await res.json();
      setRecentTracks(
        (data.items ?? []).filter((r: RecentTrack) => r?.track != null),
      );
      setRecentLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, recentLoaded]);

  useEffect(() => {
    if (tab === "playlists") loadMyPlaylists();
    if (tab === "recent") loadRecentTracks();
  }, [tab, loadMyPlaylists, loadRecentTracks]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSpotify(value), 350);
  };

  const handlePlay = (uri: string) => {
    onPlayUri(uri);
  };
  const handleQueue = (uri: string) => {
    onAddToQueue(uri);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "search",
      label: "Tìm kiếm",
      icon: <Search className="w-3.5 h-3.5" />,
    },
    {
      key: "playlists",
      label: "Playlist",
      icon: <ListMusic className="w-3.5 h-3.5" />,
    },
    {
      key: "recent",
      label: "Gần đây",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white/5 border border-white/10 mb-4">
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-green-500/20 text-green-400"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      {tab === "search" && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm bài hát, playlist, album..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-green-500/50 transition-colors"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setTracks([]);
                  setPlaylists([]);
                  setAlbums([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="overflow-y-auto px-4 pb-3 max-h-80 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
          </div>
        )}
        {!loading && tab === "search" && (
          <SearchResults
            query={query}
            tracks={tracks}
            playlists={playlists}
            albums={albums}
            onPlay={handlePlay}
            onQueue={handleQueue}
          />
        )}
        {!loading && tab === "playlists" && (
          <PlaylistList playlists={myPlaylists} onPlay={handlePlay} />
        )}
        {!loading && tab === "recent" && (
          <RecentList
            recentTracks={recentTracks}
            onPlay={handlePlay}
            onQueue={handleQueue}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SearchResults({
  query,
  tracks,
  playlists,
  albums,
  onPlay,
  onQueue,
}: {
  query: string;
  tracks: SearchTrack[];
  playlists: SearchPlaylist[];
  albums: SearchAlbum[];
  onPlay: (uri: string) => void;
  onQueue: (uri: string) => void;
}) {
  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Search className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">Tìm bài hát, playlist hoặc album</p>
      </div>
    );
  }

  if (!tracks.length && !playlists.length && !albums.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Music className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">Không tìm thấy kết quả</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tracks */}
      {tracks.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Bài hát
          </h3>
          <div className="space-y-0.5">
            {tracks.map((t) => (
              <TrackRow
                key={t.id}
                name={t.name}
                artists={t.artists.map((a) => a.name).join(", ")}
                albumArt={t.album.images[t.album.images.length - 1]?.url}
                duration={t.duration_ms}
                onPlay={() => onPlay(t.uri)}
                onQueue={() => onQueue(t.uri)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Playlists */}
      {playlists.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Playlist
          </h3>
          <div className="space-y-0.5">
            {playlists.map((p) => (
              <ItemRow
                key={p.id}
                name={p.name}
                subtitle={`${p.owner?.display_name ?? ""}${p.tracks?.total != null ? ` · ${p.tracks.total} bài` : ""}`}
                image={p.images?.[0]?.url}
                onPlay={() => onPlay(p.uri)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Album
          </h3>
          <div className="space-y-0.5">
            {albums.map((a) => (
              <ItemRow
                key={a.id}
                name={a.name}
                subtitle={`${a.artists.map((ar) => ar.name).join(", ")} · ${a.total_tracks} bài`}
                image={a.images?.[a.images.length - 1]?.url}
                onPlay={() => onPlay(a.uri)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PlaylistList({
  playlists,
  onPlay,
}: {
  playlists: UserPlaylist[];
  onPlay: (uri: string) => void;
}) {
  if (!playlists.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <ListMusic className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">Chưa có playlist nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {playlists.map((p) => (
        <ItemRow
          key={p.id}
          name={p.name}
          subtitle={`${p.owner?.display_name ?? ""}${p.tracks?.total != null ? ` · ${p.tracks.total} bài` : ""}`}
          image={p.images?.[0]?.url}
          onPlay={() => onPlay(p.uri)}
        />
      ))}
    </div>
  );
}

function RecentList({
  recentTracks,
  onPlay,
  onQueue,
}: {
  recentTracks: RecentTrack[];
  onPlay: (uri: string) => void;
  onQueue: (uri: string) => void;
}) {
  if (!recentTracks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Clock className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">Chưa có bài hát nào</p>
      </div>
    );
  }

  // Deduplicate by track URI (keep first occurrence = most recent)
  const seen = new Set<string>();
  const unique = recentTracks.filter((r) => {
    if (seen.has(r.track.uri)) return false;
    seen.add(r.track.uri);
    return true;
  });

  return (
    <div className="space-y-0.5">
      {unique.map((r, i) => (
        <TrackRow
          key={`${r.track.id}-${i}`}
          name={r.track.name}
          artists={r.track.artists.map((a) => a.name).join(", ")}
          albumArt={r.track.album.images[r.track.album.images.length - 1]?.url}
          duration={r.track.duration_ms}
          onPlay={() => onPlay(r.track.uri)}
          onQueue={() => onQueue(r.track.uri)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared rows                                                        */
/* ------------------------------------------------------------------ */

function TrackRow({
  name,
  artists,
  albumArt,
  duration,
  onPlay,
  onQueue,
}: {
  name: string;
  artists: string;
  albumArt?: string;
  duration: number;
  onPlay: () => void;
  onQueue: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
      <div className="w-9 h-9 rounded bg-white/10 overflow-hidden shrink-0 relative">
        {albumArt ? (
          <Image
            src={albumArt}
            alt={name}
            fill
            className="object-cover"
            sizes="36px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-4 h-4 text-gray-600" />
          </div>
        )}
        <button
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Play className="w-4 h-4 text-white" fill="white" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{artists}</p>
      </div>
      <span className="text-xs text-gray-600 tabular-nums shrink-0">
        {formatMs(duration)}
      </span>
      <button
        onClick={onQueue}
        className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-gray-400 hover:text-green-400"
        title="Thêm vào hàng đợi"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ItemRow({
  name,
  subtitle,
  image,
  onPlay,
}: {
  name: string;
  subtitle: string;
  image?: string;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors w-full text-left"
    >
      <div className="w-10 h-10 rounded bg-white/10 overflow-hidden shrink-0 relative">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover"
            sizes="40px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ListMusic className="w-4 h-4 text-gray-600" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-4 h-4 text-white" fill="white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
    </button>
  );
}
