import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevTimeEntry } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import {
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  ListTimeEntriesQuery,
} from './time-tracking.schema.js';
import { randomUUID } from 'crypto';

function computeMinutes(startedAt: Date, endedAt?: Date | null, explicitMinutes?: number): number {
  if (explicitMinutes !== undefined && explicitMinutes > 0) {
    return explicitMinutes;
  }
  if (endedAt) {
    const diff = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
    return Math.max(1, diff);
  }
  return 0;
}

export async function listTimeEntries(companyId: string, query: ListTimeEntriesQuery) {
  const {
    projectId,
    taskId,
    userId,
    billable,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = query;

  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    const where: any = {
      project: { companyId },
    };

    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;
    if (userId) where.userId = userId;
    if (billable !== undefined) where.billable = billable;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    const [total, entries] = await Promise.all([
      prisma.timeEntry.count({ where }),
      prisma.timeEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        },
      }),
    ]);

    // Calculate aggregated summary
    const allMatching = await prisma.timeEntry.findMany({
      where,
      select: { minutes: true, billable: true, userId: true, projectId: true },
    });

    const totalMinutes = allMatching.reduce((acc: number, curr: any) => acc + curr.minutes, 0);
    const billableMinutes = allMatching.filter((e: any) => e.billable).reduce((acc: number, curr: any) => acc + curr.minutes, 0);

    return {
      data: entries,
      summary: {
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        billableMinutes,
        billableHours: Math.round((billableMinutes / 60) * 10) / 10,
        nonBillableMinutes: totalMinutes - billableMinutes,
        nonBillableHours: Math.round(((totalMinutes - billableMinutes) / 60) * 10) / 10,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Dev Store fallback
  let filtered = devStore.timeEntries.filter((te) => {
    const proj = devStore.projects.find((p) => p.id === te.projectId && p.companyId === companyId);
    if (!proj) return false;
    if (projectId && te.projectId !== projectId) return false;
    if (taskId && te.taskId !== taskId) return false;
    if (userId && te.userId !== userId) return false;
    if (billable !== undefined && te.billable !== billable) return false;
    if (startDate && new Date(te.startedAt) < new Date(startDate)) return false;
    if (endDate && new Date(te.startedAt) > new Date(endDate)) return false;
    return true;
  });

  filtered.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  const totalMinutes = filtered.reduce((acc, curr) => acc + curr.minutes, 0);
  const billableMinutes = filtered.filter((e) => e.billable).reduce((acc, curr) => acc + curr.minutes, 0);

  const entries = paginated.map((te) => {
    const user = devStore.users.find((u) => u.id === te.userId);
    const project = devStore.projects.find((p) => p.id === te.projectId);
    const task = devStore.tasks.find((t) => t.id === te.taskId);
    return {
      ...te,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      project: project ? { id: project.id, name: project.name } : null,
      task: task ? { id: task.id, title: task.title } : null,
    };
  });

  return {
    data: entries,
    summary: {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      billableMinutes,
      billableHours: Math.round((billableMinutes / 60) * 10) / 10,
      nonBillableMinutes: totalMinutes - billableMinutes,
      nonBillableHours: Math.round(((totalMinutes - billableMinutes) / 60) * 10) / 10,
    },
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createTimeEntry(
  companyId: string,
  actorUserId: string,
  input: CreateTimeEntryInput
) {
  const targetUserId = input.userId || actorUserId;

  if (isDatabaseConnected) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in your company');

    if (input.taskId) {
      const task = await prisma.task.findFirst({
        where: { id: input.taskId, projectId: input.projectId },
      });
      if (!task) throw new AppError(400, 'INVALID_TASK', 'Task does not belong to the selected project');
    }

    const minutes = computeMinutes(input.startedAt, input.endedAt, input.minutes);

    const entry = await prisma.timeEntry.create({
      data: {
        projectId: input.projectId,
        taskId: input.taskId || null,
        userId: targetUserId,
        description: input.description,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        minutes,
        billable: input.billable ?? true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: actorUserId,
        action: 'TIME_ENTRY_CREATED',
        entityType: 'TimeEntry',
        entityId: entry.id,
        metadata: { projectId: input.projectId, taskId: input.taskId, minutes },
      },
    });

    return entry;
  }

  // Dev Store fallback
  const project = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in your company');

  if (input.taskId) {
    const task = devStore.tasks.find((t) => t.id === input.taskId && t.projectId === input.projectId);
    if (!task) throw new AppError(400, 'INVALID_TASK', 'Task does not belong to the selected project');
  }

  const minutes = computeMinutes(input.startedAt, input.endedAt, input.minutes);

  const newEntry: DevTimeEntry = {
    id: randomUUID(),
    projectId: input.projectId,
    taskId: input.taskId || null,
    userId: targetUserId,
    description: input.description || null,
    startedAt: input.startedAt,
    endedAt: input.endedAt || null,
    minutes,
    billable: input.billable ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.timeEntries.unshift(newEntry);

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: actorUserId,
    action: 'TIME_ENTRY_CREATED',
    entityType: 'TimeEntry',
    entityId: newEntry.id,
    metadata: { projectId: input.projectId, taskId: input.taskId, minutes },
    createdAt: new Date(),
  });

  const user = devStore.users.find((u) => u.id === targetUserId);
  const task = devStore.tasks.find((t) => t.id === input.taskId);

  return {
    ...newEntry,
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    project: { id: project.id, name: project.name },
    task: task ? { id: task.id, title: task.title } : null,
  };
}

export async function updateTimeEntry(
  companyId: string,
  actorUserId: string,
  entryId: string,
  input: UpdateTimeEntryInput
) {
  if (isDatabaseConnected) {
    const existing = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        project: { companyId },
      },
    });
    if (!existing) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found');

    if (existing.userId !== actorUserId) {
      const user = await prisma.user.findUnique({
        where: { id: actorUserId },
        include: { userRoles: { include: { role: true } } },
      });
      const isAdmin = user?.userRoles.some((ur: any) => ur.role.name === 'Administrator' || ur.role.name === 'Manager');
      if (!isAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to modify another user’s time entry');
      }
    }

    const startedAt = input.startedAt || existing.startedAt;
    const endedAt = input.endedAt !== undefined ? input.endedAt : existing.endedAt;
    const minutes = computeMinutes(startedAt, endedAt, input.minutes !== undefined ? input.minutes : existing.minutes);

    const updated = await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        ...(input.projectId !== undefined && { projectId: input.projectId }),
        ...(input.taskId !== undefined && { taskId: input.taskId }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.endedAt !== undefined && { endedAt: input.endedAt }),
        ...(input.billable !== undefined && { billable: input.billable }),
        minutes,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: actorUserId,
        action: 'TIME_ENTRY_UPDATED',
        entityType: 'TimeEntry',
        entityId: entryId,
        metadata: { changes: input },
      },
    });

    return updated;
  }

  // Dev Store fallback
  const idx = devStore.timeEntries.findIndex((te) => te.id === entryId);
  if (idx === -1) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found');

  const existing = devStore.timeEntries[idx];
  const project = devStore.projects.find((p) => p.id === existing.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found');

  if (existing.userId !== actorUserId) {
    const user = devStore.users.find((u) => u.id === actorUserId);
    const isAdmin = user?.roleIds.includes('10000000-0000-0000-0000-000000000001') || user?.roleIds.includes('10000000-0000-0000-0000-000000000002');
    if (!isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to modify another user’s time entry');
    }
  }

  const startedAt = input.startedAt || existing.startedAt;
  const endedAt = input.endedAt !== undefined ? input.endedAt : existing.endedAt;
  const minutes = computeMinutes(startedAt, endedAt, input.minutes !== undefined ? input.minutes : existing.minutes);

  const updated: DevTimeEntry = {
    ...existing,
    ...(input.projectId !== undefined && { projectId: input.projectId }),
    ...(input.taskId !== undefined && { taskId: input.taskId }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
    ...(input.endedAt !== undefined && { endedAt: input.endedAt }),
    ...(input.billable !== undefined && { billable: input.billable }),
    minutes,
    updatedAt: new Date(),
  };

  devStore.timeEntries[idx] = updated;

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: actorUserId,
    action: 'TIME_ENTRY_UPDATED',
    entityType: 'TimeEntry',
    entityId: entryId,
    metadata: { changes: input },
    createdAt: new Date(),
  });

  const user = devStore.users.find((u) => u.id === updated.userId);
  const task = devStore.tasks.find((t) => t.id === updated.taskId);

  return {
    ...updated,
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    project: { id: project.id, name: project.name },
    task: task ? { id: task.id, title: task.title } : null,
  };
}

