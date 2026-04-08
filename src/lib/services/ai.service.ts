/**
 * AI Service — replaces Python gRPC AI service.
 * Uses Google Gemini SDK directly for task generation, time estimation, and embeddings.
 * Uses Supabase pgvector for RAG similarity search.
 */

import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const EMBEDDING_MODEL = "gemini-embedding-001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FocusPlan {
  session_type: "QUICK_5" | "QUICK_15" | "STANDARD";
  sessions: number;
  total_minutes: number;
  label: string;
}

interface GeneratedTask {
  title: string;
  description: string;
  priority: string;
  estimatedPomodoros: number;
  reasoning: string;
  order: number;
  tags: string[];
  focusPlan: FocusPlan;
}

interface SimilarTask {
  id: string;
  title: string;
  actualPomodoros: number;
  similarity: number;
  isOwn: boolean;
  suggestedSessionType?: "QUICK_5" | "QUICK_15" | "STANDARD" | null;
  suggestedTotalMinutes?: number | null;
  avgPlannedDuration?: number | null;
}

interface SimilarEstimateResult {
  estimate: number | null;
  reasoning: string | null;
  confidence: string;
  historicalPlan: Omit<FocusPlan, "label"> | null;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const TASK_BREAKDOWN_PROMPT = `Bạn là một AI trợ lý quản lý công việc. Người dùng đưa cho bạn một mục tiêu/dự án.
Hãy phân tích và tạo ra {max_tasks} nhiệm vụ cụ thể, có thể thực hiện được.

Hệ thống có 3 chế độ Focus:
1. QUICK_5: Focus nhanh 5 phút — cho việc siêu nhỏ (trả lời tin nhắn, fix typo, quick check)
2. QUICK_15: Focus nhanh 15 phút không nghỉ — cho việc nhỏ hoàn thành trong 1 lần (review PR, viết email dài, debug nhỏ)
3. STANDARD: Pomodoro chuẩn 25 phút + nghỉ 5 phút, lặp nhiều session — cho việc cần tập trung lâu

Mục tiêu: {goal}
{context_section}

Trả về JSON (không markdown, không code block) theo cấu trúc sau:
{
    "tasks": [
        {
            "title": "Tên nhiệm vụ ngắn gọn",
            "description": "Mô tả chi tiết cách thực hiện",
            "priority": "HIGH hoặc MEDIUM hoặc LOW",
            "session_type": "QUICK_5 hoặc QUICK_15 hoặc STANDARD",
            "sessions": 3,
            "total_minutes": 75,
            "tags": ["tag1", "tag2"],
            "order": 1
        }
    ],
    "summary": "Tóm tắt kế hoạch tổng thể trong 1-2 câu"
}

Quy tắc:
- Mỗi task phải cụ thể, actionable (có thể bắt tay làm ngay)
- Sắp xếp theo thứ tự ưu tiên thực hiện (order)
- Priority dựa trên mức độ quan trọng VÀ thứ tự phụ thuộc
- Task đầu tiên nên là task nền tảng (setup, research)
- Task cuối nên là task hoàn thiện (testing, review)
- session_type: chọn chế độ phù hợp dựa trên độ phức tạp
- sessions: 1 cho QUICK_5/QUICK_15, N cho STANDARD (tối đa 10)
- total_minutes: tổng phút ước lượng (QUICK_5=5, QUICK_15=15, STANDARD=sessions*25 + breaks)
- tags: 1-3 nhãn ngắn gọn mô tả lĩnh vực/loại task bằng tiếng Việt
- Mô tả bằng tiếng Việt, ngắn gọn nhưng đủ ý`;

const ESTIMATE_PROMPT = `Bạn là AI ước lượng thời gian cho task.

Hệ thống có 3 chế độ Focus:
1. QUICK_5: Focus nhanh 5 phút — cho việc siêu nhỏ (trả lời tin nhắn, fix typo, quick check)
2. QUICK_15: Focus nhanh 15 phút không nghỉ — cho việc nhỏ hoàn thành trong 1 lần (review PR, viết email dài, debug nhỏ)
3. STANDARD: Pomodoro chuẩn 25 phút + nghỉ 5 phút, lặp nhiều session — cho việc cần tập trung lâu

Hướng dẫn ước lượng:
- Task siêu nhỏ (<5 phút): → QUICK_5, 1 session, 5 phút
- Task nhỏ (5-15 phút): → QUICK_15, 1 session, 15 phút
- Task trung bình (~1-2 giờ): → STANDARD, 2-4 sessions
- Task lớn (~2-4 giờ): → STANDARD, 5-8 sessions
- Tối đa 10 sessions — task lớn hơn nên chia nhỏ

Task cần ước lượng:
Tiêu đề: {title}
{description_section}

Trả về JSON (không markdown, không code block):
{
    "session_type": "QUICK_5 hoặc QUICK_15 hoặc STANDARD",
    "sessions": <số nguyên>,
    "total_minutes": <số phút>,
    "reasoning": "<giải thích ngắn gọn bằng tiếng Việt>"
}`;

// ── Focus Plan Builder ────────────────────────────────────────────────────────

function buildFocusPlan(estimatedPomodoros: number): Omit<FocusPlan, "label"> {
  const ep = Math.max(1, estimatedPomodoros);
  if (ep === 1) {
    return { session_type: "QUICK_15", sessions: 1, total_minutes: 15 };
  }
  const total = ep * 25 + (ep - 1) * 5;
  return { session_type: "STANDARD", sessions: ep, total_minutes: total };
}

function makeFocusPlanLabel(plan: Omit<FocusPlan, "label">): FocusPlan {
  let label: string;
  if (plan.session_type === "QUICK_5") {
    label = plan.sessions > 1
      ? `⚡ Quick 5 × ${plan.sessions} (~${plan.total_minutes} phút)`
      : "⚡ Quick 5 phút";
  } else if (plan.session_type === "QUICK_15") {
    label = plan.sessions > 1
      ? `⚡ Quick 15 × ${plan.sessions} (~${plan.total_minutes} phút)`
      : "⚡ Quick 15 phút";
  } else {
    const hours = Math.floor(plan.total_minutes / 60);
    const mins = plan.total_minutes % 60;
    const timeStr = hours > 0 ? `${hours}h${String(mins).padStart(2, "0")}` : `${mins} phút`;
    label = `🍅 ${plan.sessions} Pomodoro${plan.sessions > 1 ? "s" : ""} (~${timeStr})`;
  }
  return { ...plan, label };
}

// ── RAG + LLM Blending ───────────────────────────────────────────────────────

const CONFIDENCE_NUM: Record<string, number> = {
  none: 0.0,
  low: 0.2,
  medium: 0.6,
  high: 0.8,
};

function blendEstimates(
  ragAvg: number | null,
  ragConfidence: string,
  llmPomodoros: number,
  llmPlan: Omit<FocusPlan, "label">,
  ragReasoning: string | null,
  ragPlan: Omit<FocusPlan, "label"> | null,
  llmReasoning: string,
): { estimate: number; reasoning: string; plan: FocusPlan; confidence: string } {
  const ragConfNum = CONFIDENCE_NUM[ragConfidence] ?? 0;

  if (ragAvg === null || ragConfNum < 0.1) {
    return {
      estimate: llmPomodoros,
      reasoning: llmReasoning,
      plan: makeFocusPlanLabel(llmPlan),
      confidence: "medium",
    };
  }

  if (ragConfNum >= 0.5) {
    const finalEstimate = Math.max(1, ragAvg);
    const finalPlan = makeFocusPlanLabel(ragPlan ?? buildFocusPlan(finalEstimate));
    const confidenceLabel = ragConfNum >= 0.75 ? "high" : "medium";
    const parts: string[] = [];
    if (ragReasoning) parts.push(`📊 RAG (${Math.round(ragConfNum * 100)}%): ${ragReasoning}`);
    parts.push(`→ ${finalEstimate} pomodoros.`);
    return { estimate: finalEstimate, reasoning: parts.join(" "), plan: finalPlan, confidence: confidenceLabel };
  }

  // Low confidence — blend
  const blended = ragConfNum * ragAvg + (1 - ragConfNum) * llmPomodoros;
  const finalEstimate = Math.max(1, Math.round(blended));
  let finalPlan: Omit<FocusPlan, "label">;
  if (llmPlan.session_type === "STANDARD") {
    finalPlan = {
      session_type: "STANDARD",
      sessions: finalEstimate,
      total_minutes: finalEstimate * 25 + Math.max(0, finalEstimate - 1) * 5,
    };
  } else {
    finalPlan = finalEstimate === 1 ? llmPlan : buildFocusPlan(finalEstimate);
  }

  const parts: string[] = [];
  if (ragReasoning) parts.push(`📊 RAG (${Math.round(ragConfNum * 100)}%): ${ragReasoning}`);
  parts.push(`🤖 AI: ${llmReasoning}`);
  parts.push(`→ Kết hợp: ${finalEstimate} pomodoros.`);

  return { estimate: finalEstimate, reasoning: parts.join(" "), plan: makeFocusPlanLabel(finalPlan), confidence: "medium" };
}

// ── RAG Functions ─────────────────────────────────────────────────────────────

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
        }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.embedding?.values ?? null;
  } catch {
    return null;
  }
}

