import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { resumeSession } from "@/lib/services/focus-sessions.service";

// PATCH /api/focus-sessions/[id]/resume
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const session = await resumeSession(supabase, id, user!.id);
  if (!session) {
    return NextResponse.json({ error: "No paused session found" }, { status: 404 });
  }
  return NextResponse.json(session);
}
