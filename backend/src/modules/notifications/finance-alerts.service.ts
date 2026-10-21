import { InvoiceStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { logger } from '../../utils/logger.js';
import { formatMoney, notifyPermissionHolders } from './finance-notifications.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_REMINDER_EVERY_MS = DAY_MS;
const CONTRACT_REMINDER_EVERY_MS = 7 * DAY_MS;
const CONTRACT_LOOKAHEAD_DAYS = 30;
const MAX_ALERTS_PER_RUN = 100;

const COLLECTABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.UNPAID,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  currency: string;
  balance: number;
  dueDate: Date;
  customerName: string | null;
}

interface ExpiringContract {
  id: string;
  contractNumber: string;
  subject: string;
  endDate: Date;
  customerName: string | null;
}

export async function listCompanyIds(): Promise<string[]> {
  if (!isDatabaseConnected) return [devStore.company.id];
  const rows = await prisma.company.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

async function findOverdueInvoices(companyId: string, now: Date): Promise<OverdueInvoice[]> {
  if (!isDatabaseConnected) {
    return devStore.invoices
      .filter(
        (i) =>
          i.companyId === companyId &&
          !i.isArchived &&
          COLLECTABLE_STATUSES.includes(i.status) &&
          i.dueDate &&
          i.dueDate < now &&
          i.total - i.amountPaid > 0.005
      )
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        currency: i.currency,
        balance: i.total - i.amountPaid,
        dueDate: i.dueDate as Date,
        customerName: devStore.customers.find((c) => c.id === i.customerId)?.name ?? null,
      }));
  }

  const rows = await prisma.invoice.findMany({
    where: { companyId, isArchived: false, status: { in: COLLECTABLE_STATUSES }, dueDate: { lt: now } },
    select: {
      id: true,
      invoiceNumber: true,
      currency: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      customer: { select: { name: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: MAX_ALERTS_PER_RUN,
  });
  return rows
    .map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      currency: r.currency,
      balance: Number(r.total) - Number(r.amountPaid),
      dueDate: r.dueDate as Date,
      customerName: r.customer?.name ?? null,
    }))
    .filter((r) => r.balance > 0.005);
}

async function findExpiringContracts(companyId: string, now: Date): Promise<ExpiringContract[]> {
  const from = new Date(now.getTime() - 7 * DAY_MS);
  const to = new Date(now.getTime() + CONTRACT_LOOKAHEAD_DAYS * DAY_MS);

  if (!isDatabaseConnected) {
    return devStore.contracts
      .filter(
        (c) =>
          c.companyId === companyId &&
          !c.isArchived &&
          c.status !== 'TERMINATED' &&
          c.endDate &&
          c.endDate >= from &&
          c.endDate <= to
      )
      .map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        subject: c.subject,
        endDate: c.endDate as Date,
        customerName: devStore.customers.find((cu) => cu.id === c.customerId)?.name ?? null,
      }));
  }

  const rows = await prisma.contract.findMany({
    where: { companyId, isArchived: false, status: { not: 'TERMINATED' }, endDate: { gte: from, lte: to } },
    select: { id: true, contractNumber: true, subject: true, endDate: true, customer: { select: { name: true } } },
    orderBy: { endDate: 'asc' },
    take: MAX_ALERTS_PER_RUN,
  });
  return rows.map((r) => ({
    id: r.id,
    contractNumber: r.contractNumber,
    subject: r.subject,
    endDate: r.endDate as Date,
    customerName: r.customer?.name ?? null,
  }));
}

export interface FinanceAlertsResult {
  overdueInvoices: number;
  expiringContracts: number;
}

/**
 * Scheduled reminders for the finance team: invoices that are past due (at most one reminder per
 * invoice per day) and contracts that end soon (one per week). Safe to run as often as you like.
 */
export async function runFinanceAlerts(now: Date = new Date()): Promise<FinanceAlertsResult> {
  const result: FinanceAlertsResult = { overdueInvoices: 0, expiringContracts: 0 };

  for (const companyId of await listCompanyIds()) {
    for (const inv of await findOverdueInvoices(companyId, now)) {
      const days = Math.max(1, Math.floor((now.getTime() - inv.dueDate.getTime()) / DAY_MS));
      const sent = await notifyPermissionHolders(
        companyId,
        'payments.record',
        {
          type: 'invoice.overdue',
          title: `Invoice overdue: ${inv.invoiceNumber}`,
          body: `${inv.customerName ?? 'Customer'} owes ${formatMoney(inv.balance, inv.currency)}, ${days} day${days === 1 ? '' : 's'} past the due date.`,
          link: `/finance/invoices/${inv.id}`,
          metadata: { invoiceId: inv.id },
        },
        { dedupeWindowMs: OVERDUE_REMINDER_EVERY_MS, includeRead: true }
      );
      if (sent > 0) result.overdueInvoices += 1;
    }

    for (const contract of await findExpiringContracts(companyId, now)) {
      const days = Math.ceil((contract.endDate.getTime() - now.getTime()) / DAY_MS);
      const who = contract.customerName ?? 'a customer';
      const sent = await notifyPermissionHolders(
        companyId,
        'contracts.view',
        {
          type: 'contract.expiring',
          title: days < 0 ? `Contract expired: ${contract.contractNumber}` : `Contract expiring: ${contract.contractNumber}`,
          body:
            days < 0
              ? `${contract.subject} for ${who} ended ${Math.abs(days)} day(s) ago.`
              : `${contract.subject} for ${who} ends in ${days} day(s).`,
          link: '/sales/contracts',
          metadata: { contractId: contract.id },
        },
        { dedupeWindowMs: CONTRACT_REMINDER_EVERY_MS, includeRead: true }
      );
      if (sent > 0) result.expiringContracts += 1;
    }
  }

  if (result.overdueInvoices || result.expiringContracts) {
    logger.info(`Finance alerts: ${result.overdueInvoices} overdue invoice(s), ${result.expiringContracts} contract(s)`);
  }
  return result;
}
