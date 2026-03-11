import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@repo/database";
import { SPOTIFY_CONFIG, getSpotifyBasicAuth } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "spotify",
    },
  });

  if (!account) {
    return NextResponse.json({ connected: false });
  }

  // Check if token is expired (60s buffer)
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at < now + 60) {
    if (!account.refresh_token) {
      // Refresh token missing — user needs to reconnect
      return NextResponse.json({ connected: false, error: "no_refresh_token" });
    }

    const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${getSpotifyBasicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { connected: false, error: "refresh_failed" },
        { status: 502 },
      );
    }

    const tokens = await response.json();

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      },
    });

    return NextResponse.json({
      connected: true,
      accessToken: tokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    });
  }

  return NextResponse.json({
    connected: true,
    accessToken: account.access_token,
    expiresAt: account.expires_at,
  });
}
