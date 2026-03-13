export const SPOTIFY_CONFIG = {
  AUTH_URL: "https://accounts.spotify.com/authorize",
  TOKEN_URL: "https://accounts.spotify.com/api/token",
  API_URL: "https://api.spotify.com/v1",
  SCOPES:
    "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state user-read-currently-playing user-read-recently-played playlist-read-private playlist-read-collaborative",
} as const;

export function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getSpotifyBasicAuth() {
  const { clientId, clientSecret } = getSpotifyCredentials();
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}
