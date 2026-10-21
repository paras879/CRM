-- Super Admins manage access itself; ordinary administrators keep every day-to-day permission.
ALTER TABLE "users" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Existing companies: the earliest-created administrator becomes the Super Admin, so nobody loses access.
UPDATE "users"
SET "isSuperAdmin" = true
WHERE "id" IN (
  SELECT DISTINCT ON (u."companyId") u."id"
  FROM "users" u
  JOIN "user_roles" ur ON ur."userId" = u."id"
  JOIN "roles" r ON r."id" = ur."roleId" AND r."name" = 'Administrator'
  ORDER BY u."companyId", u."createdAt" ASC, u."email" ASC
);
