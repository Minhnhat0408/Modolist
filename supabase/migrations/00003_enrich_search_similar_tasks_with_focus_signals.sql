-- ============================================================================
-- RPC: search_similar_tasks (enriched with focus signals)
-- ============================================================================
-- Keep vector similarity behavior but return extra columns so AI estimation can
-- distinguish QUICK vs STANDARD patterns from historical sessions.

DROP FUNCTION IF EXISTS search_similar_tasks(vector, float8, int, text);

CREATE OR REPLACE FUNCTION search_similar_tasks(
  query_embedding vector,
  match_threshold float8 DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_user_id text DEFAULT NULL
)
RETURNS TABLE(
  id text,
  title text,
  "completedPomodoros" integer,
  "userId" text,
  similarity float,
  "suggestedSessionType" text,
  "suggestedTotalMinutes" integer,
  "avgPlannedDuration" integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t."completedPomodoros",
    t."userId",
    (1 - (t.embedding <=> query_embedding)::float) AS similarity,
    t."suggestedSessionType",
    t."suggestedTotalMinutes",
    fs."avgPlannedDuration"
  FROM tasks t
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(f."plannedDuration"))::integer AS "avgPlannedDuration"
    FROM focus_sessions f
    WHERE f."taskId" = t.id
      AND f.status = 'COMPLETED'
  ) fs ON true
  WHERE t.embedding IS NOT NULL
    AND t."completedPomodoros" > 0
    AND (1 - (t.embedding <=> query_embedding)::float) >= match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_similar_tasks TO authenticated;
