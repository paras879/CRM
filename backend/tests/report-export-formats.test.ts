import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { InvoiceStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { reportsRouter } from '../src/modules/reports/reports.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { TEST_USER_IDS, seedTestUsers } from './helpers/fixtures.js';

const companyId = devStore.company.id;
const app = express();
app.use(express.json());
app.use('/api/v1/reports', reportsRouter);
app.use(errorHandler);

const auth = (userId: string, email: string) => ({
  Authorization: `Bearer ${generateAccessToken({ userId, email, companyId })}`,
});
const FINANCE = auth(TEST_USER_IDS.finance, 'finance@test.local');
const ADMIN = auth(TEST_USER_IDS.admin, 'admin@businesscrm.local');

function binary(res: any, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('Report exports in CSV, Excel and PDF', () => {
  beforeEach(() => {
    seedTestUsers();
    devStore.invoices.length = 0;
    const now = new Date();
    devStore.invoices.push({
      id: crypto.randomUUID(),
      companyId,
      customerId: 'c1',
      projectId: null,
      invoiceNumber: 'INV-EXPORT-1',
      title: null,
      status: InvoiceStatus.ISSUED,
      currency: 'INR',
      subtotal: 1000,
      discount: 0,
      discountTotal: 0,
      taxTotal: 180,
      total: 1180,
      amountPaid: 180,
      issuedAt: now,
      dueDate: now,
      notes: null,
      terms: null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    } as any);
  });

  it('returns CSV by default', async () => {
    const res = await request(app).get('/api/v1/reports/export?type=invoices-table').set(FINANCE);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Invoice Number');
    expect(res.text).toContain('INV-EXPORT-1');
  });

  it('returns a real Excel workbook with numeric money columns', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export?type=invoices-table&format=xlsx')
      .set(FINANCE)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(/invoices-table-\d{4}-\d{2}-\d{2}\.xlsx/);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe('Invoice Number');
    expect(sheet.getRow(2).getCell(1).value).toBe('INV-EXPORT-1');
    expect(sheet.getRow(2).getCell(7).value).toBe(1180);
    expect(sheet.getRow(2).getCell(9).value).toBe(1000);
  });

  it('returns a PDF document', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export?type=invoices-table&format=pdf')
      .set(FINANCE)
      .buffer(true)
      .parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('exports a finance summary and the payments table', async () => {
    const summary = await request(app).get('/api/v1/reports/export?type=finance-summary').set(FINANCE);
    expect(summary.text).toContain('Total Invoiced');
    const payments = await request(app).get('/api/v1/reports/export?type=payments-table&format=xlsx').set(FINANCE).buffer(true).parse(binary);
    expect(payments.status).toBe(200);
  });

  it('rejects unknown formats', async () => {
    const res = await request(app).get('/api/v1/reports/export?type=invoices-table&format=docx').set(FINANCE);
    expect(res.status).toBe(400);
  });

  it('only exports data the caller is allowed to see', async () => {
    // Finance may export reports but has no access to leads.
    const leads = await request(app).get('/api/v1/reports/export?type=leads-table&format=xlsx').set(FINANCE);
    expect(leads.status).toBe(403);
    const adminLeads = await request(app).get('/api/v1/reports/export?type=leads-table&format=xlsx').set(ADMIN).buffer(true).parse(binary);
    expect(adminLeads.status).toBe(200);
  });
});
