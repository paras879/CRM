import { EstimateStatus, Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevEstimate, DevEstimateItem } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { generateDocumentNumber } from '../../utils/document-numbering.js';
import { calculateDocumentTotals } from '../../utils/financial-math.js';
import { createInvoice } from '../invoices/invoices.service.js';
import { CreateEstimateInput, UpdateEstimateInput, ListEstimatesQuery } from './estimates.schema.js';

export async function listEstimates(companyId: string, query: ListEstimatesQuery) {
  const { page, limit, search, customerId, projectId, status, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    try {
      const where: Prisma.EstimateWhereInput = {
        companyId,
        isArchived: false,
        ...(customerId ? { customerId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { estimateNumber: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [estimates, totalCount] = await Promise.all([
        prisma.estimate.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, email: true, companyName: true } },
            contact: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
            items: { orderBy: { order: 'asc' } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.estimate.count({ where }),
      ]);

      const formatted = estimates.map((e) => ({
        ...e,
        subtotal: Number(e.subtotal),
        discount: Number(e.discount),
        discountTotal: Number(e.discountTotal),
        taxTotal: Number(e.taxTotal),
        total: Number(e.total),
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
  let list = devStore.estimates.filter((e) => e.companyId === companyId && !e.isArchived);

  if (customerId) list = list.filter((e) => e.customerId === customerId);
  if (projectId) list = list.filter((e) => e.projectId === projectId);
  if (status) list = list.filter((e) => e.status === status);

  if (search) {
    const s = search.toLowerCase();
    list = list.filter((e) => {
      const cust = devStore.customers.find((c) => c.id === e.customerId);
      return (
        e.estimateNumber.toLowerCase().includes(s) ||
        (e.title && e.title.toLowerCase().includes(s)) ||
        (cust && cust.name.toLowerCase().includes(s))
      );
    });
  }

  list.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DevEstimate];
    let bVal: any = b[sortBy as keyof DevEstimate];
    if (aVal instanceof Date) aVal = aVal.getTime();
    if (bVal instanceof Date) bVal = bVal.getTime();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCount = list.length;
  const paged = list.slice(skip, skip + limit);

  const formatted = paged.map((e) => {
    const customer = devStore.customers.find((c) => c.id === e.customerId);
    const contact = e.contactId ? devStore.contacts.find((c) => c.id === e.contactId) : null;
    const project = e.projectId ? devStore.projects.find((pr) => pr.id === e.projectId) : null;
    const items = devStore.estimateItems
      .filter((i) => i.estimateId === e.id)
      .sort((a, b) => a.order - b.order);

    return {
      ...e,
      customer: customer ? { id: customer.id, name: customer.name, email: customer.email, companyName: customer.companyName } : null,
      contact: contact ? { id: contact.id, name: contact.name, email: contact.email } : null,
      project: project ? { id: project.id, name: project.name } : null,
      items,
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

export async function getEstimateById(companyId: string, estimateId: string) {
  if (isDatabaseConnected) {
    try {
      const estimate = await prisma.estimate.findFirst({
        where: { id: estimateId, companyId },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, city: true, state: true, country: true, companyName: true } },
          contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
          project: { select: { id: true, name: true } },
          items: { orderBy: { order: 'asc' } },
        },
      });

      if (!estimate) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Estimate not found');

      // Fetch related invoice if converted
      let relatedInvoice = null;
      if (estimate.convertedToInvoiceId) {
        relatedInvoice = await prisma.invoice.findUnique({
          where: { id: estimate.convertedToInvoiceId },
          select: { id: true, invoiceNumber: true, status: true, total: true, amountPaid: true },
        });
      }

      return {
        ...estimate,
        subtotal: Number(estimate.subtotal),
        discount: Number(estimate.discount),
        discountTotal: Number(estimate.discountTotal),
        taxTotal: Number(estimate.taxTotal),
        total: Number(estimate.total),
        relatedInvoice: relatedInvoice
          ? {
              ...relatedInvoice,
              total: Number(relatedInvoice.total),
              amountPaid: Number(relatedInvoice.amountPaid),
            }
          : null,
        items: estimate.items.map((i) => ({
          ...i,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount),
          taxRate: Number(i.taxRate),
          lineTotal: Number(i.lineTotal),
        })),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
    }
  }

  // DevStore
  const estimate = devStore.estimates.find((e) => e.id === estimateId && e.companyId === companyId);
  if (!estimate) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Estimate not found');

  const customer = devStore.customers.find((c) => c.id === estimate.customerId);
  const contact = estimate.contactId ? devStore.contacts.find((c) => c.id === estimate.contactId) : null;
  const project = estimate.projectId ? devStore.projects.find((p) => p.id === estimate.projectId) : null;
  const items = devStore.estimateItems
    .filter((i) => i.estimateId === estimate.id)
    .sort((a, b) => a.order - b.order);

  let relatedInvoice = null;
  if (estimate.convertedToInvoiceId) {
    const inv = devStore.invoices.find((i) => i.id === estimate.convertedToInvoiceId);
    if (inv) {
      relatedInvoice = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        total: inv.total,
        amountPaid: inv.amountPaid,
      };
    }
  }

  return {
    ...estimate,
    customer: customer || null,
    contact: contact || null,
    project: project || null,
    items,
    relatedInvoice,
  };
}

export async function createEstimate(companyId: string, actorId: string, input: CreateEstimateInput) {
  // Validate customer
  if (isDatabaseConnected) {
    const cust = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found in this company');
    if (input.projectId) {
      const proj = await prisma.project.findFirst({ where: { id: input.projectId, companyId } });
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project not found in this company');
    }
  } else {
    const cust = devStore.customers.find((c) => c.id === input.customerId && c.companyId === companyId);
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found in this company');
    if (input.projectId) {
      const proj = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project not found in this company');
    }
  }

  const totals = calculateDocumentTotals(input.items, input.discount);
  const estimateNumber = await generateDocumentNumber(companyId, 'estimate');

  const validUntilObj = input.validUntil ? new Date(input.validUntil) : null;
  const issuedAtObj = input.issuedAt ? new Date(input.issuedAt) : new Date();

  const requestedStatus = input.status || EstimateStatus.DRAFT;
  const acceptedAt = requestedStatus === EstimateStatus.ACCEPTED ? new Date() : null;
  const declinedAt = requestedStatus === EstimateStatus.DECLINED ? new Date() : null;

  if (isDatabaseConnected) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const est = await tx.estimate.create({
          data: {
            companyId,
            customerId: input.customerId,
            contactId: input.contactId || null,
            projectId: input.projectId || null,
            estimateNumber,
            title: input.title,
            status: requestedStatus,
            currency: input.currency || 'INR',
            subtotal: totals.subtotal,
            discount: input.discount || 0,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            validUntil: validUntilObj,
            issuedAt: issuedAtObj,
            acceptedAt,
            declinedAt,
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
          include: { customer: true, contact: true, project: true, items: true },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'ESTIMATE_CREATED',
            entityType: 'Estimate',
            entityId: est.id,
            metadata: { estimateNumber, total: totals.total },
          },
        });

        return est;
      });

      return {
        ...created,
        subtotal: Number(created.subtotal),
        discount: Number(created.discount),
        discountTotal: Number(created.discountTotal),
        taxTotal: Number(created.taxTotal),
        total: Number(created.total),
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const newId = `b1000000-0000-0000-0000-${String(devStore.estimates.length + 1).padStart(12, '0')}`;
  const newEstimate: DevEstimate = {
    id: newId,
    companyId,
    customerId: input.customerId,
    contactId: input.contactId || null,
    projectId: input.projectId || null,
    estimateNumber,
    title: input.title,
    status: requestedStatus,
    currency: input.currency || 'INR',
    subtotal: totals.subtotal,
    discount: input.discount || 0,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    validUntil: validUntilObj,
    issuedAt: issuedAtObj,
    acceptedAt,
    declinedAt,
    notes: input.notes || null,
    terms: input.terms || null,
    isArchived: false,
    convertedToInvoiceId: null,
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const newItems: DevEstimateItem[] = totals.items.map((i, idx) => ({
    id: `b1010000-0000-0000-0000-${String(devStore.estimateItems.length + idx + 1).padStart(12, '0')}`,
    estimateId: newId,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount,
    taxRate: i.taxRate,
    lineTotal: i.lineTotal,
    order: i.order,
  }));

  devStore.estimates.unshift(newEstimate);
  devStore.estimateItems.push(...newItems);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'ESTIMATE_CREATED',
    entityType: 'Estimate',
    entityId: newId,
    metadata: { estimateNumber, total: totals.total },
    createdAt: new Date(),
  });

  return {
    ...newEstimate,
    items: newItems,
    customer: devStore.customers.find((c) => c.id === input.customerId) || null,
    contact: input.contactId ? devStore.contacts.find((c) => c.id === input.contactId) || null : null,
    project: input.projectId ? devStore.projects.find((p) => p.id === input.projectId) || null : null,
  };
}

export async function updateEstimate(
  companyId: string,
  estimateId: string,
  actorId: string,
  input: UpdateEstimateInput
) {
  const existing = await getEstimateById(companyId, estimateId);

  if (existing.convertedToInvoiceId) {
    throw new AppError(400, 'ESTIMATE_CONVERTED', 'Cannot edit an estimate that has already been converted to an invoice.');
  }

  const itemsToCalc = input.items || existing.items;
  const docDiscount = input.discount !== undefined ? input.discount : existing.discount;
  const totals = calculateDocumentTotals(itemsToCalc, docDiscount);

  const validUntilObj = input.validUntil !== undefined ? (input.validUntil ? new Date(input.validUntil) : null) : existing.validUntil ? new Date(existing.validUntil) : null;

  let acceptedAt = existing.acceptedAt ? new Date(existing.acceptedAt) : null;
  let declinedAt = existing.declinedAt ? new Date(existing.declinedAt) : null;

  if (input.status === EstimateStatus.ACCEPTED && existing.status !== EstimateStatus.ACCEPTED) {
    acceptedAt = new Date();
  } else if (input.status === EstimateStatus.DECLINED && existing.status !== EstimateStatus.DECLINED) {
    declinedAt = new Date();
  }

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (input.items) {
          await tx.estimateItem.deleteMany({ where: { estimateId } });
        }

        const est = await tx.estimate.update({
          where: { id: estimateId },
          data: {
            title: input.title || existing.title,
            customerId: input.customerId || existing.customerId,
            contactId: input.contactId !== undefined ? input.contactId : existing.contactId,
            projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
            status: input.status || existing.status,
            currency: input.currency || existing.currency,
            subtotal: totals.subtotal,
            discount: docDiscount,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            validUntil: validUntilObj,
            issuedAt: input.issuedAt !== undefined ? (input.issuedAt ? new Date(input.issuedAt) : null) : existing.issuedAt,
            acceptedAt,
            declinedAt,
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
          include: { customer: true, contact: true, project: true, items: true },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            actorId,
            action: 'ESTIMATE_UPDATED',
            entityType: 'Estimate',
            entityId: estimateId,
            metadata: { total: totals.total, status: est.status },
          },
        });

        return est;
      });

      return {
        ...updated,
        subtotal: Number(updated.subtotal),
        discount: Number(updated.discount),
        discountTotal: Number(updated.discountTotal),
        taxTotal: Number(updated.taxTotal),
        total: Number(updated.total),
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const storeEst = devStore.estimates.find((e) => e.id === estimateId);
  if (!storeEst) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Estimate not found');

  if (input.title) storeEst.title = input.title;
  if (input.customerId) storeEst.customerId = input.customerId;
  if (input.contactId !== undefined) storeEst.contactId = input.contactId;
  if (input.projectId !== undefined) storeEst.projectId = input.projectId;
  if (input.status) storeEst.status = input.status;
  if (input.currency) storeEst.currency = input.currency;
  storeEst.subtotal = totals.subtotal;
  storeEst.discount = docDiscount;
  storeEst.discountTotal = totals.discountTotal;
  storeEst.taxTotal = totals.taxTotal;
  storeEst.total = totals.total;
  if (input.validUntil !== undefined) storeEst.validUntil = validUntilObj;
  if (input.issuedAt !== undefined) storeEst.issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;
  storeEst.acceptedAt = acceptedAt;
  storeEst.declinedAt = declinedAt;
  if (input.notes !== undefined) storeEst.notes = input.notes;
  if (input.terms !== undefined) storeEst.terms = input.terms;
  storeEst.updatedAt = new Date();

  if (input.items) {
    devStore.estimateItems = devStore.estimateItems.filter((i) => i.estimateId !== estimateId);
    const newItems: DevEstimateItem[] = totals.items.map((i, idx) => ({
      id: `b1010000-${Date.now()}-${idx}`,
      estimateId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
      lineTotal: i.lineTotal,
      order: i.order,
    }));
    devStore.estimateItems.push(...newItems);
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'ESTIMATE_UPDATED',
    entityType: 'Estimate',
    entityId: estimateId,
    metadata: { total: totals.total, status: storeEst.status },
    createdAt: new Date(),
  });

  return getEstimateById(companyId, estimateId);
}

export async function convertEstimateToInvoice(companyId: string, estimateId: string, actorId: string) {
  const estimate = await getEstimateById(companyId, estimateId);

  if (estimate.convertedToInvoiceId) {
    throw new AppError(400, 'ALREADY_CONVERTED', `This estimate was already converted to invoice (${estimate.convertedToInvoiceId}). Duplicate conversion prevented.`);
  }

  if (estimate.status !== EstimateStatus.ACCEPTED) {
    throw new AppError(400, 'INVALID_STATUS', `Only accepted estimates can be converted to invoices. Current status: ${estimate.status}`);
  }

  // Create invoice from estimate items
  const createdInvoice = await createInvoice(companyId, actorId, {
    customerId: estimate.customerId,
    projectId: estimate.projectId,
    title: `Invoice for ${estimate.title}`,
    currency: estimate.currency,
    discount: estimate.discount,
    notes: estimate.notes,
    terms: estimate.terms,
    items: estimate.items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount),
      taxRate: Number(i.taxRate),
      order: i.order,
    })),
  });

  const convertedAt = new Date();

  if (isDatabaseConnected) {
    try {
      await prisma.estimate.update({
        where: { id: estimateId },
        data: {
          convertedToInvoiceId: createdInvoice.id,
          convertedAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'ESTIMATE_CONVERTED_TO_INVOICE',
          entityType: 'Estimate',
          entityId: estimateId,
          metadata: { invoiceId: createdInvoice.id, invoiceNumber: (createdInvoice as any).invoiceNumber },
        },
      });
    } catch {
      // Fallback
    }
  }

  const storeEst = devStore.estimates.find((e) => e.id === estimateId);
  if (storeEst) {
    storeEst.convertedToInvoiceId = createdInvoice.id;
    storeEst.convertedAt = convertedAt;
    storeEst.updatedAt = new Date();
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'ESTIMATE_CONVERTED_TO_INVOICE',
    entityType: 'Estimate',
    entityId: estimateId,
    metadata: { invoiceId: createdInvoice.id, invoiceNumber: (createdInvoice as any).invoiceNumber },
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Estimate successfully converted to invoice',
    invoice: createdInvoice,
  };
}

export async function archiveEstimate(companyId: string, estimateId: string, actorId: string) {
  if (isDatabaseConnected) {
    try {
      await prisma.estimate.update({
        where: { id: estimateId },
        data: { isArchived: true },
      });
      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'ESTIMATE_ARCHIVED',
          entityType: 'Estimate',
          entityId: estimateId,
        },
      });
      return { success: true };
    } catch {
      // Fallback
    }
  }

  const storeEst = devStore.estimates.find((e) => e.id === estimateId);
  if (!storeEst) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Estimate not found');
  storeEst.isArchived = true;
  storeEst.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'ESTIMATE_ARCHIVED',
    entityType: 'Estimate',
    entityId: estimateId,
    metadata: {},
    createdAt: new Date(),
  });

  return { success: true };
}
