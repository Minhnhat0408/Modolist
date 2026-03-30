import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { findBacklog } from "@/lib/services/tasks.service";

// GET /api/tasks/backlog
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const tasks = await findBacklog(supabase, user!.id);
  return NextResponse.json(tasks);
}
