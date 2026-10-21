import { UserStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { env } from '../../config/env.js';
import { verifyPassword, hashPassword } from '../../utils/password.js';
import {
  generateAccessToken,
  generateRandomToken,
  hashToken,
} from '../../utils/tokens.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { canManageAccess } from '../users/super-admin.js';
import { LoginInput, ResetPasswordInput } from './auth.schema.js';
import * as passwordReset from './password-reset.service.js';

export async function loginUser(
  data: LoginInput,
  userAgent?: string,
  ipAddress?: string
) {
  if (!isDatabaseConnected) {
    // In-Memory Dev Store Login
    const user = devStore.users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (!user) {
      // Same work and same message as a wrong password, so the response does not reveal which accounts exist.
      await verifyPassword(data.password, '$2a$12$e868d49a37e5c5a04597d2e4f01476d0d938590d96dcf55f75607b399d81d2f8');
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!(await verifyPassword(data.password, user.passwordHash))) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw AppError.forbidden('Your account is inactive or disabled', 'ACCOUNT_DISABLED');
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
    });

    const rawRefreshToken = generateRandomToken(48);
    const tokenHash = hashToken(rawRefreshToken);
    devStore.refreshTokens.push({
      id: generateRandomToken(16),
      userId: user.id,
      tokenHash,
      revoked: false,
      revokedAt: null,
      replacedByTokenHash: null,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    user.lastLoginAt = new Date();

    const userRoles = devStore.roles.filter((r) => user.roleIds.includes(r.id));
    const roleNames = userRoles.map((r) => r.name);
    const permSet = new Set<string>();
    userRoles.forEach((r) => r.permissionKeys.forEach((k) => permSet.add(k)));

    await recordAuditLog({
      companyId: user.companyId,
      actorId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { ipAddress, userAgent, mode: 'dev-in-memory' },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId,
        companyName: devStore.company.name,
        roles: roleNames,
        permissions: Array.from(permSet),
      },
    };
  }

  // PostgreSQL Prisma Login
  const user = await prisma.user.findFirst({
    where: { email: data.email },
    include: {
      company: true,
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
    await verifyPassword('dummy_password_for_timing', '$2a$12$e868d49a37e5c5a04597d2e4f01476d0d938590d96dcf55f75607b399d81d2f8');
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isValidPassword = await verifyPassword(data.password, user.passwordHash);
  if (!isValidPassword) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw AppError.forbidden(
      'Your account is inactive or disabled. Contact your administrator.',
      'ACCOUNT_DISABLED'
    );
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    companyId: user.companyId,
  });

  const rawRefreshToken = generateRandomToken(48);
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const roles: string[] = [];
  const permissionSet = new Set<string>();

  for (const ur of user.userRoles) {
    roles.push(ur.role.name);
    for (const rp of ur.role.permissions) {
      permissionSet.add(rp.permission.key);
    }
  }

  await recordAuditLog({
    companyId: user.companyId,
    actorId: user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
    metadata: { ipAddress, userAgent },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      companyName: user.company.name,
      roles,
      permissions: Array.from(permissionSet),
    },
  };
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
  userAgent?: string,
  ipAddress?: string
) {
  const tokenHash = hashToken(rawRefreshToken);

  if (!isDatabaseConnected) {
    const existing = devStore.refreshTokens.find((t) => t.tokenHash === tokenHash);
    if (!existing || existing.revoked || new Date() > existing.expiresAt) {
      throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    existing.revoked = true;
    existing.revokedAt = new Date();

    const user = devStore.users.find((u) => u.id === existing.userId)!;
    const newRaw = generateRandomToken(48);
    const newHash = hashToken(newRaw);
    existing.replacedByTokenHash = newHash;

    devStore.refreshTokens.push({
      id: generateRandomToken(16),
      userId: user.id,
      tokenHash: newHash,
      revoked: false,
      revokedAt: null,
      replacedByTokenHash: null,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
    });

    return { accessToken: newAccessToken, refreshToken: newRaw };
  }

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
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
      },
    },
  });

  if (!existingToken) {
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (existingToken.revoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: existingToken.userId },
      data: { revoked: true, revokedAt: new Date() },
    });
    throw AppError.forbidden(
      'Session violation detected. Please sign in again.',
      'TOKEN_REUSE_DETECTED'
    );
  }

  if (new Date() > existingToken.expiresAt) {
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revoked: true, revokedAt: new Date() },
    });
    throw AppError.unauthorized('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
  }

  if (existingToken.user.status !== UserStatus.ACTIVE) {
    throw AppError.forbidden('User account is inactive', 'ACCOUNT_DISABLED');
  }

  const newRawRefreshToken = generateRandomToken(48);
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: {
        revoked: true,
        revokedAt: new Date(),
        replacedByTokenHash: newTokenHash,
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existingToken.userId,
        tokenHash: newTokenHash,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  const newAccessToken = generateAccessToken({
    userId: existingToken.user.id,
    email: existingToken.user.email,
    companyId: existingToken.user.companyId,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
}

export async function logoutUser(userId: string, rawRefreshToken?: string) {
  if (!isDatabaseConnected) {
    devStore.refreshTokens
      .filter((t) => t.userId === userId)
      .forEach((t) => {
        t.revoked = true;
        t.revokedAt = new Date();
      });
    return;
  }

  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, userId },
      data: { revoked: true, revokedAt: new Date() },
    });
  } else {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }
}

export async function getCurrentUserProfile(userId: string) {
  if (!isDatabaseConnected) {
    const user = devStore.users.find((u) => u.id === userId);
    if (!user) throw AppError.notFound('User not found');

    const userRoles = devStore.roles.filter((r) => user.roleIds.includes(r.id));
    const roleNames = userRoles.map((r) => r.name);
    const permSet = new Set<string>();
    userRoles.forEach((r) => r.permissionKeys.forEach((k) => permSet.add(k)));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      company: {
        id: devStore.company.id,
        name: devStore.company.name,
        email: devStore.company.email,
        currency: devStore.company.currency,
      },
      roles: roleNames,
      permissions: Array.from(permSet),
      isSuperAdmin: !!user.isSuperAdmin,
      canManageAccess: await canManageAccess({ companyId: user.companyId, roles: roleNames, isSuperAdmin: !!user.isSuperAdmin }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          email: true,
          currency: true,
        },
      },
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
    throw AppError.notFound('User not found');
  }

  const roles: string[] = [];
  const permissionSet = new Set<string>();

  for (const ur of user.userRoles) {
    roles.push(ur.role.name);
    for (const rp of ur.role.permissions) {
      permissionSet.add(rp.permission.key);
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    company: user.company,
    roles,
    permissions: Array.from(permissionSet),
    isSuperAdmin: user.isSuperAdmin,
    canManageAccess: await canManageAccess({ companyId: user.companyId, roles, isSuperAdmin: user.isSuperAdmin }),
  };
}

// Reset links are issued by an administrator (see password-reset.service.ts) until email
// delivery is configured, so a self-service request intentionally issues nothing and reveals
// nothing about whether the account exists.
export async function requestPasswordReset(_email: string) {
  return {
    message: 'If an account exists for this email, contact your administrator to receive a password reset link.',
  };
}

export async function resetPasswordWithToken(data: ResetPasswordInput) {
  return passwordReset.resetPasswordWithToken(data.token, data.newPassword);
}
