import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { makeCustomer } from './helpers/fixtures.js';

describe('Attachments HTTP API', () => {
  let agent: ReturnType<typeof request.agent>;
  let csrf: string;
  let customerId: string;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-uploads-http-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { createApp } = await import('../src/app.js');
    const { devStore } = await import('../src/config/dev-store.js');
    agent = request.agent(createApp());

    await agent.get('/api/v1/health');
    const jar = (agent as any).jar.getCookies({ path: '/', domain: '127.0.0.1', secure: false, script: false });
    csrf = jar.find((c: any) => c.name === 'crm_csrf')?.value;

    const login = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'admin@businesscrm.local', password: 'Admin@Secure123!' });
    expect(login.status).toBe(200);

    customerId = makeCustomer().id;
  });

  afterAll(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  it('requires authentication', async () => {
    const { createApp } = await import('../src/app.js');
    const res = await request(createApp()).get(
      '/api/v1/attachments?entityType=customer&entityId=00000000-0000-0000-0000-000000000001'
    );
    expect(res.status).toBe(401);
  });

  it('uploads a binary body, downloads it back and deletes it', async () => {
    expect(customerId).toBeDefined();
    const body = Buffer.from([0, 1, 2, 3, 250, 251, 252]);

    const up = await agent
      .post(`/api/v1/attachments?entityType=customer&entityId=${customerId}&fileName=data.bin`)
      .set('x-csrf-token', csrf)
      .set('Content-Type', 'application/octet-stream')
      .send(body);
    expect(up.status).toBe(201);
    const id = up.body.data.id;

    const list = await agent.get(`/api/v1/attachments?entityType=customer&entityId=${customerId}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((a: any) => a.id)).toContain(id);

    const down = await agent
      .get(`/api/v1/attachments/${id}/download`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(down.status).toBe(200);
    expect(down.headers['content-disposition']).toContain('data.bin');
    expect((down.body as Buffer).equals(body)).toBe(true);

    const del = await agent.delete(`/api/v1/attachments/${id}`).set('x-csrf-token', csrf);
    expect(del.status).toBe(204);
  });

  it('rejects blocked file types with 400', async () => {
    const res = await agent
      .post(`/api/v1/attachments?entityType=customer&entityId=${customerId}&fileName=run.exe`)
      .set('x-csrf-token', csrf)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('x'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
  });
});
