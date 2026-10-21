import { Prisma, LeadStatus, LeadPriority, CustomerType, CustomerStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevLead, DevCustomer, DevContact, DevNote, DevLeadSource, DevLeadStatusConfig } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  CreateLeadInput,
  UpdateLeadInput,
  ListLeadsQuery,
  ConvertLeadInput,
  CreateLeadSourceInput,
  CreateLeadStatusInput,
} from './leads.schema.js';
import crypto from 'node:crypto';

export async function listLeads(companyId: string, query: ListLeadsQuery) {
  if (!isDatabaseConnected) {
    let list = devStore.leads.filter((l) => l.companyId === companyId);

    if (query.isArchived !== undefined) {
      list = list.filter((l) => l.isArchived === query.isArchived);
    } else {
      list = list.filter((l) => !l.isArchived);
    }

    if (query.isConverted !== undefined) {
      list = list.filter((l) => query.isConverted ? l.convertedToId !== null : l.convertedToId === null);
    }

    if (query.status) {
      list = list.filter((l) => l.status === query.status);
    }
    if (query.priority) {
      list = list.filter((l) => l.priority === query.priority);
    }
    if (query.sourceId) {
      list = list.filter((l) => l.sourceId === query.sourceId);
    }
    if (query.ownerId) {
      list = list.filter((l) => l.ownerId === query.ownerId);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.title && l.title.toLowerCase().includes(q)) ||
          (l.companyName && l.companyName.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.phone && l.phone.toLowerCase().includes(q))
      );
    }

    // Sort
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    list.sort((a: any, b: any) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const total = list.length;
    const paginated = list.slice((page - 1) * limit, page * limit);

    const formatted = paginated.map((l) => {
      const owner = l.ownerId ? devStore.users.find((u) => u.id === l.ownerId) : null;
      const sourceRef = l.sourceId ? devStore.leadSources.find((s) => s.id === l.sourceId) : null;
      const statusRef = l.statusId ? devStore.leadStatuses.find((s) => s.id === l.statusId) : null;
      const convertedTo = l.convertedToId ? devStore.customers.find((c) => c.id === l.convertedToId) : null;

      return {
        ...l,
        owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
        sourceRef: sourceRef ? { id: sourceRef.id, name: sourceRef.name } : null,
        statusRef: statusRef ? { id: statusRef.id, name: statusRef.name, color: statusRef.color } : null,
        convertedTo: convertedTo ? { id: convertedTo.id, name: convertedTo.name } : null,
      };
    });

    return {
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.LeadWhereInput = {
    companyId,
    ...(query.isArchived !== undefined ? { isArchived: query.isArchived } : { isArchived: false }),
    ...(query.isConverted !== undefined
      ? query.isConverted
        ? { convertedToId: { not: null } }
        : { convertedToId: null }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { title: { contains: query.search, mode: 'insensitive' } },
            { companyName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        sourceRef: { select: { id: true, name: true } },
        statusRef: { select: { id: true, name: true, color: true } },
        convertedTo: { select: { id: true, name: true } },
        _count: { select: { activities: true, notes: true } },
      },
    }),
  ]);

  const formatted = items.map((l) => ({
    ...l,
    value: l.value ? Number(l.value) : null,
    activitiesCount: l._count.activities,
    notesCount: l._count.notes,
  }));

  return {
    data: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getLeadById(companyId: string, leadId: string) {
  if (!isDatabaseConnected) {
    const lead = devStore.leads.find((l) => l.companyId === companyId && l.id === leadId);
    if (!lead) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
    }

    const owner = lead.ownerId ? devStore.users.find((u) => u.id === lead.ownerId) : null;
    const sourceRef = lead.sourceId ? devStore.leadSources.find((s) => s.id === lead.sourceId) : null;
    const statusRef = lead.statusId ? devStore.leadStatuses.find((s) => s.id === lead.statusId) : null;
    const convertedTo = lead.convertedToId ? devStore.customers.find((c) => c.id === lead.convertedToId) : null;
    const convertedContact = lead.convertedContactId ? devStore.contacts.find((ct) => ct.id === lead.convertedContactId) : null;

    const notes = devStore.notes
      .filter((n) => n.leadId === lead.id)
      .map((n) => {
        const author = devStore.users.find((u) => u.id === n.authorId);
        return {
          ...n,
          author: author ? { id: author.id, name: author.name, email: author.email } : null,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const activities = devStore.activities
      .filter((a) => a.leadId === lead.id)
      .map((a) => {
        const assigned = a.assignedToId ? devStore.users.find((u) => u.id === a.assignedToId) : null;
        return {
          ...a,
          assignedTo: assigned ? { id: assigned.id, name: assigned.name } : null,
        };
      })
      .sort((a, b) => (b.dueDate?.getTime() || 0) - (a.dueDate?.getTime() || 0));

    return {
      ...lead,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
      sourceRef: sourceRef ? { id: sourceRef.id, name: sourceRef.name } : null,
      statusRef: statusRef ? { id: statusRef.id, name: statusRef.name, color: statusRef.color } : null,
      convertedTo: convertedTo ? { id: convertedTo.id, name: convertedTo.name } : null,
      convertedContact: convertedContact ? { id: convertedContact.id, name: convertedContact.name } : null,
      notes,
      activities,
    };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      sourceRef: { select: { id: true, name: true } },
      statusRef: { select: { id: true, name: true, color: true } },
      convertedTo: { select: { id: true, name: true, email: true, phone: true } },
      convertedContact: { select: { id: true, name: true, email: true, phone: true } },
      notes: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!lead) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
  }

  return {
    ...lead,
    value: lead.value ? Number(lead.value) : null,
  };
}

export async function createLead(companyId: string, actorId: string, input: CreateLeadInput) {
  // Validate duplicate sensible check (optional email within company)
  if (input.email) {
    if (!isDatabaseConnected) {
      const existing = devStore.leads.find(
        (l) => l.companyId === companyId && !l.isArchived && l.email?.toLowerCase() === input.email?.toLowerCase()
      );
      if (existing) {
        throw new AppError(409, 'DUPLICATE_LEAD', `A lead with email ${input.email} already exists.`);
      }
    } else {
      const existing = await prisma.lead.findFirst({
        where: { companyId, isArchived: false, email: { equals: input.email, mode: 'insensitive' } },
      });
      if (existing) {
        throw new AppError(409, 'DUPLICATE_LEAD', `A lead with email ${input.email} already exists.`);
      }
    }
  }

  if (!isDatabaseConnected) {
    const leadId = crypto.randomUUID();
    const newLead: DevLead = {
      id: leadId,
      companyId,
      title: input.title || (input.companyName ? `${input.companyName} Deal` : `${input.name} Opportunity`),
      name: input.name,
      companyName: input.companyName || null,
      email: input.email || null,
      phone: input.phone || null,
      value: input.value !== undefined && input.value !== null ? input.value : null,
      currency: input.currency || 'INR',
      status: input.status || LeadStatus.NEW,
      statusId: input.statusId || null,
      source: input.source || null,
      sourceId: input.sourceId || null,
      priority: input.priority || LeadPriority.MEDIUM,
      description: input.description || null,
      nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
      ownerId: input.ownerId || actorId,
      isArchived: false,
      convertedToId: null,
      convertedContactId: null,
      convertedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    devStore.leads.push(newLead);

    if (input.initialNote) {
      devStore.notes.push({
        id: crypto.randomUUID(),
        companyId,
        authorId: actorId,
        body: input.initialNote,
        customerId: null,
        leadId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await recordAuditLog({
      companyId,
      actorId,
      action: 'LEAD_CREATED',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { name: newLead.name, companyName: newLead.companyName },
    });

    return getLeadById(companyId, leadId);
  }

  const created = await prisma.lead.create({
    data: {
      companyId,
      title: input.title || (input.companyName ? `${input.companyName} Deal` : `${input.name} Opportunity`),
      name: input.name,
      companyName: input.companyName || null,
      email: input.email || null,
      phone: input.phone || null,
      value: input.value !== undefined && input.value !== null ? new Prisma.Decimal(input.value) : null,
      currency: input.currency || 'INR',
      status: input.status || LeadStatus.NEW,
      statusId: input.statusId || null,
      source: input.source || null,
      sourceId: input.sourceId || null,
      priority: input.priority || LeadPriority.MEDIUM,
      description: input.description || null,
      nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
      ownerId: input.ownerId || actorId,
      notes: input.initialNote
        ? {
            create: {
              companyId,
              authorId: actorId,
              body: input.initialNote,
            },
          }
        : undefined,
    },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'LEAD_CREATED',
    entityType: 'Lead',
    entityId: created.id,
    metadata: { name: created.name, companyName: created.companyName },
  });

  return getLeadById(companyId, created.id);
}

export async function updateLead(companyId: string, actorId: string, leadId: string, input: UpdateLeadInput) {
  if (!isDatabaseConnected) {
    const index = devStore.leads.findIndex((l) => l.companyId === companyId && l.id === leadId);
    if (index === -1) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
    }

    const current = devStore.leads[index];
    const updated: DevLead = {
      ...current,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.nextFollowUp !== undefined ? { nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      updatedAt: new Date(),
    };

    devStore.leads[index] = updated;

    await recordAuditLog({
      companyId,
      actorId,
      action: 'LEAD_UPDATED',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { changes: Object.keys(input) },
    });

    return getLeadById(companyId, leadId);
  }

  const existing = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.value !== undefined ? { value: input.value !== null ? new Prisma.Decimal(input.value) : null } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.nextFollowUp !== undefined ? { nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
    },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'LEAD_UPDATED',
    entityType: 'Lead',
    entityId: leadId,
    metadata: { changes: Object.keys(input) },
  });

  return getLeadById(companyId, leadId);
}

export async function assignLead(companyId: string, actorId: string, leadId: string, ownerId: string | null) {
  if (!isDatabaseConnected) {
    const lead = devStore.leads.find((l) => l.companyId === companyId && l.id === leadId);
    if (!lead) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
    }
    if (ownerId) {
      const targetUser = devStore.users.find((u) => u.companyId === companyId && u.id === ownerId);
      if (!targetUser) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Assignee user not found in company');
      }
    }

    lead.ownerId = ownerId;
    lead.updatedAt = new Date();

    await recordAuditLog({
      companyId,
      actorId,
      action: 'LEAD_ASSIGNED',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { ownerId },
    });

    return getLeadById(companyId, leadId);
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
  });
  if (!lead) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
  }

  if (ownerId) {
    const targetUser = await prisma.user.findFirst({
      where: { id: ownerId, companyId },
    });
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Assignee user not found in company');
    }
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { ownerId },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'LEAD_ASSIGNED',
    entityType: 'Lead',
    entityId: leadId,
    metadata: { ownerId },
  });

  return getLeadById(companyId, leadId);
}

