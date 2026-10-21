import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import * as invoicesService from '../src/modules/invoices/invoices.service.js';
import { renderInvoicePdf, InvoicePdfData } from '../src/modules/invoices/invoice-pdf.js';
import { createApp } from '../src/app.js';
import { devStore } from '../src/config/dev-store.js';
import { makeCustomer } from './helpers/fixtures.js';

const company = { name: 'Test Co', email: 'billing@test.example', phone: null, address: '1 Test Street' };

function sampleInvoice(itemCount: number): InvoicePdfData {
  return {
    invoiceNumber: 'INV-2026-0001',
    status: 'UNPAID',
    currency: 'INR',
    issuedAt: new Date('2026-01-05'),
    dueDate: new Date('2026-01-20'),
    subtotal: 1000 * itemCount,
    discount: 0,
    discountTotal: 0,
    taxTotal: 180 * itemCount,
    total: 1180 * itemCount,
    amountPaid: 0,
    balanceDue: 1180 * itemCount,
    notes: 'Thank you for your business.',
    terms: 'Net 15',
    customer: { name: 'Customer One', email: 'one@customer.example' },
    items: Array.from({ length: itemCount }, (_, i) => ({
      description: `Line item ${i + 1}`,
      quantity: 1,
      unitPrice: 1000,
      discount: 0,
      taxRate: 0.18,
      lineTotal: 1180,
    })),
  };
}

describe('Invoice PDF', () => {
  it('renders a valid PDF buffer', async () => {
    const pdf = await renderInvoicePdf(sampleInvoice(2), company);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('paginates long invoices without throwing', async () => {
    const pdf = await renderInvoicePdf(sampleInvoice(80), company);
    const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(pages).toBeGreaterThan(1);
  });

  describe('GET /api/v1/invoices/:id/pdf', () => {
    const companyId = devStore.company.id;
    const adminId = devStore.users[0].id;
    let invoiceId: string;

    beforeEach(async () => {
      devStore.invoices = [];
      devStore.invoiceItems = [];
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: makeCustomer().id,
        currency: 'INR',
        discount: 0,
        items: [{ description: 'Consulting', quantity: 2, unitPrice: 500, taxRate: 0.18 }],
      } as any);
      invoiceId = invoice.id;
    });

    it('requires authentication', async () => {
      const res = await request(createApp()).get(`/api/v1/invoices/${invoiceId}/pdf`);
      expect(res.status).toBe(401);
    });

    it('returns the invoice as a PDF attachment', async () => {
      const agent = request.agent(createApp());
      await agent.get('/api/v1/health');
      const cookies = (agent as any).jar.getCookies({ path: '/', domain: '127.0.0.1', secure: false, script: false });
      const csrf = cookies.find((c: any) => c.name === 'crm_csrf')?.value;
      const login = await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', csrf)
        .send({ email: 'admin@businesscrm.local', password: 'Admin@Secure123!' });
      expect(login.status).toBe(200);

      const res = await agent
        .get(`/api/v1/invoices/${invoiceId}/pdf`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/INV-\d{4}-\d{4}\.pdf/);
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });
  });
});
