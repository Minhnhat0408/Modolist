import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getTaskStats } from "@/lib/services/tasks.service";

// GET /api/tasks/stats
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const stats = await getTaskStats(supabase, user!.id);
  return NextResponse.json(stats);
}
