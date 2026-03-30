import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { confirmGeneratedTasks } from "@/lib/services/ai.service";

// POST /api/ai/confirm-tasks
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const { tasks } = body;

  if (!Array.isArray(tasks) || !tasks.length) {
    return NextResponse.json({ error: "tasks array is required" }, { status: 400 });
  }

  try {
    const result = await confirmGeneratedTasks(supabase, user!.id, tasks);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("AI confirm-tasks error:", err);
    return NextResponse.json(
      { error: "Failed to confirm tasks" },
      { status: 500 },
    );
  }
}
