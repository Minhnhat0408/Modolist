import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { startSession } from "@/lib/services/focus-sessions.service";

// POST /api/focus-sessions/start
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const session = await startSession(
    supabase,
    user!.id,
    body.taskId || null,
    body.plannedDuration,
  );
  return NextResponse.json(session, { status: 201 });
}
