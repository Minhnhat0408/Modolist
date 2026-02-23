-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "suggestedSessionType" TEXT,
ADD COLUMN     "suggestedSessions" INTEGER,
ADD COLUMN     "suggestedTotalMinutes" INTEGER;
