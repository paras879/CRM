/**
 * Runs one migration file against DATABASE_URL inside a transaction that is always rolled back, then prints
 * a query of your choice. Nothing is saved. Use it to see what a migration would do to live data first.
 *
 *   DATABASE_URL=... npx tsx scripts/dry-run-migration.mts prisma/migrations/<name>/migration.sql "select ..."
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const [file, query] = process.argv.slice(2);
if (!file) {
  console.error('Usage: dry-run-migration.mts <migration.sql> [query to run afterwards]');
  process.exit(1);
}

const prisma = new PrismaClient();
const ROLLBACK = 'dry run: rolled back';

const statements = fs
  .readFileSync(file, 'utf8')
  .split(/;\s*\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s.replace(/--.*$/gm, '').trim().length > 0);

try {
  await prisma.$transaction(
    async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }
      console.log(`Applied ${statements.length} statement(s) inside the transaction.`);
      if (query) console.log(JSON.stringify(await tx.$queryRawUnsafe(query), null, 2));
      throw new Error(ROLLBACK);
    },
    { timeout: 60_000 }
  );
} catch (error) {
  if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  console.log('Rolled back: the database was not changed.');
} finally {
  await prisma.$disconnect();
}
