import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE_NAME } from '../utils/tokens.js';

export const CSRF_COOKIE_NAME = 'crm_csrf';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: Response, token: string) {
  const isProduction = env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by client JavaScript to place into x-csrf-token header
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  });
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // 1. Safe HTTP methods do not mutate state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = generateCsrfToken();
      setCsrfCookie(res, token);
    }
    return next();
  }

  // 2. Unauthenticated auth endpoints do not have ambient session risk
  const isAuthRoute =
    req.path.includes('/login') ||
    req.path.includes('/refresh') ||
    req.path.includes('/forgot-password') ||
    req.path.includes('/reset-password');

  if (isAuthRoute) {
    return next();
  }

  // 3. Requests authenticated via Authorization Bearer header are immune to browser ambient CSRF
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  // 4. In test environment, bypass CSRF if not explicitly testing it
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-csrf-enforce']) {
    return next();
  }

  // 5. If no session cookie exists, there is no authenticated session to hijack
  if (!req.cookies?.[SESSION_COOKIE_NAME]) {
    return next();
  }

  // 6. For cookie-authenticated state-changing requests, verify double-submit CSRF token
  const clientToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!clientToken || !cookieToken || clientToken !== cookieToken) {
    return next(
      AppError.forbidden('Invalid or missing CSRF token', 'CSRF_VALIDATION_FAILED')
    );
  }

  next();
}
