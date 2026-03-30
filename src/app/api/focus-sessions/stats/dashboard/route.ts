import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getDashboardStats } from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions/stats/dashboard
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const stats = await getDashboardStats(supabase, user!.id);
  return NextResponse.json(stats);
}
