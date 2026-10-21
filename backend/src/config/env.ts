import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.string().default('7').transform((val) => parseInt(val, 10)),
  CSRF_SECRET: z.string().min(16, 'CSRF_SECRET must be at least 16 characters long'),
  APP_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.string().default('10').transform((val) => parseInt(val, 10)),
  COOKIE_SECURE: z.string().default('false').transform((val) => val === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Environment configuration error. Please check your .env file.');
}

export const env = parsed.data;
