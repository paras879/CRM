import { describe, it, expect, beforeEach } from 'vitest';
import { InvoiceStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { getFinancialSummary } from '../src/modules/finance-dashboard/finance-dashboard.service.js';

const companyId = devStore.company.id;
const DAY = 86_400_000;

function addInvoice(overrides: Record<string, unknown>) {
  const now = new Date();
  devStore.invoices.push({
    id: crypto.randomUUID(),
    companyId,
    customerId: 'cust-1',
    projectId: null,
    invoiceNumber: 'INV-X',
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
  } as any);
}

function addExpense(overrides: Record<string, unknown>) {
  const now = new Date();
  devStore.expenses.push({
    id: crypto.randomUUID(),
    companyId,
    title: null,
    description: 'Team lunch',
    categoryId: null,
    category: 'Meals',
    amount: 500,
    currency: 'INR',
    vendor: null,
    customerId: null,
    projectId: null,
    paymentMethod: null,
    referenceNumber: null,
    notes: null,
    receiptUrl: null,
    approvalStatus: 'APPROVED',
    createdById: null,
    incurredAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as any);
}

describe('Finance dashboard: action needed', () => {
  beforeEach(() => {
    devStore.invoices.length = 0;
    devStore.expenses.length = 0;
  });

  it('lists overdue invoices with their unpaid balance, oldest first', async () => {
    addInvoice({ invoiceNumber: 'INV-NEW', dueDate: new Date(Date.now() - 2 * DAY), total: 500, amountPaid: 100 });
    addInvoice({ invoiceNumber: 'INV-OLD', dueDate: new Date(Date.now() - 20 * DAY), total: 800 });
    addInvoice({ invoiceNumber: 'INV-FUTURE' });
    addInvoice({ invoiceNumber: 'INV-PAID', status: InvoiceStatus.PAID, total: 300, amountPaid: 300, dueDate: new Date(Date.now() - 5 * DAY) });

    const { actionNeeded } = await getFinancialSummary(companyId);
    expect(actionNeeded.overdueInvoiceCount).toBe(2);
    expect(actionNeeded.overdueInvoices.map((i) => i.invoiceNumber)).toEqual(['INV-OLD', 'INV-NEW']);
    expect(actionNeeded.overdueInvoices[1].balance).toBe(400);
  });

  it('counts draft invoices that still need issuing', async () => {
    addInvoice({ status: InvoiceStatus.DRAFT });
    addInvoice({ status: InvoiceStatus.DRAFT, isArchived: true });
    addInvoice({});
    const { actionNeeded } = await getFinancialSummary(companyId);
    expect(actionNeeded.draftInvoiceCount).toBe(1);
  });

  it('surfaces expenses awaiting approval without counting them as spend', async () => {
    addExpense({ approvalStatus: 'PENDING', description: 'Software licence', amount: 1200 });
    addExpense({ approvalStatus: 'APPROVED', amount: 300 });
    addExpense({ approvalStatus: 'REJECTED', amount: 900 });

    const summary = await getFinancialSummary(companyId);
    expect(summary.actionNeeded.pendingExpenseCount).toBe(1);
    expect(summary.actionNeeded.pendingExpenses[0]).toMatchObject({ description: 'Software licence', amount: 1200 });
    expect(summary.currencyMetrics.INR.totalExpenses).toBe(300);
  });
});