export async function archiveLead(companyId: string, actorId: string, leadId: string) {
  if (!isDatabaseConnected) {
    const lead = devStore.leads.find((l) => l.companyId === companyId && l.id === leadId);
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    lead.isArchived = true;
    lead.updatedAt = new Date();
    await recordAuditLog({ companyId, actorId, action: 'LEAD_ARCHIVED', entityType: 'Lead', entityId: leadId });
    return { success: true, message: 'Lead archived successfully' };
  }

  const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
  if (!existing) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');

  await prisma.lead.update({ where: { id: leadId }, data: { isArchived: true } });
  await recordAuditLog({ companyId, actorId, action: 'LEAD_ARCHIVED', entityType: 'Lead', entityId: leadId });
  return { success: true, message: 'Lead archived successfully' };
}

export async function restoreLead(companyId: string, actorId: string, leadId: string) {
  if (!isDatabaseConnected) {
    const lead = devStore.leads.find((l) => l.companyId === companyId && l.id === leadId);
    if (!lead) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    lead.isArchived = false;
    lead.updatedAt = new Date();
    await recordAuditLog({ companyId, actorId, action: 'LEAD_RESTORED', entityType: 'Lead', entityId: leadId });
    return { success: true, message: 'Lead restored successfully' };
  }

  const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
  if (!existing) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');

  await prisma.lead.update({ where: { id: leadId }, data: { isArchived: false } });
  await recordAuditLog({ companyId, actorId, action: 'LEAD_RESTORED', entityType: 'Lead', entityId: leadId });
  return { success: true, message: 'Lead restored successfully' };
}

