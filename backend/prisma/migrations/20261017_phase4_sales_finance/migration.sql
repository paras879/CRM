-- Phase 4: Sales & Finance Management Migration

-- 1. Alter Enums
ALTER TYPE "ProposalStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "EstimateStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "EstimateStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'EXPIRING';

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';

-- 2. Proposals & Items
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "contactId" UUID;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "terms" TEXT;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "convertedToEstimateId" UUID;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "convertedToInvoiceId" UUID;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);

ALTER TABLE "proposal_items" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "proposal_items" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "proposals_projectId_idx" ON "proposals"("projectId");
CREATE INDEX IF NOT EXISTS "proposals_customerId_idx" ON "proposals"("customerId");

ALTER TABLE "proposals" DROP CONSTRAINT IF EXISTS "proposals_contactId_fkey";
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposals" DROP CONSTRAINT IF EXISTS "proposals_projectId_fkey";
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Estimates & Items
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "contactId" UUID;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3);
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "terms" TEXT;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "convertedToInvoiceId" UUID;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);

ALTER TABLE "estimate_items" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "estimate_items" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "estimates_projectId_idx" ON "estimates"("projectId");
CREATE INDEX IF NOT EXISTS "estimates_customerId_idx" ON "estimates"("customerId");

ALTER TABLE "estimates" DROP CONSTRAINT IF EXISTS "estimates_contactId_fkey";
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "estimates" DROP CONSTRAINT IF EXISTS "estimates_projectId_fkey";
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Contracts
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contractType" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "terms" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "contracts_projectId_idx" ON "contracts"("projectId");
CREATE INDEX IF NOT EXISTS "contracts_customerId_idx" ON "contracts"("customerId");

ALTER TABLE "contracts" DROP CONSTRAINT IF EXISTS "contracts_projectId_fkey";
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Invoices & Items
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "terms" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "invoices_projectId_idx" ON "invoices"("projectId");
CREATE INDEX IF NOT EXISTS "invoices_customerId_idx" ON "invoices"("customerId");

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_projectId_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "isReversed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

-- 7. Expense Categories
CREATE TABLE IF NOT EXISTS "expense_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_companyId_name_key" ON "expense_categories"("companyId", "name");

ALTER TABLE "expense_categories" DROP CONSTRAINT IF EXISTS "expense_categories_companyId_fkey";
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Expenses
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "categoryId" UUID;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "vendor" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "customerId" UUID;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod" DEFAULT 'OTHER';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "createdById" UUID;

CREATE INDEX IF NOT EXISTS "expenses_companyId_category_idx" ON "expenses"("companyId", "category");
CREATE INDEX IF NOT EXISTS "expenses_customerId_idx" ON "expenses"("customerId");
CREATE INDEX IF NOT EXISTS "expenses_projectId_idx" ON "expenses"("projectId");

ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_categoryId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_customerId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_projectId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_createdById_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
