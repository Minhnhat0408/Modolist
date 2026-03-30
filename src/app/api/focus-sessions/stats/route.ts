import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getSessionStats } from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions/stats
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const stats = await getSessionStats(supabase, user!.id);
  return NextResponse.json(stats);
}
