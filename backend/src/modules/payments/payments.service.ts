import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevPayment } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { roundMoney } from '../../utils/financial-math.js';
import { deriveInvoiceStatus, getInvoiceById } from '../invoices/invoices.service.js';
import { RecordPaymentInput, ReversePaymentInput, ListPaymentsQuery } from './payments.schema.js';

export async function listPayments(companyId: string, query: ListPaymentsQuery) {
  const { page, limit, invoiceId, method } = query;
  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    try {
      const where: Prisma.PaymentWhereInput = {
        invoice: { companyId },
        ...(invoiceId ? { invoiceId } : {}),
        ...(method ? { method } : {}),
      };

      const [payments, totalCount] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                amountPaid: true,
                status: true,
                customer: { select: { id: true, name: true } },
              },
            },
            recorder: { select: { id: true, name: true, email: true } },
          },
          orderBy: { paidAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.payment.count({ where }),
      ]);

      const formatted = payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        invoice: p.invoice
          ? {
              ...p.invoice,
              total: Number(p.invoice.total),
              amountPaid: Number(p.invoice.amountPaid),
            }
          : null,
      }));

      return {
        data: formatted,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  let list = devStore.payments.filter((p) => {
    const inv = devStore.invoices.find((i) => i.id === p.invoiceId);
    if (!inv || inv.companyId !== companyId) return false;
    if (invoiceId && p.invoiceId !== invoiceId) return false;
    if (method && p.method !== method) return false;
    return true;
  });

  list.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

  const totalCount = list.length;
  const paged = list.slice(skip, skip + limit);

  const formatted = paged.map((p) => {
    const inv = devStore.invoices.find((i) => i.id === p.invoiceId);
    const customer = inv ? devStore.customers.find((c) => c.id === inv.customerId) : null;
    const recorder = devStore.users.find((u) => u.id === p.recordedBy);

    return {
      ...p,
      invoice: inv
        ? {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            total: inv.total,
            amountPaid: inv.amountPaid,
            status: inv.status,
            customer: customer ? { id: customer.id, name: customer.name } : null,
          }
        : null,
      recorder: recorder ? { id: recorder.id, name: recorder.name, email: recorder.email } : null,
    };
  });

  return {
    data: formatted,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

export async function recordPayment(companyId: string, actorId: string, input: RecordPaymentInput) {
  const invoice = await getInvoiceById(companyId, input.invoiceId);

  if (invoice.status === InvoiceStatus.DRAFT) {
    throw new AppError(400, 'INVOICE_NOT_ISSUED', 'Cannot record payment for a draft invoice. Please issue the invoice first.');
  }

  if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.CANCELLED) {
    throw new AppError(400, 'INVOICE_INACTIVE', `Cannot record payment for a ${invoice.status.toLowerCase()} invoice.`);
  }

  const balanceDue = roundMoney(invoice.total - invoice.amountPaid);
  const paymentAmount = roundMoney(input.amount);

  if (paymentAmount > balanceDue) {
    throw new AppError(
      400,
      'EXCEEDS_BALANCE',
      `Payment amount (${paymentAmount}) exceeds outstanding balance due (${balanceDue}).`
    );
  }

  // Idempotency check
  if (input.idempotencyKey) {
    if (isDatabaseConnected) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingPayment) {
        return { ...existingPayment, amount: Number(existingPayment.amount) };
      }
    } else {
      const existingPayment = devStore.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
      if (existingPayment) return existingPayment;
    }
  }

  const newAmountPaid = roundMoney(invoice.amountPaid + paymentAmount);
  const newStatus = deriveInvoiceStatus(
    invoice.status,
    newAmountPaid,
    invoice.total,
    invoice.dueDate ? new Date(invoice.dueDate) : null
  );

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

  if (isDatabaseConnected) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            invoiceId: input.invoiceId,
            amount: paymentAmount,
            currency: invoice.currency,
            method: input.method,
            reference: input.reference || null,
            paidAt,
            notes: input.notes || null,
            recordedBy: actorId,
            idempotencyKey: input.idempotencyKey || null,
            status: 'COMPLETED',
          },
        });

        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'PAYMENT_RECORDED',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: {
              invoiceId: input.invoiceId,
              invoiceNumber: invoice.invoiceNumber,
              amount: paymentAmount,
              newBalanceDue: roundMoney(invoice.total - newAmountPaid),
              newInvoiceStatus: newStatus,
            },
          },
        });

        return payment;
      });

      return {
        ...result,
        amount: Number(result.amount),
        updatedInvoice: {
          id: invoice.id,
          amountPaid: newAmountPaid,
          balanceDue: roundMoney(invoice.total - newAmountPaid),
          status: newStatus,
        },
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const paymentId = `f1000000-0000-0000-0000-${String(devStore.payments.length + 1).padStart(12, '0')}`;
  const newPayment: DevPayment = {
    id: paymentId,
    invoiceId: input.invoiceId,
    amount: paymentAmount,
    currency: invoice.currency,
    method: input.method,
    reference: input.reference || null,
    paidAt,
    notes: input.notes || null,
    status: 'COMPLETED',
    isReversed: false,
    reversedAt: null,
    reversalReason: null,
    recordedBy: actorId,
    idempotencyKey: input.idempotencyKey || null,
    createdAt: new Date(),
  };

  devStore.payments.unshift(newPayment);

  const storeInv = devStore.invoices.find((i) => i.id === input.invoiceId);
  if (storeInv) {
    storeInv.amountPaid = newAmountPaid;
    storeInv.status = newStatus;
    storeInv.updatedAt = new Date();
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'PAYMENT_RECORDED',
    entityType: 'Payment',
    entityId: paymentId,
    metadata: {
      invoiceId: input.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amount: paymentAmount,
      newBalanceDue: roundMoney(invoice.total - newAmountPaid),
      newInvoiceStatus: newStatus,
    },
    createdAt: new Date(),
  });

  return {
    ...newPayment,
    updatedInvoice: {
      id: invoice.id,
      amountPaid: newAmountPaid,
      balanceDue: roundMoney(invoice.total - newAmountPaid),
      status: newStatus,
    },
  };
}

