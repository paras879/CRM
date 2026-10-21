import crypto from 'node:crypto';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { env } from '../../config/env.js';
import { hashPassword } from '../../utils/password.js';
import { generateRandomToken, hashToken } from '../../utils/tokens.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';

export const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Issues a one-time password reset link for a staff user. Until email delivery is configured,
 * an administrator hands this link to the user. The raw token is returned once and only its
 * hash is stored.
 */
export async function issuePasswordReset(companyId: string, actorId: string, userId: string) {
  const user = !isDatabaseConnected
    ? devStore.users.find((u) => u.id === userId && u.companyId === companyId)
    : await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw AppError.notFound('User not found');

  const token = generateRandomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  if (!isDatabaseConnected) {
    devStore.passwordResetTokens.forEach((t) => {
      if (t.userId === userId && !t.used) {
        t.used = true;
        t.usedAt = new Date();
      }
    });
    devStore.passwordResetTokens.push({
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      used: false,
      usedAt: null,
      expiresAt,
      createdAt: new Date(),
    });
  } else {
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId, used: false },
        data: { used: true, usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'PASSWORD_RESET_ISSUED',
    entityType: 'User',
    entityId: userId,
    metadata: { expiresAt },
  });

  const origin = env.APP_ORIGIN.replace(/\/$/, '');
  return {
    token,
    resetUrl: `${origin}/reset-password?token=${token}`,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const invalid = () =>
    new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired. Ask your administrator for a new one.');
  const now = new Date();

  const passwordHash = await hashPassword(newPassword);

  if (!isDatabaseConnected) {
    const record = devStore.passwordResetTokens.find((t) => t.tokenHash === tokenHash);
    if (!record || record.used || record.expiresAt <= now) throw invalid();
    const user = devStore.users.find((u) => u.id === record.userId);
    if (!user) throw invalid();

    record.used = true;
    record.usedAt = now;
    user.passwordHash = passwordHash;
    user.updatedAt = now;
    devStore.refreshTokens
      .filter((t) => t.userId === user.id && !t.revoked)
      .forEach((t) => {
        t.revoked = true;
        t.revokedAt = now;
      });

    await recordAuditLog({ companyId: user.companyId, actorId: user.id, action: 'PASSWORD_RESET_COMPLETED', entityType: 'User', entityId: user.id });
    return { message: 'Password has been successfully reset.' };
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record || record.used || record.expiresAt <= now) throw invalid();

  // Claim the token atomically so a link cannot be used twice concurrently.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, used: false },
    data: { used: true, usedAt: now },
  });
  if (claimed.count === 0) throw invalid();

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revoked: false },
      data: { revoked: true, revokedAt: now },
    }),
  ]);

  await recordAuditLog({
    companyId: record.user.companyId,
    actorId: record.userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: record.userId,
  });
  return { message: 'Password has been successfully reset.' };
}
