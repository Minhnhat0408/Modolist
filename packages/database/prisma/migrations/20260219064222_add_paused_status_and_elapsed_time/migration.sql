/*
  Warnings:

  - Added the required column `updatedAt` to the `focus_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "FocusSessionStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "focus_sessions" ADD COLUMN     "elapsedTime" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
