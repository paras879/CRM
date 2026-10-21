import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevInvoice, DevInvoiceItem } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { generateDocumentNumber } from '../../utils/document-numbering.js';
import { calculateDocumentTotals } from '../../utils/financial-math.js';
import { CreateInvoiceInput, UpdateInvoiceInput, ListInvoicesQuery } from './invoices.schema.js';

export function deriveInvoiceStatus(
  currentStatus: InvoiceStatus,
  amountPaid: number,
  total: number,
  dueDate: Date | null
): InvoiceStatus {
  if (currentStatus === InvoiceStatus.DRAFT) return InvoiceStatus.DRAFT;
  if (currentStatus === InvoiceStatus.VOID || currentStatus === InvoiceStatus.CANCELLED) return currentStatus;
  if (amountPaid >= total && total > 0) return InvoiceStatus.PAID;
  if (amountPaid > 0 && amountPaid < total) return InvoiceStatus.PARTIALLY_PAID;
  if (dueDate && new Date(dueDate).getTime() < Date.now() && amountPaid < total) return InvoiceStatus.OVERDUE;
  return InvoiceStatus.UNPAID;
}

export async function listInvoices(companyId: string, query: ListInvoicesQuery) {
  const { page, limit, search, customerId, projectId, status, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    try {
      const where: Prisma.InvoiceWhereInput = {
        companyId,
        isArchived: false,
        ...(customerId ? { customerId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
          : {}),
      };

      const [invoices, totalCount] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, email: true, companyName: true } },
            project: { select: { id: true, name: true } },
            items: { orderBy: { order: 'asc' } },
            payments: { orderBy: { paidAt: 'desc' } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.invoice.count({ where }),
      ]);

      const formatted = invoices.map((inv) => ({
        ...inv,
        subtotal: Number(inv.subtotal),
        discount: Number(inv.discount),
        discountTotal: Number(inv.discountTotal),
        taxTotal: Number(inv.taxTotal),
        total: Number(inv.total),
        amountPaid: Number(inv.amountPaid),
        balanceDue: Math.max(0, Number(inv.total) - Number(inv.amountPaid)),
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

  // DevStore fallback
  let list = devStore.invoices.filter((inv) => inv.companyId === companyId && !inv.isArchived);

  if (customerId) list = list.filter((inv) => inv.customerId === customerId);
  if (projectId) list = list.filter((inv) => inv.projectId === projectId);
  if (status) list = list.filter((inv) => inv.status === status);

  if (search) {
    const s = search.toLowerCase();
    list = list.filter((inv) => {
      const cust = devStore.customers.find((c) => c.id === inv.customerId);
      return (
        inv.invoiceNumber.toLowerCase().includes(s) ||
        (inv.title && inv.title.toLowerCase().includes(s)) ||
        (cust && cust.name.toLowerCase().includes(s))
      );
    });
  }

  // Sort
  list.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DevInvoice];
    let bVal: any = b[sortBy as keyof DevInvoice];
    if (aVal instanceof Date) aVal = aVal.getTime();
    if (bVal instanceof Date) bVal = bVal.getTime();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCount = list.length;
  const paged = list.slice(skip, skip + limit);

  const formatted = paged.map((inv) => {
    const customer = devStore.customers.find((c) => c.id === inv.customerId);
    const project = inv.projectId ? devStore.projects.find((p) => p.id === inv.projectId) : null;
    const items = devStore.invoiceItems
      .filter((item) => item.invoiceId === inv.id)
      .sort((a, b) => a.order - b.order);
    const payments = devStore.payments.filter((p) => p.invoiceId === inv.id && !p.isReversed);

    return {
      ...inv,
      balanceDue: Math.max(0, inv.total - inv.amountPaid),
      customer: customer ? { id: customer.id, name: customer.name, email: customer.email, companyName: customer.companyName } : null,
      project: project ? { id: project.id, name: project.name } : null,
      items,
      payments,
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

export async function getInvoiceById(companyId: string, invoiceId: string) {
  if (isDatabaseConnected) {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, companyId },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, city: true, state: true, country: true, zipCode: true, taxId: true, companyName: true } },
          project: { select: { id: true, name: true } },
          items: { orderBy: { order: 'asc' } },
          payments: {
            where: { isReversed: false },
            include: { recorder: { select: { id: true, name: true, email: true } } },
            orderBy: { paidAt: 'desc' },
          },
        },
      });

      if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');

      return {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        discount: Number(invoice.discount),
        discountTotal: Number(invoice.discountTotal),
        taxTotal: Number(invoice.taxTotal),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        balanceDue: Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)),
        items: invoice.items.map((i) => ({
          ...i,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount),
          taxRate: Number(i.taxRate),
          lineTotal: Number(i.lineTotal),
        })),
        payments: invoice.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
    }
  }

  // DevStore
  const invoice = devStore.invoices.find((i) => i.id === invoiceId && i.companyId === companyId);
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');

  const customer = devStore.customers.find((c) => c.id === invoice.customerId);
  const project = invoice.projectId ? devStore.projects.find((p) => p.id === invoice.projectId) : null;
  const items = devStore.invoiceItems
    .filter((item) => item.invoiceId === invoice.id)
    .sort((a, b) => a.order - b.order);
  const payments = devStore.payments
    .filter((p) => p.invoiceId === invoice.id && !p.isReversed)
    .map((p) => {
      const recorder = devStore.users.find((u) => u.id === p.recordedBy);
      return {
        ...p,
        recorder: recorder ? { id: recorder.id, name: recorder.name, email: recorder.email } : null,
      };
    });

  return {
    ...invoice,
    balanceDue: Math.max(0, invoice.total - invoice.amountPaid),
    customer: customer || null,
    project: project || null,
    items,
    payments,
  };
}

