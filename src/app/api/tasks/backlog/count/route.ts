import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getBacklogCount } from "@/lib/services/tasks.service";

// GET /api/tasks/backlog/count
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const count = await getBacklogCount(supabase, user!.id);
  return NextResponse.json(count);
}
