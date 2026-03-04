import json

import ai_service_pb2

from config import client, GEMINI_MODEL, logger

# ── Focus Plan Builder ─────────────────────────────────────────────────────────
def build_focus_plan(estimated_pomodoros: int) -> dict:
    """Convert a pomodoro count into a FocusPlan recommendation dict."""
    if estimated_pomodoros <= 0:
        estimated_pomodoros = 1

    if estimated_pomodoros == 1:
        return {"session_type": "QUICK_25", "sessions": 1, "total_minutes": 25}
    else:
        total = estimated_pomodoros * 25 + (estimated_pomodoros - 1) * 5
        return {"session_type": "STANDARD", "sessions": estimated_pomodoros, "total_minutes": total}


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


# ── RAG + LLM Blending ─────────────────────────────────────────────────────────
# Numeric weight per confidence label used by blend_estimates.
_CONFIDENCE_NUM: dict[str, float] = {
    "none":   0.0,
    "low":    0.20,
    "medium": 0.60,
    "high":   0.80,
}


def blend_estimates(
    rag_avg: int | None,
    rag_confidence: str,
    llm_pomodoros: int,
    llm_plan: dict,
    rag_reasoning: str | None,
    llm_reasoning: str,
) -> tuple[int, str, dict, str]:
    """
    Blend RAG and LLM estimates based on RAG confidence label.
    Returns (final_pomodoros, final_reasoning, final_plan, confidence_label).
    High/medium confidence → trust RAG directly.
    Low confidence → weighted blend toward LLM.
    """
    rag_conf_num = (
        _CONFIDENCE_NUM.get(rag_confidence, 0.0)
        if isinstance(rag_confidence, str)
        else float(rag_confidence)
    )

    if rag_avg is None or rag_conf_num < 0.10:
        return llm_pomodoros, llm_reasoning, llm_plan, "medium"

    if rag_conf_num >= 0.50:
        # Medium/high confidence: trust RAG directly
        final_estimate = max(1, rag_avg)
        final_plan = build_focus_plan(final_estimate)
        confidence_label = "high" if rag_conf_num >= 0.75 else "medium"
        reasoning_parts = []
        if rag_reasoning:
            reasoning_parts.append(f"📊 RAG ({int(rag_conf_num * 100)}%): {rag_reasoning}")
        reasoning_parts.append(f"→ {final_estimate} pomodoros.")
        return final_estimate, " ".join(reasoning_parts), final_plan, confidence_label

    # Low confidence — blend: final = rag_conf_num * RAG + (1 - rag_conf_num) * LLM
    blended = rag_conf_num * rag_avg + (1 - rag_conf_num) * llm_pomodoros
    final_estimate = max(1, round(blended))

    if llm_plan["session_type"] == "STANDARD":
        final_plan = {
            "session_type": "STANDARD",
            "sessions": final_estimate,
            "total_minutes": final_estimate * 25 + max(0, final_estimate - 1) * 5,
        }
    else:
        final_plan = llm_plan if final_estimate == 1 else build_focus_plan(final_estimate)

    reasoning_parts = []
    if rag_reasoning:
        reasoning_parts.append(f"📊 RAG ({int(rag_conf_num * 100)}%): {rag_reasoning}")
    reasoning_parts.append(f"🤖 AI: {llm_reasoning}")
    reasoning_parts.append(f"→ Kết hợp: {final_estimate} pomodoros.")

    return final_estimate, " ".join(reasoning_parts), final_plan, "medium"


# ── LLM Estimation ─────────────────────────────────────────────────────────────
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

        plan = {"session_type": session_type, "sessions": sessions, "total_minutes": total_minutes}
        est_pomodoros = sessions if session_type == "STANDARD" else 1
        return est_pomodoros, f"🤖 {reasoning}", plan

    except Exception as e:
        logger.warning(f"⚠️ LLM estimate failed: {e}")
        return 3, "Không thể ước lượng — sử dụng mặc định 3 pomodoros.", {
            "session_type": "STANDARD", "sessions": 3, "total_minutes": 75,
        }
