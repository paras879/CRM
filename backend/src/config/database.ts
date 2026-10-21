import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaInstance: PrismaClient | undefined;
}

export const prisma =
  global.prismaInstance ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaInstance = prisma;
}

export let isDatabaseConnected = false;

export async function connectDatabase() {
  try {
    await prisma.$connect();
    isDatabaseConnected = true;
    console.log('✅ Connected to PostgreSQL database via Prisma');
  } catch (error) {
    isDatabaseConnected = false;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PostgreSQL is not reachable at DATABASE_URL. The in-memory Dev Store is disabled in production.');
    }
    console.warn('⚠️ Warning: PostgreSQL database is not reachable at DATABASE_URL.');
    console.warn('⚡ Operating with active In-Memory Dev Store fallback so all UI workflows, authentication, and screens can be explored.');
  }
}
