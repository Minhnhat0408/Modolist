-- Add focus session tracking fields to tasks table
ALTER TABLE "tasks" ADD COLUMN "focusTotalSessions" INTEGER;
ALTER TABLE "tasks" ADD COLUMN "focusCompletedSessions" INTEGER NOT NULL DEFAULT 0;
