import json

from config import client, GEMINI_MODEL, logger
from rag import find_similar_tasks, estimate_from_similar
from estimation import blend_estimates


TASK_BREAKDOWN_PROMPT = """Bạn là một AI trợ lý quản lý công việc. Người dùng đưa cho bạn một mục tiêu/dự án.
Hãy phân tích và tạo ra {max_tasks} nhiệm vụ cụ thể, có thể thực hiện được.

Hệ thống có 3 chế độ Focus:
1. QUICK_5: Focus nhanh 5 phút — cho việc siêu nhỏ (trả lời tin nhắn, fix typo, quick check)
2. QUICK_15: Focus nhanh 15 phút không nghỉ — cho việc nhỏ hoàn thành trong 1 lần (review PR, viết email dài, debug nhỏ)
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
            "session_type": "QUICK_5 hoặc QUICK_15 hoặc STANDARD",
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
- sessions: 1 cho QUICK_5/QUICK_15, N cho STANDARD (tối đa 10)
- total_minutes: tổng phút ước lượng (QUICK_5=5, QUICK_15=15, STANDARD=sessions*25 + breaks)
- tags: 1-3 nhãn ngắn gọn mô tả lĩnh vực/loại task bằng tiếng Việt
- Mô tả bằng tiếng Việt, ngắn gọn nhưng đủ ý
"""


async def generate_tasks_with_gemini(
    goal: str,
    context: str,
    max_tasks: int,
) -> dict:
    """Call Gemini to decompose a goal into a task list with focus plans."""
    context_section = f"Bối cảnh thêm: {context}" if context else ""
    prompt = TASK_BREAKDOWN_PROMPT.format(
        goal=goal,
        context_section=context_section,
        max_tasks=max_tasks,
    )

    response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    return json.loads(text)


async def build_generated_tasks(
    user_id: str,
    raw_tasks: list[dict],
    proto_module,
    make_focus_plan_proto_fn,
) -> list:
    """
    Enrich raw Gemini task dicts with RAG-refined estimates and produce proto objects.

    Accepts the proto module and make_focus_plan_proto as arguments to avoid
    the circular import that would arise from importing ai_service_pb2 here.
    """
    generated_tasks = []
    for task_data in raw_tasks:
        title = task_data.get("title", "")
        description = task_data.get("description", "")
        tags = task_data.get("tags", [])

        # LLM already provides focus plan from prompt
        llm_session_type = task_data.get("session_type", "STANDARD")
        llm_sessions = task_data.get("sessions", 3)
        llm_total_minutes = task_data.get("total_minutes", llm_sessions * 25)
        llm_plan = {
            "session_type": llm_session_type if llm_session_type in ("QUICK_5", "QUICK_15", "STANDARD") else "STANDARD",
            "sessions": max(1, int(llm_sessions)),
            "total_minutes": int(llm_total_minutes),
        }

        # RAG: try to refine estimate from historical data
        similar = await find_similar_tasks(user_id, f"{title} {description}")
        rag_avg, rag_reasoning, rag_confidence = estimate_from_similar(similar)

        # Blend RAG + LLM based on confidence
        llm_pomo = 1 if llm_plan["session_type"].startswith("QUICK") else min(10, llm_plan["sessions"])
        llm_r = f"🤖 AI ước lượng: {llm_plan['session_type']} × {llm_plan['sessions']} (~{llm_plan['total_minutes']} phút)."

        estimate, reasoning, plan, _ = blend_estimates(
            rag_avg, rag_confidence, llm_pomo, llm_plan, rag_reasoning, llm_r,
        )

        generated_tasks.append(
            proto_module.GeneratedTask(
                title=title,
                description=description,
                priority=task_data.get("priority", "MEDIUM").upper(),
                estimated_pomodoros=estimate,
                reasoning=reasoning,
                order=task_data.get("order", 0),
                tags=tags,
                focus_plan=make_focus_plan_proto_fn(plan),
            )
        )

    return generated_tasks
