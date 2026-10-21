import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { devStore } from '../src/config/dev-store.js';
import { usersRouter } from '../src/modules/users/users.routes.js';
import { rolesRouter } from '../src/modules/roles/roles.routes.js';
import { settingsRouter } from '../src/modules/settings/settings.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { getCurrentUserProfile } from '../src/modules/auth/auth.service.js';

const companyId = devStore.company.id;
const ADMIN_ROLE = '10000000-0000-0000-0000-000000000001';
const STAFF_ROLE = '10000000-0000-0000-0000-000000000003';
const SUPER = devStore.users.find((u) => u.isSuperAdmin)!;
const PLAIN_ADMIN = devStore.users.find((u) => !u.isSuperAdmin && u.roleIds.includes(ADMIN_ROLE))!;
const STAFF = '20000000-0000-0000-0000-0000000000f1';
const OTHER_ADMIN = '20000000-0000-0000-0000-0000000000f2';

const app = express();
app.use(express.json());
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/roles', rolesRouter);
app.use('/api/v1/settings', settingsRouter);
app.use(errorHandler);

const as = (user: { id: string; email: string }) => ({
  Authorization: `Bearer ${generateAccessToken({ userId: user.id, email: user.email, companyId })}`,
});

function addUser(id: string, roleId: string, extra: Record<string, unknown> = {}) {
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
    ...extra,
  } as any);
}

