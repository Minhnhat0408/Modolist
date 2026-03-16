-- AlterEnum
ALTER TYPE "RecurrenceRule" ADD VALUE 'MONTHLY';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurrenceDayOfMonth" INTEGER,
ADD COLUMN     "recurrenceDaysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
