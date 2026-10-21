import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

describe('Staged file uploads', () => {
  let app: express.Express;
  let uploadDir: string;
  let auth: Record<string, string>;
  let companyId: string;
  let createContractSchema: any;

  beforeAll(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-staged-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { uploadsRouter } = await import('../src/modules/uploads/uploads.routes.js');
    const { errorHandler } = await import('../src/middleware/error-handler.js');
    const { devStore } = await import('../src/config/dev-store.js');
    const { generateAccessToken } = await import('../src/utils/tokens.js');
    ({ CreateContractSchema: createContractSchema } = await import('../src/modules/contracts/contracts.schema.js'));
    companyId = devStore.company.id;
    auth = { Authorization: `Bearer ${generateAccessToken({ userId: devStore.users[0].id, email: devStore.users[0].email, companyId })}` };
    app = express();
    app.use('/api/v1/uploads', uploadsRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  const upload = (name: string, body: Buffer | string) =>
    request(app)
      .post(`/api/v1/uploads?fileName=${encodeURIComponent(name)}`)
      .set(auth)
      .set('Content-Type', 'application/octet-stream')
      .send(body);

  it('stores a file and hands back a link that serves it again', async () => {
    const res = await upload('Signed contract.pdf', Buffer.from('%PDF-1.4 hello'));
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/api\/v1\/uploads\/[0-9a-f-]{36}$/);
    expect(res.body.data.fileName).toBe('Signed contract.pdf');

    const file = await request(app).get(res.body.data.url).set(auth);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toContain('inline');
    expect(file.headers['content-disposition']).toContain('Signed contract.pdf');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
  });

  it('downloads, rather than displays, types a browser could run', async () => {
    const res = await upload('notes.docx', Buffer.from('docx bytes'));
    const file = await request(app).get(res.body.data.url).set(auth);
    expect(file.headers['content-disposition']).toContain('attachment');
  });

  it('rejects empty files and dangerous types', async () => {
    expect((await upload('empty.pdf', Buffer.alloc(0))).status).toBe(400);
    expect((await upload('script.html', Buffer.from('<script>1</script>'))).status).toBe(400);
    expect((await upload('run.exe', Buffer.from('MZ'))).status).toBe(400);
  });

  it('requires a signed-in user and an existing file', async () => {
    const anon = await request(app).post('/api/v1/uploads?fileName=a.pdf').send(Buffer.from('x'));
    expect(anon.status).toBe(401);
    const missing = await request(app).get('/api/v1/uploads/6f1a8f3e-2b0c-4a56-9c47-0d5f0a3e9b11').set(auth);
    expect(missing.status).toBe(404);
  });

  it('is accepted wherever a record used to need a web address', () => {
    const link = '/api/v1/uploads/6f1a8f3e-2b0c-4a56-9c47-0d5f0a3e9b11';
    const problems = (attachmentUrl: string) =>
      (createContractSchema.safeParse({ subject: 'Annual SLA', attachmentUrl }).error?.issues ?? []).filter((i: any) =>
        i.path.includes('attachmentUrl')
      );

    expect(problems(link)).toHaveLength(0);
    expect(problems('https://example.com/doc.pdf')).toHaveLength(0);
    expect(problems('javascript:alert(1)')).toHaveLength(1);
    expect(problems('/api/v1/uploads/../../etc/passwd')).toHaveLength(1);
  });
});
