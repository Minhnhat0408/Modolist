-- ============================================================================
-- RPC: search_similar_tasks
-- ============================================================================
-- Vector similarity search for RAG feature
-- Finds similar tasks by embedding vector using cosine distance

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
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t."completedPomodoros",
    t."userId",
    (1 - (t.embedding <=> query_embedding)::float) AS similarity
  FROM tasks t
  WHERE t.embedding IS NOT NULL
    AND t."completedPomodoros" > 0
    AND (1 - (t.embedding <=> query_embedding)::float) >= match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION search_similar_tasks TO authenticated;
