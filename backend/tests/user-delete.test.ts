import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { devStore } from '../src/config/dev-store.js';
import { TEST_USER_IDS, seedTestUsers } from './helpers/fixtures.js';
import { usersRouter } from '../src/modules/users/users.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { deleteUserPermanently } from '../src/modules/users/users.service.js';

const companyId = devStore.company.id;
const ADMIN = TEST_USER_IDS.admin;
const MANAGER = TEST_USER_IDS.manager;
const STAFF = '20000000-0000-0000-0000-0000000000e1';
const STAFF_ROLE = '10000000-0000-0000-0000-000000000003';
const ADMIN_ROLE = '10000000-0000-0000-0000-000000000001';

const app = express();
app.use(express.json());
app.use('/api/v1/users', usersRouter);
app.use(errorHandler);

const auth = (userId: string, email: string) => ({
  Authorization: `Bearer ${generateAccessToken({ userId, email, companyId })}`,
});

function addUser(id: string, roleId: string, overrides: Record<string, unknown> = {}) {
  devStore.users.push({
    id,
    companyId,
    name: `User ${id.slice(-2)}`,
    email: `${id}@test.local`,
    passwordHash: devStore.users[0].passwordHash,
    status: 'ACTIVE',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleIds: [roleId],
    managerId: null,
    ...overrides,
  } as any);
}

describe('Permanently deleting a user', () => {
  beforeEach(() => {
    seedTestUsers();
    devStore.users = devStore.users.filter((u) => u.id !== STAFF);
    addUser(STAFF, STAFF_ROLE, { managerId: MANAGER });
  });

  it('removes the account and detaches anyone who reported to it', async () => {
    const report = '20000000-0000-0000-0000-0000000000e2';
    addUser(report, STAFF_ROLE, { managerId: STAFF });

    await deleteUserPermanently(companyId, ADMIN, STAFF);

    expect(devStore.users.some((u) => u.id === STAFF)).toBe(false);
    expect(devStore.users.find((u) => u.id === report)?.managerId).toBeNull();
    expect(devStore.auditLogs.some((l) => l.action === 'USER_DELETED' && l.entityId === STAFF)).toBe(true);
    devStore.users = devStore.users.filter((u) => u.id !== report);
  });

  it('refuses to delete your own account', async () => {
    await expect(deleteUserPermanently(companyId, ADMIN, ADMIN)).rejects.toThrow(/own account/i);
  });

  it('keeps at least one active administrator', async () => {
    const onlyAdmins = devStore.users.filter((u) => u.roleIds.includes(ADMIN_ROLE) && u.status === 'ACTIVE');
    const keep = onlyAdmins.find((u) => u.id !== ADMIN) ?? onlyAdmins[0];
    // Leave exactly one active administrator, then try to delete it as someone else.
    onlyAdmins.filter((u) => u.id !== keep.id).forEach((u) => (u.status = 'DISABLED' as any));
    await expect(deleteUserPermanently(companyId, STAFF, keep.id)).rejects.toThrow(/last active administrator/i);
    onlyAdmins.forEach((u) => (u.status = 'ACTIVE' as any));
  });

  it('is only available through the delete route with permanent=true, and needs users.delete', async () => {
    const asManager = await request(app)
      .delete(`/api/v1/users/${STAFF}?permanent=true`)
      .set(auth(MANAGER, 'manager@test.local'));
    expect(asManager.status).toBe(403);
    expect(devStore.users.some((u) => u.id === STAFF)).toBe(true);

    const asAdmin = await request(app)
      .delete(`/api/v1/users/${STAFF}?permanent=true`)
      .set(auth(ADMIN, 'admin@businesscrm.local'));
    expect(asAdmin.status).toBe(200);
    expect(devStore.users.some((u) => u.id === STAFF)).toBe(false);
  });

  it('still just deactivates when permanent is not requested', async () => {
    const res = await request(app).delete(`/api/v1/users/${STAFF}`).set(auth(ADMIN, 'admin@businesscrm.local'));
    expect(res.status).toBe(200);
    const user = devStore.users.find((u) => u.id === STAFF);
    expect(user?.status).toBe('DISABLED');
  });
});