export async function createInvoice(companyId: string, actorId: string, input: CreateInvoiceInput) {
  // Validate customer belongs to company
  if (isDatabaseConnected) {
    const cust = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer does not exist or belong to this organization');
    if (input.projectId) {
      const proj = await prisma.project.findFirst({ where: { id: input.projectId, companyId } });
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project does not exist or belong to this organization');
    }
  } else {
    const cust = devStore.customers.find((c) => c.id === input.customerId && c.companyId === companyId);
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer does not exist or belong to this organization');
    if (input.projectId) {
      const proj = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project does not exist or belong to this organization');
    }
  }

  // Calculate totals precisely on backend
  const totals = calculateDocumentTotals(input.items, input.discount);
  const invoiceNumber = await generateDocumentNumber(companyId, 'invoice');

  const requestedStatus = input.status || InvoiceStatus.DRAFT;
  const dueDateObj = input.dueDate ? new Date(input.dueDate) : null;
  const issuedAtObj = input.issuedAt ? new Date(input.issuedAt) : requestedStatus !== InvoiceStatus.DRAFT ? new Date() : null;
  const finalStatus = deriveInvoiceStatus(requestedStatus, 0, totals.total, dueDateObj);

  if (isDatabaseConnected) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            companyId,
            customerId: input.customerId,
            projectId: input.projectId || null,
            invoiceNumber,
            title: input.title || `Invoice ${invoiceNumber}`,
            status: finalStatus,
            currency: input.currency || 'INR',
            subtotal: totals.subtotal,
            discount: input.discount || 0,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            amountPaid: 0,
            issuedAt: issuedAtObj,
            dueDate: dueDateObj,
            notes: input.notes || null,
            terms: input.terms || null,
            items: {
              create: totals.items.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                discount: i.discount,
                taxRate: i.taxRate,
                lineTotal: i.lineTotal,
                order: i.order,
              })),
            },
          },
          include: {
            customer: true,
            project: true,
            items: true,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'INVOICE_CREATED',
            entityType: 'Invoice',
            entityId: inv.id,
            metadata: { invoiceNumber, total: totals.total, status: finalStatus },
          },
        });

        return inv;
      });

      return {
        ...created,
        subtotal: Number(created.subtotal),
        discount: Number(created.discount),
        discountTotal: Number(created.discountTotal),
        taxTotal: Number(created.taxTotal),
        total: Number(created.total),
        amountPaid: 0,
        balanceDue: Number(created.total),
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const newId = `e1000000-0000-0000-0000-${String(devStore.invoices.length + 1).padStart(12, '0')}`;
  const newInvoice: DevInvoice = {
    id: newId,
    companyId,
    customerId: input.customerId,
    projectId: input.projectId || null,
    invoiceNumber,
    title: input.title || `Invoice ${invoiceNumber}`,
    status: finalStatus,
    currency: input.currency || 'INR',
    subtotal: totals.subtotal,
    discount: input.discount || 0,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    amountPaid: 0,
    issuedAt: issuedAtObj,
    dueDate: dueDateObj,
    notes: input.notes || null,
    terms: input.terms || null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const newItems: DevInvoiceItem[] = totals.items.map((i, idx) => ({
    id: `e1010000-0000-0000-0000-${String(devStore.invoiceItems.length + idx + 1).padStart(12, '0')}`,
    invoiceId: newId,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount,
    taxRate: i.taxRate,
    lineTotal: i.lineTotal,
    order: i.order,
  }));

  devStore.invoices.unshift(newInvoice);
  devStore.invoiceItems.push(...newItems);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'INVOICE_CREATED',
    entityType: 'Invoice',
    entityId: newId,
    metadata: { invoiceNumber, total: totals.total, status: finalStatus },
    createdAt: new Date(),
  });

  return {
    ...newInvoice,
    balanceDue: newInvoice.total,
    items: newItems,
    customer: devStore.customers.find((c) => c.id === input.customerId) || null,
    project: input.projectId ? devStore.projects.find((p) => p.id === input.projectId) || null : null,
    payments: [],
  };
}

