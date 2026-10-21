import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { dashboardRouter } from '../src/modules/dashboard/dashboard.routes.js';
import * as workDashboardService from '../src/modules/work-dashboard/work-dashboard.service.js';
import { devStore } from '../src/config/dev-store.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { UserStatus } from '@prisma/client';

describe('Dashboard RBAC Scoping & Security', () => {
  const companyId = devStore.company.id;
  const adminUserId = '20000000-0000-0000-0000-000000000001';
  const staffUserId = '20000000-0000-0000-0000-000000000089';
  const financeUserId = '20000000-0000-0000-0000-000000000004';
  const noPermUserId = '20000000-0000-0000-0000-000000000099';
  const workProjectId = '30000000-0000-0000-0000-0000000000f1';

  const app = express();
  app.use(express.json());
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use(errorHandler);

  beforeEach(() => {
    // Ensure test users are in devStore
    if (!devStore.users.some((u) => u.id === staffUserId)) {
      devStore.users.push({
        id: staffUserId,
        companyId,
        name: 'Staff Member',
        email: 'staff@test.com',
        passwordHash: devStore.users[0].passwordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roleIds: ['10000000-0000-0000-0000-000000000003'],
      });
    }

    if (!devStore.users.some((u) => u.id === financeUserId)) {
      devStore.users.push({
        id: financeUserId,
        companyId,
        name: 'Finance User',
        email: 'finance@test.com',
        passwordHash: devStore.users[0].passwordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roleIds: ['10000000-0000-0000-0000-000000000004'],
      });
    }

    if (!devStore.users.some((u) => u.id === noPermUserId)) {
      devStore.users.push({
        id: noPermUserId,
        companyId,
        name: 'No Perm User',
        email: 'noperm@test.com',
        passwordHash: devStore.users[0].passwordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roleIds: [],
      });
    }

    // No sample records ship with the app, so give the staff member some work to be scoped to.
    if (!devStore.projects.some((p) => p.id === workProjectId)) {
      const now = new Date();
      devStore.projects.push({
        id: workProjectId, companyId, customerId: null, name: 'Dashboard scoping project', description: null,
        status: 'ACTIVE', priority: 'MEDIUM', startDate: null, deadline: null, dueDate: null, progress: 0,
        budget: null, currency: 'INR', projectManagerId: null, isArchived: false, createdAt: now, updatedAt: now,
      } as any);
      devStore.projectMembers.push({ projectId: workProjectId, userId: staffUserId, role: 'MEMBER', createdAt: now });
      const taskId = '40000000-0000-0000-0000-0000000000f1';
      devStore.tasks.push({
        id: taskId, projectId: workProjectId, milestoneId: null, creatorId: adminUserId, title: 'Staff task',
        description: null, status: 'TODO', priority: 'MEDIUM', startDate: null, dueDate: null, completedAt: null,
        estimatedHours: null, isArchived: false, createdAt: now, updatedAt: now,
      } as any);
      devStore.taskAssignees.push({ taskId, userId: staffUserId });
      devStore.timeEntries.push({
        id: '50000000-0000-0000-0000-0000000000f1', projectId: workProjectId, taskId, userId: staffUserId,
        description: null, startedAt: now, endedAt: now, minutes: 90, billable: true, createdAt: now, updatedAt: now,
      });
    }

    devStore.auditLogs = [
      {
        id: 'audit-1',
        companyId,
        actorId: adminUserId,
        action: 'system.settings.updated',
        entityType: 'Company',
        entityId: companyId,
        metadata: null,
        createdAt: new Date(),
      },
    ];
  });

  describe('1. Staff Member RBAC scoping on /dashboard/summary', () => {
    it('redacts admin, role, CRM, and finance totals for Staff Member', async () => {
      const token = generateAccessToken({
        userId: staffUserId,
        email: 'staff@test.com',
        companyId,
      });

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const summary = res.body.summary;
      // Staff member does not have users.view, roles.view, invoices.view, audit.view (Admin/Finance only)
      expect(summary.activeUsers).toBeNull();
      expect(summary.totalRoles).toBeNull();
      expect(summary.totalInvoices).toBeNull();
      expect(summary.recentActivity).toEqual([]);

      // CRM totals are redacted too; Staff only gets Projects, Tickets, Notifications
      expect(summary.totalLeads).toBeNull();
      expect(summary.totalCustomers).toBeNull();
      expect(typeof summary.totalProjects).toBe('number');
      expect(typeof summary.openTickets).toBe('number');
      expect(typeof summary.unreadNotifications).toBe('number');
    });

    it('returns full company-wide metrics and audit logs for Administrator', async () => {
      const token = generateAccessToken({
        userId: adminUserId,
        email: 'admin@businesscrm.local',
        companyId,
      });

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const summary = res.body.summary;
      expect(summary.activeUsers).toBeGreaterThan(0);
      expect(summary.totalRoles).toBeGreaterThan(0);
      expect(summary.totalProjects).toBeDefined();
      expect(summary.recentActivity.length).toBeGreaterThan(0);
      expect(summary.recentActivity[0].action).toBe('system.settings.updated');
    });

    it('returns finance and customer totals for Finance User, while redacting admin/role management', async () => {
      const token = generateAccessToken({
        userId: financeUserId,
        email: 'finance@test.com',
        companyId,
      });

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const summary = res.body.summary;
      expect(summary.activeUsers).toBeNull();
      expect(summary.totalRoles).toBeNull();
      expect(summary.totalLeads).toBeNull();
      expect(summary.recentActivity).toEqual([]);

      expect(typeof summary.totalCustomers).toBe('number');
      expect(typeof summary.totalInvoices).toBe('number');
    });

    it('rejects unauthenticated request with 401', async () => {
      const res401 = await request(app).get('/api/v1/dashboard/summary');
      expect(res401.status).toBe(401);
    });

    it('rejects request without dashboard.view permission with 403', async () => {
      const token = generateAccessToken({
        userId: noPermUserId,
        email: 'noperm@test.com',
        companyId,
      });

      const res403 = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res403.status).toBe(403);
    });
  });

  describe('2. Work Dashboard Metrics Scoping', () => {
    it('scopes tasks, projects and hours to current user for Staff Member', async () => {
      const staffMetrics = await workDashboardService.getWorkDashboardMetrics(
        companyId,
        staffUserId,
        ['dashboard.view', 'projects.view', 'tasks.view'],
        ['Staff Member']
      );

      expect(staffMetrics.isScopedToUser).toBe(true);
      // Assigned tasks for staff member
      expect(staffMetrics.openTasksCount).toBeGreaterThan(0);
      expect(staffMetrics.assignedTasksCount).toBe(staffMetrics.openTasksCount);
      // Tracked time is scoped to staff user
      expect(staffMetrics.timeTracking.totalHours).toBeGreaterThan(0);
    });

    it('provides global company-wide project and task metrics for Administrator', async () => {
      const adminMetrics = await workDashboardService.getWorkDashboardMetrics(
        companyId,
        adminUserId,
        ['dashboard.view', 'projects.view', 'tasks.view', 'projects.create'],
        ['Administrator']
      );

      expect(adminMetrics.isScopedToUser).toBe(false);
      expect(adminMetrics.activeProjectsCount).toBeGreaterThanOrEqual(1);
    });
  });
});
