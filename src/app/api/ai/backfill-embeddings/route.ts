import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-helper";
import { storeEmbedding } from "@/lib/services/ai.service";

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < Math.max(1, limit); i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) return;
        await worker(item);
      }
    })());
  }

  await Promise.all(workers);
}

// POST /api/ai/backfill-embeddings
export async function POST() {
  const { user, supabase, error } = await getAuthenticatedUser();
  if (error) return error;

  const { data: tasks, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, description, completedPomodoros")
    .eq("userId", user!.id)
    .gt("completedPomodoros", 0)
    .is("embedding", null)
    .limit(500);

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch tasks for embedding backfill" },
      { status: 500 },
    );
  }

  const candidates = tasks ?? [];
  let success = 0;
  let failed = 0;

  await runWithConcurrency(candidates, 5, async (task) => {
    const result = await storeEmbedding(
      supabase,
      task.id,
      user!.id,
      task.title,
      task.description || "",
    );

    if (result.success) {
      success += 1;
    } else {
      failed += 1;
    }
  });

  return NextResponse.json({
    total: candidates.length,
    success,
    failed,
  });
}
