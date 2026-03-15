import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SPOTIFY_CONFIG, getSpotifyCredentials } from "@/lib/spotify";
import { createHmac } from "crypto";

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
  const origin = getPublicOrigin(request);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Redirect to sign-in instead of returning JSON — browser-navigable context
      return NextResponse.redirect(`${origin}/auth/signin`);
    }

    const { clientId } = getSpotifyCredentials();

    // HMAC-signed state: avoids cookie/domain issues when localhost ↔ 127.0.0.1
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-fallback";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${session.user.id}:${timestamp}`;
    const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
    const state = `${Buffer.from(payload).toString("base64url")}.${sig}`;

    const redirectUri =
      process.env.SPOTIFY_REDIRECT_URI ?? `${origin}/api/spotify/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SPOTIFY_CONFIG.SCOPES,
      state,
      show_dialog: "true",
    });

    return NextResponse.redirect(`${SPOTIFY_CONFIG.AUTH_URL}?${params}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("[spotify/connect] error:", message);
    return NextResponse.redirect(
      `${origin}/dashboard?spotify_error=${encodeURIComponent(message)}`,
    );
  }
}