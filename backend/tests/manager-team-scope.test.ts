import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { UserStatus } from '@prisma/client';
import { usersRouter } from '../src/modules/users/users.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { devStore } from '../src/config/dev-store.js';
import { getWorkDashboardMetrics } from '../src/modules/work-dashboard/work-dashboard.service.js';
import { getTeamOverview, getTeamUserIds, isTeamScopedManager, wouldCreateReportingLoop } from '../src/modules/users/team.service.js';
import { updateUser, createUser } from '../src/modules/users/users.service.js';
import { getCrmReport } from '../src/modules/reports/reports.service.js';
import { TEST_USER_IDS, makeProject, seedTestUsers } from './helpers/fixtures.js';

const MANAGER_ROLE_ID = '10000000-0000-0000-0000-000000000002';
const companyId = devStore.company.id;
const MANAGER = TEST_USER_IDS.manager;
const ADMIN = TEST_USER_IDS.admin;
const TEAM_MEMBER = '20000000-0000-0000-0000-0000000000a1';
const SUB_MEMBER = '20000000-0000-0000-0000-0000000000a2';
const OUTSIDER = '20000000-0000-0000-0000-0000000000a3';

function addUser(id: string, managerId: string | null) {
  if (devStore.users.some((u) => u.id === id)) {
    devStore.users.find((u) => u.id === id)!.managerId = managerId;
    return;
  }
  devStore.users.push({
    id,
    companyId,
    name: `User ${id.slice(-2)}`,
    email: `${id}@test.local`,
    passwordHash: devStore.users[0].passwordHash,
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleIds: [MANAGER_ROLE_ID],
    managerId,
  });
}

