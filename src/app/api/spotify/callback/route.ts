import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
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
    if (Math.floor(Date.now() / 1000) - parseInt(timestamp, 10) > 600)
      return false;
    const secret =
      process.env.SUPABASE_SECRET_KEY ?? "dev-fallback";
    const expectedSig = createHmac("sha256", secret)
      .update(payload)
      .digest("hex")
      .slice(0, 32);
    return sig === expectedSig;
  } catch {
    return false;
  }
}

/**
 * Derive the public-facing origin of this request.
 * Behind a reverse proxy (Railway, Vercel, etc.), request.url contains the
 * internal container address.  Prefer NEXT_PUBLIC_SITE_URL env var, then x-forwarded-*
 * headers injected by the proxy, and fall back to request.url as last resort.
 */
function getPublicOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
  }
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = (
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  )
    ?.split(",")[0]
    ?.trim();
  if (proto && host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const user = await getServerSession();
  const origin = getPublicOrigin(request);

  if (!user?.id) {
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

  if (!code || !state || !verifyOAuthState(state, user.id)) {
    return NextResponse.redirect(
      `${origin}/dashboard?spotify_error=state_mismatch`,
    );
  }

  // Must match exactly what was sent in /connect
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${origin}/api/spotify/callback`;
  console.log("[spotify/callback] redirectUri:", redirectUri);
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
    const errBody = await tokenResponse.text();
    console.error(
      "[spotify/callback] token exchange failed:",
      tokenResponse.status,
      errBody,
    );
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

  // Verify the session user actually exists in our DB before upserting
  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!dbUser) {
    console.error(
      "[spotify/callback] session userId not found in DB:",
      user.id,
      "— session may be stale, user must re-login",
    );
    return NextResponse.redirect(
      `${origin}/dashboard?spotify_error=user_not_found`,
    );
  }

  // Upsert spotify_accounts row — store tokens
  const { error: upsertError } = await supabase
    .from("spotify_accounts")
    .upsert(
      {
        userId: user.id,
        providerAccountId: profile.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
      { onConflict: "userId" },
    );

  if (upsertError) {
    console.error("[spotify/callback] upsert error:", upsertError);
    return NextResponse.redirect(
      `${origin}/dashboard?spotify_error=token_exchange_failed`,
    );
  }

  return NextResponse.redirect(`${origin}/dashboard?spotify_connected=true`);
}
