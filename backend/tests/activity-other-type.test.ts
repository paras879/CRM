import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { devStore } from '../src/config/dev-store.js';
import { activitiesRouter } from '../src/modules/activities/activities.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';

const companyId = devStore.company.id;
const admin = devStore.users[0];
const app = express();
app.use(express.json());
app.use('/api/v1/activities', activitiesRouter);
app.use(errorHandler);

const auth = { Authorization: `Bearer ${generateAccessToken({ userId: admin.id, email: admin.email, companyId })}` };

describe('The "Other" activity type', () => {
  beforeEach(() => {
    devStore.activities.length = 0;
  });

  it('needs a typed label, and keeps it', async () => {
    const missing = await request(app).post('/api/v1/activities').set(auth).send({ type: 'OTHER', subject: 'Visit the site' });
    expect(missing.status).toBe(400);

    const blank = await request(app).post('/api/v1/activities').set(auth).send({ type: 'OTHER', customType: '   ', subject: 'Visit the site' });
    expect(blank.status).toBe(400);

    const ok = await request(app)
      .post('/api/v1/activities')
      .set(auth)
      .send({ type: 'OTHER', customType: 'Site visit', subject: 'Visit the Pune site' });
    expect(ok.status).toBe(201);
    expect(ok.body.activity.type).toBe('OTHER');
    expect(ok.body.activity.customType).toBe('Site visit');

    const list = await request(app).get('/api/v1/activities?limit=10').set(auth);
    expect(list.body.data[0].customType).toBe('Site visit');
  });

  it('ignores a label on any other type', async () => {
    const res = await request(app)
      .post('/api/v1/activities')
      .set(auth)
      .send({ type: 'CALL', customType: 'should be dropped', subject: 'Call the client' });
    expect(res.status).toBe(201);
    expect(res.body.activity.customType).toBeNull();
  });

  it('clears the label when the type changes away from Other, and can rename it', async () => {
    const created = await request(app)
      .post('/api/v1/activities')
      .set(auth)
      .send({ type: 'OTHER', customType: 'Site visit', subject: 'Visit the Pune site' });
    const id = created.body.activity.id;

    const renamed = await request(app).put(`/api/v1/activities/${id}`).set(auth).send({ customType: 'Inspection' });
    expect(renamed.body.activity.customType).toBe('Inspection');

    const changed = await request(app).put(`/api/v1/activities/${id}`).set(auth).send({ type: 'MEETING' });
    expect(changed.body.activity.type).toBe('MEETING');
    expect(changed.body.activity.customType).toBeNull();
  });
});
