-- Brings the database in line with schema.prisma for projects, tasks, milestones and time tracking
-- (columns, indexes and foreign keys that earlier migrations never created), and removes the
-- redundant database-side defaults on id/updatedAt columns, which Prisma sets itself.
-- Written for a database without data in those tables: the NOT NULL columns without defaults
-- (time_entries.projectId, and updatedAt on milestones, task_comments and time_entries) need
-- backfilling first if rows already exist.

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_projectId_fkey";

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_taskId_fkey";

-- DropIndex
DROP INDEX "milestones_projectId_idx";

-- DropIndex
DROP INDEX "time_entries_taskId_startedAt_idx";

-- AlterTable
ALTER TABLE "attachments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expense_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_articles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "project_members" ADD COLUMN     "role" TEXT DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "budget" DECIMAL(14,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "projectManagerId" UUID;

-- AlterTable
ALTER TABLE "recurring_invoices" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "task_comments" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "creatorId" UUID,
ADD COLUMN     "estimatedHours" DECIMAL(8,2),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ticket_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ticket_replies" ALTER COLUMN "attachmentUrls" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "attachmentUrls" DROP DEFAULT;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "projectId" UUID NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "taskId" DROP NOT NULL,
ALTER COLUMN "endedAt" DROP NOT NULL,
ALTER COLUMN "minutes" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "milestones_projectId_isArchived_idx" ON "milestones"("projectId", "isArchived");

-- CreateIndex
CREATE INDEX "projects_companyId_isArchived_idx" ON "projects"("companyId", "isArchived");

-- CreateIndex
CREATE INDEX "projects_customerId_idx" ON "projects"("customerId");

-- CreateIndex
CREATE INDEX "tasks_milestoneId_idx" ON "tasks"("milestoneId");

-- CreateIndex
CREATE INDEX "tasks_projectId_isArchived_idx" ON "tasks"("projectId", "isArchived");

-- CreateIndex
CREATE INDEX "time_entries_projectId_startedAt_idx" ON "time_entries"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "time_entries_taskId_idx" ON "time_entries"("taskId");

-- CreateIndex
CREATE INDEX "time_entries_userId_idx" ON "time_entries"("userId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

