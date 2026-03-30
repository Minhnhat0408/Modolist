import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import {
  findOneTask,
  updateTask,
  removeTask,
} from "@/lib/services/tasks.service";

// GET /api/tasks/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const task = await findOneTask(supabase, id, user!.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}

// PATCH /api/tasks/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const task = await updateTask(supabase, id, user!.id, body);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}

// DELETE /api/tasks/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;
  const task = await removeTask(supabase, id, user!.id);
  return NextResponse.json(task);
}
