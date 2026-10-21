import crypto from 'node:crypto';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevTicket, DevTicketReply, DevTicketCategory } from '../../config/dev-store.js';
import { TicketStatus, TicketPriority } from '@prisma/client';
import {
  CreateTicketInput,
  UpdateTicketInput,
  CreateTicketReplyInput,
  ListTicketsQuery,
  TicketCategoryInput,
} from './tickets.schema.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { createNotification } from '../notifications/notifications.service.js';

async function logAudit(companyId: string, actorId: string, action: string, entityType: string, entityId: string, metadata?: any) {
  return await recordAuditLog({ companyId, actorId, action, entityType, entityId, metadata });
}

export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

function generateTicketNumber(existingCount: number): string {
  const year = new Date().getFullYear();
  const sequence = String(existingCount + 1).padStart(4, '0');
  return `TICK-${year}-${sequence}`;
}

export async function listTicketCategories(companyId: string): Promise<DevTicketCategory[]> {
  if (!isDatabaseConnected) {
    return devStore.ticketCategories.filter((c) => c.companyId === companyId);
  }
  return (await prisma.ticketCategory.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })) as unknown as DevTicketCategory[];
}

export async function createTicketCategory(
  companyId: string,
  input: TicketCategoryInput
): Promise<DevTicketCategory> {
  const existing = !isDatabaseConnected
    ? devStore.ticketCategories.find(
        (c) => c.companyId === companyId && c.name.toLowerCase() === input.name.toLowerCase()
      )
    : await prisma.ticketCategory.findFirst({
        where: { companyId, name: { equals: input.name, mode: 'insensitive' } },
      });

  if (existing) {
    throw new AppError(409, 'DUPLICATE_CATEGORY', `Category '${input.name}' already exists.`);
  }

  if (!isDatabaseConnected) {
    const newCategory: DevTicketCategory = {
      id: crypto.randomUUID(),
      companyId,
      name: input.name.trim(),
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.ticketCategories.push(newCategory);
    return newCategory;
  }

  return (await prisma.ticketCategory.create({
    data: {
      companyId,
      name: input.name.trim(),
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
    },
  })) as unknown as DevTicketCategory;
}

export async function createTicket(
  companyId: string,
  userId: string,
  input: CreateTicketInput
) {
  // 1. Verify customer if supplied
  if (input.customerId) {
    const customer = !isDatabaseConnected
      ? devStore.customers.find((c) => c.id === input.customerId && c.companyId === companyId)
      : await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Specified customer does not exist in this company.');
    }
  }

  // 2. Verify assignee if supplied
  if (input.assignedTo) {
    const assignee = !isDatabaseConnected
      ? devStore.users.find((u) => u.id === input.assignedTo && u.companyId === companyId)
      : await prisma.user.findFirst({ where: { id: input.assignedTo, companyId } });
    if (!assignee) {
      throw new AppError(404, 'ASSIGNEE_NOT_FOUND', 'Assigned staff user not found in this company.');
    }
  }

  const cleanSubject = sanitizeText(input.subject);
  const cleanDescription = sanitizeText(input.description);

  if (!isDatabaseConnected) {
    const currentYear = new Date().getFullYear();
    const countThisYear = devStore.tickets.filter(
      (t) => t.companyId === companyId && t.ticketNumber.startsWith(`TICK-${currentYear}`)
    ).length;
    const ticketNumber = generateTicketNumber(countThisYear);

    const now = new Date();
    const newTicket: DevTicket = {
      id: crypto.randomUUID(),
      companyId,
      customerId: input.customerId ?? null,
      contactId: input.contactId ?? null,
      categoryId: input.categoryId ?? null,
      ticketNumber,
      subject: cleanSubject,
      description: cleanDescription,
      status: input.status ?? TicketStatus.OPEN,
      priority: input.priority ?? TicketPriority.MEDIUM,
      department: input.department ?? null,
      assignedTo: input.assignedTo ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
      resolvedAt: input.status === TicketStatus.RESOLVED ? now : null,
      closedAt: input.status === TicketStatus.CLOSED ? now : null,
      isArchived: false,
      attachmentUrls: input.attachmentUrls ?? [],
      createdAt: now,
      updatedAt: now,
    };
    devStore.tickets.unshift(newTicket);

    await logAudit(companyId, userId, 'ticket.created', 'Ticket', newTicket.id, {
      ticketNumber,
      subject: cleanSubject,
      priority: newTicket.priority,
    });

    if (newTicket.assignedTo && newTicket.assignedTo !== userId) {
      await createNotification(newTicket.assignedTo, {
        companyId,
        type: 'ticket.assigned',
        title: 'New Support Ticket Assigned',
        body: `You were assigned ticket ${ticketNumber}: "${cleanSubject}".`,
        link: `/support/tickets/${newTicket.id}`,
        metadata: { ticketId: newTicket.id, ticketNumber },
      });
    }

    return populateTicket(newTicket);
  }

  const currentYear = new Date().getFullYear();
  const countThisYear = await prisma.ticket.count({
    where: {
      companyId,
      ticketNumber: { startsWith: `TICK-${currentYear}` },
    },
  });
  const ticketNumber = generateTicketNumber(countThisYear);

  const now = new Date();
  const created = await prisma.ticket.create({
    data: {
      companyId,
      customerId: input.customerId ?? null,
      contactId: input.contactId ?? null,
      categoryId: input.categoryId ?? null,
      ticketNumber,
      subject: cleanSubject,
      description: cleanDescription,
      status: input.status ?? TicketStatus.OPEN,
      priority: input.priority ?? TicketPriority.MEDIUM,
      department: input.department ?? null,
      assignedTo: input.assignedTo ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null,
      resolvedAt: input.status === TicketStatus.RESOLVED ? now : null,
      closedAt: input.status === TicketStatus.CLOSED ? now : null,
      attachmentUrls: input.attachmentUrls ?? [],
    },
    include: {
      customer: true,
      contact: true,
      category: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(companyId, userId, 'ticket.created', 'Ticket', created.id, {
    ticketNumber,
    subject: cleanSubject,
    priority: created.priority,
  });

  if (created.assignedTo && created.assignedTo !== userId) {
    await createNotification(created.assignedTo, {
      companyId,
      type: 'ticket.assigned',
      title: 'New Support Ticket Assigned',
      body: `You were assigned ticket ${ticketNumber}: "${cleanSubject}".`,
      link: `/support/tickets/${created.id}`,
      metadata: { ticketId: created.id, ticketNumber },
    });
  }

  return created;
}

export async function listTickets(companyId: string, query: ListTicketsQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  if (!isDatabaseConnected) {
    let items = devStore.tickets.filter((t) => t.companyId === companyId);

    if (query.isArchived !== undefined) {
      items = items.filter((t) => t.isArchived === query.isArchived);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    if (query.customerId) {
      items = items.filter((t) => t.customerId === query.customerId);
    }
    if (query.assignedTo) {
      items = items.filter((t) => t.assignedTo === query.assignedTo);
    }
    if (query.categoryId) {
      items = items.filter((t) => t.categoryId === query.categoryId);
    }
    if (query.status) {
      items = items.filter((t) => t.status === query.status);
    }
    if (query.priority) {
      items = items.filter((t) => t.priority === query.priority);
    }
    if (query.department) {
      items = items.filter((t) => t.department?.toLowerCase() === query.department?.toLowerCase());
    }
    if (query.isOverdue) {
      const now = new Date();
      items = items.filter(
        (t) =>
          t.status !== TicketStatus.RESOLVED &&
          t.status !== TicketStatus.CLOSED &&
          ((t.dueDate && new Date(t.dueDate) < now) || (t.slaDueAt && new Date(t.slaDueAt) < now))
      );
    }

    const total = items.length;

    // Sorting
    items.sort((a, b) => {
      const field = query.sortBy ?? 'createdAt';
      const aVal = a[field as keyof DevTicket];
      const bVal = b[field as keyof DevTicket];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return query.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return query.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const paged = items.slice(skip, skip + limit).map(populateTicket);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  const where: any = { companyId, isArchived: query.isArchived ?? false };

  if (query.search) {
    where.OR = [
      { ticketNumber: { contains: query.search, mode: 'insensitive' } },
      { subject: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.customerId) where.customerId = query.customerId;
  if (query.assignedTo) where.assignedTo = query.assignedTo;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.department) where.department = { equals: query.department, mode: 'insensitive' };
  if (query.isOverdue) {
    const now = new Date();
    where.status = { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] };
    where.OR = [
      { dueDate: { lt: now } },
      { slaDueAt: { lt: now } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
      include: {
        customer: true,
        contact: true,
        category: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getTicketById(
  companyId: string,
  ticketId: string,
  canViewInternalNotes = true
) {
  if (!isDatabaseConnected) {
    const ticket = devStore.tickets.find((t) => t.id === ticketId && t.companyId === companyId);
    if (!ticket) {
      throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found.');
    }

    let replies = devStore.ticketReplies.filter((r) => r.ticketId === ticketId);
    if (!canViewInternalNotes) {
      replies = replies.filter((r) => !r.isInternal);
    }

    const populatedReplies = replies.map((r) => {
      const author = devStore.users.find((u) => u.id === r.authorId);
      return {
        ...r,
        author: author ? { id: author.id, name: author.name, email: author.email } : null,
      };
    });

    return {
      ...populateTicket(ticket),
      replies: populatedReplies,
    };
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId },
    include: {
      customer: true,
      contact: true,
      category: true,
      assignee: { select: { id: true, name: true, email: true } },
      replies: {
        where: canViewInternalNotes ? undefined : { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found.');
  }

  return ticket;
}

export async function updateTicket(
  companyId: string,
  ticketId: string,
  userId: string,
  input: UpdateTicketInput
) {
  const existing = await getTicketById(companyId, ticketId);
  const now = new Date();

  let resolvedAt = input.resolvedAt ? new Date(input.resolvedAt) : existing.resolvedAt;
  let closedAt = input.closedAt ? new Date(input.closedAt) : existing.closedAt;

  if (input.status === TicketStatus.RESOLVED && existing.status !== TicketStatus.RESOLVED) {
    resolvedAt = now;
  }
  if (input.status === TicketStatus.CLOSED && existing.status !== TicketStatus.CLOSED) {
    closedAt = now;
  }
  if (input.status && input.status !== TicketStatus.RESOLVED && input.status !== TicketStatus.CLOSED) {
    resolvedAt = null;
    closedAt = null;
  }

  const cleanSubject = input.subject ? sanitizeText(input.subject) : undefined;
  const cleanDescription = input.description ? sanitizeText(input.description) : undefined;

  if (!isDatabaseConnected) {
    const idx = devStore.tickets.findIndex((t) => t.id === ticketId && t.companyId === companyId);
    if (idx === -1) throw new AppError(404, 'TICKET_NOT_FOUND', 'Support ticket not found.');

    const current = devStore.tickets[idx];
    const updated: DevTicket = {
      ...current,
      customerId: input.customerId !== undefined ? input.customerId : current.customerId,
      contactId: input.contactId !== undefined ? input.contactId : current.contactId,
      categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
      subject: cleanSubject ?? current.subject,
      description: cleanDescription ?? current.description,
      status: input.status ?? current.status,
      priority: input.priority ?? current.priority,
      department: input.department !== undefined ? input.department : current.department,
      assignedTo: input.assignedTo !== undefined ? input.assignedTo : current.assignedTo,
      dueDate: input.dueDate ? new Date(input.dueDate) : input.dueDate === null ? null : current.dueDate,
      slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : input.slaDueAt === null ? null : current.slaDueAt,
      resolvedAt,
      closedAt,
      attachmentUrls: input.attachmentUrls ?? current.attachmentUrls,
      updatedAt: now,
    };
    devStore.tickets[idx] = updated;

    await logAudit(companyId, userId, 'ticket.updated', 'Ticket', ticketId, {
      status: updated.status,
      priority: updated.priority,
      assignedTo: updated.assignedTo,
    });

    if (input.assignedTo && input.assignedTo !== current.assignedTo && input.assignedTo !== userId) {
      await createNotification(input.assignedTo, {
        companyId,
        type: 'ticket.reassigned',
        title: 'Ticket Reassigned to You',
        body: `You were reassigned ticket ${current.ticketNumber}: "${updated.subject}".`,
        link: `/support/tickets/${ticketId}`,
        metadata: { ticketId, ticketNumber: current.ticketNumber },
      });
    }

    return populateTicket(updated);
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      customerId: input.customerId !== undefined ? input.customerId : undefined,
      contactId: input.contactId !== undefined ? input.contactId : undefined,
      categoryId: input.categoryId !== undefined ? input.categoryId : undefined,
      subject: cleanSubject,
      description: cleanDescription,
      status: input.status,
      priority: input.priority,
      department: input.department !== undefined ? input.department : undefined,
      assignedTo: input.assignedTo !== undefined ? input.assignedTo : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : input.dueDate === null ? null : undefined,
      slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : input.slaDueAt === null ? null : undefined,
      resolvedAt,
      closedAt,
      attachmentUrls: input.attachmentUrls,
    },
    include: {
      customer: true,
      contact: true,
      category: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(companyId, userId, 'ticket.updated', 'Ticket', ticketId, {
    status: updated.status,
    priority: updated.priority,
    assignedTo: updated.assignedTo,
  });

  return updated;
}

export async function archiveTicket(companyId: string, ticketId: string, userId: string) {
  if (!isDatabaseConnected) {
    const ticket = devStore.tickets.find((t) => t.id === ticketId && t.companyId === companyId);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found.');
    ticket.isArchived = true;
    ticket.updatedAt = new Date();

    await logAudit(companyId, userId, 'ticket.archived', 'Ticket', ticketId);
    return { success: true, message: 'Ticket archived successfully' };
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { isArchived: true },
  });

  await logAudit(companyId, userId, 'ticket.archived', 'Ticket', ticketId);
  return { success: true, message: 'Ticket archived successfully' };
}

export async function createTicketReply(
  companyId: string,
  ticketId: string,
  authorId: string,
  input: CreateTicketReplyInput
) {
  const ticket = await getTicketById(companyId, ticketId);
  const cleanBody = sanitizeText(input.body);
  const now = new Date();

  if (!isDatabaseConnected) {
    const newReply: DevTicketReply = {
      id: crypto.randomUUID(),
      ticketId,
      authorId,
      body: cleanBody,
      isInternal: input.isInternal ?? false,
      attachmentUrls: input.attachmentUrls ?? [],
      createdAt: now,
      updatedAt: now,
    };
    devStore.ticketReplies.push(newReply);

    // Update ticket updatedAt timestamp
    const tIdx = devStore.tickets.findIndex((t) => t.id === ticketId);
    if (tIdx !== -1) {
      devStore.tickets[tIdx].updatedAt = now;
      if (!input.isInternal && devStore.tickets[tIdx].status === TicketStatus.OPEN) {
        devStore.tickets[tIdx].status = TicketStatus.IN_PROGRESS;
      }
    }

    const author = devStore.users.find((u) => u.id === authorId);

    // Send notification if reply is from another user
    if (ticket.assignedTo && ticket.assignedTo !== authorId) {
      await createNotification(ticket.assignedTo, {
        companyId,
        type: input.isInternal ? 'ticket.internal_note' : 'ticket.reply',
        title: input.isInternal ? 'Internal Note Added' : 'New Ticket Reply',
        body: `${author?.name ?? 'A user'} ${input.isInternal ? 'added an internal note to' : 'replied to'} ticket ${ticket.ticketNumber}.`,
        link: `/support/tickets/${ticketId}`,
        metadata: { ticketId, ticketNumber: ticket.ticketNumber, isInternal: input.isInternal },
      });
    }

    await logAudit(companyId, authorId, input.isInternal ? 'ticket.note_added' : 'ticket.replied', 'TicketReply', newReply.id, {
      ticketNumber: ticket.ticketNumber,
      isInternal: input.isInternal,
    });

    return {
      ...newReply,
      author: author ? { id: author.id, name: author.name, email: author.email } : null,
    };
  }

  const [reply] = await Promise.all([
    prisma.ticketReply.create({
      data: {
        ticketId,
        authorId,
        body: cleanBody,
        isInternal: input.isInternal ?? false,
        attachmentUrls: input.attachmentUrls ?? [],
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        updatedAt: now,
        status:
          !input.isInternal && ticket.status === TicketStatus.OPEN
            ? TicketStatus.IN_PROGRESS
            : undefined,
      },
    }),
  ]);

  if (ticket.assignedTo && ticket.assignedTo !== authorId) {
    await createNotification(ticket.assignedTo, {
      companyId,
      type: input.isInternal ? 'ticket.internal_note' : 'ticket.reply',
      title: input.isInternal ? 'Internal Note Added' : 'New Ticket Reply',
      body: `${reply.author.name} ${input.isInternal ? 'added an internal note to' : 'replied to'} ticket ${ticket.ticketNumber}.`,
      link: `/support/tickets/${ticketId}`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber, isInternal: input.isInternal },
    });
  }

  await logAudit(companyId, authorId, input.isInternal ? 'ticket.note_added' : 'ticket.replied', 'TicketReply', reply.id, {
    ticketNumber: ticket.ticketNumber,
    isInternal: input.isInternal,
  });

  return reply;
}

export async function deleteTicketReply(
  companyId: string,
  ticketId: string,
  replyId: string,
  userId: string,
  isAdmin = false
) {
  if (!isDatabaseConnected) {
    const idx = devStore.ticketReplies.findIndex((r) => r.id === replyId && r.ticketId === ticketId);
    if (idx === -1) throw new AppError(404, 'REPLY_NOT_FOUND', 'Reply not found.');

    const reply = devStore.ticketReplies[idx];
    if (reply.authorId !== userId && !isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this reply.');
    }

    devStore.ticketReplies.splice(idx, 1);
    await logAudit(companyId, userId, 'ticket.reply_deleted', 'TicketReply', replyId);
    return { success: true, message: 'Reply deleted' };
  }

  const reply = await prisma.ticketReply.findFirst({
    where: { id: replyId, ticketId },
  });
  if (!reply) throw new AppError(404, 'REPLY_NOT_FOUND', 'Reply not found.');

  if (reply.authorId !== userId && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this reply.');
  }

  await prisma.ticketReply.delete({ where: { id: replyId } });
  await logAudit(companyId, userId, 'ticket.reply_deleted', 'TicketReply', replyId);
  return { success: true, message: 'Reply deleted' };
}

function populateTicket(t: DevTicket) {
  const customer = t.customerId ? devStore.customers.find((c) => c.id === t.customerId) : null;
  const contact = t.contactId ? devStore.contacts.find((c) => c.id === t.contactId) : null;
  const category = t.categoryId ? devStore.ticketCategories.find((c) => c.id === t.categoryId) : null;
  const assignee = t.assignedTo ? devStore.users.find((u) => u.id === t.assignedTo) : null;

  return {
    ...t,
    customer: customer ?? null,
    contact: contact ?? null,
    category: category ?? null,
    assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
  };
}
