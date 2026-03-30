import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { duplicateTask } from "@/lib/services/tasks.service";

// POST /api/tasks/[id]/duplicate
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const task = await duplicateTask(supabase, id, user!.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task, { status: 201 });
}