describe('Super Admin versus Admin', () => {
  beforeEach(() => {
    devStore.users = devStore.users.filter((u) => ![STAFF, OTHER_ADMIN].includes(u.id));
    addUser(STAFF, STAFF_ROLE);
    addUser(OTHER_ADMIN, ADMIN_ROLE);
    SUPER.status = 'ACTIVE' as any;
  });

  describe('an ordinary Admin', () => {
    it('cannot touch a Super Admin account', async () => {
      const edit = await request(app).patch(`/api/v1/users/${SUPER.id}`).set(as(PLAIN_ADMIN)).send({ name: 'Hacked' });
      expect(edit.status).toBe(403);
      expect(edit.body.error.code).toBe('SUPER_ADMIN_REQUIRED');

      expect((await request(app).delete(`/api/v1/users/${SUPER.id}`).set(as(PLAIN_ADMIN))).status).toBe(403);
      expect((await request(app).delete(`/api/v1/users/${SUPER.id}?permanent=true`).set(as(PLAIN_ADMIN))).status).toBe(403);
      expect((await request(app).post(`/api/v1/users/${SUPER.id}/password-reset`).set(as(PLAIN_ADMIN))).status).toBe(403);
      expect(devStore.users.find((u) => u.id === SUPER.id)?.name).toBe('Super Admin');
    });

    it('cannot create an Administrator, or promote and demote one', async () => {
      const create = await request(app)
        .post('/api/v1/users')
        .set(as(PLAIN_ADMIN))
        .send({ name: 'New Boss', email: 'boss@example.com', password: 'Passw0rdX1', roleIds: [ADMIN_ROLE] });
      expect(create.status).toBe(403);

      const promote = await request(app).patch(`/api/v1/users/${STAFF}`).set(as(PLAIN_ADMIN)).send({ roleIds: [ADMIN_ROLE] });
      expect(promote.status).toBe(403);

      const demote = await request(app).patch(`/api/v1/users/${OTHER_ADMIN}`).set(as(PLAIN_ADMIN)).send({ roleIds: [STAFF_ROLE] });
      expect(demote.status).toBe(403);
    });

    it('still manages ordinary people', async () => {
      const create = await request(app)
        .post('/api/v1/users')
        .set(as(PLAIN_ADMIN))
        .send({ name: 'New Hire', email: 'hire@example.com', password: 'Passw0rdX1', roleIds: [STAFF_ROLE] });
      expect(create.status).toBe(201);
      const edit = await request(app).patch(`/api/v1/users/${STAFF}`).set(as(PLAIN_ADMIN)).send({ name: 'Renamed' });
      expect(edit.status).toBe(200);
      const remove = await request(app).delete(`/api/v1/users/${STAFF}?permanent=true`).set(as(PLAIN_ADMIN));
      expect(remove.status).toBe(200);
    });

    it('cannot change roles or currencies, but can still read them', async () => {
      const role = devStore.roles.find((r) => r.name === 'Staff Member')!;
      expect((await request(app).patch(`/api/v1/roles/${role.id}`).set(as(PLAIN_ADMIN)).send({ description: 'x' })).status).toBe(403);
      expect((await request(app).post('/api/v1/roles').set(as(PLAIN_ADMIN)).send({ name: 'Intruder', permissionKeys: [] })).status).toBe(403);
      expect((await request(app).delete(`/api/v1/roles/${role.id}`).set(as(PLAIN_ADMIN))).status).toBe(403);
      expect((await request(app).post('/api/v1/settings/currencies').set(as(PLAIN_ADMIN)).send({ code: 'USD', symbol: '$' })).status).toBe(403);
      expect((await request(app).get('/api/v1/roles').set(as(PLAIN_ADMIN))).status).toBe(200);
      expect((await request(app).get('/api/v1/settings/currencies').set(as(PLAIN_ADMIN))).status).toBe(200);
    });
  });

  describe('a Super Admin', () => {
    it('can hand out the Administrator role and change roles and currencies', async () => {
      const promote = await request(app).patch(`/api/v1/users/${STAFF}`).set(as(SUPER)).send({ roleIds: [ADMIN_ROLE] });
      expect(promote.status).toBe(200);
      const role = devStore.roles.find((r) => r.name === 'Staff Member')!;
      expect((await request(app).patch(`/api/v1/roles/${role.id}`).set(as(SUPER)).send({ description: 'Updated' })).status).toBe(200);
      expect((await request(app).post('/api/v1/settings/currencies').set(as(SUPER)).send({ code: 'USD', symbol: '$' })).status).toBe(201);
    });

    it('cannot change their own role', async () => {
      const res = await request(app).patch(`/api/v1/users/${SUPER.id}`).set(as(SUPER)).send({ roleIds: [STAFF_ROLE] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/own role/i);
    });

    it('can still edit their own name', async () => {
      const res = await request(app).patch(`/api/v1/users/${SUPER.id}`).set(as(SUPER)).send({ name: 'Super Admin' });
      expect(res.status).toBe(200);
    });
  });

  describe('when a company has no active Super Admin', () => {
    it('lets its Administrators keep full control so nobody is locked out', async () => {
      SUPER.status = 'DISABLED' as any;
      const role = devStore.roles.find((r) => r.name === 'Staff Member')!;
      expect((await request(app).patch(`/api/v1/roles/${role.id}`).set(as(PLAIN_ADMIN)).send({ description: 'Still allowed' })).status).toBe(200);
      const profile: any = await getCurrentUserProfile(PLAIN_ADMIN.id);
      expect(profile.isSuperAdmin).toBe(false);
      expect(profile.canManageAccess).toBe(true);
    });
  });

  describe('what the app tells the browser', () => {
    it('separates the badge from the permission to manage access', async () => {
      const superProfile: any = await getCurrentUserProfile(SUPER.id);
      expect(superProfile).toMatchObject({ isSuperAdmin: true, canManageAccess: true });
      const adminProfile: any = await getCurrentUserProfile(PLAIN_ADMIN.id);
      expect(adminProfile).toMatchObject({ isSuperAdmin: false, canManageAccess: false });
      const staffProfile: any = await getCurrentUserProfile(STAFF);
      expect(staffProfile).toMatchObject({ isSuperAdmin: false, canManageAccess: false });
    });

    it('lists who is a Super Admin', async () => {
      const res = await request(app).get('/api/v1/users?limit=100').set(as(SUPER));
      expect(res.body.data.find((u: any) => u.id === SUPER.id).isSuperAdmin).toBe(true);
      expect(res.body.data.find((u: any) => u.id === PLAIN_ADMIN.id).isSuperAdmin).toBe(false);
    });
  });
});
