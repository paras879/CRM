import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  companyId: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const SESSION_COOKIE_NAME = 'crm_session';
export const REFRESH_COOKIE_NAME = 'crm_refresh';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string
) {
  const isProduction = env.NODE_ENV === 'production';

  // Access token cookie (short-lived, 15m)
  res.cookie(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: 15 * 60 * 1000, // 15 mins
    path: '/',
  });

  // Refresh token cookie (long-lived, e.g. 7 days)
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE || isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      domain: env.COOKIE_DOMAIN || undefined,
      maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });
  }
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}
