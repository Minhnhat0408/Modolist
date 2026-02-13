-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "tasks_userId_status_order_idx" ON "tasks"("userId", "status", "order");