export async function updateInvoice(
  companyId: string,
  invoiceId: string,
  actorId: string,
  input: UpdateInvoiceInput
) {
  const existing = await getInvoiceById(companyId, invoiceId);

  // Issued invoices with payments cannot have line items destructively changed
  if (existing.amountPaid > 0 && input.items) {
    throw new AppError(400, 'INVOICE_LOCKED', 'Cannot modify line items of an invoice with recorded payments');
  }

  const itemsToCalc = input.items || existing.items;
  const docDiscount = input.discount !== undefined ? input.discount : existing.discount;
  const totals = calculateDocumentTotals(itemsToCalc, docDiscount);

  const dueDateObj = input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing.dueDate ? new Date(existing.dueDate) : null;
  const targetStatus = input.status !== undefined ? input.status : existing.status;
  const finalStatus = deriveInvoiceStatus(targetStatus, existing.amountPaid, totals.total, dueDateObj);

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (input.items) {
          await tx.invoiceItem.deleteMany({ where: { invoiceId } });
        }

        const inv = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            title: input.title !== undefined ? input.title : existing.title,
            customerId: input.customerId || existing.customerId,
            projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
            status: finalStatus,
            currency: input.currency || existing.currency,
            subtotal: totals.subtotal,
            discount: docDiscount,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            issuedAt: input.issuedAt !== undefined ? (input.issuedAt ? new Date(input.issuedAt) : null) : existing.issuedAt,
            dueDate: dueDateObj,
            notes: input.notes !== undefined ? input.notes : existing.notes,
            terms: input.terms !== undefined ? input.terms : existing.terms,
            ...(input.items
              ? {
                items: {
                  create: totals.items.map((i) => ({
                    description: i.description,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    discount: i.discount,
                    taxRate: i.taxRate,
                    lineTotal: i.lineTotal,
                    order: i.order,
                  })),
                },
              }
              : {}),
          },
          include: { customer: true, project: true, items: true },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'INVOICE_UPDATED',
            entityType: 'Invoice',
            entityId: invoiceId,
            metadata: { total: totals.total, status: finalStatus },
          },
        });

        return inv;
      });

      return {
        ...updated,
        subtotal: Number(updated.subtotal),
        discount: Number(updated.discount),
        discountTotal: Number(updated.discountTotal),
        taxTotal: Number(updated.taxTotal),
        total: Number(updated.total),
        amountPaid: Number(updated.amountPaid),
        balanceDue: Math.max(0, Number(updated.total) - Number(updated.amountPaid)),
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const storeInv = devStore.invoices.find((i) => i.id === invoiceId);
  if (!storeInv) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');

  if (input.title !== undefined) storeInv.title = input.title;
  if (input.customerId) storeInv.customerId = input.customerId;
  if (input.projectId !== undefined) storeInv.projectId = input.projectId;
  storeInv.status = finalStatus;
  if (input.currency) storeInv.currency = input.currency;
  storeInv.subtotal = totals.subtotal;
  storeInv.discount = docDiscount;
  storeInv.discountTotal = totals.discountTotal;
  storeInv.taxTotal = totals.taxTotal;
  storeInv.total = totals.total;
  if (input.issuedAt !== undefined) storeInv.issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;
  if (input.dueDate !== undefined) storeInv.dueDate = dueDateObj;
  if (input.notes !== undefined) storeInv.notes = input.notes;
  if (input.terms !== undefined) storeInv.terms = input.terms;
  storeInv.updatedAt = new Date();

  if (input.items) {
    devStore.invoiceItems = devStore.invoiceItems.filter((i) => i.invoiceId !== invoiceId);
    const newItems: DevInvoiceItem[] = totals.items.map((i, idx) => ({
      id: `e1010000-${Date.now()}-${idx}`,
      invoiceId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
      lineTotal: i.lineTotal,
      order: i.order,
    }));
    devStore.invoiceItems.push(...newItems);
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'INVOICE_UPDATED',
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { total: totals.total, status: finalStatus },
    createdAt: new Date(),
  });

  return getInvoiceById(companyId, invoiceId);
}

