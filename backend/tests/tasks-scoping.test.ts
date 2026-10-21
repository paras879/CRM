import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { tasksRouter } from '../src/modules/tasks/tasks.routes.js';
import { devStore } from '../src/config/dev-store.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { makeProject } from './helpers/fixtures.js';

describe('Task scoping for non-elevated users', () => {
  const companyId = devStore.company.id;
  const adminId = '20000000-0000-0000-0000-000000000001';
  const staffId = '20000000-0000-0000-0000-000000000089';
  const projectId = '30000000-0000-0000-0000-000000000001';

  // The app ships with no sample records, so this suite creates the staff member and project it needs.
  beforeAll(() => {
    if (!devStore.users.some((u) => u.id === staffId)) {
      devStore.users.push({
        id: staffId,
        companyId,
        name: 'Staff Member',
        email: 'staff@test.com',
        passwordHash: devStore.users[0].passwordHash,
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        roleIds: ['10000000-0000-0000-0000-000000000003'],
      } as any);
    }
    makeProject({ id: projectId, name: 'Scoping project' });
    devStore.projectMembers.push({ projectId, userId: staffId, role: 'MEMBER', createdAt: new Date() });
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/tasks', tasksRouter);
  app.use(errorHandler);

  const tokenFor = (userId: string, email: string) => `Bearer ${generateAccessToken({ userId, email, companyId })}`;
  const staff = () => tokenFor(staffId, 'staff@test.com');
  const admin = () => tokenFor(adminId, 'admin@businesscrm.local');

  it('forces staff-created tasks to be assigned to the creator and visible to them', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', staff())
      .send({ projectId, title: 'Staff own task', status: 'TODO', priority: 'MEDIUM', assigneeIds: [adminId] });
    expect(res.status).toBe(201);

    const assignees = devStore.taskAssignees.filter((ta) => ta.taskId === res.body.task.id).map((ta) => ta.userId);
    expect(assignees).toEqual([staffId]);

    const list = await request(app).get('/api/v1/tasks?limit=100').set('Authorization', staff());
    expect(list.body.data.some((t: any) => t.id === res.body.task.id)).toBe(true);
  });

  it('hides tasks that neither belong to nor were assigned to the staff user', async () => {
    const created = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', admin())
      .send({ projectId, title: 'Admin private task', status: 'TODO', priority: 'LOW', assigneeIds: [adminId] });
    expect(created.status).toBe(201);
    const id = created.body.task.id;

    const list = await request(app).get('/api/v1/tasks?limit=100').set('Authorization', staff());
    expect(list.body.data.some((t: any) => t.id === id)).toBe(false);

    const detail = await request(app).get(`/api/v1/tasks/${id}`).set('Authorization', staff());
    expect(detail.status).toBe(404);

    const adminList = await request(app).get('/api/v1/tasks?limit=100').set('Authorization', admin());
    expect(adminList.body.data.some((t: any) => t.id === id)).toBe(true);
  });

  it('shows staff a task an admin assigned to them', async () => {
    const created = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', admin())
      .send({ projectId, title: 'Assigned to staff', status: 'TODO', priority: 'HIGH', assigneeIds: [staffId] });
    const id = created.body.task.id;

    const list = await request(app).get('/api/v1/tasks?limit=100').set('Authorization', staff());
    expect(list.body.data.some((t: any) => t.id === id)).toBe(true);

    const detail = await request(app).get(`/api/v1/tasks/${id}`).set('Authorization', staff());
    expect(detail.status).toBe(200);
  });

  it('stops staff from reassigning their task to someone else', async () => {
    const created = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', staff())
      .send({ projectId, title: 'Keep mine', status: 'TODO', priority: 'LOW' });
    const id = created.body.task.id;

    await request(app).put(`/api/v1/tasks/${id}`).set('Authorization', staff()).send({ assigneeIds: [adminId] });
    const assignees = devStore.taskAssignees.filter((ta) => ta.taskId === id).map((ta) => ta.userId);
    expect(assignees).toEqual([staffId]);
  });
});
