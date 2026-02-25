"""
AI Task Service — gRPC server for Task Breakdown + Time Estimation (RAG).

Stack:
  - gRPC server (grpcio)
  - Google Gemini (google-genai) for LLM task decomposition
  - pgvector + asyncpg for RAG cosine similarity search
  - Gemini embedding (text-embedding-004) for vector generation
"""

import os
import json
import asyncio
import logging
from concurrent import futures

import grpc
from grpc import aio as grpc_aio
from dotenv import load_dotenv
from google import genai
import httpx

import ai_service_pb2
import ai_service_pb2_grpc

import asyncpg

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai-service")

# ── Config ───────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
PORT = int(os.getenv("PORT", "50051"))
HOST = os.getenv("HOST", "0.0.0.0")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 3072  # gemini-embedding-001 output dim

# ── Gemini Client (generation) ────────────────────────────────────────────────────
client = genai.Client(api_key=GEMINI_API_KEY)

# ── Database Pool (lazy init) ────────────────────────────────────────────────────
_db_pool: asyncpg.Pool | None = None


async def get_db_pool() -> asyncpg.Pool:
    global _db_pool
    if _db_pool is None:
        _db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        logger.info("✅ Database pool created")
    return _db_pool


# ── Embedding Helper ─────────────────────────────────────────────────────────────
async def get_embedding(text: str) -> list[float] | None:
    """
    Generate embedding via REST embedContent endpoint (not batchEmbedContents).
    The google-genai SDK always calls batchEmbedContents which is unsupported
    for text-embedding-004, so we hit the REST API directly.
    Returns None on any error so callers can fall back gracefully.
    """
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{EMBEDDING_MODEL}:embedContent?key={GEMINI_API_KEY}"
    )
    payload = {"model": f"models/{EMBEDDING_MODEL}", "content": {"parts": [{"text": text}]}}
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["embedding"]["values"]
    except Exception as e:
        logger.warning(f"⚠️ Embedding failed (will skip RAG): {e}")
        return None


# ── RAG: Find Similar Tasks (Cross-User with Weighting) ──────────────────────────
async def find_similar_tasks(
    user_id: str,
    text: str,
    limit: int = 10,
) -> list[dict]:
    """
    Cosine similarity search on ALL users' completed tasks via pgvector.
    Current user's tasks get full weight (1.0), other users' tasks get 0.7.
    Returns empty list if embedding unavailable.
    """
    embedding = await get_embedding(text)
    if embedding is None:
        return []
    pool = await get_db_pool()

    # Search across ALL users — no userId filter for broader coverage
    query = """
        SELECT
            id,
            title,
            "completedPomodoros",
            "userId",
            1 - (embedding <=> $1::vector) AS similarity
        FROM tasks
        WHERE embedding IS NOT NULL
          AND "completedPomodoros" > 0
        ORDER BY embedding <=> $1::vector
        LIMIT $2
    """
    vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
    rows = await pool.fetch(query, vector_str, limit)

    results = []
    for row in rows:
        is_own = row["userId"] == user_id
        raw_sim = float(row["similarity"])
        # Current user's data is more relevant; other users down-weighted
        weighted_sim = raw_sim * (1.0 if is_own else 0.7)
        results.append({
            "id": row["id"],
            "title": row["title"],
            "actual_pomodoros": row["completedPomodoros"],
            "similarity": weighted_sim,
            "is_own": is_own,
        })

    # Re-sort by weighted similarity
    results.sort(key=lambda t: t["similarity"], reverse=True)
    return results


