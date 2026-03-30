import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getIncompleteSession } from "@/lib/services/focus-sessions.service";

// GET /api/focus-sessions/incomplete?taskId=xxx
export async function GET(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") ?? "";

  const result = await getIncompleteSession(supabase, user!.id, taskId);
  return NextResponse.json(result);
}