export async function deleteTimeEntry(companyId: string, actorUserId: string, entryId: string) {
  if (isDatabaseConnected) {
    const existing = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        project: { companyId },
      },
    });
    if (!existing) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found');

    if (existing.userId !== actorUserId) {
      const user = await prisma.user.findUnique({
        where: { id: actorUserId },
        include: { userRoles: { include: { role: true } } },
      });
      const isAdmin = user?.userRoles.some((ur: any) => ur.role.name === 'Administrator' || ur.role.name === 'Manager');
      if (!isAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete another user’s time entry');
      }
    }

    await prisma.timeEntry.delete({ where: { id: entryId } });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: actorUserId,
        action: 'TIME_ENTRY_DELETED',
        entityType: 'TimeEntry',
        entityId: entryId,
        metadata: { deletedEntryId: entryId },
      },
    });

    return { success: true, message: 'Time entry deleted successfully' };
  }

  // Dev Store fallback
  const idx = devStore.timeEntries.findIndex((te) => te.id === entryId);
  if (idx === -1) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found');

  const existing = devStore.timeEntries[idx];
  const project = devStore.projects.find((p) => p.id === existing.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found');

  if (existing.userId !== actorUserId) {
    const user = devStore.users.find((u) => u.id === actorUserId);
    const isAdmin = user?.roleIds.includes('10000000-0000-0000-0000-000000000001') || user?.roleIds.includes('10000000-0000-0000-0000-000000000002');
    if (!isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete another user’s time entry');
    }
  }

  devStore.timeEntries.splice(idx, 1);

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: actorUserId,
    action: 'TIME_ENTRY_DELETED',
    entityType: 'TimeEntry',
    entityId: entryId,
    metadata: { deletedEntryId: entryId },
    createdAt: new Date(),
  });

  return { success: true, message: 'Time entry deleted successfully' };
}
