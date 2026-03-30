-- ============================================================================
-- Supabase Migration: Initial Schema (migrated from Prisma)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODAY', 'DONE');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "RecurrenceRule" AS ENUM ('NONE', 'DAILY', 'WEEKDAY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "FocusSessionStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED');
CREATE TYPE "AIInteractionType" AS ENUM ('TASK_SUGGESTION', 'TASK_BREAKDOWN', 'MOTIVATION', 'PRODUCTIVITY_TIP');
CREATE TYPE "BadgeCategory" AS ENUM ('FOCUS', 'CONSISTENCY', 'PRODUCTIVITY', 'SOCIAL', 'MILESTONE');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users (maps to Supabase Auth users via auth.users.id)
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    name TEXT,
    bio TEXT,
    timezone TEXT DEFAULT 'UTC',
    "totalFocusTime" INTEGER DEFAULT 0 NOT NULL,
    "currentStreak" INTEGER DEFAULT 0 NOT NULL,
    "longestStreak" INTEGER DEFAULT 0 NOT NULL,
    password TEXT,
    image TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_users_email ON users (email);

-- Tasks
-- Spotify Accounts (OAuth tokens for Spotify integration)
CREATE TABLE spotify_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "providerAccountId" TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE("userId"),
    UNIQUE("providerAccountId")
);

CREATE INDEX idx_spotify_accounts_user ON spotify_accounts("userId");

CREATE TABLE tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT,
    status "TaskStatus" DEFAULT 'BACKLOG' NOT NULL,
    priority "TaskPriority" DEFAULT 'MEDIUM' NOT NULL,
    "completedPomodoros" INTEGER DEFAULT 0 NOT NULL,
    "focusTotalSessions" INTEGER,
    "order" INTEGER DEFAULT 0 NOT NULL,
    tags TEXT[] DEFAULT '{}',
    "dueDate" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "estimatedPomodoros" INTEGER,
    "suggestedSessionType" TEXT,
    "suggestedSessions" INTEGER,
    "suggestedTotalMinutes" INTEGER,
    embedding vector(3072),
    "isArchived" BOOLEAN DEFAULT false NOT NULL,
    recurrence "RecurrenceRule" DEFAULT 'NONE' NOT NULL,
    "recurrenceDaysOfWeek" INTEGER[] DEFAULT '{}',
    "recurrenceDayOfMonth" INTEGER,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_tasks_user_status ON tasks ("userId", status);
CREATE INDEX idx_tasks_user_archived ON tasks ("userId", "isArchived");
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_user_status_order ON tasks ("userId", status, "order");

-- Focus Sessions
CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    duration INTEGER,
    "plannedDuration" INTEGER DEFAULT 1500 NOT NULL,
    "elapsedTime" INTEGER DEFAULT 0 NOT NULL,
    status "FocusSessionStatus" DEFAULT 'IN_PROGRESS' NOT NULL,
    "taskId" TEXT REFERENCES tasks(id),
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "breakDuration" INTEGER,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_focus_sessions_user_started ON focus_sessions ("userId", "startedAt");
CREATE INDEX idx_focus_sessions_user_status ON focus_sessions ("userId", status);
CREATE INDEX idx_focus_sessions_started ON focus_sessions ("startedAt");

-- Daily Stats
CREATE TABLE daily_stats (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    "totalFocusTime" INTEGER DEFAULT 0 NOT NULL,
    "completedPomodoros" INTEGER DEFAULT 0 NOT NULL,
    "completedTasks" INTEGER DEFAULT 0 NOT NULL,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE ("userId", date)
);
CREATE INDEX idx_daily_stats_date ON daily_stats (date);
CREATE INDEX idx_daily_stats_date_focus ON daily_stats (date, "totalFocusTime");

-- AI Interactions
CREATE TABLE ai_interactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type "AIInteractionType" NOT NULL,
    "userPrompt" TEXT,
    context JSONB,
    "aiResponse" TEXT NOT NULL,
    "wasHelpful" BOOLEAN,
    model TEXT DEFAULT 'gemini-2.5-flash' NOT NULL,
    "tokensUsed" INTEGER,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_ai_interactions_user_created ON ai_interactions ("userId", "createdAt");
CREATE INDEX idx_ai_interactions_type ON ai_interactions (type);

-- Badges
CREATE TABLE badges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category "BadgeCategory" NOT NULL,
    criteria JSONB NOT NULL,
    rarity TEXT DEFAULT 'common' NOT NULL,
    points INTEGER DEFAULT 10 NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User Badges
CREATE TABLE user_badges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "badgeId" TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    "unlockedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE ("userId", "badgeId")
);
CREATE INDEX idx_user_badges_user ON user_badges ("userId");

