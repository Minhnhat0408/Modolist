import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SPOTIFY_CONFIG, getSpotifyCredentials } from "@/lib/spotify";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = getSpotifyCredentials();
  const state = randomBytes(16).toString("hex");

  // Build redirect_uri from request origin
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/spotify/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_CONFIG.SCOPES,
    state,
  });

  const response = NextResponse.redirect(
    `${SPOTIFY_CONFIG.AUTH_URL}?${params}`,
  );
  response.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return response;
}
