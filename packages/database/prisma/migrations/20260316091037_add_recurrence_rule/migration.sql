-- CreateEnum
CREATE TYPE "RecurrenceRule" AS ENUM ('NONE', 'DAILY', 'WEEKDAY', 'WEEKLY');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurrence" "RecurrenceRule" NOT NULL DEFAULT 'NONE';
