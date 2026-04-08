/* eslint-env node */

import { createClient } from "@supabase/supabase-js";

const process = globalThis.process;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
  console.error("Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.split("=");
    return [k.replace(/^--/, ""), v ?? "true"];
  }),
);

const BATCH_SIZE = Number(args.batchSize ?? 200);
const CONCURRENCY = Number(args.concurrency ?? 5);
const MAX_TASKS = Number(args.maxTasks ?? 0);
const DRY_RUN = String(args.dryRun ?? "false") === "true";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getEmbedding(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini embed failed: HTTP ${response.status} ${body}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini returned empty embedding vector");
  }
  return values;
}

async function fetchCandidates(limit) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, userId, title, description, completedPomodoros")
    // .gt("completedPomodoros", 0)
    .is("embedding", null)
    .order("createdAt", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch candidates: ${error.message}`);
  }

  return data ?? [];
}

async function updateEmbedding(taskId, vector) {
  const vectorStr = `[${vector.join(",")}]`;
  const { error } = await supabase
    .from("tasks")
    .update({ embedding: vectorStr })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update embedding for task ${taskId}: ${error.message}`);
  }
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = [];

  for (let i = 0; i < Math.max(1, limit); i += 1) {
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

async function main() {
  const startedAt = Date.now();
  let processed = 0;
  let success = 0;
  let failed = 0;

  console.log("Starting system-wide embedding backfill...");
  console.log(`Config: batchSize=${BATCH_SIZE}, concurrency=${CONCURRENCY}, maxTasks=${MAX_TASKS || "unlimited"}, dryRun=${DRY_RUN}`);

  while (true) {
    const remaining = MAX_TASKS > 0 ? MAX_TASKS - processed : BATCH_SIZE;
    if (MAX_TASKS > 0 && remaining <= 0) break;

    const currentBatchSize = MAX_TASKS > 0 ? Math.min(BATCH_SIZE, remaining) : BATCH_SIZE;
    const candidates = await fetchCandidates(currentBatchSize);

    if (candidates.length === 0) break;

    console.log(`Fetched batch: ${candidates.length} tasks`);

    await runWithConcurrency(candidates, CONCURRENCY, async (task) => {
      processed += 1;
      const text = `${task.title || ""} ${task.description || ""}`.trim();

      if (!text) {
        failed += 1;
        console.warn(`Skipped empty text task: ${task.id}`);
        return;
      }

      try {
        if (!DRY_RUN) {
          const vector = await getEmbedding(text);
          await updateEmbedding(task.id, vector);
        }
        success += 1;
      } catch (error) {
        failed += 1;
        console.error(`Task ${task.id} failed:`, error instanceof Error ? error.message : String(error));
      }
    });

    console.log(`Progress: processed=${processed}, success=${success}, failed=${failed}`);
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log("Backfill completed");
  console.log(`Summary: processed=${processed}, success=${success}, failed=${failed}, elapsed=${elapsedSec}s`);

  if (failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("Backfill crashed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
