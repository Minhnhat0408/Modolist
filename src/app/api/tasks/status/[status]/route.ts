import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { findTasksByStatus } from "@/lib/services/tasks.service";
import type { TaskStatus } from "@/lib/supabase/types";

// GET /api/tasks/status/[status]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ status: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { status } = await params;
  const tasks = await findTasksByStatus(supabase, user!.id, status as TaskStatus);
  return NextResponse.json(tasks);
}