export async function reversePayment(
  companyId: string,
  paymentId: string,
  actorId: string,
  input: ReversePaymentInput
) {
  let payment: any;
  if (isDatabaseConnected) {
    payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment || payment.invoice.companyId !== companyId) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }
  } else {
    payment = devStore.payments.find((p) => p.id === paymentId);
    if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    const inv = devStore.invoices.find((i) => i.id === payment.invoiceId);
    if (!inv || inv.companyId !== companyId) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    payment.invoice = inv;
  }

  if (payment.isReversed) {
    throw new AppError(400, 'ALREADY_REVERSED', 'This payment has already been reversed.');
  }

  const paymentAmount = Number(payment.amount);
  const currentAmountPaid = Number(payment.invoice.amountPaid);
  const newAmountPaid = Math.max(0, roundMoney(currentAmountPaid - paymentAmount));
  const newStatus = deriveInvoiceStatus(
    payment.invoice.status,
    newAmountPaid,
    Number(payment.invoice.total),
    payment.invoice.dueDate ? new Date(payment.invoice.dueDate) : null
  );

  const reversedAt = new Date();

  if (isDatabaseConnected) {
    try {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },
          data: {
            isReversed: true,
            reversedAt,
            reversalReason: input.reason,
            status: 'REVERSED',
          },
        }),
        prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
          },
        }),
        prisma.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'PAYMENT_REVERSED',
            entityType: 'Payment',
            entityId: paymentId,
            metadata: {
              invoiceId: payment.invoiceId,
              amount: paymentAmount,
              reason: input.reason,
              newInvoiceStatus: newStatus,
            },
          },
        }),
      ]);
      return { success: true, message: 'Payment successfully reversed' };
    } catch {
      // Fallback
    }
  }

  const storePayment = devStore.payments.find((p) => p.id === paymentId);
  if (storePayment) {
    storePayment.isReversed = true;
    storePayment.reversedAt = reversedAt;
    storePayment.reversalReason = input.reason;
    storePayment.status = 'REVERSED';
  }

  const storeInv = devStore.invoices.find((i) => i.id === payment.invoiceId);
  if (storeInv) {
    storeInv.amountPaid = newAmountPaid;
    storeInv.status = newStatus;
    storeInv.updatedAt = new Date();
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'PAYMENT_REVERSED',
    entityType: 'Payment',
    entityId: paymentId,
    metadata: {
      invoiceId: payment.invoiceId,
      amount: paymentAmount,
      reason: input.reason,
      newInvoiceStatus: newStatus,
    },
    createdAt: new Date(),
  });

  return { success: true, message: 'Payment successfully reversed' };
}
