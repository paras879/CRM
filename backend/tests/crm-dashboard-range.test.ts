import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { devStore } from '../src/config/dev-store.js';
import { crmDashboardRouter } from '../src/modules/crm-dashboard/crm-dashboard.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';

const companyId = devStore.company.id;
const adminId = devStore.users[0].id;
const app = express();
app.use(express.json());
app.use('/api/v1/crm-dashboard', crmDashboardRouter);
app.use(errorHandler);

const auth = {
  Authorization: `Bearer ${generateAccessToken({ userId: adminId, email: devStore.users[0].email, companyId })}`,
};

function addLead(name: string, createdAt: string) {
  devStore.leads.push({
    id: crypto.randomUUID(),
    companyId,
    name,
    status: 'NEW',
    priority: 'MEDIUM',
    currency: 'INR',
    value: 0,
    isArchived: false,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  } as any);
}

describe('CRM dashboard custom date range', () => {
  beforeEach(() => {
    devStore.leads.length = 0;
    addLead('Early', '2026-03-05T10:00:00Z');
    addLead('Mid A', '2026-05-10T10:00:00Z');
    addLead('Mid B', '2026-05-20T23:30:00Z');
    addLead('Late', '2026-08-01T10:00:00Z');
  });

  const metrics = async (query: string) => {
    const res = await request(app).get(`/api/v1/crm-dashboard/metrics?${query}`).set(auth);
    return res;
  };

  it('counts only leads created between the two dates, including the whole last day', async () => {
    const res = await metrics('startDate=2026-05-01&endDate=2026-05-20');
    expect(res.status).toBe(200);
    expect(res.body.metrics.newLeadsInPeriod).toBe(2);
    expect(res.body.metrics.period).toEqual({
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-20T23:59:59.999Z',
    });
  });

  it('accepts a single-day range', async () => {
    const res = await metrics('startDate=2026-08-01&endDate=2026-08-01');
    expect(res.body.metrics.newLeadsInPeriod).toBe(1);
  });

  it('keeps the preset day filters working', async () => {
    const res = await metrics('days=0');
    expect(res.body.metrics.newLeadsInPeriod).toBe(4);
    expect(res.body.metrics.period).toBeNull();
  });

  it('rejects incomplete, malformed or reversed ranges', async () => {
    expect((await metrics('startDate=2026-05-01')).status).toBe(400);
    expect((await metrics('startDate=05/01/2026&endDate=05/20/2026')).status).toBe(400);
    expect((await metrics('startDate=2026-02-31&endDate=2026-03-05')).status).toBe(400);
    expect((await metrics('startDate=2026-06-01&endDate=2026-05-01')).status).toBe(400);
  });
});