def estimate_from_similar(similar_tasks: list[dict]) -> tuple[int | None, str | None, str]:
    """
    Estimate pomodoros from similar tasks.
    Returns (estimate, reasoning, confidence).
    Returns (None, None, "none") when no relevant data — caller should use LLM fallback.
    """
    if not similar_tasks:
        return None, None, "none"

    # Filter to tasks with weighted similarity > 0.45
    relevant = [t for t in similar_tasks if t["similarity"] > 0.45]

    if not relevant:
        return None, None, "none"

    # Weighted average by similarity score
    total_weight = sum(t["similarity"] for t in relevant)
    weighted_avg = sum(t["actual_pomodoros"] * t["similarity"] for t in relevant) / total_weight
    estimate = max(1, round(weighted_avg))

    # Only reference user's own tasks in the explanation (privacy)
    own_tasks = [t for t in relevant if t.get("is_own", True)]
    other_count = len(relevant) - len(own_tasks)

    if own_tasks:
        task_refs = ", ".join(f'"{t["title"]}" ({t["actual_pomodoros"]} pomo)' for t in own_tasks[:3])
        reasoning = f"Dựa trên {len(own_tasks)} task cá nhân tương tự: {task_refs}."
    else:
        reasoning = f"Dựa trên {other_count} task từ cộng đồng."

    if other_count > 0 and own_tasks:
        reasoning += f" Kết hợp thêm {other_count} task từ người dùng khác."

    reasoning += f" Trung bình có trọng số: {weighted_avg:.1f} → {estimate} pomodoros."

    confidence = "high" if len(relevant) >= 3 else "medium" if len(relevant) >= 1 else "low"

    return estimate, reasoning, confidence


# ── LLM Fallback: Estimate When No RAG Data ─────────────────────────────────────
ESTIMATE_PROMPT = """Bạn là AI ước lượng thời gian cho task.

Hệ thống có 3 chế độ Focus:
1. QUICK_5: Focus nhanh 5 phút — cho việc siêu nhỏ (trả lời tin nhắn, fix typo, quick check)
2. QUICK_25: Focus nhanh 25 phút không nghỉ — cho việc nhỏ hoàn thành trong 1 lần (review PR, viết email dài, debug nhỏ)
3. STANDARD: Pomodoro chuẩn 25 phút + nghỉ 5 phút, lặp nhiều session — cho việc cần tập trung lâu

Hướng dẫn ước lượng:
- Task siêu nhỏ (<5 phút): → QUICK_5, 1 session, 5 phút
- Task nhỏ (5-25 phút): → QUICK_25, 1 session, 25 phút
- Task trung bình (~1-2 giờ): → STANDARD, 2-4 sessions
- Task lớn (~2-4 giờ): → STANDARD, 5-8 sessions
- Tối đa 10 sessions — task lớn hơn nên chia nhỏ

Task cần ước lượng:
Tiêu đề: {title}
{description_section}

Trả về JSON (không markdown, không code block):
{{
    "session_type": "QUICK_5 hoặc QUICK_25 hoặc STANDARD",
    "sessions": <số nguyên>,
    "total_minutes": <số phút>,
    "reasoning": "<giải thích ngắn gọn bằng tiếng Việt>"
}}"""


async def estimate_with_llm(title: str, description: str = "") -> tuple[int, str, dict]:
    """
    Use Gemini LLM to estimate focus plan when RAG has no data.
    Returns (estimated_pomodoros, reasoning, focus_plan_dict).
    """
    desc_section = f"Mô tả: {description}" if description else ""
    prompt = ESTIMATE_PROMPT.format(title=title, description_section=desc_section)

    try:
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        data = json.loads(text)
        session_type = data.get("session_type", "STANDARD")
        sessions = max(1, int(data.get("sessions", 1)))
        total_minutes = int(data.get("total_minutes", sessions * 25))
        reasoning = data.get("reasoning", "AI ước lượng dựa trên độ phức tạp.")

        # Normalize & clamp
        if session_type not in ("QUICK_5", "QUICK_25", "STANDARD"):
            session_type = "STANDARD"
        if session_type.startswith("QUICK"):
            sessions = 1
        sessions = min(sessions, 10)

        plan = {
            "session_type": session_type,
            "sessions": sessions,
            "total_minutes": total_minutes,
        }

        # For backward compat, estimated_pomodoros = sessions for STANDARD, 1 for quick
        est_pomodoros = sessions if session_type == "STANDARD" else 1
        return est_pomodoros, f"🤖 {reasoning}", plan
    except Exception as e:
        logger.warning(f"⚠️ LLM estimate failed: {e}")
        return 3, "Không thể ước lượng — sử dụng mặc định 3 pomodoros.", {
            "session_type": "STANDARD", "sessions": 3, "total_minutes": 75,
        }


