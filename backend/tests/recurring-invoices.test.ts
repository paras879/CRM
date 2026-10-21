import { describe, it, expect, beforeEach } from 'vitest';
import * as recurring from '../src/modules/recurring-invoices/recurring-invoices.service.js';
import { CreateRecurringInvoiceSchema } from '../src/modules/recurring-invoices/recurring-invoices.schema.js';
import { devStore } from '../src/config/dev-store.js';
import { makeCustomer } from './helpers/fixtures.js';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('Recurring invoice schedule', () => {
  it('advances weekly, monthly, quarterly and yearly occurrences', () => {
    const start = utc(2026, 1, 5);
    expect(iso(recurring.occurrenceDate(start, 'WEEKLY', 2, 1))).toBe('2026-01-19');
    expect(iso(recurring.occurrenceDate(start, 'MONTHLY', 1, 3))).toBe('2026-04-05');
    expect(iso(recurring.occurrenceDate(start, 'QUARTERLY', 1, 2))).toBe('2026-07-05');
    expect(iso(recurring.occurrenceDate(start, 'YEARLY', 1, 1))).toBe('2027-01-05');
  });

  it('keeps month-end schedules from drifting', () => {
    const start = utc(2026, 1, 31);
    expect(iso(recurring.occurrenceDate(start, 'MONTHLY', 1, 1))).toBe('2026-02-28');
    expect(iso(recurring.occurrenceDate(start, 'MONTHLY', 1, 2))).toBe('2026-03-31');
    expect(iso(recurring.occurrenceDate(start, 'MONTHLY', 1, 3))).toBe('2026-04-30');
  });

  it('validates input', () => {
    const base = {
      customerId: '00000000-0000-0000-0000-000000000001',
      title: 'Retainer',
      frequency: 'MONTHLY',
      startDate: '2026-01-01',
      items: [{ description: 'Retainer', quantity: 1, unitPrice: 100 }],
    };
    expect(CreateRecurringInvoiceSchema.safeParse(base).success).toBe(true);
    expect(CreateRecurringInvoiceSchema.safeParse({ ...base, frequency: 'DAILY' }).success).toBe(false);
    expect(CreateRecurringInvoiceSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(CreateRecurringInvoiceSchema.safeParse({ ...base, startDate: 'not-a-date' }).success).toBe(false);
  });
});

describe('Recurring invoice service', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;
  const customerId = makeCustomer().id;

  const create = (overrides: Record<string, unknown> = {}) =>
    recurring.createRecurringInvoice(companyId, adminId, CreateRecurringInvoiceSchema.parse({
      customerId,
      title: 'Monthly retainer',
      currency: 'INR',
      frequency: 'MONTHLY',
      startDate: '2026-01-01',
      dueInDays: 10,
      items: [{ description: 'Retainer', quantity: 1, unitPrice: 1000, taxRate: 0.18 }],
      ...overrides,
    }));

  beforeEach(() => {
    devStore.recurringInvoices = [];
    devStore.invoices = [];
    devStore.invoiceItems = [];
  });

  it('rejects customers outside the company', async () => {
    await expect(create({ customerId: '00000000-0000-0000-0000-00000000ffff' })).rejects.toMatchObject({
      code: 'INVALID_CUSTOMER',
    });
  });

  it('generates a linked draft invoice when due and schedules the next run', async () => {
    const tpl = await create();
    const result = await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 1, 1) });

    expect(result.generated).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    const invoice = devStore.invoices.find((i) => i.id === result.generated[0].invoiceId)!;
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.recurringInvoiceId).toBe(tpl.id);
    expect(invoice.total).toBe(1180);

    const after = await recurring.getRecurringInvoice(companyId, tpl.id);
    expect(after.generatedCount).toBe(1);
    expect(iso(after.nextRunDate)).toBe('2026-02-01');
  });

  it('does nothing before the scheduled date and never duplicates a run', async () => {
    await create();
    expect((await recurring.runDueRecurringInvoices({ companyId, now: utc(2025, 12, 31) })).generated).toHaveLength(0);

    await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 1, 1) });
    const again = await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 1, 1) });
    expect(again.generated).toHaveLength(0);
    expect(devStore.invoices).toHaveLength(1);
  });

  it('catches up missed periods and issues invoices when autoIssue is on', async () => {
    await create({ autoIssue: true });
    const result = await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 3, 15) });

    expect(result.generated).toHaveLength(3);
    expect(devStore.invoices.every((i) => i.status !== 'DRAFT')).toBe(true);
    expect(devStore.invoices.every((i) => i.issuedAt !== null)).toBe(true);
  });

  it('deactivates the schedule after its end date', async () => {
    const tpl = await create({ endDate: '2026-02-15' });
    const result = await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 6, 1) });

    expect(result.generated).toHaveLength(2);
    const after = await recurring.getRecurringInvoice(companyId, tpl.id);
    expect(after.isActive).toBe(false);
  });

  it('skips paused schedules and supports generate-now', async () => {
    const tpl = await create();
    await recurring.updateRecurringInvoice(companyId, adminId, tpl.id, { isActive: false });
    expect((await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 6, 1) })).generated).toHaveLength(0);
    await expect(recurring.generateNow(companyId, adminId, tpl.id)).rejects.toMatchObject({
      code: 'RECURRING_INVOICE_INACTIVE',
    });

    await recurring.updateRecurringInvoice(companyId, adminId, tpl.id, { isActive: true });
    const invoice = await recurring.generateNow(companyId, adminId, tpl.id);
    expect(invoice.invoiceNumber).toMatch(/^INV-/);
    expect((await recurring.getRecurringInvoice(companyId, tpl.id)).generatedCount).toBe(1);
  });

  it('keeps invoices when a schedule is deleted and isolates companies', async () => {
    const tpl = await create();
    await recurring.runDueRecurringInvoices({ companyId, now: utc(2026, 1, 1) });

    await expect(
      recurring.deleteRecurringInvoice('00000000-0000-0000-0000-00000000ffff', adminId, tpl.id)
    ).rejects.toMatchObject({ code: 'RECURRING_INVOICE_NOT_FOUND' });

    await recurring.deleteRecurringInvoice(companyId, adminId, tpl.id);
    expect(devStore.invoices).toHaveLength(1);
    expect(devStore.invoices[0].recurringInvoiceId).toBeNull();
  });
});
