import asyncpg
import httpx

from config import GEMINI_API_KEY, EMBEDDING_MODEL, DATABASE_URL, logger

_db_pool: asyncpg.Pool | None = None


async def get_db_pool() -> asyncpg.Pool:
    global _db_pool
    if _db_pool is None:
        _db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        logger.info("✅ Database pool created")
    return _db_pool


async def get_embedding(text: str) -> list[float] | None:
    """
    Generate embedding via REST embedContent endpoint (not batchEmbedContents).
    The google-genai SDK always calls batchEmbedContents which is unsupported
    for gemini-embedding-001, so we hit the REST API directly.
    Returns None on any error so callers can fall back gracefully.
    """
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{EMBEDDING_MODEL}:embedContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {"parts": [{"text": text}]},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["embedding"]["values"]
    except Exception as e:
        logger.warning(f"⚠️ Embedding failed (will skip RAG): {e}")
        return None