# ── Focus Plan Builder ───────────────────────────────────────────────────────────
def build_focus_plan(estimated_pomodoros: int) -> dict:
    """
    Convert a pomodoro count into a FocusPlan recommendation.
    Used when RAG provides the estimate (no LLM plan available).
    """
    if estimated_pomodoros <= 0:
        estimated_pomodoros = 1

    if estimated_pomodoros == 1:
        # Could be quick 25 or standard 1 — recommend quick for simplicity
        return {
            "session_type": "QUICK_25",
            "sessions": 1,
            "total_minutes": 25,
        }
    else:
        total = estimated_pomodoros * 25 + (estimated_pomodoros - 1) * 5
        return {
            "session_type": "STANDARD",
            "sessions": estimated_pomodoros,
            "total_minutes": total,
        }


def make_focus_plan_proto(plan: dict) -> "ai_service_pb2.FocusPlan":
    """Convert a plan dict to a protobuf FocusPlan message."""
    st = plan["session_type"]
    sessions = plan["sessions"]
    total = plan["total_minutes"]

    if st == "QUICK_5":
        label = "⚡ Quick 5 phút"
    elif st == "QUICK_25":
        label = "⚡ Quick 25 phút"
    else:
        hours = total // 60
        mins = total % 60
        time_str = f"{hours}h{mins:02d}" if hours > 0 else f"{mins} phút"
        label = f"🍅 {sessions} Pomodoro{'s' if sessions > 1 else ''} (~{time_str})"

    return ai_service_pb2.FocusPlan(
        session_type=st,
        sessions=sessions,
        total_minutes=total,
        label=label,
    )


# ── Gemini: Task Breakdown ───────────────────────────────────────────────────────
TASK_BREAKDOWN_PROMPT = """Bạn là một AI trợ lý quản lý công việc. Người dùng đưa cho bạn một mục tiêu/dự án.
Hãy phân tích và tạo ra {max_tasks} nhiệm vụ cụ thể, có thể thực hiện được.

Hệ thống có 3 chế độ Focus:
1. QUICK_5: Focus nhanh 5 phút — cho việc siêu nhỏ (trả lời tin nhắn, fix typo, quick check)
2. QUICK_25: Focus nhanh 25 phút không nghỉ — cho việc nhỏ hoàn thành trong 1 lần (review PR, viết email dài, debug nhỏ)
3. STANDARD: Pomodoro chuẩn 25 phút + nghỉ 5 phút, lặp nhiều session — cho việc cần tập trung lâu

Mục tiêu: {goal}
{context_section}

Trả về JSON (không markdown, không code block) theo cấu trúc sau:
{{
    "tasks": [
        {{
            "title": "Tên nhiệm vụ ngắn gọn",
            "description": "Mô tả chi tiết cách thực hiện",
            "priority": "HIGH hoặc MEDIUM hoặc LOW",
            "session_type": "QUICK_5 hoặc QUICK_25 hoặc STANDARD",
            "sessions": 3,
            "total_minutes": 75,
            "tags": ["tag1", "tag2"],
            "order": 1
        }}
    ],
    "summary": "Tóm tắt kế hoạch tổng thể trong 1-2 câu"
}}

Quy tắc:
- Mỗi task phải cụ thể, actionable (có thể bắt tay làm ngay)
- Sắp xếp theo thứ tự ưu tiên thực hiện (order)
- Priority dựa trên mức độ quan trọng VÀ thứ tự phụ thuộc
- Task đầu tiên nên là task nền tảng (setup, research)
- Task cuối nên là task hoàn thiện (testing, review)
- session_type: chọn chế độ phù hợp dựa trên độ phức tạp
- sessions: 1 cho QUICK_5/QUICK_25, N cho STANDARD (tối đa 10)
- total_minutes: tổng phút ước lượng (QUICK_5=5, QUICK_25=25, STANDARD=sessions*25 + breaks)
- tags: 1-3 nhãn ngắn gọn mô tả lĩnh vực/loại task bằng tiếng Việt
- Mô tả bằng tiếng Việt, ngắn gọn nhưng đủ ý
"""