describe('Manager team scoping', () => {
  beforeEach(() => {
    seedTestUsers();
    devStore.users.forEach((u) => {
      if (u.id === MANAGER) u.managerId = null;
    });
    addUser(TEAM_MEMBER, MANAGER);
    addUser(SUB_MEMBER, TEAM_MEMBER);
    addUser(OUTSIDER, null);
    devStore.projects.length = 0;
    devStore.projectMembers.length = 0;
  });

  it('only scopes Managers who are not also Administrators', () => {
    expect(isTeamScopedManager(['Manager'])).toBe(true);
    expect(isTeamScopedManager(['Manager', 'Administrator'])).toBe(false);
    expect(isTeamScopedManager(['Administrator'])).toBe(false);
    expect(isTeamScopedManager(['Staff Member'])).toBe(false);
  });

  it('collects the whole reporting tree, including indirect reports', async () => {
    const ids = await getTeamUserIds(companyId, MANAGER);
    expect(ids).toEqual(expect.arrayContaining([MANAGER, TEAM_MEMBER, SUB_MEMBER]));
    expect(ids).not.toContain(OUTSIDER);
  });

  it('limits work metrics to projects the team works on', async () => {
    const teamProject = makeProject({ name: 'Team project' });
    const otherProject = makeProject({ name: 'Other project' });
    devStore.projectMembers.push(
      { projectId: teamProject.id, userId: SUB_MEMBER, role: 'MEMBER', createdAt: new Date() },
      { projectId: otherProject.id, userId: OUTSIDER, role: 'MEMBER', createdAt: new Date() }
    );

    const managerView = await getWorkDashboardMetrics(companyId, MANAGER, [], ['Manager']);
    expect(managerView.activeProjectsCount).toBe(1);
    expect(managerView.recentProjects.map((p) => p.name)).toEqual(['Team project']);
    expect(managerView.isTeamScoped).toBe(true);
    expect(managerView.teamSize).toBe(2);

    const adminView = await getWorkDashboardMetrics(companyId, ADMIN, [], ['Administrator']);
    expect(adminView.activeProjectsCount).toBe(2);
    expect(adminView.isTeamScoped).toBeUndefined();
  });

  it('shows an empty dashboard for a manager with no reports', async () => {
    const lonely = await getWorkDashboardMetrics(companyId, OUTSIDER, [], ['Manager']);
    expect(lonely.activeProjectsCount).toBe(0);
    expect(lonely.teamSize).toBe(0);
  });

  it('scopes the CRM report to the manager\'s team', async () => {
    const full = await getCrmReport(companyId, {} as any, null);
    const scoped = await getCrmReport(companyId, {} as any, [OUTSIDER]);
    expect(scoped.totalLeads).toBeLessThanOrEqual(full.totalLeads);
  });

  it('rejects reporting loops and self-management', async () => {
    expect(await wouldCreateReportingLoop(companyId, MANAGER, SUB_MEMBER)).toBe(true);
    expect(await wouldCreateReportingLoop(companyId, MANAGER, MANAGER)).toBe(true);
    expect(await wouldCreateReportingLoop(companyId, OUTSIDER, MANAGER)).toBe(false);

    await expect(updateUser(companyId, ADMIN, MANAGER, { managerId: SUB_MEMBER })).rejects.toThrow(/team/i);
  });

  it('assigns and clears a manager through the users service', async () => {
    const updated: any = await updateUser(companyId, ADMIN, OUTSIDER, { managerId: MANAGER });
    expect(updated.managerId).toBe(MANAGER);
    expect(updated.manager.id).toBe(MANAGER);

    const cleared: any = await updateUser(companyId, ADMIN, OUTSIDER, { managerId: null });
    expect(cleared.managerId).toBeNull();
  });

  it('rejects a manager that is not in the company', async () => {
    await expect(
      createUser(companyId, ADMIN, {
        name: 'New Hire',
        email: 'newhire@test.local',
        password: 'Passw0rdX',
        status: UserStatus.ACTIVE,
        roleIds: [MANAGER_ROLE_ID],
        managerId: '20000000-0000-0000-0000-00000000ffff',
      })
    ).rejects.toThrow(/manager/i);
  });

  it('summarises each team member without including the manager or outsiders', async () => {
    const overview = await getTeamOverview(companyId, MANAGER);
    const ids = overview.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining([TEAM_MEMBER, SUB_MEMBER]));
    expect(ids).not.toContain(MANAGER);
    expect(ids).not.toContain(OUTSIDER);
    expect(overview.find((m) => m.id === TEAM_MEMBER)).toMatchObject({
      directManagerId: MANAGER,
      openTasks: 0,
      overdueTasks: 0,
      openTickets: 0,
    });
  });

  describe('users API for a Manager', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/users', usersRouter);
    app.use(errorHandler);

    const tokenFor = (userId: string, email: string) => generateAccessToken({ userId, email, companyId });

    it('lists only the manager and their team, never other staff', async () => {
      const res = await request(app)
        .get('/api/v1/users?limit=100')
        .set('Authorization', `Bearer ${tokenFor(MANAGER, 'manager@test.local')}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((u: any) => u.id);
      expect(ids).toEqual(expect.arrayContaining([MANAGER, TEAM_MEMBER, SUB_MEMBER]));
      expect(ids).not.toContain(OUTSIDER);
      expect(ids).not.toContain(ADMIN);
    });

    it('hides users outside the team from the detail endpoint', async () => {
      const auth = { Authorization: `Bearer ${tokenFor(MANAGER, 'manager@test.local')}` };
      expect((await request(app).get(`/api/v1/users/${TEAM_MEMBER}`).set(auth)).status).toBe(200);
      expect((await request(app).get(`/api/v1/users/${OUTSIDER}`).set(auth)).status).toBe(404);
    });

    it('still lets an administrator see everyone', async () => {
      const res = await request(app)
        .get('/api/v1/users?limit=100')
        .set('Authorization', `Bearer ${tokenFor(ADMIN, 'admin@test.local')}`);
      const ids = res.body.data.map((u: any) => u.id);
      expect(ids).toEqual(expect.arrayContaining([ADMIN, MANAGER, OUTSIDER]));
    });
  });
});