async function findSimilarTasks(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  limit = 10,
): Promise<SimilarTask[]> {
  const embedding = await getEmbedding(text);
  if (!embedding) return [];

  const { data, error } = await supabase.rpc("search_similar_tasks", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: 0.7,
    match_count: limit,
    p_user_id: userId,
  });

  if (error || !data) return [];

  return data.map((row: {
    id: string;
    title: string;
    completedPomodoros: number;
    userId: string;
    similarity: number;
    suggestedSessionType?: string | null;
    suggestedTotalMinutes?: number | null;
    avgPlannedDuration?: number | null;
  }) => {
    const isOwn = row.userId === userId;
    return {
      id: row.id,
      title: row.title,
      actualPomodoros: row.completedPomodoros,
      similarity: row.similarity * (isOwn ? 1.0 : 0.7),
      isOwn,
      suggestedSessionType:
        row.suggestedSessionType === "QUICK_5" ||
        row.suggestedSessionType === "QUICK_15" ||
        row.suggestedSessionType === "STANDARD"
          ? row.suggestedSessionType
          : null,
      suggestedTotalMinutes: row.suggestedTotalMinutes ?? null,
      avgPlannedDuration: row.avgPlannedDuration ?? null,
    };
  }).sort((a: SimilarTask, b: SimilarTask) => b.similarity - a.similarity);
}

