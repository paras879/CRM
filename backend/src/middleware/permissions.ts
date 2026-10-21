import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    // Administrators bypass granular permission blocks
    if (req.user.roles.includes('Administrator')) {
      return next();
    }

    const hasAnyPermission = permissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAnyPermission) {
      return next(
        AppError.forbidden(
          `Access denied. Requires one of: [${permissions.join(', ')}]`,
          'INSUFFICIENT_PERMISSIONS',
          { required: permissions }
        )
      );
    }

    next();
  };
}

export function requireAllPermissions(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (req.user.roles.includes('Administrator')) {
      return next();
    }

    const hasAll = permissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasAll) {
      return next(
        AppError.forbidden(
          `Access denied. Requires all of: [${permissions.join(', ')}]`,
          'INSUFFICIENT_PERMISSIONS',
          { required: permissions }
        )
      );
    }

    next();
  };
}

export function requireRole(...roleNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (req.user.roles.includes('Administrator')) {
      return next();
    }

    const hasRole = roleNames.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      return next(
        AppError.forbidden(
          `Access denied. Requires one of the following roles: [${roleNames.join(', ')}]`,
          'INSUFFICIENT_ROLE',
          { required: roleNames }
        )
      );
    }

    next();
  };
}
