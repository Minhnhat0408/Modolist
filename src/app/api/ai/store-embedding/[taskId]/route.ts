import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { storeEmbedding } from "@/lib/services/ai.service";

// POST /api/ai/store-embedding/[taskId]
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { taskId } = await params;

  // Get task details
  const { data: task } = await supabase
    .from("tasks")
    .select("title, description")
    .eq("id", taskId)
    .eq("userId", user!.id)
    .single();

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const result = await storeEmbedding(
    supabase,
    taskId,
    user!.id,
    task.title,
    task.description || "",
  );
  return NextResponse.json(result);
}