-- Posts
CREATE TABLE posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content TEXT NOT NULL,
    "isPublic" BOOLEAN DEFAULT true NOT NULL,
    "viewCount" INTEGER DEFAULT 0 NOT NULL,
    "likeCount" INTEGER DEFAULT 0 NOT NULL,
    "taskId" TEXT REFERENCES tasks(id),
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_posts_user ON posts ("userId");
CREATE INDEX idx_posts_created ON posts ("createdAt");
CREATE INDEX idx_posts_public_created ON posts ("isPublic", "createdAt");

-- Post Images
CREATE TABLE post_images (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    format TEXT,
    "postId" TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_post_images_post ON post_images ("postId");

-- ============================================================================
-- AUTO-UPDATE updatedAt TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_focus_sessions_updated_at BEFORE UPDATE ON focus_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_daily_stats_updated_at BEFORE UPDATE ON daily_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify_accounts ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid()::text);

-- Tasks: full CRUD on own tasks; read all embeddings for RAG
CREATE POLICY "Users can CRUD own tasks" ON tasks
    FOR ALL USING ("userId" = auth.uid()::text);

-- Focus Sessions: full CRUD on own sessions
CREATE POLICY "Users can CRUD own sessions" ON focus_sessions
    FOR ALL USING ("userId" = auth.uid()::text);

-- Daily Stats: full CRUD on own stats
CREATE POLICY "Users can CRUD own stats" ON daily_stats
    FOR ALL USING ("userId" = auth.uid()::text);

-- AI Interactions: CRUD on own
CREATE POLICY "Users can CRUD own AI interactions" ON ai_interactions
    FOR ALL USING ("userId" = auth.uid()::text);

-- User Badges: CRUD own
CREATE POLICY "Users can view own badges" ON user_badges
    FOR SELECT USING ("userId" = auth.uid()::text);

-- Posts: read public, CRUD own
CREATE POLICY "Users can read public posts" ON posts
    FOR SELECT USING ("isPublic" = true OR "userId" = auth.uid()::text);
CREATE POLICY "Users can CRUD own posts" ON posts
    FOR ALL USING ("userId" = auth.uid()::text);

-- Post Images: tied to post ownership
CREATE POLICY "Users can view post images" ON post_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_images."postId"
            AND ("isPublic" = true OR "userId" = auth.uid()::text)
        )
    );
CREATE POLICY "Users can manage own post images" ON post_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM posts
            WHERE posts.id = post_images."postId"
            AND "userId" = auth.uid()::text
        )
    );

-- Spotify Accounts: CRUD own
CREATE POLICY "Users can CRUD own spotify accounts" ON spotify_accounts
    FOR ALL USING ("userId" = auth.uid()::text);

-- ============================================================================
-- SERVICE ROLE FUNCTIONS (for API routes that bypass RLS)
-- ============================================================================

-- Increment task order in a column (shift tasks up by 1 to make room at top)
CREATE OR REPLACE FUNCTION increment_task_order(p_user_id text, p_status "TaskStatus")
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE tasks
    SET "order" = "order" + 1
    WHERE "userId" = p_user_id AND status = p_status;
END;
$$;