function estimateFromSimilar(
  similarTasks: SimilarTask[],
): SimilarEstimateResult {
  if (!similarTasks.length) {
    return { estimate: null, reasoning: null, confidence: "none", historicalPlan: null };
  }

  const relevant = similarTasks.filter((t) => t.similarity >= 0.7);
  if (!relevant.length) {
    return { estimate: null, reasoning: null, confidence: "none", historicalPlan: null };
  }

  const totalWeight = relevant.reduce((acc, t) => acc + t.similarity, 0);
  const weightedAvg = relevant.reduce((acc, t) => acc + t.actualPomodoros * t.similarity, 0) / totalWeight;
  const estimate = Math.max(1, Math.round(weightedAvg));

  const ownTasks = relevant.filter((t) => t.isOwn);
  const otherCount = relevant.length - ownTasks.length;

  const totalMinutesWeighted = relevant.reduce((acc, t) => {
    const minutesFromHistory =
      t.avgPlannedDuration != null
        ? Math.max(1, Math.round((t.avgPlannedDuration / 60) * t.actualPomodoros))
        : t.suggestedTotalMinutes ?? null;

    if (minutesFromHistory == null) return acc;
    return acc + minutesFromHistory * t.similarity;
  }, 0);

  const totalMinutesWeight = relevant.reduce((acc, t) => {
    const hasMinutes = t.avgPlannedDuration != null || t.suggestedTotalMinutes != null;
    return hasMinutes ? acc + t.similarity : acc;
  }, 0);

  const weightedTotalMinutes =
    totalMinutesWeight > 0
      ? Math.max(1, Math.round(totalMinutesWeighted / totalMinutesWeight))
      : null;

  const weightedPlannedSecondsRaw = relevant.reduce((acc, t) => {
    if (t.avgPlannedDuration == null) return acc;
    return acc + t.avgPlannedDuration * t.similarity;
  }, 0);

  const weightedPlannedSecondsWeight = relevant.reduce((acc, t) => {
    return t.avgPlannedDuration == null ? acc : acc + t.similarity;
  }, 0);

  const weightedPlannedSeconds =
    weightedPlannedSecondsWeight > 0
      ? Math.round(weightedPlannedSecondsRaw / weightedPlannedSecondsWeight)
      : null;

  const standardVotes = relevant.filter((t) => t.suggestedSessionType === "STANDARD").length;
  const quick5Votes = relevant.filter((t) => t.suggestedSessionType === "QUICK_5").length;
  const quick15Votes = relevant.filter((t) => t.suggestedSessionType === "QUICK_15").length;

  let historicalPlan: Omit<FocusPlan, "label"> | null = null;

  if (weightedPlannedSeconds != null && weightedPlannedSeconds <= 300) {
    const sessions = Math.max(1, estimate);
    historicalPlan = {
      session_type: "QUICK_5",
      sessions,
      total_minutes: Math.max(5, sessions * 5),
    };
  } else if (weightedPlannedSeconds != null && weightedPlannedSeconds <= 900) {
    const sessions = Math.max(1, estimate);
    historicalPlan = {
      session_type: "QUICK_15",
      sessions,
      total_minutes: Math.max(15, sessions * 15),
    };
  } else if (weightedTotalMinutes != null && weightedTotalMinutes <= 15) {
    historicalPlan = {
      session_type: weightedTotalMinutes <= 5 ? "QUICK_5" : "QUICK_15",
      sessions: 1,
      total_minutes: weightedTotalMinutes <= 5 ? 5 : 15,
    };
  } else if (quick5Votes > standardVotes && quick5Votes >= quick15Votes) {
    const sessions = Math.max(1, estimate);
    historicalPlan = {
      session_type: "QUICK_5",
      sessions,
      total_minutes: Math.max(5, sessions * 5),
    };
  } else if (quick15Votes > standardVotes) {
    const sessions = Math.max(1, estimate);
    historicalPlan = {
      session_type: "QUICK_15",
      sessions,
      total_minutes: Math.max(15, sessions * 15),
    };
  } else {
    historicalPlan = buildFocusPlan(estimate);
  }

  let reasoning: string;
  if (ownTasks.length) {
    const refs = ownTasks
      .slice(0, 3)
      .map((t) => `"${t.title}" (${t.actualPomodoros} pomo)`)
      .join(", ");
    reasoning = `Dựa trên ${ownTasks.length} task cá nhân tương tự: ${refs}.`;
  } else {
    reasoning = `Dựa trên ${otherCount} task từ cộng đồng.`;
  }
  if (otherCount > 0 && ownTasks.length) {
    reasoning += ` Kết hợp thêm ${otherCount} task từ người dùng khác.`;
  }

  const avgSimilarity = totalWeight / relevant.length;
  const quantityFactor = Math.min(1, relevant.length / 7);
  const similarityFactor = Math.max(0, (avgSimilarity - 0.7) / 0.25);
  let confidenceScore = Math.min(1, quantityFactor * 0.5 + similarityFactor * 0.5);

  if (relevant.length <= 1 && avgSimilarity < 0.65) {
    confidenceScore = Math.min(confidenceScore, 0.2);
  }

  const confidence =
    confidenceScore >= 0.6 ? "high" : confidenceScore >= 0.3 ? "medium" : "low";

  return { estimate, reasoning, confidence, historicalPlan };
}

