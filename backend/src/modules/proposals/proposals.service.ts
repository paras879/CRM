import { ProposalStatus, Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevProposal, DevProposalItem } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { generateDocumentNumber } from '../../utils/document-numbering.js';
import { calculateDocumentTotals } from '../../utils/financial-math.js';
import { createInvoice } from '../invoices/invoices.service.js';
import { CreateProposalInput, UpdateProposalInput, ListProposalsQuery } from './proposals.schema.js';

export async function listProposals(companyId: string, query: ListProposalsQuery) {
  const { page, limit, search, customerId, projectId, status, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    try {
      const where: Prisma.ProposalWhereInput = {
        companyId,
        isArchived: false,
        ...(customerId ? { customerId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { proposalNumber: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [proposals, totalCount] = await Promise.all([
        prisma.proposal.findMany({
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
        prisma.proposal.count({ where }),
      ]);

      const formatted = proposals.map((p) => ({
        ...p,
        subtotal: Number(p.subtotal),
        discount: Number(p.discount),
        discountTotal: Number(p.discountTotal),
        taxTotal: Number(p.taxTotal),
        total: Number(p.total),
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
  let list = devStore.proposals.filter((p) => p.companyId === companyId && !p.isArchived);

  if (customerId) list = list.filter((p) => p.customerId === customerId);
  if (projectId) list = list.filter((p) => p.projectId === projectId);
  if (status) list = list.filter((p) => p.status === status);

  if (search) {
    const s = search.toLowerCase();
    list = list.filter((p) => {
      const cust = devStore.customers.find((c) => c.id === p.customerId);
      return (
        p.proposalNumber.toLowerCase().includes(s) ||
        p.subject.toLowerCase().includes(s) ||
        (p.title && p.title.toLowerCase().includes(s)) ||
        (cust && cust.name.toLowerCase().includes(s))
      );
    });
  }

  list.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DevProposal];
    let bVal: any = b[sortBy as keyof DevProposal];
    if (aVal instanceof Date) aVal = aVal.getTime();
    if (bVal instanceof Date) bVal = bVal.getTime();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCount = list.length;
  const paged = list.slice(skip, skip + limit);

  const formatted = paged.map((p) => {
    const customer = devStore.customers.find((c) => c.id === p.customerId);
    const contact = p.contactId ? devStore.contacts.find((c) => c.id === p.contactId) : null;
    const project = p.projectId ? devStore.projects.find((pr) => pr.id === p.projectId) : null;
    const items = devStore.proposalItems
      .filter((i) => i.proposalId === p.id)
      .sort((a, b) => a.order - b.order);

    return {
      ...p,
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

export async function getProposalById(companyId: string, proposalId: string) {
  if (isDatabaseConnected) {
    try {
      const proposal = await prisma.proposal.findFirst({
        where: { id: proposalId, companyId },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, city: true, state: true, country: true, companyName: true } },
          contact: { select: { id: true, name: true, email: true, phone: true, title: true } },
          project: { select: { id: true, name: true } },
          items: { orderBy: { order: 'asc' } },
        },
      });

      if (!proposal) throw new AppError(404, 'PROPOSAL_NOT_FOUND', 'Proposal not found');

      return {
        ...proposal,
        subtotal: Number(proposal.subtotal),
        discount: Number(proposal.discount),
        discountTotal: Number(proposal.discountTotal),
        taxTotal: Number(proposal.taxTotal),
        total: Number(proposal.total),
        items: proposal.items.map((i) => ({
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
  const proposal = devStore.proposals.find((p) => p.id === proposalId && p.companyId === companyId);
  if (!proposal) throw new AppError(404, 'PROPOSAL_NOT_FOUND', 'Proposal not found');

  const customer = devStore.customers.find((c) => c.id === proposal.customerId);
  const contact = proposal.contactId ? devStore.contacts.find((c) => c.id === proposal.contactId) : null;
  const project = proposal.projectId ? devStore.projects.find((p) => p.id === proposal.projectId) : null;
  const items = devStore.proposalItems
    .filter((i) => i.proposalId === proposal.id)
    .sort((a, b) => a.order - b.order);

  return {
    ...proposal,
    customer: customer || null,
    contact: contact || null,
    project: project || null,
    items,
  };
}

export async function createProposal(companyId: string, actorId: string, input: CreateProposalInput) {
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
  const proposalNumber = await generateDocumentNumber(companyId, 'proposal');

  const validUntilObj = input.validUntil ? new Date(input.validUntil) : null;
  const issuedAtObj = input.issuedAt ? new Date(input.issuedAt) : new Date();

  if (isDatabaseConnected) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const prop = await tx.proposal.create({
          data: {
            companyId,
            customerId: input.customerId,
            contactId: input.contactId || null,
            projectId: input.projectId || null,
            proposalNumber,
            title: input.title || input.subject,
            subject: input.subject,
            status: input.status || ProposalStatus.DRAFT,
            currency: input.currency || 'INR',
            subtotal: totals.subtotal,
            discount: input.discount || 0,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            validUntil: validUntilObj,
            issuedAt: issuedAtObj,
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
            action: 'PROPOSAL_CREATED',
            entityType: 'Proposal',
            entityId: prop.id,
            metadata: { proposalNumber, total: totals.total },
          },
        });

        return prop;
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
  const newId = `a1000000-0000-0000-0000-${String(devStore.proposals.length + 1).padStart(12, '0')}`;
  const newProposal: DevProposal = {
    id: newId,
    companyId,
    customerId: input.customerId,
    contactId: input.contactId || null,
    projectId: input.projectId || null,
    proposalNumber,
    title: input.title || input.subject,
    subject: input.subject,
    status: input.status || ProposalStatus.DRAFT,
    currency: input.currency || 'INR',
    subtotal: totals.subtotal,
    discount: input.discount || 0,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    validUntil: validUntilObj,
    issuedAt: issuedAtObj,
    notes: input.notes || null,
    terms: input.terms || null,
    isArchived: false,
    convertedToEstimateId: null,
    convertedToInvoiceId: null,
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const newItems: DevProposalItem[] = totals.items.map((i, idx) => ({
    id: `a1010000-0000-0000-0000-${String(devStore.proposalItems.length + idx + 1).padStart(12, '0')}`,
    proposalId: newId,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount,
    taxRate: i.taxRate,
    lineTotal: i.lineTotal,
    order: i.order,
  }));

  devStore.proposals.unshift(newProposal);
  devStore.proposalItems.push(...newItems);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'PROPOSAL_CREATED',
    entityType: 'Proposal',
    entityId: newId,
    metadata: { proposalNumber, total: totals.total },
    createdAt: new Date(),
  });

  return {
    ...newProposal,
    items: newItems,
    customer: devStore.customers.find((c) => c.id === input.customerId) || null,
    contact: input.contactId ? devStore.contacts.find((c) => c.id === input.contactId) || null : null,
    project: input.projectId ? devStore.projects.find((p) => p.id === input.projectId) || null : null,
  };
}

export async function updateProposal(
  companyId: string,
  proposalId: string,
  actorId: string,
  input: UpdateProposalInput
) {
  const existing = await getProposalById(companyId, proposalId);

  if (existing.convertedToInvoiceId || existing.convertedToEstimateId) {
    throw new AppError(400, 'PROPOSAL_CONVERTED', 'Cannot edit a proposal that has already been converted to an estimate or invoice.');
  }

  const itemsToCalc = input.items || existing.items;
  const docDiscount = input.discount !== undefined ? input.discount : existing.discount;
  const totals = calculateDocumentTotals(itemsToCalc, docDiscount);

  const validUntilObj = input.validUntil !== undefined ? (input.validUntil ? new Date(input.validUntil) : null) : existing.validUntil ? new Date(existing.validUntil) : null;

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (input.items) {
          await tx.proposalItem.deleteMany({ where: { proposalId } });
        }

        const prop = await tx.proposal.update({
          where: { id: proposalId },
          data: {
            title: input.title !== undefined ? input.title : existing.title,
            subject: input.subject || existing.subject,
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
            action: 'PROPOSAL_UPDATED',
            entityType: 'Proposal',
            entityId: proposalId,
            metadata: { total: totals.total, status: prop.status },
          },
        });

        return prop;
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
  const storeProp = devStore.proposals.find((p) => p.id === proposalId);
  if (!storeProp) throw new AppError(404, 'PROPOSAL_NOT_FOUND', 'Proposal not found');

  if (input.title !== undefined) storeProp.title = input.title;
  if (input.subject) storeProp.subject = input.subject;
  if (input.customerId) storeProp.customerId = input.customerId;
  if (input.contactId !== undefined) storeProp.contactId = input.contactId;
  if (input.projectId !== undefined) storeProp.projectId = input.projectId;
  if (input.status) storeProp.status = input.status;
  if (input.currency) storeProp.currency = input.currency;
  storeProp.subtotal = totals.subtotal;
  storeProp.discount = docDiscount;
  storeProp.discountTotal = totals.discountTotal;
  storeProp.taxTotal = totals.taxTotal;
  storeProp.total = totals.total;
  if (input.validUntil !== undefined) storeProp.validUntil = validUntilObj;
  if (input.issuedAt !== undefined) storeProp.issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;
  if (input.notes !== undefined) storeProp.notes = input.notes;
  if (input.terms !== undefined) storeProp.terms = input.terms;
  storeProp.updatedAt = new Date();

  if (input.items) {
    devStore.proposalItems = devStore.proposalItems.filter((i) => i.proposalId !== proposalId);
    const newItems: DevProposalItem[] = totals.items.map((i, idx) => ({
      id: `a1010000-${Date.now()}-${idx}`,
      proposalId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
      lineTotal: i.lineTotal,
      order: i.order,
    }));
    devStore.proposalItems.push(...newItems);
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'PROPOSAL_UPDATED',
    entityType: 'Proposal',
    entityId: proposalId,
    metadata: { total: totals.total, status: storeProp.status },
    createdAt: new Date(),
  });

  return getProposalById(companyId, proposalId);
}

export async function convertProposalToInvoice(companyId: string, proposalId: string, actorId: string) {
  const proposal = await getProposalById(companyId, proposalId);

  if (proposal.convertedToInvoiceId) {
    throw new AppError(400, 'ALREADY_CONVERTED', `This proposal was already converted to invoice (${proposal.convertedToInvoiceId}). Duplicate conversion prevented.`);
  }

  if (proposal.status !== ProposalStatus.ACCEPTED) {
    throw new AppError(400, 'INVALID_STATUS', `Only accepted proposals can be converted to invoices. Current status: ${proposal.status}`);
  }

  // Create invoice from proposal items
  const createdInvoice = await createInvoice(companyId, actorId, {
    customerId: proposal.customerId,
    projectId: proposal.projectId,
    title: `Invoice for ${proposal.title || proposal.subject}`,
    currency: proposal.currency,
    discount: proposal.discount,
    notes: proposal.notes,
    terms: proposal.terms,
    items: proposal.items.map((i) => ({
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
      await prisma.proposal.update({
        where: { id: proposalId },
        data: {
          convertedToInvoiceId: createdInvoice.id,
          convertedAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'PROPOSAL_CONVERTED_TO_INVOICE',
          entityType: 'Proposal',
          entityId: proposalId,
          metadata: { invoiceId: createdInvoice.id, invoiceNumber: (createdInvoice as any).invoiceNumber },
        },
      });
    } catch {
      // Fallback
    }
  }

  const storeProp = devStore.proposals.find((p) => p.id === proposalId);
  if (storeProp) {
    storeProp.convertedToInvoiceId = createdInvoice.id;
    storeProp.convertedAt = convertedAt;
    storeProp.updatedAt = new Date();
  }

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'PROPOSAL_CONVERTED_TO_INVOICE',
    entityType: 'Proposal',
    entityId: proposalId,
    metadata: { invoiceId: createdInvoice.id, invoiceNumber: (createdInvoice as any).invoiceNumber },
    createdAt: new Date(),
  });

  return {
    success: true,
    message: 'Proposal successfully converted to invoice',
    invoice: createdInvoice,
  };
}

export async function archiveProposal(companyId: string, proposalId: string, actorId: string) {
  if (isDatabaseConnected) {
    try {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { isArchived: true },
      });
      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'PROPOSAL_ARCHIVED',
          entityType: 'Proposal',
          entityId: proposalId,
        },
      });
      return { success: true };
    } catch {
      // Fallback
    }
  }

  const storeProp = devStore.proposals.find((p) => p.id === proposalId);
  if (!storeProp) throw new AppError(404, 'PROPOSAL_NOT_FOUND', 'Proposal not found');
  storeProp.isArchived = true;
  storeProp.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'PROPOSAL_ARCHIVED',
    entityType: 'Proposal',
    entityId: proposalId,
    metadata: {},
    createdAt: new Date(),
  });

  return { success: true };
}
