import { Prisma, ActivityType, ActivityStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevActivity, DevNote } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  CreateActivityInput,
  UpdateActivityInput,
  CompleteActivityInput,
  RescheduleActivityInput,
  ListActivitiesQuery,
} from './activities.schema.js';
import crypto from 'node:crypto';

export async function listActivities(companyId: string, query: ListActivitiesQuery) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (!isDatabaseConnected) {
    let list = devStore.activities.filter((a) => a.companyId === companyId);

    if (query.type) {
      list = list.filter((a) => a.type === query.type);
    }
    if (query.status) {
      list = list.filter((a) => a.status === query.status);
    }
    if (query.assignedToId) {
      list = list.filter((a) => a.assignedToId === query.assignedToId);
    }
    if (query.customerId) {
      list = list.filter((a) => a.customerId === query.customerId);
    }
    if (query.leadId) {
      list = list.filter((a) => a.leadId === query.leadId);
    }

    if (query.timeframe === 'upcoming') {
      list = list.filter((a) => a.status === ActivityStatus.PENDING && a.dueDate && a.dueDate >= now);
    } else if (query.timeframe === 'overdue') {
      list = list.filter((a) => a.status === ActivityStatus.PENDING && a.dueDate && a.dueDate < now);
    } else if (query.timeframe === 'completed') {
      list = list.filter((a) => a.status === ActivityStatus.COMPLETED);
    } else if (query.timeframe === 'today') {
      list = list.filter((a) => a.dueDate && a.dueDate >= startOfToday && a.dueDate <= endOfToday);
    }

    // Sort
    const sortField = query.sortBy || 'dueDate';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    list.sort((a: any, b: any) => {
      const valA = a[sortField] ? new Date(a[sortField]).getTime() : 0;
      const valB = b[sortField] ? new Date(b[sortField]).getTime() : 0;
      return (valA - valB) * sortOrder;
    });

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const total = list.length;
    const paginated = list.slice((page - 1) * limit, page * limit);

    const formatted = paginated.map((a) => {
      const assigned = a.assignedToId ? devStore.users.find((u) => u.id === a.assignedToId) : null;
      const customer = a.customerId ? devStore.customers.find((c) => c.id === a.customerId) : null;
      const lead = a.leadId ? devStore.leads.find((l) => l.id === a.leadId) : null;

      return {
        ...a,
        assignedTo: assigned ? { id: assigned.id, name: assigned.name, email: assigned.email } : null,
        customer: customer ? { id: customer.id, name: customer.name, companyName: customer.companyName } : null,
        lead: lead ? { id: lead.id, name: lead.name, companyName: lead.companyName } : null,
        isOverdue: a.status === ActivityStatus.PENDING && a.dueDate ? a.dueDate < now : false,
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

  const where: Prisma.ActivityWhereInput = {
    companyId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.timeframe === 'upcoming'
      ? { status: ActivityStatus.PENDING, dueDate: { gte: now } }
      : query.timeframe === 'overdue'
      ? { status: ActivityStatus.PENDING, dueDate: { lt: now } }
      : query.timeframe === 'completed'
      ? { status: ActivityStatus.COMPLETED }
      : query.timeframe === 'today'
      ? { dueDate: { gte: startOfToday, lte: endOfToday } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true, companyName: true } },
        lead: { select: { id: true, name: true, companyName: true } },
      },
    }),
  ]);

  const formatted = items.map((a) => ({
    ...a,
    isOverdue: a.status === ActivityStatus.PENDING && a.dueDate ? a.dueDate < now : false,
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

export async function getActivityById(companyId: string, activityId: string) {
  if (!isDatabaseConnected) {
    const activity = devStore.activities.find((a) => a.companyId === companyId && a.id === activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
    }

    const assigned = activity.assignedToId ? devStore.users.find((u) => u.id === activity.assignedToId) : null;
    const customer = activity.customerId ? devStore.customers.find((c) => c.id === activity.customerId) : null;
    const lead = activity.leadId ? devStore.leads.find((l) => l.id === activity.leadId) : null;

    return {
      ...activity,
      assignedTo: assigned ? { id: assigned.id, name: assigned.name, email: assigned.email } : null,
      customer: customer ? { id: customer.id, name: customer.name, companyName: customer.companyName } : null,
      lead: lead ? { id: lead.id, name: lead.name, companyName: lead.companyName } : null,
    };
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, companyId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      customer: { select: { id: true, name: true, companyName: true } },
      lead: { select: { id: true, name: true, companyName: true } },
    },
  });

  if (!activity) {
    throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
  }

  return activity;
}

export async function createActivity(companyId: string, actorId: string, input: CreateActivityInput) {
  if (!isDatabaseConnected) {
    const activityId = crypto.randomUUID();
    const newActivity: DevActivity = {
      id: activityId,
      companyId,
      type: input.type,
      subject: input.subject,
      description: input.description || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: ActivityStatus.PENDING,
      completedAt: null,
      assignedToId: input.assignedToId || actorId,
      customerId: input.customerId || null,
      leadId: input.leadId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    devStore.activities.push(newActivity);

    await recordAuditLog({
      companyId,
      actorId,
      action: 'ACTIVITY_CREATED',
      entityType: 'Activity',
      entityId: activityId,
      metadata: { subject: newActivity.subject, type: newActivity.type },
    });

    return getActivityById(companyId, activityId);
  }

  const created = await prisma.activity.create({
    data: {
      companyId,
      type: input.type,
      subject: input.subject,
      description: input.description || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      status: ActivityStatus.PENDING,
      assignedToId: input.assignedToId || actorId,
      customerId: input.customerId || null,
      leadId: input.leadId || null,
    },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ACTIVITY_CREATED',
    entityType: 'Activity',
    entityId: created.id,
    metadata: { subject: created.subject, type: created.type },
  });

  return getActivityById(companyId, created.id);
}

export async function updateActivity(companyId: string, actorId: string, activityId: string, input: UpdateActivityInput) {
  if (!isDatabaseConnected) {
    const activity = devStore.activities.find((a) => a.companyId === companyId && a.id === activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
    }

    if (input.type !== undefined) activity.type = input.type;
    if (input.subject !== undefined) activity.subject = input.subject;
    if (input.description !== undefined) activity.description = input.description || null;
    if (input.dueDate !== undefined) activity.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.status !== undefined) activity.status = input.status;
    if (input.assignedToId !== undefined) activity.assignedToId = input.assignedToId || null;
    if (input.customerId !== undefined) activity.customerId = input.customerId || null;
    if (input.leadId !== undefined) activity.leadId = input.leadId || null;
    activity.updatedAt = new Date();

    return getActivityById(companyId, activityId);
  }

  const existing = await prisma.activity.findFirst({
    where: { id: activityId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
    },
  });

  return getActivityById(companyId, activityId);
}

export async function completeActivity(
  companyId: string,
  actorId: string,
  activityId: string,
  input: CompleteActivityInput
) {
  const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();

  if (!isDatabaseConnected) {
    const activity = devStore.activities.find((a) => a.companyId === companyId && a.id === activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
    }

    activity.status = ActivityStatus.COMPLETED;
    activity.completedAt = completedAt;
    activity.updatedAt = new Date();

    if (input.completionNote) {
      const note: DevNote = {
        id: crypto.randomUUID(),
        companyId,
        authorId: actorId,
        body: `Completed activity [${activity.type}]: ${activity.subject}\n\nNote: ${input.completionNote}`,
        customerId: activity.customerId,
        leadId: activity.leadId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devStore.notes.push(note);
    }

    await recordAuditLog({
      companyId,
      actorId,
      action: 'ACTIVITY_COMPLETED',
      entityType: 'Activity',
      entityId: activityId,
      metadata: { subject: activity.subject },
    });

    return getActivityById(companyId, activityId);
  }

  const existing = await prisma.activity.findFirst({
    where: { id: activityId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: activityId },
      data: {
        status: ActivityStatus.COMPLETED,
        completedAt,
      },
    });

    if (input.completionNote) {
      await tx.note.create({
        data: {
          companyId,
          authorId: actorId,
          customerId: existing.customerId,
          leadId: existing.leadId,
          body: `Completed activity [${existing.type}]: ${existing.subject}\n\nNote: ${input.completionNote}`,
        },
      });
    }
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ACTIVITY_COMPLETED',
    entityType: 'Activity',
    entityId: activityId,
    metadata: { subject: existing.subject },
  });

  return getActivityById(companyId, activityId);
}

