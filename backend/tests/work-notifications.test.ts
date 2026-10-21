import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { devStore } from '../src/config/dev-store.js';
import { TEST_USER_IDS, makeProject, seedTestUsers } from './helpers/fixtures.js';
import {
  notifyActivityAssigned,
  notifyAdminsOfUserEvent,
  notifyLeadAssigned,
  notifyTaskCreatorOfComment,
  notifyTaskStatusChange,
} from '../src/modules/notifications/work-notifications.js';
import { runWorkAlerts } from '../src/modules/notifications/work-alerts.service.js';
import { usersRouter } from '../src/modules/users/users.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';

const companyId = devStore.company.id;
const DAY = 86_400_000;
const ADMIN = TEST_USER_IDS.admin;
const MANAGER = TEST_USER_IDS.manager;
const STAFF_A = '20000000-0000-0000-0000-0000000000c1';
const STAFF_B = '20000000-0000-0000-0000-0000000000c2';
const OUTSIDER = '20000000-0000-0000-0000-0000000000c3';
const STAFF_ROLE = '10000000-0000-0000-0000-000000000003';

const forUser = (userId: string, type?: string) =>
  devStore.notifications.filter((n) => n.userId === userId && (!type || n.type === type));

function addStaff(id: string, managerId: string | null) {
  const existing = devStore.users.find((u) => u.id === id);
  if (existing) {
    existing.managerId = managerId;
    return;
  }
  devStore.users.push({
    id,
    companyId,
    name: `Staff ${id.slice(-2)}`,
    email: `${id}@test.local`,
    passwordHash: devStore.users[0].passwordHash,
    status: 'ACTIVE',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleIds: [STAFF_ROLE],
    managerId,
  } as any);
}

