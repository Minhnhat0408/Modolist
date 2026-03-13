import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { SPOTIFY_CONFIG, getSpotifyBasicAuth } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const storedState = request.cookies.get("spotify_oauth_state")?.value;
  const origin = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(
      `${origin}/?spotify_error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${origin}/?spotify_error=state_mismatch`);
  }

  // Must match exactly what was sent in /connect
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${origin}/api/spotify/callback`;
  const tokenResponse = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${getSpotifyBasicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      `${origin}/?spotify_error=token_exchange_failed`,
    );
  }

  const tokens = await tokenResponse.json();

  // Get Spotify user profile for providerAccountId
  const profileResponse = await fetch(`${SPOTIFY_CONFIG.API_URL}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    return NextResponse.redirect(
      `${origin}/?spotify_error=profile_fetch_failed`,
    );
  }

  const profile = await profileResponse.json();

  // Upsert Account row — store tokens in existing Account table
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "spotify",
        providerAccountId: profile.id,
      },
    },
    update: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      token_type: tokens.token_type,
      scope: tokens.scope,
    },
    create: {
      userId: session.user.id,
      type: "oauth",
      provider: "spotify",
      providerAccountId: profile.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      token_type: tokens.token_type,
      scope: tokens.scope,
    },
  });

  const response = NextResponse.redirect(`${origin}/?spotify_connected=true`);
  response.cookies.delete("spotify_oauth_state");
  return response;
}
