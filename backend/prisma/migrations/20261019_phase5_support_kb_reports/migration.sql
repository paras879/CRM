-- Phase 5: Support Desk, Knowledge Base, Notifications & Reports Migration

-- 1. Create ArticleStatus enum if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArticleStatus') THEN
    CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

-- 2. Ticket Categories Table
CREATE TABLE IF NOT EXISTS "ticket_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ticket_categories_companyId_name_key" ON "ticket_categories"("companyId", "name");
ALTER TABLE "ticket_categories" DROP CONSTRAINT IF EXISTS "ticket_categories_companyId_fkey";
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Enhance Tickets Table
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "contactId" UUID;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "categoryId" UUID;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "slaDueAt" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "attachmentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "tickets_companyId_isArchived_idx" ON "tickets"("companyId", "isArchived");
CREATE INDEX IF NOT EXISTS "tickets_customerId_idx" ON "tickets"("customerId");
CREATE INDEX IF NOT EXISTS "tickets_assignedTo_idx" ON "tickets"("assignedTo");

ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_contactId_fkey";
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_categoryId_fkey";
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Enhance Ticket Replies Table
ALTER TABLE "ticket_replies" ADD COLUMN IF NOT EXISTS "attachmentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ticket_replies" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ticket_replies" DROP CONSTRAINT IF EXISTS "ticket_replies_ticketId_fkey";
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Knowledge Base Tables
CREATE TABLE IF NOT EXISTS "kb_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kb_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kb_categories_companyId_slug_key" ON "kb_categories"("companyId", "slug");
ALTER TABLE "kb_categories" DROP CONSTRAINT IF EXISTS "kb_categories_companyId_fkey";
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "kb_articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "categoryId" UUID,
  "authorId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT,
  "body" TEXT NOT NULL,
  "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
  "views" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kb_articles_companyId_slug_key" ON "kb_articles"("companyId", "slug");
CREATE INDEX IF NOT EXISTS "kb_articles_companyId_status_idx" ON "kb_articles"("companyId", "status");
CREATE INDEX IF NOT EXISTS "kb_articles_categoryId_idx" ON "kb_articles"("categoryId");

ALTER TABLE "kb_articles" DROP CONSTRAINT IF EXISTS "kb_articles_companyId_fkey";
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kb_articles" DROP CONSTRAINT IF EXISTS "kb_articles_categoryId_fkey";
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kb_articles" DROP CONSTRAINT IF EXISTS "kb_articles_authorId_fkey";
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "kb_tags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kb_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kb_tags_companyId_slug_key" ON "kb_tags"("companyId", "slug");
ALTER TABLE "kb_tags" DROP CONSTRAINT IF EXISTS "kb_tags_companyId_fkey";
ALTER TABLE "kb_tags" ADD CONSTRAINT "kb_tags_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "kb_article_tags" (
  "articleId" UUID NOT NULL,
  "tagId" UUID NOT NULL,

  CONSTRAINT "kb_article_tags_pkey" PRIMARY KEY ("articleId", "tagId")
);

ALTER TABLE "kb_article_tags" DROP CONSTRAINT IF EXISTS "kb_article_tags_articleId_fkey";
ALTER TABLE "kb_article_tags" ADD CONSTRAINT "kb_article_tags_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_article_tags" DROP CONSTRAINT IF EXISTS "kb_article_tags_tagId_fkey";
ALTER TABLE "kb_article_tags" ADD CONSTRAINT "kb_article_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "kb_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Notifications Table Enhancements
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "companyId" UUID;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "link" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
