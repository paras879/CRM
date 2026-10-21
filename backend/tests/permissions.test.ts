import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { requirePermission, requireRole } from '../src/middleware/permissions.js';
import { errorHandler } from '../src/middleware/error-handler.js';

describe('Permissions & RBAC Middleware', () => {
  const createTestApp = (mockUser?: any) => {
    const app = express();
    app.use(express.json());

    // Inject mock user
    app.use((req, _res, next) => {
      if (mockUser) {
        req.user = mockUser;
      }
      next();
    });

    app.get('/protected-feature', requirePermission('invoices.issue'), (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Granted' });
    });

    app.get('/admin-only', requireRole('Administrator'), (_req: Request, res: Response) => {
      res.json({ success: true, message: 'Admin granted' });
    });

    app.use(errorHandler);
    return app;
  };

  it('rejects unauthenticated request with 401', async () => {
    const app = createTestApp(undefined);
    const res = await request(app).get('/protected-feature');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects request with 403 when user lacks required permission', async () => {
    const app = createTestApp({
      id: '1',
      companyId: 'comp-1',
      email: 'staff@example.com',
      roles: ['Staff Member'],
      permissions: ['invoices.view'], // lacks invoices.issue
    });

    const res = await request(app).get('/protected-feature');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('allows request when user has required permission', async () => {
    const app = createTestApp({
      id: '2',
      companyId: 'comp-1',
      email: 'finance@example.com',
      roles: ['Finance User'],
      permissions: ['invoices.issue'],
    });

    const res = await request(app).get('/protected-feature');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows Administrator to bypass granular permission check', async () => {
    const app = createTestApp({
      id: '3',
      companyId: 'comp-1',
      email: 'admin@example.com',
      roles: ['Administrator'],
      permissions: [], // empty permissions, but admin role bypasses
    });

    const res = await request(app).get('/protected-feature');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
