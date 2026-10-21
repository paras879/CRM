import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
} from '../../utils/tokens.js';
import { generateCsrfToken, setCsrfCookie } from '../../middleware/csrf.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await authService.loginUser(req.body, userAgent, ipAddress);

    // Set secure HTTP-only cookies
    setAuthCookies(res, result.accessToken, result.refreshToken);

    // Generate and set CSRF cookie
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    res.json({
      message: 'Authentication successful',
      user: result.user,
      accessToken: result.accessToken, // Provided for API/mobile clients as well
      csrfToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token cookie or body property is required',
        },
      });
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await authService.rotateRefreshToken(refreshToken, userAgent, ipAddress);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (req.user?.id) {
      await authService.logoutUser(req.user.id, refreshToken);
    }

    clearAuthCookies(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getCurrentUserProfile(req.user!.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function getCsrf(req: Request, res: Response) {
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({ csrfToken });
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.resetPasswordWithToken(req.body);
    clearAuthCookies(res);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