-- Increment task completedPomodoros by 1
CREATE OR REPLACE FUNCTION increment_task_pomodoros(p_task_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE tasks SET "completedPomodoros" = "completedPomodoros" + 1 WHERE id = p_task_id;
END;
$$;

-- Increment user totalFocusTime
CREATE OR REPLACE FUNCTION increment_user_focus_time(p_user_id text, p_duration int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE users SET "totalFocusTime" = "totalFocusTime" + p_duration WHERE id = p_user_id;
END;
$$;

-- Upsert daily stats when session completes
CREATE OR REPLACE FUNCTION upsert_daily_stats_on_complete(p_user_id text, p_date date, p_duration int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO daily_stats (id, date, "totalFocusTime", "completedPomodoros", "completedTasks", "userId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, p_date, p_duration, 1, 0, p_user_id, now(), now())
    ON CONFLICT ("userId", date) DO UPDATE SET
        "totalFocusTime" = daily_stats."totalFocusTime" + p_duration,
        "completedPomodoros" = daily_stats."completedPomodoros" + 1,
        "updatedAt" = now();
END;
$$;

-- Vector similarity search for RAG (needs to read ALL users' embeddings)
CREATE OR REPLACE FUNCTION search_similar_tasks(
    query_embedding vector(3072),
    match_threshold float DEFAULT 0.70,
    match_count int DEFAULT 10,
    p_user_id text DEFAULT NULL
)
RETURNS TABLE (
    id text,
    title text,
    "completedPomodoros" int,
    "userId" text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t."completedPomodoros",
        t."userId",
        (1 - (t.embedding <=> query_embedding))::float AS similarity
    FROM tasks t
    WHERE t.embedding IS NOT NULL
      AND t."completedPomodoros" > 0
      AND (1 - (t.embedding <=> query_embedding)) >= match_threshold
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- CRON JOBS (pg_cron) — replaces BullMQ
-- ============================================================================

-- Midnight reset: move unfinished TODAY → BACKLOG, archive old DONE
CREATE OR REPLACE FUNCTION cron_midnight_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    moved int;
    archived int;
BEGIN
    -- Move unfinished TODAY tasks back to BACKLOG
    UPDATE tasks
    SET status = 'BACKLOG', "updatedAt" = now()
    WHERE status = 'TODAY' AND "completedAt" IS NULL AND "isArchived" = false;
    GET DIAGNOSTICS moved = ROW_COUNT;

    -- Archive DONE tasks completed before today
    UPDATE tasks
    SET "isArchived" = true, "updatedAt" = now()
    WHERE status = 'DONE' AND "isArchived" = false
      AND "completedAt" < date_trunc('day', now());
    GET DIAGNOSTICS archived = ROW_COUNT;

    RAISE LOG 'cron_midnight_reset: moved=% archived=%', moved, archived;
END;
$$;

-- Stale sessions: mark >2h old IN_PROGRESS/PAUSED as INTERRUPTED
CREATE OR REPLACE FUNCTION cron_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cnt int;
BEGIN
    UPDATE focus_sessions
    SET status = 'INTERRUPTED', "endedAt" = now(), "updatedAt" = now()
    WHERE status IN ('IN_PROGRESS', 'PAUSED')
      AND GREATEST("startedAt", "updatedAt") < now() - interval '2 hours';
    GET DIAGNOSTICS cnt = ROW_COUNT;

    IF cnt > 0 THEN
        RAISE LOG 'cron_stale_sessions: cleaned up % stale sessions', cnt;
    END IF;
END;
$$;

-- Daily stats reconciliation: count completed tasks for yesterday
CREATE OR REPLACE FUNCTION cron_daily_stats_reconcile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    yesterday date := (now() - interval '1 day')::date;
    rec record;
BEGIN
    FOR rec IN
        SELECT "userId", COUNT(*)::int AS cnt
        FROM tasks
        WHERE "completedAt" >= yesterday
          AND "completedAt" < yesterday + interval '1 day'
        GROUP BY "userId"
    LOOP
        INSERT INTO daily_stats (id, date, "totalFocusTime", "completedPomodoros", "completedTasks", "userId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, yesterday, 0, 0, rec.cnt, rec."userId", now(), now())
        ON CONFLICT ("userId", date)
        DO UPDATE SET "completedTasks" = rec.cnt, "updatedAt" = now();
    END LOOP;
END;
$$;

-- Streak update: increment or reset currentStreak/longestStreak
CREATE OR REPLACE FUNCTION cron_streak_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    yesterday date := (now() - interval '1 day')::date;
    rec record;
BEGIN
    FOR rec IN SELECT id, "currentStreak", "longestStreak" FROM users
    LOOP
        IF EXISTS (
            SELECT 1 FROM daily_stats
            WHERE "userId" = rec.id AND date = yesterday AND "completedPomodoros" > 0
        ) THEN
            UPDATE users SET
                "currentStreak" = rec."currentStreak" + 1,
                "longestStreak" = GREATEST(rec."longestStreak", rec."currentStreak" + 1),
                "updatedAt" = now()
            WHERE id = rec.id;
        ELSIF rec."currentStreak" > 0 THEN
            UPDATE users SET "currentStreak" = 0, "updatedAt" = now()
            WHERE id = rec.id;
        END IF;
    END LOOP;
END;
$$;

-- Schedule cron jobs (Asia/Tokyo timezone for midnight jobs)
SELECT cron.schedule('midnight-reset', '0 0 * * *', $$SELECT cron_midnight_reset()$$);
SELECT cron.schedule('stale-sessions', '*/10 * * * *', $$SELECT cron_stale_sessions()$$);
SELECT cron.schedule('daily-stats-reconcile', '5 0 * * *', $$SELECT cron_daily_stats_reconcile()$$);
SELECT cron.schedule('streak-update', '10 0 * * *', $$SELECT cron_streak_update()$$);

-- ============================================================================
-- HELPER: Create user on Supabase Auth signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO users (id, email, name, image, "createdAt", "updatedAt")
    VALUES (
        NEW.id::text,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        image = COALESCE(EXCLUDED.image, users.image),
        "updatedAt" = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Also handle updates (e.g. user changes Google profile pic)
CREATE OR REPLACE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
