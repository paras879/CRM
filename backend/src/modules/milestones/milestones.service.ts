import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevMilestone } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import {
  CreateMilestoneInput,
  UpdateMilestoneInput,
  ListMilestonesQuery,
} from './milestones.schema.js';
import { randomUUID } from 'crypto';

export async function listMilestones(companyId: string, query: ListMilestonesQuery) {
  const { projectId, status, isArchived = false } = query;

  if (isDatabaseConnected) {
    const where: any = {
      project: { companyId },
      isArchived,
    };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const milestones = await prisma.milestone.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        project: { select: { id: true, name: true } },
        tasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        },
      },
    });

    const now = new Date();
    return milestones.map((m: any) => {
      const totalTasks = m.tasks.length;
      const doneTasks = m.tasks.filter((t: any) => t.status === 'DONE').length;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (m.status === 'COMPLETED' ? 100 : 0);
      const isOverdue = m.dueDate && m.dueDate < now && m.status !== 'COMPLETED';

      return {
        ...m,
        progress,
        isOverdue: Boolean(isOverdue),
        totalTasks,
        doneTasks,
      };
    });
  }

  // Dev Store fallback
  let milestones = devStore.milestones.filter((m) => {
    const project = devStore.projects.find((p) => p.id === m.projectId && p.companyId === companyId);
    if (!project) return false;
    if (m.isArchived !== isArchived) return false;
    if (projectId && m.projectId !== projectId) return false;
    if (status && m.status !== status) return false;
    return true;
  });

  milestones.sort((a, b) => a.order - b.order);

  const now = new Date();
  return milestones.map((m) => {
    const project = devStore.projects.find((p) => p.id === m.projectId);
    const tasks = devStore.tasks.filter((t) => t.milestoneId === m.id && !t.isArchived);
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (m.status === 'COMPLETED' ? 100 : 0);
    const isOverdue = m.dueDate && new Date(m.dueDate) < now && m.status !== 'COMPLETED';

    return {
      ...m,
      project: project ? { id: project.id, name: project.name } : null,
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate })),
      progress,
      isOverdue: Boolean(isOverdue),
      totalTasks,
      doneTasks,
    };
  });
}

export async function getMilestoneById(companyId: string, milestoneId: string) {
  if (isDatabaseConnected) {
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        project: { companyId },
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        tasks: {
          where: { isArchived: false },
          include: {
            creator: { select: { id: true, name: true, email: true } },
            assignees: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

    const totalTasks = milestone.tasks.length;
    const doneTasks = milestone.tasks.filter((t: any) => t.status === 'DONE').length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (milestone.status === 'COMPLETED' ? 100 : 0);
    const isOverdue = milestone.dueDate && milestone.dueDate < new Date() && milestone.status !== 'COMPLETED';

    return {
      ...milestone,
      progress,
      isOverdue: Boolean(isOverdue),
      totalTasks,
      doneTasks,
    };
  }

  // Dev Store fallback
  const milestone = devStore.milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  const project = devStore.projects.find((p) => p.id === milestone.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  const tasks = devStore.tasks
    .filter((t) => t.milestoneId === milestone.id && !t.isArchived)
    .map((t) => {
      const creator = devStore.users.find((u) => u.id === t.creatorId);
      const assignees = devStore.taskAssignees
        .filter((ta) => ta.taskId === t.id)
        .map((ta) => ({
          ...ta,
          user: devStore.users.find((u) => u.id === ta.userId) || null,
        }));
      return {
        ...t,
        creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
        assignees,
      };
    });

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (milestone.status === 'COMPLETED' ? 100 : 0);
  const isOverdue = milestone.dueDate && new Date(milestone.dueDate) < new Date() && milestone.status !== 'COMPLETED';

  return {
    ...milestone,
    project: { id: project.id, name: project.name, status: project.status },
    tasks,
    progress,
    isOverdue: Boolean(isOverdue),
    totalTasks,
    doneTasks,
  };
}

export async function createMilestone(
  companyId: string,
  userId: string,
  input: CreateMilestoneInput
) {
  // Validate project belongs to company
  if (isDatabaseConnected) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in your company');

    const milestone = await prisma.milestone.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        title: input.title || input.name,
        description: input.description,
        dueDate: input.dueDate,
        status: input.status,
        order: input.order,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: userId,
        action: 'MILESTONE_CREATED',
        entityType: 'Milestone',
        entityId: milestone.id,
        metadata: { name: milestone.name, projectId: input.projectId },
      },
    });

    return milestone;
  }

  // Dev Store fallback
  const project = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in your company');

  const newMilestone: DevMilestone = {
    id: randomUUID(),
    projectId: input.projectId,
    name: input.name,
    title: input.title || input.name,
    description: input.description || null,
    dueDate: input.dueDate || null,
    status: input.status,
    completedAt: input.status === 'COMPLETED' ? new Date() : null,
    order: input.order || 0,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.milestones.push(newMilestone);

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'MILESTONE_CREATED',
    entityType: 'Milestone',
    entityId: newMilestone.id,
    metadata: { name: newMilestone.name, projectId: input.projectId },
    createdAt: new Date(),
  });

  return {
    ...newMilestone,
    project: { id: project.id, name: project.name },
  };
}

export async function updateMilestone(
  companyId: string,
  userId: string,
  milestoneId: string,
  input: UpdateMilestoneInput
) {
  if (isDatabaseConnected) {
    const existing = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        project: { companyId },
      },
    });
    if (!existing) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

    const completedAt =
      input.completedAt !== undefined
        ? input.completedAt
        : input.status === 'COMPLETED' && !existing.completedAt
        ? new Date()
        : input.status && input.status !== 'COMPLETED'
        ? null
        : undefined;

    const updated = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.status !== undefined && { status: input.status }),
        ...(completedAt !== undefined && { completedAt }),
        ...(input.order !== undefined && { order: input.order }),
        ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: userId,
        action: 'MILESTONE_UPDATED',
        entityType: 'Milestone',
        entityId: milestoneId,
        metadata: { changes: input },
      },
    });

    return updated;
  }

  // Dev Store fallback
  const idx = devStore.milestones.findIndex((m) => m.id === milestoneId);
  if (idx === -1) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  const existing = devStore.milestones[idx];
  const project = devStore.projects.find((p) => p.id === existing.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  const completedAt =
    input.completedAt !== undefined
      ? input.completedAt
      : input.status === 'COMPLETED' && !existing.completedAt
      ? new Date()
      : input.status && input.status !== 'COMPLETED'
      ? null
      : existing.completedAt;

  const updated: DevMilestone = {
    ...existing,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.title !== undefined && { title: input.title || input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
    ...(input.status !== undefined && { status: input.status }),
    completedAt,
    ...(input.order !== undefined && { order: input.order }),
    ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    updatedAt: new Date(),
  };

  devStore.milestones[idx] = updated;

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'MILESTONE_UPDATED',
    entityType: 'Milestone',
    entityId: milestoneId,
    metadata: { changes: input },
    createdAt: new Date(),
  });

  return updated;
}
