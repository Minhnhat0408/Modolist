import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getCurrentSession } from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions/current
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const result = await getCurrentSession(supabase, user!.id);
  return NextResponse.json(result);
}