function addTask(overrides: Record<string, unknown>, assignees: string[], projectId: string) {
  const now = new Date();
  const task = {
    id: crypto.randomUUID(),
    projectId,
    milestoneId: null,
    creatorId: MANAGER,
    title: 'Write the spec',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: null,
    dueDate: null,
    completedAt: null,
    estimatedHours: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  devStore.tasks.push(task as any);
  assignees.forEach((userId) => devStore.taskAssignees.push({ taskId: task.id, userId }));
  return task as typeof task & { id: string };
}

describe('Work, CRM and admin notifications', () => {
  let projectId: string;

  beforeEach(() => {
    seedTestUsers();
    addStaff(STAFF_A, MANAGER);
    addStaff(STAFF_B, MANAGER);
    addStaff(OUTSIDER, null);
    devStore.notifications.length = 0;
    devStore.tasks.length = 0;
    devStore.taskAssignees.length = 0;
    devStore.projects.length = 0;
    devStore.activities.length = 0;
    projectId = makeProject({ name: 'Portal', projectManagerId: MANAGER }).id;
  });

  describe('events', () => {
    it('tells the task creator and project manager when work is finished, not the person who did it', async () => {
      const task = addTask({ status: 'DONE', creatorId: ADMIN }, [STAFF_A], projectId);
      await notifyTaskStatusChange(companyId, STAFF_A, task.id, 'IN_PROGRESS');
      expect(forUser(ADMIN, 'task.completed')).toHaveLength(1);
      expect(forUser(MANAGER, 'task.completed')).toHaveLength(1);
      expect(forUser(STAFF_A)).toHaveLength(0);
    });

    it('flags blocked tasks, and ignores a status that did not change or is not final', async () => {
      const blocked = addTask({ status: 'BLOCKED' }, [STAFF_A], projectId);
      await notifyTaskStatusChange(companyId, STAFF_A, blocked.id, 'IN_PROGRESS');
      expect(forUser(MANAGER, 'task.blocked')).toHaveLength(1);

      const same = addTask({ status: 'DONE' }, [STAFF_A], projectId);
      await notifyTaskStatusChange(companyId, STAFF_A, same.id, 'DONE');
      const moving = addTask({ status: 'IN_PROGRESS' }, [STAFF_A], projectId);
      await notifyTaskStatusChange(companyId, STAFF_A, moving.id, 'TODO');
      expect(devStore.notifications).toHaveLength(1);
    });

    it('lets the task creator hear about comments, without doubling up with assignees', async () => {
      const task = addTask({ creatorId: MANAGER }, [STAFF_A], projectId);
      await notifyTaskCreatorOfComment(companyId, STAFF_A, task.id, [STAFF_A]);
      expect(forUser(MANAGER, 'task.comment')).toHaveLength(1);

      devStore.notifications.length = 0;
      await notifyTaskCreatorOfComment(companyId, STAFF_A, task.id, [STAFF_A, MANAGER]);
      expect(devStore.notifications).toHaveLength(0);
    });

    it('notifies the new owner of a lead and the assignee of an activity', async () => {
      const lead = { id: crypto.randomUUID(), companyId, name: 'Globex', companyName: 'Globex Corp', ownerId: STAFF_A, isArchived: false } as any;
      devStore.leads.push(lead);
      await notifyLeadAssigned(companyId, MANAGER, lead.id, STAFF_A);
      expect(forUser(STAFF_A, 'lead.assigned')[0].title).toContain('Globex');
      await notifyLeadAssigned(companyId, MANAGER, lead.id, null);
      expect(forUser(STAFF_A, 'lead.assigned')).toHaveLength(1);

      await notifyActivityAssigned(companyId, MANAGER, {
        id: 'a1',
        subject: 'Call Globex',
        type: 'FOLLOW_UP',
        dueDate: new Date(),
        assignedToId: STAFF_B,
      });
      expect(forUser(STAFF_B, 'activity.assigned')[0].title).toContain('follow-up');
    });

    it('lets administrators know about account changes made by someone else', async () => {
      await notifyAdminsOfUserEvent(companyId, MANAGER, 'created', { id: STAFF_A, name: 'Ravi' });
      expect(forUser(ADMIN, 'user.created')).toHaveLength(1);
      await notifyAdminsOfUserEvent(companyId, ADMIN, 'deactivated', { id: STAFF_A, name: 'Ravi' });
      expect(forUser(ADMIN, 'user.deactivated')).toHaveLength(0);
      expect(forUser(MANAGER)).toHaveLength(0);
    });
  });

  describe('scheduled reminders', () => {
    it('reminds assignees about tasks that are due soon or overdue, once a day', async () => {
      addTask({ title: 'Due tomorrow', dueDate: new Date(Date.now() + 10 * 3_600_000) }, [STAFF_A], projectId);
      addTask({ title: 'Late', dueDate: new Date(Date.now() - 2 * DAY) }, [STAFF_B], projectId);
      addTask({ title: 'Next month', dueDate: new Date(Date.now() + 30 * DAY) }, [STAFF_A], projectId);
      addTask({ title: 'Done', status: 'DONE', dueDate: new Date(Date.now() - DAY) }, [STAFF_A], projectId);

      const first = await runWorkAlerts();
      expect(first.taskReminders).toBe(2);
      expect(forUser(STAFF_A, 'task.due_soon')[0].title).toContain('Due tomorrow');
      expect(forUser(STAFF_B, 'task.overdue')[0].body).toContain('2 days');

      expect((await runWorkAlerts()).taskReminders).toBe(0);
    });

    it('sends each manager one digest of overdue work in their own team only', async () => {
      addTask({ dueDate: new Date(Date.now() - DAY) }, [STAFF_A], projectId);
      addTask({ dueDate: new Date(Date.now() - DAY) }, [STAFF_A], projectId);
      addTask({ dueDate: new Date(Date.now() - DAY) }, [STAFF_B], projectId);
      addTask({ dueDate: new Date(Date.now() - DAY) }, [OUTSIDER], projectId);

      const result = await runWorkAlerts();
      expect(result.teamDigests).toBe(1);
      const digest = forUser(MANAGER, 'team.overdue');
      expect(digest).toHaveLength(1);
      expect(digest[0].title).toBe('3 overdue tasks in your team');
      expect(digest[0].body).toContain('(2)');
      expect(digest[0].link).toBe('/team');
    });

    it('warns the project manager about a deadline, and skips finished projects', async () => {
      makeProject({ name: 'Soon', projectManagerId: STAFF_A, deadline: new Date(Date.now() + 2 * DAY) });
      makeProject({ name: 'Far', projectManagerId: STAFF_A, deadline: new Date(Date.now() + 40 * DAY) });
      makeProject({ name: 'Finished', projectManagerId: STAFF_A, status: 'COMPLETED' as any, deadline: new Date(Date.now() - DAY) });

      expect((await runWorkAlerts()).projectReminders).toBe(1);
      expect(forUser(STAFF_A, 'project.deadline')[0].title).toContain('Soon');
    });

    it('reminds the owner of a follow-up that is due today or late', async () => {
      const mk = (subject: string, offsetDays: number, status = 'PENDING') =>
        devStore.activities.push({
          id: crypto.randomUUID(),
          companyId,
          type: 'FOLLOW_UP',
          subject,
          description: null,
          dueDate: new Date(Date.now() + offsetDays * DAY),
          status,
          completedAt: null,
          assignedToId: STAFF_A,
          customerId: null,
          leadId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      mk('Call back', -1);
      mk('Next week', 7);
      mk('Already done', -1, 'COMPLETED');

      expect((await runWorkAlerts()).followUpReminders).toBe(1);
      expect(forUser(STAFF_A, 'followup.due')[0].title).toContain('Call back');
    });
  });

  describe('admin events over HTTP', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/users', usersRouter);
    app.use(errorHandler);

    it('does not notify the administrator who made the change', async () => {
      const token = generateAccessToken({ userId: ADMIN, email: 'admin@businesscrm.local', companyId });
      const res = await request(app).post(`/api/v1/users/${STAFF_A}/password-reset`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 20));
      expect(forUser(ADMIN, 'user.password_reset')).toHaveLength(0);
    });
  });
});
