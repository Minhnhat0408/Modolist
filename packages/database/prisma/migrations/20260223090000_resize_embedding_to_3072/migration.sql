-- Resize embedding column from vector(768) to vector(3072)
-- Required by migration from text-embedding-004 (768 dim) to gemini-embedding-001 (3072 dim)
ALTER TABLE "tasks" ALTER COLUMN "embedding" TYPE vector(3072);
