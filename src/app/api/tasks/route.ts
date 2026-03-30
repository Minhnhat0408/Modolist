import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import {
  findAllTasks,
  createTask,
  createBatchTasks,
} from "@/lib/services/tasks.service";

// GET /api/tasks
export async function GET(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const tasks = await findAllTasks(supabase, user!.id, includeArchived);
  return NextResponse.json(tasks);
}

// POST /api/tasks
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();

  // Check if it's a batch create
  if (body.tasks && Array.isArray(body.tasks)) {
    const result = await createBatchTasks(supabase, user!.id, body.tasks);
    return NextResponse.json(result, { status: 201 });
  }

  const task = await createTask(supabase, user!.id, body);
  return NextResponse.json(task, { status: 201 });
}
