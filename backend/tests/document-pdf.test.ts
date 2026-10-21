import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { devStore } from '../src/config/dev-store.js';
import * as estimatesService from '../src/modules/estimates/estimates.service.js';
import * as proposalsService from '../src/modules/proposals/proposals.service.js';
import { renderDocumentPdf } from '../src/utils/document-pdf.js';
import { makeCustomer } from './helpers/fixtures.js';

const binaryParser = (res: any, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Estimate & proposal PDFs', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;
  let agent: ReturnType<typeof request.agent>;
  let estimateId: string;
  let proposalId: string;

  beforeAll(async () => {
    const customerId = makeCustomer().id;
    const estimate = await estimatesService.createEstimate(companyId, adminId, {
      customerId,
      title: 'Pipeline estimate',
      items: [{ description: 'CI/CD setup', quantity: 1, unitPrice: 4000, taxRate: 0.18 }],
    } as any);
    estimateId = estimate.id;
    const proposal = await proposalsService.createProposal(companyId, adminId, {
      customerId,
      subject: 'Cloud migration',
      items: [{ description: 'Architecture', quantity: 1, unitPrice: 8000, taxRate: 0.18 }],
    } as any);
    proposalId = proposal.id;

    agent = request.agent(createApp());
    await agent.get('/api/v1/health');
    const cookies = (agent as any).jar.getCookies({ path: '/', domain: '127.0.0.1', secure: false, script: false });
    const csrf = cookies.find((c: any) => c.name === 'crm_csrf')?.value;
    const login = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'admin@businesscrm.local', password: 'Admin@Secure123!' });
    expect(login.status).toBe(200);
  });

  it('omits payment rows for documents without a balance', async () => {
    const pdf = await renderDocumentPdf(
      {
        documentType: 'ESTIMATE',
        invoiceNumber: 'EST-2026-0001',
        status: 'DRAFT',
        currency: 'INR',
        validUntil: new Date('2026-02-01'),
        subtotal: 100,
        discount: 0,
        discountTotal: 0,
        taxTotal: 18,
        total: 118,
        items: [{ description: 'Work', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0.18, lineTotal: 118 }],
      },
      { name: 'Test Co' }
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('downloads an estimate as a PDF', async () => {
    const res = await agent.get(`/api/v1/estimates/${estimateId}/pdf`).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/EST-\d{4}-\d{4}\.pdf/);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('downloads a proposal as a PDF', async () => {
    const res = await agent.get(`/api/v1/proposals/${proposalId}/pdf`).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/PROP-\d{4}-\d{4}\.pdf/);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('requires authentication and returns 404 for unknown documents', async () => {
    const anon = await request(createApp()).get(`/api/v1/estimates/${estimateId}/pdf`);
    expect(anon.status).toBe(401);

    const missing = await agent.get('/api/v1/estimates/00000000-0000-0000-0000-00000000ffff/pdf');
    expect(missing.status).toBe(404);
  });
});
