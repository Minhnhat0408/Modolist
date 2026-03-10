from database import get_embedding, get_db_pool
from config import logger


async def find_similar_tasks(
    user_id: str,
    text: str,
    limit: int = 10,
) -> list[dict]:
    """
    Cosine similarity search on ALL users' completed tasks via pgvector.
    Current user's tasks get full weight (1.0), other users' tasks get 0.7.
    Returns empty list if embedding is unavailable.
    """
    embedding = await get_embedding(text)
    if embedding is None:
        return []

    pool = await get_db_pool()

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
        weighted_sim = raw_sim * (1.0 if is_own else 0.7)
        results.append({
            "id": row["id"],
            "title": row["title"],
            "actual_pomodoros": row["completedPomodoros"],
            "similarity": weighted_sim,
            "is_own": is_own,
        })

    results.sort(key=lambda t: t["similarity"], reverse=True)
    return results


def estimate_from_similar(
    similar_tasks: list[dict],
) -> tuple[int | None, str | None, str]:
    """
    Estimate pomodoros from similar tasks using weighted average.
    Returns (rounded_estimate, reasoning, confidence_label).
    confidence_label is one of: "none" | "low" | "medium" | "high".
    Returns (None, None, "none") when no relevant data found.
    """
    if not similar_tasks:
        return None, None, "none"

    relevant = [t for t in similar_tasks if t["similarity"] >= 0.70]

    if not relevant:
        return None, None, "none"

    total_weight = sum(t["similarity"] for t in relevant)
    weighted_avg = sum(t["actual_pomodoros"] * t["similarity"] for t in relevant) / total_weight
    estimate = max(1, round(weighted_avg))

    own_tasks = [t for t in relevant if t.get("is_own", True)]
    other_count = len(relevant) - len(own_tasks)

    if own_tasks:
        task_refs = ", ".join(
            f'"{t["title"]}" ({t["actual_pomodoros"]} pomo)' for t in own_tasks[:3]
        )
        reasoning = f"Dựa trên {len(own_tasks)} task cá nhân tương tự: {task_refs}."
    else:
        reasoning = f"Dựa trên {other_count} task từ cộng đồng."

    if other_count > 0 and own_tasks:
        reasoning += f" Kết hợp thêm {other_count} task từ người dùng khác."

    avg_similarity = total_weight / len(relevant)
    quantity_factor = min(1.0, len(relevant) / 7.0)
    similarity_factor = max(0.0, (avg_similarity - 0.70) / 0.25)
    confidence_score = min(1.0, quantity_factor * 0.5 + similarity_factor * 0.5)

    if len(relevant) <= 1 and avg_similarity < 0.65:
        confidence_score = min(confidence_score, 0.20)

    if confidence_score >= 0.60:
        confidence_label = "high"
    elif confidence_score >= 0.30:
        confidence_label = "medium"
    else:
        confidence_label = "low"

    return estimate, reasoning, confidence_label