// ── Public API ────────────────────────────────────────────────────────────────

function parseJsonResponse(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("\n").slice(1).join("\n");
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
  }
  return JSON.parse(cleaned);
}

export async function generateTasks(
  supabase: SupabaseClient,
  userId: string,
  goal: string,
  context?: string,
  maxTasks = 5,
): Promise<{ tasks: GeneratedTask[]; summary: string }> {
  const contextSection = context ? `Bối cảnh thêm: ${context}` : "";
  const prompt = TASK_BREAKDOWN_PROMPT
    .replace("{goal}", goal)
    .replace("{context_section}", contextSection)
    .replace("{max_tasks}", String(Math.min(maxTasks, 7)));

  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  const raw = parseJsonResponse(response.text ?? "{}") as {
    tasks: Array<{
      title: string;
      description: string;
      priority: string;
      session_type: string;
      sessions: number;
      total_minutes: number;
      tags: string[];
      order: number;
    }>;
    summary: string;
  };

  // Enrich with RAG
  const generatedTasks: GeneratedTask[] = [];
  for (const taskData of raw.tasks ?? []) {
    const title = taskData.title || "";
    const description = taskData.description || "";

    const llmSessionType = ["QUICK_5", "QUICK_15", "STANDARD"].includes(taskData.session_type)
      ? taskData.session_type
      : "STANDARD";
    const llmSessions = Math.max(1, taskData.sessions || 1);
    const llmTotalMinutes = taskData.total_minutes || llmSessions * 25;
    const llmPlan = {
      session_type: llmSessionType as "QUICK_5" | "QUICK_15" | "STANDARD",
      sessions: llmSessions,
      total_minutes: llmTotalMinutes,
    };

    // RAG refine
    const similar = await findSimilarTasks(supabase, userId, `${title} ${description}`);
    const {
      estimate: ragAvg,
      reasoning: ragReasoning,
      confidence: ragConfidence,
      historicalPlan: ragPlan,
    } = estimateFromSimilar(similar);

    const llmPomo = llmSessionType.startsWith("QUICK") ? 1 : Math.min(10, llmSessions);
    const llmR = `🤖 AI ước lượng: ${llmSessionType} × ${llmSessions} (~${llmTotalMinutes} phút).`;

    const { estimate, reasoning, plan } = blendEstimates(
      ragAvg, ragConfidence, llmPomo, llmPlan, ragReasoning, ragPlan, llmR,
    );

    generatedTasks.push({
      title,
      description,
      priority: (taskData.priority || "MEDIUM").toUpperCase(),
      estimatedPomodoros: estimate,
      reasoning,
      order: taskData.order || 0,
      tags: taskData.tags || [],
      focusPlan: plan,
    });
  }

  return { tasks: generatedTasks, summary: raw.summary || "" };
}

