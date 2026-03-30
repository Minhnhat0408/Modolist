import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { createBatchTasks } from "@/lib/services/tasks.service";

// POST /api/tasks/batch — Batch create tasks (guest migration)
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const tasks = body.tasks;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: "tasks array is required" }, { status: 400 });
  }
  if (tasks.length > 100) {
    return NextResponse.json({ error: "Maximum 100 tasks per batch" }, { status: 400 });
  }

  const result = await createBatchTasks(supabase, user!.id, tasks);
  return NextResponse.json(result, { status: 201 });
}