async def generate_tasks_with_gemini(
    goal: str,
    context: str,
    max_tasks: int,
) -> dict:
    """Call Gemini to decompose a goal into tasks."""
    context_section = f"Bối cảnh thêm: {context}" if context else ""

    prompt = TASK_BREAKDOWN_PROMPT.format(
        goal=goal,
        context_section=context_section,
        max_tasks=max_tasks,
    )

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )

    text = response.text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]  # remove first line
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    return json.loads(text)


# ── gRPC Service Implementation ─────────────────────────────────────────────────
class AIServiceServicer(ai_service_pb2_grpc.AIServiceServicer):

    async def GenerateTasks(self, request, context):
        """Generate tasks from goal + estimate pomodoros via RAG (with LLM fallback)."""
        logger.info(f"📋 GenerateTasks: user={request.user_id}, goal='{request.goal[:50]}...'")

        max_tasks = request.max_tasks if request.max_tasks > 0 else 5
        max_tasks = min(max_tasks, 7)

        try:
            # 1. Gemini: decompose goal into tasks (includes LLM estimates + tags)
            result = await generate_tasks_with_gemini(
                goal=request.goal,
                context=request.context,
                max_tasks=max_tasks,
            )

            generated_tasks = []
            for task_data in result.get("tasks", []):
                title = task_data.get("title", "")
                description = task_data.get("description", "")
                tags = task_data.get("tags", [])

                # LLM already provides focus plan from prompt
                llm_session_type = task_data.get("session_type", "STANDARD")
                llm_sessions = task_data.get("sessions", 3)
                llm_total_minutes = task_data.get("total_minutes", llm_sessions * 25)
                llm_plan = {
                    "session_type": llm_session_type if llm_session_type in ("QUICK_5", "QUICK_25", "STANDARD") else "STANDARD",
                    "sessions": max(1, int(llm_sessions)),
                    "total_minutes": int(llm_total_minutes),
                }

                # 2. RAG: try to refine estimate from historical data (cross-user)
                similar = await find_similar_tasks(request.user_id, f"{title} {description}")
                rag_estimate, rag_reasoning, confidence = estimate_from_similar(similar)

                # 3. Use RAG if confident, else keep LLM plan from prompt
                if rag_estimate is not None:
                    estimate = rag_estimate
                    reasoning = rag_reasoning
                    plan = build_focus_plan(rag_estimate)
                else:
                    if llm_plan["session_type"].startswith("QUICK"):
                        estimate = 1
                    else:
                        estimate = min(10, llm_plan["sessions"])
                    plan = llm_plan
                    reasoning = f"🤖 AI ước lượng: {plan['session_type']} × {plan['sessions']} (~{plan['total_minutes']} phút)."

                generated_tasks.append(
                    ai_service_pb2.GeneratedTask(
                        title=title,
                        description=description,
                        priority=task_data.get("priority", "MEDIUM").upper(),
                        estimated_pomodoros=estimate,
                        reasoning=reasoning,
                        order=task_data.get("order", 0),
                        tags=tags,
                        focus_plan=make_focus_plan_proto(plan),
                    )
                )

            return ai_service_pb2.GenerateTasksResponse(
                tasks=generated_tasks,
                summary=result.get("summary", ""),
            )

        except json.JSONDecodeError as e:
            logger.error(f"❌ Gemini returned invalid JSON: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"AI trả về dữ liệu không hợp lệ: {e}")
            return ai_service_pb2.GenerateTasksResponse()

        except Exception as e:
            logger.error(f"❌ GenerateTasks error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ai_service_pb2.GenerateTasksResponse()

    async def EstimateTime(self, request, context):
        """Estimate pomodoros for a single task via RAG + LLM fallback."""
        logger.info(f"⏱️ EstimateTime: user={request.user_id}, title='{request.task_title[:50]}'")

        try:
            text = f"{request.task_title} {request.task_description or ''}"
            similar = await find_similar_tasks(request.user_id, text)
            rag_estimate, rag_reasoning, confidence = estimate_from_similar(similar)

            if rag_estimate is not None:
                # RAG has data — use it
                plan = build_focus_plan(rag_estimate)
                # Only show own user's tasks in response (privacy)
                own_similar = [t for t in similar if t.get("is_own", True)]
                similar_task_protos = [
                    ai_service_pb2.SimilarTask(
                        title=t["title"],
                        actual_pomodoros=t["actual_pomodoros"],
                        similarity=t["similarity"],
                    )
                    for t in own_similar[:3]
                ]
                return ai_service_pb2.EstimateTimeResponse(
                    estimated_pomodoros=rag_estimate,
                    reasoning=rag_reasoning,
                    similar_tasks=similar_task_protos,
                    confidence=confidence,
                    focus_plan=make_focus_plan_proto(plan),
                )
            else:
                # No RAG data — call LLM for intelligent estimation
                llm_estimate, llm_reasoning, llm_plan = await estimate_with_llm(
                    request.task_title, request.task_description or ""
                )
                return ai_service_pb2.EstimateTimeResponse(
                    estimated_pomodoros=llm_estimate,
                    reasoning=llm_reasoning,
                    similar_tasks=[],
                    confidence="medium",
                    focus_plan=make_focus_plan_proto(llm_plan),
                )

        except Exception as e:
            logger.error(f"❌ EstimateTime error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ai_service_pb2.EstimateTimeResponse(
                estimated_pomodoros=3,
                reasoning="Lỗi khi ước lượng — sử dụng giá trị mặc định.",
                confidence="low",
            )

    async def StoreTaskEmbedding(self, request, context):
        """Generate and store embedding for a task."""
        logger.info(f"💾 StoreTaskEmbedding: task={request.task_id}")

        try:
            text = f"{request.title} {request.description or ''}"
            embedding = await get_embedding(text)

            if embedding is None:
                logger.warning(f"⚠️ Skipping embedding storage for task {request.task_id} — embedding unavailable")
                return ai_service_pb2.StoreTaskEmbeddingResponse(success=False)

            pool = await get_db_pool()
            vector_str = "[" + ",".join(str(v) for v in embedding) + "]"

            await pool.execute(
                'UPDATE tasks SET embedding = $1::vector WHERE id = $2 AND "userId" = $3',
                vector_str,
                request.task_id,
                request.user_id,
            )

            logger.info(f"✅ Stored embedding for task {request.task_id}")
            return ai_service_pb2.StoreTaskEmbeddingResponse(success=True)

        except Exception as e:
            logger.error(f"❌ StoreTaskEmbedding error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return ai_service_pb2.StoreTaskEmbeddingResponse(success=False)


# ── Server Bootstrap ─────────────────────────────────────────────────────────────
async def serve():
    server = grpc_aio.server(futures.ThreadPoolExecutor(max_workers=10))
    ai_service_pb2_grpc.add_AIServiceServicer_to_server(AIServiceServicer(), server)
    listen_addr = f"{HOST}:{PORT}"
    server.add_insecure_port(listen_addr)
    await server.start()
    logger.info(f"🚀 AI Service gRPC server listening on {listen_addr}")

    # Eagerly init DB pool
    try:
        await get_db_pool()
    except Exception as e:
        logger.warning(f"⚠️ DB pool init deferred: {e}")

    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())