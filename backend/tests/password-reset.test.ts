import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { devStore } from '../src/config/dev-store.js';
import * as passwordReset from '../src/modules/auth/password-reset.service.js';
import { verifyPassword } from '../src/utils/password.js';
import { seedTestUsers } from './helpers/fixtures.js';

seedTestUsers();
describe('Password reset (administrator-issued links)', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;
  const targetId = devStore.users[1].id;

  it('issues a one-time link and stores only the token hash', async () => {
    const issued = await passwordReset.issuePasswordReset(companyId, adminId, targetId);
    expect(issued.resetUrl).toContain(`/reset-password?token=${issued.token}`);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(devStore.passwordResetTokens.some((t) => t.tokenHash === issued.token)).toBe(false);
  });

  it('resets the password, revokes sessions and rejects reuse', async () => {
    const issued = await passwordReset.issuePasswordReset(companyId, adminId, targetId);
    devStore.refreshTokens.push({
      id: 'rt-test',
      userId: targetId,
      tokenHash: 'x',
      revoked: false,
      revokedAt: null,
      replacedByTokenHash: null,
      userAgent: null,
      ipAddress: null,
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
    });

    await passwordReset.resetPasswordWithToken(issued.token, 'NewSecret123');
    const user = devStore.users.find((u) => u.id === targetId)!;
    expect(await verifyPassword('NewSecret123', user.passwordHash)).toBe(true);
    expect(devStore.refreshTokens.find((t) => t.id === 'rt-test')!.revoked).toBe(true);

    await expect(passwordReset.resetPasswordWithToken(issued.token, 'Another123Pass')).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
    });
  });

  it('invalidates an earlier link when a new one is issued', async () => {
    const first = await passwordReset.issuePasswordReset(companyId, adminId, targetId);
    await passwordReset.issuePasswordReset(companyId, adminId, targetId);
    await expect(passwordReset.resetPasswordWithToken(first.token, 'NewSecret123')).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
    });
  });

  it('rejects expired and unknown tokens', async () => {
    const issued = await passwordReset.issuePasswordReset(companyId, adminId, targetId);
    devStore.passwordResetTokens.forEach((t) => (t.expiresAt = new Date(Date.now() - 1000)));
    await expect(passwordReset.resetPasswordWithToken(issued.token, 'NewSecret123')).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
    });
    await expect(passwordReset.resetPasswordWithToken('a'.repeat(64), 'NewSecret123')).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
    });
  });

  it('does not issue links for users outside the company', async () => {
    await expect(
      passwordReset.issuePasswordReset('00000000-0000-0000-0000-00000000ffff', adminId, targetId)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('serves the public reset endpoint over HTTP and enforces password rules', async () => {
    const issued = await passwordReset.issuePasswordReset(companyId, adminId, targetId);
    const app = createApp();

    const weak = await request(app).post('/api/v1/auth/reset-password').send({ token: issued.token, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const ok = await request(app).post('/api/v1/auth/reset-password').send({ token: issued.token, newPassword: 'Fresh1234Pass' });
    expect(ok.status).toBe(200);

    const again = await request(app).post('/api/v1/auth/reset-password').send({ token: issued.token, newPassword: 'Fresh1234Pass' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('forgot-password never reveals whether an account exists', async () => {
    const app = createApp();
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: devStore.users[0].email });
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@nowhere.test' });
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });
});
