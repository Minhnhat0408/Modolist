import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { findDoneHistory } from "@/lib/services/tasks.service";

// GET /api/tasks/done-history
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const tasks = await findDoneHistory(supabase, user!.id);
  return NextResponse.json(tasks);
}
