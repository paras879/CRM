import { describe, it, expect, beforeEach } from 'vitest';
import { InvoiceStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { TEST_USER_IDS, seedTestUsers } from './helpers/fixtures.js';
import {
  notifyExpenseDecision,
  notifyExpenseSubmitted,
  notifyPaymentRecorded,
} from '../src/modules/notifications/finance-notifications.js';
import { runFinanceAlerts } from '../src/modules/notifications/finance-alerts.service.js';

const companyId = devStore.company.id;
const DAY = 86_400_000;
const FINANCE = TEST_USER_IDS.finance;
const MANAGER = TEST_USER_IDS.manager;
const ADMIN = TEST_USER_IDS.admin;

function notificationsFor(userId: string, type?: string) {
  return devStore.notifications.filter((n) => n.userId === userId && (!type || n.type === type));
}

function addInvoice(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const invoice = {
    id: crypto.randomUUID(),
    companyId,
    customerId: 'cust-1',
    projectId: null,
    invoiceNumber: 'INV-NOTIFY-1',
    title: null,
    status: InvoiceStatus.ISSUED,
    currency: 'INR',
    subtotal: 1000,
    discount: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 1000,
    amountPaid: 0,
    issuedAt: now,
    dueDate: new Date(now.getTime() + 10 * DAY),
    notes: null,
    terms: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  devStore.invoices.push(invoice as any);
  return invoice as typeof invoice & { id: string };
}

describe('Finance notifications', () => {
  beforeEach(() => {
    seedTestUsers();
    devStore.notifications.length = 0;
    devStore.invoices.length = 0;
    devStore.contracts.length = 0;
  });

  it('tells the finance team about a payment, but not the person who recorded it', async () => {
    const invoice = addInvoice({ amountPaid: 400 });
    await notifyPaymentRecorded(companyId, FINANCE, { id: 'pay-1', invoiceId: invoice.id, amount: 400, currency: 'INR' });

    expect(notificationsFor(FINANCE)).toHaveLength(0);
    const adminNotice = notificationsFor(ADMIN, 'payment.received');
    expect(adminNotice).toHaveLength(1);
    expect(adminNotice[0].title).toContain('400');
    expect(adminNotice[0].body).toContain('INV-NOTIFY-1');
    expect(adminNotice[0].link).toBe(`/finance/invoices/${invoice.id}`);
    expect(notificationsFor(MANAGER)).toHaveLength(0);
  });

  it('keeps every payment notification even when two land back to back', async () => {
    const invoice = addInvoice();
    await notifyPaymentRecorded(companyId, FINANCE, { id: 'pay-1', invoiceId: invoice.id, amount: 100 });
    await notifyPaymentRecorded(companyId, FINANCE, { id: 'pay-2', invoiceId: invoice.id, amount: 200 });
    expect(notificationsFor(ADMIN, 'payment.received')).toHaveLength(2);
  });

  it('routes pending expenses to approvers and the decision back to the submitter', async () => {
    const expense = { id: 'exp-1', title: 'Licences', amount: 1200, currency: 'INR', approvalStatus: 'PENDING', createdById: MANAGER };
    await notifyExpenseSubmitted(companyId, MANAGER, expense);
    expect(notificationsFor(FINANCE, 'expense.pending')).toHaveLength(1);
    expect(notificationsFor(MANAGER, 'expense.pending')).toHaveLength(0);

    await notifyExpenseDecision(companyId, FINANCE, { ...expense, approvalStatus: 'REJECTED' });
    const decision = notificationsFor(MANAGER, 'expense.rejected');
    expect(decision).toHaveLength(1);
    expect(decision[0].body).toContain('Licences');
  });

  it('does not ask for approval on an expense that is already approved', async () => {
    await notifyExpenseSubmitted(companyId, MANAGER, {
      id: 'exp-2',
      title: 'Taxi',
      amount: 300,
      currency: 'INR',
      approvalStatus: 'APPROVED',
    });
    expect(devStore.notifications).toHaveLength(0);
  });

  it('reminds finance about overdue invoices once a day', async () => {
    addInvoice({ invoiceNumber: 'INV-LATE', dueDate: new Date(Date.now() - 6 * DAY), total: 900, amountPaid: 100 });
    addInvoice({ invoiceNumber: 'INV-FINE' });
    addInvoice({ invoiceNumber: 'INV-PAID', dueDate: new Date(Date.now() - 6 * DAY), total: 500, amountPaid: 500 });

    const first = await runFinanceAlerts();
    expect(first.overdueInvoices).toBe(1);
    const reminders = notificationsFor(FINANCE, 'invoice.overdue');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toContain('6 days');
    expect(reminders[0].body).toContain('800');

    reminders[0].readAt = new Date();
    const second = await runFinanceAlerts();
    expect(second.overdueInvoices).toBe(0);
    expect(notificationsFor(FINANCE, 'invoice.overdue')).toHaveLength(1);

    // A day later the reminder is due again.
    reminders[0].createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const nextDay = await runFinanceAlerts();
    expect(nextDay.overdueInvoices).toBe(1);
  });
});