export async function deleteLead(companyId: string, actorId: string, leadId: string) {
  if (!isDatabaseConnected) {
    const index = devStore.leads.findIndex((l) => l.companyId === companyId && l.id === leadId);
    if (index === -1) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    const [deleted] = devStore.leads.splice(index, 1);
    await recordAuditLog({
      companyId,
      actorId,
      action: 'LEAD_DELETED',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { name: deleted.name },
    });
    return { success: true, message: 'Lead deleted successfully' };
  }

  const existing = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
  if (!existing) throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');

  await prisma.lead.delete({ where: { id: leadId } });
  await recordAuditLog({
    companyId,
    actorId,
    action: 'LEAD_DELETED',
    entityType: 'Lead',
    entityId: leadId,
    metadata: { name: existing.name },
  });
  return { success: true, message: 'Lead deleted successfully' };
}

/**
 * Lead Conversion into Customer and Contact:
 * - Atomic database transaction
 * - Duplicate conversion prevention (checks if lead already converted)
 * - Preserves lead history and notes/activities
 * - Sets convertedToId, convertedContactId, convertedAt and updates status to WON
 */
export async function convertLead(
  companyId: string,
  actorId: string,
  leadId: string,
  input: ConvertLeadInput
) {
  if (!isDatabaseConnected) {
    const lead = devStore.leads.find((l) => l.companyId === companyId && l.id === leadId);
    if (!lead) {
      throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
    }

    if (lead.convertedToId) {
      throw new AppError(
        409,
        'LEAD_ALREADY_CONVERTED',
        `Lead has already been converted into customer ID: ${lead.convertedToId} on ${lead.convertedAt?.toISOString()}`
      );
    }

    const customerId = crypto.randomUUID();
    const contactId = crypto.randomUUID();

    const customerName =
      input.customerName ||
      (input.customerType === CustomerType.COMPANY
        ? input.companyName || lead.companyName || lead.name
        : lead.name);

    const newCustomer: DevCustomer = {
      id: customerId,
      companyId,
      type: input.customerType,
      name: customerName,
      companyName: input.customerType === CustomerType.COMPANY ? (input.companyName || lead.companyName || customerName) : null,
      email: input.email !== undefined ? (input.email || null) : lead.email,
      phone: input.phone !== undefined ? (input.phone || null) : lead.phone,
      website: null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || null,
      zipCode: input.zipCode || null,
      taxId: input.taxId || null,
      status: CustomerStatus.ACTIVE,
      isArchived: false,
      assignedToId: lead.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.customers.push(newCustomer);

    const newContact: DevContact = {
      id: contactId,
      customerId,
      name: input.contactName || lead.name,
      email: input.email !== undefined ? (input.email || null) : lead.email,
      phone: input.phone !== undefined ? (input.phone || null) : lead.phone,
      title: input.contactTitle || 'Primary Contact',
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.contacts.push(newContact);

    // Update lead conversion pointers
    lead.convertedToId = customerId;
    lead.convertedContactId = contactId;
    lead.convertedAt = new Date();
    lead.status = LeadStatus.WON;
    lead.updatedAt = new Date();

    // Link lead's activities & notes to new customer as well for full continuity
    devStore.activities.forEach((act) => {
      if (act.leadId === leadId && !act.customerId) {
        act.customerId = customerId;
      }
    });
    devStore.notes.forEach((nt) => {
      if (nt.leadId === leadId && !nt.customerId) {
        nt.customerId = customerId;
      }
    });

    await recordAuditLog({
      companyId,
      actorId,
      action: 'LEAD_CONVERTED',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { customerId, contactId, customerName },
    });

    return {
      message: 'Lead converted successfully',
      customer: newCustomer,
      contact: newContact,
      lead: await getLeadById(companyId, leadId),
    };
  }

  const existingLead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
  });

  if (!existingLead) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead record not found');
  }

  if (existingLead.convertedToId) {
    throw new AppError(
      409,
      'LEAD_ALREADY_CONVERTED',
      `Lead has already been converted into customer ID: ${existingLead.convertedToId} on ${existingLead.convertedAt?.toISOString()}`
    );
  }

  const customerName =
    input.customerName ||
    (input.customerType === CustomerType.COMPANY
      ? input.companyName || existingLead.companyName || existingLead.name
      : existingLead.name);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Customer
    const customer = await tx.customer.create({
      data: {
        companyId,
        type: input.customerType,
        name: customerName,
        companyName:
          input.customerType === CustomerType.COMPANY
            ? input.companyName || existingLead.companyName || customerName
            : null,
        email: input.email !== undefined ? input.email || null : existingLead.email,
        phone: input.phone !== undefined ? input.phone || null : existingLead.phone,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        country: input.country || null,
        zipCode: input.zipCode || null,
        taxId: input.taxId || null,
        status: CustomerStatus.ACTIVE,
        assignedToId: existingLead.ownerId,
      },
    });

    // 2. Create Primary Contact
    const contact = await tx.contact.create({
      data: {
        customerId: customer.id,
        name: input.contactName || existingLead.name,
        email: input.email !== undefined ? input.email || null : existingLead.email,
        phone: input.phone !== undefined ? input.phone || null : existingLead.phone,
        title: input.contactTitle || 'Primary Contact',
        isPrimary: true,
      },
    });

    // 3. Update Lead
    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: {
        convertedToId: customer.id,
        convertedContactId: contact.id,
        convertedAt: new Date(),
        status: LeadStatus.WON,
      },
      include: {
        convertedTo: true,
        convertedContact: true,
      },
    });

    // 4. Link activities & notes to the new customer
    await tx.activity.updateMany({
      where: { leadId, customerId: null },
      data: { customerId: customer.id },
    });

    await tx.note.updateMany({
      where: { leadId, customerId: null },
      data: { customerId: customer.id },
    });

    return { customer, contact, lead: updatedLead };
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'LEAD_CONVERTED',
    entityType: 'Lead',
    entityId: leadId,
    metadata: { customerId: result.customer.id, contactId: result.contact.id, customerName },
  });

  return {
    message: 'Lead converted successfully',
    customer: result.customer,
    contact: result.contact,
    lead: result.lead,
  };
}

