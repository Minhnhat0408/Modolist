import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { estimateTime } from "@/lib/services/ai.service";

// POST /api/ai/estimate-time
export async function POST(request: Request) {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await request.json();
  const { taskTitle, taskDescription } = body;

  if (!taskTitle) {
    return NextResponse.json({ error: "taskTitle is required" }, { status: 400 });
  }

  try {
    const result = await estimateTime(supabase, user!.id, taskTitle, taskDescription);
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI estimate-time error:", err);
    return NextResponse.json(
      {
        estimatedPomodoros: 3,
        reasoning: "Không thể kết nối AI service — sử dụng giá trị mặc định.",
        similarTasks: [],
        confidence: "low",
      },
    );
  }
}
