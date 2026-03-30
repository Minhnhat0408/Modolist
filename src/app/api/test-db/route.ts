import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { count: userCount } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    const { count: taskCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      success: true,
      message: "Database connected successfully",
      stats: {
        users: userCount,
        tasks: taskCount,
      },
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return NextResponse.json(
      { success: false, error: "Database connection failed" },
      { status: 500 },
    );
  }
}
