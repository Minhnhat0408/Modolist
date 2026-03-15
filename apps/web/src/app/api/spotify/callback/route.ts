import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { SPOTIFY_CONFIG, getSpotifyBasicAuth } from "@/lib/spotify";
import { createHmac } from "crypto";

function verifyOAuthState(state: string, userId: string): boolean {
  try {
    const dotIdx = state.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const encodedPayload = state.slice(0, dotIdx);
    const sig = state.slice(dotIdx + 1);
    const payload = Buffer.from(encodedPayload, "base64url").toString();
    const [payloadUserId, timestamp] = payload.split(":");
    if (payloadUserId !== userId || !timestamp) return false;
    // Reject states older than 10 minutes
    if (Math.floor(Date.now() / 1000) - parseInt(timestamp, 10) > 600) return false;
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-fallback";
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
    return sig === expectedSig;
  } catch {
    return false;
  }
}

/**
 * Derive the public-facing origin of this request.
 * Behind a reverse proxy (Railway, Vercel, etc.), request.url contains the
 * internal container address.  Prefer AUTH_URL env var, then x-forwarded-*
 * headers injected by the proxy, and fall back to request.url as last resort.
 */
function getPublicOrigin(request: NextRequest): string {
  if (process.env.AUTH_URL) {
    return new URL(process.env.AUTH_URL).origin;
  }
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0]?.trim();
  if (proto && host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const origin = getPublicOrigin(request);

  if (!session?.user?.id) {
    return NextResponse.redirect(`${origin}/auth/signin`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/dashboard?spotify_error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state || !verifyOAuthState(state, session.user.id)) {
    return NextResponse.redirect(`${origin}/dashboard?spotify_error=state_mismatch`);
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
      `${origin}/dashboard?spotify_error=token_exchange_failed`,
    );
  }

  const tokens = await tokenResponse.json();

  // Get Spotify user profile for providerAccountId
  const profileResponse = await fetch(`${SPOTIFY_CONFIG.API_URL}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    return NextResponse.redirect(
      `${origin}/dashboard?spotify_error=profile_fetch_failed`,
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

  return NextResponse.redirect(`${origin}/dashboard?spotify_connected=true`);
}
