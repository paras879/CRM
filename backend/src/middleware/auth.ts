import { Request, Response, NextFunction } from 'express';
import { prisma, isDatabaseConnected } from '../config/database.js';
import { devStore } from '../config/dev-store.js';
import { verifyAccessToken, SESSION_COOKIE_NAME } from '../utils/tokens.js';
import { AppError } from '../utils/app-error.js';

export interface AuthenticatedUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[SESSION_COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      return next(AppError.unauthorized('Authentication required'));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(AppError.unauthorized('Session expired or invalid'));
    }

    if (!isDatabaseConnected) {
      // In-Memory Dev Store Lookup
      const user = devStore.users.find((u) => u.id === decoded.userId);
      if (!user) {
        return next(AppError.unauthorized('User account not found'));
      }
      if (user.status !== 'ACTIVE') {
        return next(AppError.forbidden('User account is inactive or disabled', 'ACCOUNT_DISABLED'));
      }

      const userRoles = devStore.roles.filter((r) => user.roleIds.includes(r.id));
      const roleNames = userRoles.map((r) => r.name);
      const permSet = new Set<string>();
      userRoles.forEach((r) => r.permissionKeys.forEach((k) => permSet.add(k)));

      req.user = {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        name: user.name,
        status: user.status,
        roles: roleNames,
        permissions: Array.from(permSet),
      };
      return next();
    }

    // PostgreSQL Prisma Lookup
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return next(AppError.unauthorized('User account not found'));
    }

    if (user.status !== 'ACTIVE') {
      return next(AppError.forbidden('User account is inactive or disabled', 'ACCOUNT_DISABLED'));
    }

    const roles: string[] = [];
    const permissionSet = new Set<string>();

    for (const ur of user.userRoles) {
      roles.push(ur.role.name);
      for (const rp of ur.role.permissions) {
        permissionSet.add(rp.permission.key);
      }
    }

    req.user = {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name,
      status: user.status,
      roles,
      permissions: Array.from(permissionSet),
    };

    next();
  } catch (error) {
    next(error);
  }
}
