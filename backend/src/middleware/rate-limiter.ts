import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodically clean up expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    // In test environment, do not block tests
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return next(
        new AppError(429, 'RATE_LIMIT_EXCEEDED', message, {
          retryAfterSeconds: retryAfter,
        })
      );
    }

    record.count += 1;
    next();
  };
}