export async function confirmGeneratedTasks(
  supabase: SupabaseClient,
  userId: string,
  tasks: Array<{
    title: string;
    description?: string;
    priority?: string;
    estimatedPomodoros?: number;
    order?: number;
    tags?: string[];
    suggestedSessionType?: string;
    suggestedSessions?: number;
    suggestedTotalMinutes?: number;
  }>,
) {
  // Shift existing BACKLOG tasks up
  await supabase.rpc("increment_task_order", {
    p_user_id: userId,
    p_status: "BACKLOG",
  });

  const priorityMap: Record<string, string> = {
    LOW: "LOW",
    HIGH: "HIGH",
    URGENT: "URGENT",
  };

  const rows = tasks.map((task, index) => ({
    title: task.title,
    description: task.description || null,
    status: "BACKLOG",
    priority: priorityMap[task.priority?.toUpperCase() ?? ""] || "MEDIUM",
    estimatedPomodoros: task.estimatedPomodoros || null,
    suggestedSessionType: task.suggestedSessionType || null,
    suggestedSessions: task.suggestedSessions || null,
    suggestedTotalMinutes: task.suggestedTotalMinutes || null,
    tags: task.tags || [],
    order: task.order ?? index,
    userId,
  }));

  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) throw error;

  // Store embeddings in background (with error logging)
  for (const created of data ?? []) {
    storeEmbedding(supabase, created.id, userId, created.title, created.description || "")
      .catch((err) => {
        console.error(`⚠️  Failed to store embedding for task ${created.id}:`, err);
      });
  }

  return data;
}