export async function issueInvoice(companyId: string, invoiceId: string, actorId: string) {
  const existing = await getInvoiceById(companyId, invoiceId);
  if (existing.status !== InvoiceStatus.DRAFT) {
    throw new AppError(400, 'INVALID_TRANSITION', `Invoice is already in ${existing.status} status`);
  }

  const issuedAt = new Date();
  const dueDate = existing.dueDate ? new Date(existing.dueDate) : new Date(Date.now() + 14 * 86400000);
  const status = deriveInvoiceStatus(InvoiceStatus.UNPAID, existing.amountPaid, existing.total, dueDate);

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status, issuedAt, dueDate },
      });
      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'INVOICE_ISSUED',
          entityType: 'Invoice',
          entityId: invoiceId,
          metadata: { invoiceNumber: existing.invoiceNumber, issuedAt },
        },
      });
      return getInvoiceById(companyId, invoiceId);
    } catch {
      // Fallback
    }
  }

  const storeInv = devStore.invoices.find((i) => i.id === invoiceId);
  if (!storeInv) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
  storeInv.status = status;
  storeInv.issuedAt = issuedAt;
  storeInv.dueDate = dueDate;
  storeInv.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'INVOICE_ISSUED',
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { invoiceNumber: existing.invoiceNumber, issuedAt },
    createdAt: new Date(),
  });

  return getInvoiceById(companyId, invoiceId);
}

export async function voidInvoice(companyId: string, invoiceId: string, actorId: string, reason?: string) {
  const existing = await getInvoiceById(companyId, invoiceId);
  if (existing.amountPaid > 0) {
    throw new AppError(400, 'INVOICE_HAS_PAYMENTS', 'Cannot void an invoice with active payments. Reverse payments first.');
  }

  if (isDatabaseConnected) {
    try {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.VOID },
      });
      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'INVOICE_VOIDED',
          entityType: 'Invoice',
          entityId: invoiceId,
          metadata: { reason: reason || 'Voided by authorized user' },
        },
      });
      return getInvoiceById(companyId, invoiceId);
    } catch {
      // Fallback
    }
  }

  const storeInv = devStore.invoices.find((i) => i.id === invoiceId);
  if (!storeInv) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
  storeInv.status = InvoiceStatus.VOID;
  storeInv.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'INVOICE_VOIDED',
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { reason: reason || 'Voided by authorized user' },
    createdAt: new Date(),
  });

  return getInvoiceById(companyId, invoiceId);
}

export async function deleteInvoice(companyId: string, invoiceId: string, actorId: string) {
  const existing = await getInvoiceById(companyId, invoiceId);
  if (existing.status !== InvoiceStatus.DRAFT) {
    throw new AppError(400, 'CANNOT_DELETE_ISSUED_INVOICE', 'Only draft invoices can be deleted. Use void for issued invoices to preserve financial history.');
  }

  if (isDatabaseConnected) {
    try {
      await prisma.$transaction([
        prisma.invoiceItem.deleteMany({ where: { invoiceId } }),
        prisma.invoice.delete({ where: { id: invoiceId } }),
        prisma.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'INVOICE_DELETED',
            entityType: 'Invoice',
            entityId: invoiceId,
            metadata: { invoiceNumber: existing.invoiceNumber },
          },
        }),
      ]);
      return { success: true };
    } catch {
      // Fallback
    }
  }

  devStore.invoiceItems = devStore.invoiceItems.filter((i) => i.invoiceId !== invoiceId);
  devStore.invoices = devStore.invoices.filter((i) => i.id !== invoiceId);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'INVOICE_DELETED',
    entityType: 'Invoice',
    entityId: invoiceId,
    metadata: { invoiceNumber: existing.invoiceNumber },
    createdAt: new Date(),
  });

  return { success: true };
}
