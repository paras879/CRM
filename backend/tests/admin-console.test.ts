import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { InvoiceStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { TEST_USER_IDS, makeTicket, seedTestUsers } from './helpers/fixtures.js';
import { usersRouter } from '../src/modules/users/users.routes.js';
import { rolesRouter } from '../src/modules/roles/roles.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { getUserStats } from '../src/modules/users/team.service.js';
import { runAdminAlerts } from '../src/modules/notifications/admin-alerts.service.js';

const companyId = devStore.company.id;
const DAY = 86_400_000;
const ADMIN = TEST_USER_IDS.admin;
const MANAGER = TEST_USER_IDS.manager;
const SUPER_ADMIN = devStore.users.find((u) => u.isSuperAdmin)!.id;
const STAFF_ROLE = '10000000-0000-0000-0000-000000000003';

const app = express();
app.use(express.json());
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/roles', rolesRouter);
app.use(errorHandler);

const auth = (userId: string, email: string) => ({
  Authorization: `Bearer ${generateAccessToken({ userId, email, companyId })}`,
});

function addUser(id: string, overrides: Record<string, unknown> = {}) {
  devStore.users.push({
    id,
    companyId,
    name: `User ${id.slice(-2)}`,
    email: `${id}@test.local`,
    passwordHash: devStore.users[0].passwordHash,
    status: 'ACTIVE',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    roleIds: [STAFF_ROLE],
    managerId: null,
    ...overrides,
  } as any);
}

describe('Administrator console', () => {
  beforeEach(() => {
    seedTestUsers();
    devStore.users = devStore.users.filter((u) => !u.id.startsWith('20000000-0000-0000-0000-0000000000d'));
    devStore.notifications.length = 0;
    devStore.tickets.length = 0;
    devStore.invoices.length = 0;
    devStore.expenses.length = 0;
    devStore.tasks.length = 0;
    devStore.taskAssignees.length = 0;
    devStore.projects.length = 0;
  });

  describe('account health', () => {
    it('counts accounts by status and flags the ones that need a follow-up', async () => {
      const before = await getUserStats(companyId);
      addUser('20000000-0000-0000-0000-0000000000d1', { managerId: MANAGER });
      addUser('20000000-0000-0000-0000-0000000000d2'); // staff with no manager
      addUser('20000000-0000-0000-0000-0000000000d3', { lastLoginAt: null }); // never signed in
      addUser('20000000-0000-0000-0000-0000000000d4', { status: 'INVITED', createdAt: new Date(Date.now() - 10 * DAY) });
      addUser('20000000-0000-0000-0000-0000000000d5', { status: 'DISABLED' });

      const stats = await getUserStats(companyId);
      expect(stats.total - before.total).toBe(5);
      expect(stats.active - before.active).toBe(3);
      expect(stats.invited - before.invited).toBe(1);
      expect(stats.disabled - before.disabled).toBe(1);
      expect(stats.neverSignedIn - before.neverSignedIn).toBe(1);
      expect(stats.staleInvites - before.staleInvites).toBe(1);
      expect(stats.withoutManager - before.withoutManager).toBe(2);
      expect(stats.byRole.find((r) => r.role === 'Staff Member')).toBeTruthy();
    });

    it('serves the stats to administrators only', async () => {
      const asAdmin = await request(app).get('/api/v1/users/stats').set(auth(ADMIN, 'admin@businesscrm.local'));
      expect(asAdmin.status).toBe(200);
      expect(asAdmin.body.data.total).toBeGreaterThan(0);

      const asManager = await request(app).get('/api/v1/users/stats').set(auth(MANAGER, 'manager@test.local'));
      expect(asManager.status).toBe(403);
    });
  });

  describe('daily summary', () => {
    it('sends nothing when nothing needs attention', async () => {
      const result = await runAdminAlerts();
      expect(result.digests).toBe(0);
      expect(devStore.notifications.filter((n) => n.type === 'admin.digest')).toHaveLength(0);
    });

    it('rolls what is late into one notification, once a day', async () => {
      makeTicket({ slaDueAt: new Date(Date.now() - 3 * 3_600_000) });
      makeTicket({ dueDate: new Date(Date.now() - 3_600_000) });
      const now = new Date();
      devStore.invoices.push({
        id: crypto.randomUUID(), companyId, customerId: 'c1', projectId: null, invoiceNumber: 'INV-LATE', title: null,
        status: InvoiceStatus.ISSUED, currency: 'INR', subtotal: 100, discount: 0, discountTotal: 0, taxTotal: 0,
        total: 100, amountPaid: 0, issuedAt: now, dueDate: new Date(Date.now() - 5 * DAY), notes: null, terms: null,
        isArchived: false, createdAt: now, updatedAt: now,
      } as any);

      expect((await runAdminAlerts()).digests).toBe(1);
      const digest = devStore.notifications.filter((n) => n.type === 'admin.digest' && n.userId === ADMIN);
      expect(digest).toHaveLength(1);
      expect(digest[0].title).toBe('Daily summary: 3 items need attention');
      expect(digest[0].body).toContain('1 overdue invoice');
      expect(digest[0].body).toContain('2 tickets past their deadline');

      digest[0].readAt = new Date();
      expect((await runAdminAlerts()).digests).toBe(0);
    });
  });

  describe('role changes', () => {
    it('lets other administrators know when a role is edited, but not the editor', async () => {
      const role = devStore.roles.find((r) => r.name === 'Staff Member')!;
      const res = await request(app)
        .patch(`/api/v1/roles/${role.id}`)
        .set(auth(SUPER_ADMIN, 'superadmin@businesscrm.local'))
        .send({ description: 'Updated description' });
      expect([200, 201]).toContain(res.status);
      await new Promise((r) => setTimeout(r, 20));
      // Roles are managed by a Super Admin, so the other administrator is the one who hears about it.
      expect(devStore.notifications.filter((n) => n.userId === SUPER_ADMIN && n.type === 'role.updated')).toHaveLength(0);
      expect(devStore.notifications.filter((n) => n.userId === ADMIN && n.type === 'role.updated')).toHaveLength(1);
    });
  });
});
