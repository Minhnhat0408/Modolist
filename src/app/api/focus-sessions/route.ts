import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { findAllSessions, createSession } from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const sessions = await findAllSessions(supabase, user!.id);
  return NextResponse.json(sessions);
}

// POST /api/focus-sessions
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const session = await createSession(supabase, user!.id, body);
  return NextResponse.json(session, { status: 201 });
}
