import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { getDoneHistoryCount } from "@/lib/services/tasks.service";

// GET /api/tasks/done-history/count
export async function GET() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const count = await getDoneHistoryCount(supabase, user!.id);
  return NextResponse.json(count);
}