export async function rescheduleActivity(
  companyId: string,
  actorId: string,
  activityId: string,
  input: RescheduleActivityInput
) {
  const newDate = new Date(input.newDueDate);

  if (!isDatabaseConnected) {
    const activity = devStore.activities.find((a) => a.companyId === companyId && a.id === activityId);
    if (!activity) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
    }

    const oldDate = activity.dueDate;
    activity.dueDate = newDate;
    activity.status = ActivityStatus.PENDING;
    activity.updatedAt = new Date();

    if (input.reason) {
      const note: DevNote = {
        id: crypto.randomUUID(),
        companyId,
        authorId: actorId,
        body: `Rescheduled [${activity.type}]: ${activity.subject}\nFrom: ${oldDate?.toLocaleDateString() || 'N/A'} To: ${newDate.toLocaleDateString()}\nReason: ${input.reason}`,
        customerId: activity.customerId,
        leadId: activity.leadId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devStore.notes.push(note);
    }

    await recordAuditLog({
      companyId,
      actorId,
      action: 'ACTIVITY_RESCHEDULED',
      entityType: 'Activity',
      entityId: activityId,
      metadata: { newDueDate: newDate.toISOString(), reason: input.reason },
    });

    return getActivityById(companyId, activityId);
  }

  const existing = await prisma.activity.findFirst({
    where: { id: activityId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: activityId },
      data: {
        dueDate: newDate,
        status: ActivityStatus.PENDING,
      },
    });

    if (input.reason) {
      await tx.note.create({
        data: {
          companyId,
          authorId: actorId,
          customerId: existing.customerId,
          leadId: existing.leadId,
          body: `Rescheduled [${existing.type}]: ${existing.subject}\nFrom: ${existing.dueDate?.toLocaleDateString() || 'N/A'} To: ${newDate.toLocaleDateString()}\nReason: ${input.reason}`,
        },
      });
    }
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ACTIVITY_RESCHEDULED',
    entityType: 'Activity',
    entityId: activityId,
    metadata: { newDueDate: newDate.toISOString(), reason: input.reason },
  });

  return getActivityById(companyId, activityId);
}

export async function deleteActivity(companyId: string, actorId: string, activityId: string) {
  if (!isDatabaseConnected) {
    const index = devStore.activities.findIndex((a) => a.companyId === companyId && a.id === activityId);
    if (index === -1) {
      throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
    }
    const [deleted] = devStore.activities.splice(index, 1);
    await recordAuditLog({
      companyId,
      actorId,
      action: 'ACTIVITY_DELETED',
      entityType: 'Activity',
      entityId: activityId,
      metadata: { subject: deleted.subject },
    });
    return { success: true, message: 'Activity deleted successfully' };
  }

  const existing = await prisma.activity.findFirst({
    where: { id: activityId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity record not found');
  }

  await prisma.activity.delete({
    where: { id: activityId },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'ACTIVITY_DELETED',
    entityType: 'Activity',
    entityId: activityId,
    metadata: { subject: existing.subject },
  });

  return { success: true, message: 'Activity deleted successfully' };
}
