import { UserStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { logger } from '../../utils/logger.js';
import { createNotification, createNotificationIfNew, CreateNotificationOptions } from './notifications.service.js';
import type { CreateNotificationInput } from './notifications.schema.js';

type NotificationPayload = Omit<CreateNotificationInput, 'companyId'>;

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Active users in the company whose roles grant `permissionKey`. Administrators hold every permission. */
export async function getUserIdsWithPermission(companyId: string, permissionKey: string): Promise<string[]> {
  if (!isDatabaseConnected) {
    return devStore.users
      .filter((u) => {
        if (u.companyId !== companyId || u.status !== UserStatus.ACTIVE) return false;
        return devStore.roles.some(
          (r) =>
            u.roleIds.includes(r.id) && (r.name === 'Administrator' || r.permissionKeys.includes(permissionKey))
        );
      })
      .map((u) => u.id);
  }

  const users = await prisma.user.findMany({
    where: {
      companyId,
      status: UserStatus.ACTIVE,
      userRoles: {
        some: {
          role: {
            OR: [{ name: 'Administrator' }, { permissions: { some: { permission: { key: permissionKey } } } }],
          },
        },
      },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Notify everyone who holds a permission, except the person who triggered the event. Returns how many
 * new notifications were created. Never throws.
 */
export async function notifyPermissionHolders(
  companyId: string,
  permissionKey: string,
  payload: NotificationPayload,
  options: { excludeUserId?: string } & CreateNotificationOptions = {}
): Promise<number> {
  const { excludeUserId, ...notificationOptions } = options;
  try {
    const recipients = (await getUserIdsWithPermission(companyId, permissionKey)).filter((id) => id !== excludeUserId);
    const results = await Promise.all(
      recipients.map((userId) => createNotificationIfNew(userId, { ...payload, companyId }, notificationOptions))
    );
    // A de-duplicated call reuses an existing notification, so only count genuinely new ones.
    return results.filter((r) => r.created).length;
  } catch (error) {
    logger.warn('Failed to send finance notification', { error, type: payload.type });
    return 0;
  }
}

async function getInvoiceBrief(companyId: string, invoiceId: string) {
  if (!isDatabaseConnected) {
    const inv = devStore.invoices.find((i) => i.id === invoiceId && i.companyId === companyId);
    return inv
      ? { id: inv.id, invoiceNumber: inv.invoiceNumber, currency: inv.currency, total: inv.total, amountPaid: inv.amountPaid }
      : null;
  }
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, invoiceNumber: true, currency: true, total: true, amountPaid: true },
  });
  return inv ? { ...inv, total: Number(inv.total), amountPaid: Number(inv.amountPaid) } : null;
}

export async function notifyPaymentRecorded(
  companyId: string,
  actorId: string,
  payment: { id: string; invoiceId: string; amount: number; currency?: string }
) {
  const invoice = await getInvoiceBrief(companyId, payment.invoiceId);
  if (!invoice) return;
  const currency = payment.currency ?? invoice.currency;
  const due = invoice.total - invoice.amountPaid;
  await notifyPermissionHolders(
    companyId,
    'payments.record',
    {
      type: 'payment.received',
      title: `Payment received: ${formatMoney(Number(payment.amount), currency)}`,
      body:
        due <= 0.005
          ? `${invoice.invoiceNumber} is now fully paid.`
          : `Payment recorded against ${invoice.invoiceNumber}. ${formatMoney(due, currency)} is still due.`,
      link: `/finance/invoices/${invoice.id}`,
      metadata: { paymentId: payment.id, invoiceId: invoice.id },
    },
    { excludeUserId: actorId, dedupeWindowMs: 0 }
  );
}

export async function notifyPaymentReversed(companyId: string, actorId: string, paymentId: string) {
  const payment = !isDatabaseConnected
    ? devStore.payments.find((p) => p.id === paymentId)
    : await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  const invoice = await getInvoiceBrief(companyId, payment.invoiceId);
  if (!invoice) return;
  await notifyPermissionHolders(
    companyId,
    'payments.record',
    {
      type: 'payment.reversed',
      title: `Payment reversed: ${formatMoney(Number(payment.amount), payment.currency)}`,
      body: `A payment against ${invoice.invoiceNumber} was reversed. The balance is due again.`,
      link: `/finance/invoices/${invoice.id}`,
      metadata: { paymentId, invoiceId: invoice.id },
    },
    { excludeUserId: actorId, dedupeWindowMs: 0 }
  );
}

export async function notifyInvoiceVoided(companyId: string, actorId: string, invoiceId: string) {
  const invoice = await getInvoiceBrief(companyId, invoiceId);
  if (!invoice) return;
  await notifyPermissionHolders(
    companyId,
    'invoices.issue',
    {
      type: 'invoice.voided',
      title: `Invoice voided: ${invoice.invoiceNumber}`,
      body: `${invoice.invoiceNumber} (${formatMoney(invoice.total, invoice.currency)}) was voided.`,
      link: `/finance/invoices/${invoice.id}`,
      metadata: { invoiceId: invoice.id },
    },
    { excludeUserId: actorId }
  );
}

interface ExpenseBrief {
  id: string;
  title?: string | null;
  description?: string | null;
  amount: number | string;
  currency: string;
  approvalStatus: string;
  createdById?: string | null;
}

function expenseLabel(expense: ExpenseBrief): string {
  return expense.title || expense.description || 'Expense';
}

/** Tell approvers that an expense is waiting for a decision. */
export async function notifyExpenseSubmitted(companyId: string, actorId: string, expense: ExpenseBrief) {
  if (expense.approvalStatus !== 'PENDING') return;
  await notifyPermissionHolders(
    companyId,
    'expenses.approve',
    {
      type: 'expense.pending',
      title: `Expense awaiting approval: ${formatMoney(Number(expense.amount), expense.currency)}`,
      body: `"${expenseLabel(expense)}" needs your approval.`,
      link: '/finance/expenses?approvalStatus=PENDING',
      metadata: { expenseId: expense.id },
    },
    { excludeUserId: actorId, dedupeWindowMs: 0 }
  );
}

/** Tell the person who raised an expense whether it was approved or rejected. */
export async function notifyExpenseDecision(companyId: string, actorId: string, expense: ExpenseBrief) {
  if (!expense.createdById || expense.createdById === actorId) return;
  if (expense.approvalStatus !== 'APPROVED' && expense.approvalStatus !== 'REJECTED') return;
  const approved = expense.approvalStatus === 'APPROVED';
  try {
    await createNotification(
      expense.createdById,
      {
        companyId,
        type: approved ? 'expense.approved' : 'expense.rejected',
        title: `Expense ${approved ? 'approved' : 'rejected'}: ${formatMoney(Number(expense.amount), expense.currency)}`,
        body: `"${expenseLabel(expense)}" was ${approved ? 'approved' : 'rejected'}.`,
        link: '/finance/expenses',
        metadata: { expenseId: expense.id },
      },
      { dedupeWindowMs: 0 }
    );
  } catch (error) {
    logger.warn('Failed to send expense decision notification', { error });
  }
}
