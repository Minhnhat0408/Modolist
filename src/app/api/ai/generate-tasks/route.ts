import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { generateTasks } from "@/lib/services/ai.service";

// POST /api/ai/generate-tasks
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const { goal, context, maxTasks } = body;

  if (!goal) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  try {
    const result = await generateTasks(supabase, user!.id, goal, context, maxTasks);
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI generate-tasks error:", err);
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 },
    );
  }
}