export async function addLeadNote(companyId: string, actorId: string, leadId: string, body: string) {
  await getLeadById(companyId, leadId);

  if (!isDatabaseConnected) {
    const note: DevNote = {
      id: crypto.randomUUID(),
      companyId,
      authorId: actorId,
      body,
      customerId: null,
      leadId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.notes.push(note);
    const author = devStore.users.find((u) => u.id === actorId);

    return {
      ...note,
      author: author ? { id: author.id, name: author.name, email: author.email } : null,
    };
  }

  const note = await prisma.note.create({
    data: {
      companyId,
      authorId: actorId,
      leadId,
      body,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return note;
}

// Lead Sources & Statuses Configuration
export async function listLeadSources(companyId: string) {
  if (!isDatabaseConnected) {
    return devStore.leadSources.filter((s) => s.companyId === companyId);
  }
  return prisma.leadSource.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
}

export async function createLeadSource(companyId: string, actorId: string, input: CreateLeadSourceInput) {
  if (!isDatabaseConnected) {
    const source: DevLeadSource = {
      id: crypto.randomUUID(),
      companyId,
      name: input.name,
      isDefault: input.isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.leadSources.push(source);
    return source;
  }

  return prisma.leadSource.create({
    data: {
      companyId,
      name: input.name,
      isDefault: input.isDefault,
    },
  });
}

export async function listLeadStatuses(companyId: string) {
  if (!isDatabaseConnected) {
    return devStore.leadStatuses
      .filter((s) => s.companyId === companyId)
      .sort((a, b) => a.order - b.order);
  }
  return prisma.leadStatusConfig.findMany({
    where: { companyId },
    orderBy: { order: 'asc' },
  });
}

export async function createLeadStatus(companyId: string, actorId: string, input: CreateLeadStatusInput) {
  if (!isDatabaseConnected) {
    const status: DevLeadStatusConfig = {
      id: crypto.randomUUID(),
      companyId,
      name: input.name,
      color: input.color || '#3B82F6',
      order: input.order,
      isDefault: input.isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.leadStatuses.push(status);
    return status;
  }

  return prisma.leadStatusConfig.create({
    data: {
      companyId,
      name: input.name,
      color: input.color || '#3B82F6',
      order: input.order,
      isDefault: input.isDefault,
    },
  });
}
