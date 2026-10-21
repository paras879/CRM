ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerId" UUID;

CREATE INDEX IF NOT EXISTS "users_managerId_idx" ON "users"("managerId");

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