export async function estimateTime(
  supabase: SupabaseClient,
  userId: string,
  taskTitle: string,
  taskDescription?: string,
): Promise<{
  estimatedPomodoros: number;
  reasoning: string;
  similarTasks: SimilarTask[];
  confidence: string;
  focusPlan?: FocusPlan;
}> {
  // RAG search
  const similar = await findSimilarTasks(supabase, userId, `${taskTitle} ${taskDescription || ""}`);
  const {
    estimate: ragAvg,
    reasoning: ragReasoning,
    confidence: ragConfidence,
    historicalPlan: ragPlan,
  } = estimateFromSimilar(similar);

  // LLM estimation
  let llmPomodoros = 3;
  let llmReasoning = "Không thể ước lượng — sử dụng mặc định 3 pomodoros.";
  let llmPlan: Omit<FocusPlan, "label"> = { session_type: "STANDARD", sessions: 3, total_minutes: 75 };
  let llmFailed = false;

  try {
    const descSection = taskDescription ? `Mô tả: ${taskDescription}` : "";
    const prompt = ESTIMATE_PROMPT
      .replace("{title}", taskTitle)
      .replace("{description_section}", descSection);

    const response = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const data = parseJsonResponse(response.text ?? "{}") as {
      session_type: string;
      sessions: number;
      total_minutes: number;
      reasoning: string;
    };

    let sessionType = data.session_type || "STANDARD";
    let sessions = Math.max(1, data.sessions || 1);
    const totalMinutes = data.total_minutes || sessions * 25;

    if (!["QUICK_5", "QUICK_15", "STANDARD"].includes(sessionType)) sessionType = "STANDARD";
    if (sessionType.startsWith("QUICK")) sessions = 1;
    sessions = Math.min(sessions, 10);

    llmPlan = { session_type: sessionType as "QUICK_5" | "QUICK_15" | "STANDARD", sessions, total_minutes: totalMinutes };
    llmPomodoros = sessionType === "STANDARD" ? sessions : 1;
    llmReasoning = `🤖 ${data.reasoning || "AI ước lượng dựa trên độ phức tạp."}`;
  } catch (err) {
    llmFailed = true;
    console.warn(`⚠️  LLM estimation failed for "${taskTitle}": ${err instanceof Error ? err.message : String(err)}. Using default 3 pomodoros.`);
    // Use defaults
  }

  const { estimate, reasoning, plan, confidence } = blendEstimates(
    ragAvg, ragConfidence, llmPomodoros, llmPlan, ragReasoning, ragPlan, llmReasoning,
  );

  const finalConfidence = llmFailed && ragAvg === null ? "low" : confidence;

  return {
    estimatedPomodoros: estimate,
    reasoning,
    similarTasks: similar.slice(0, 5),
    confidence: finalConfidence,
    focusPlan: plan,
  };
}

export async function storeEmbedding(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  title: string,
  description: string,
  maxRetries = 3,
): Promise<{ success: boolean }> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const embedding = await getEmbedding(`${title} ${description}`);
      if (!embedding) {
        console.warn(`⚠️  Failed to get embedding for task ${taskId} (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return { success: false };
      }

      const vectorStr = `[${embedding.join(",")}]`;

      const { error } = await supabase
        .from("tasks")
        .update({ embedding: vectorStr })
        .eq("id", taskId)
        .eq("userId", userId);

      if (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.warn(`⚠️  Failed to store embedding for task ${taskId} (attempt ${attempt}/${maxRetries}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return { success: false };
      }
      
      return { success: true };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`⚠️  Exception storing embedding for task ${taskId} (attempt ${attempt}/${maxRetries}):`, err);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }
  
  console.error(`❌ Failed to store embedding for task ${taskId} after ${maxRetries} retries:`, lastError);
  return { success: false };
}
