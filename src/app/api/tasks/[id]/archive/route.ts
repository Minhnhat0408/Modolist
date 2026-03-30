import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { archiveTask } from "@/lib/services/tasks.service";

// PATCH /api/tasks/[id]/archive
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const task = await archiveTask(supabase, id, user!.id);
  return NextResponse.json(task);
}
