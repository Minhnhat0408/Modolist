import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { findSessionsByTask } from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions/by-task/[taskId]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { taskId } = await params;
  const sessions = await findSessionsByTask(supabase, user!.id, taskId);
  return NextResponse.json(sessions);
}
