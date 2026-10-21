DO $$ BEGIN
  CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "recurring_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "projectId" UUID,
  "title" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "frequency" "RecurringFrequency" NOT NULL,
  "intervalCount" INTEGER NOT NULL DEFAULT 1,
  "startDate" TIMESTAMP(3) NOT NULL,
  "nextRunDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "dueInDays" INTEGER NOT NULL DEFAULT 14,
  "autoIssue" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "items" JSONB NOT NULL,
  "notes" TEXT,
  "terms" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "generatedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recurring_invoices_companyId_isActive_nextRunDate_idx" ON "recurring_invoices"("companyId", "isActive", "nextRunDate");

ALTER TABLE "recurring_invoices" DROP CONSTRAINT IF EXISTS "recurring_invoices_companyId_fkey";
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_invoices" DROP CONSTRAINT IF EXISTS "recurring_invoices_customerId_fkey";
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurringInvoiceId" UUID;

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_recurringInvoiceId_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "recurring_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
