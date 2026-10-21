import { prisma, isDatabaseConnected } from '../../config/database.js';
import {
  devStore,
  DevTask,
  DevTaskAssignee,
  DevTaskComment,
} from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
  AddTaskCommentInput,
  UpdateTaskCommentInput,
} from './tasks.schema.js';
import { randomUUID } from 'crypto';
import { createNotification } from '../notifications/notifications.service.js';
import { getTaskBrief, notifyTaskCreatorOfComment, notifyTaskStatusChange } from '../notifications/work-notifications.js';

/** Administrators and Managers see every task; everyone else only their own. */
export function isTaskElevated(roles: string[] | undefined): boolean {
  return !!roles && (roles.includes('Administrator') || roles.includes('Manager'));
}

/** True when the user created the task or is one of its assignees. */
async function isTaskOwnedBy(companyId: string, taskId: string, userId: string): Promise<boolean> {
  if (isDatabaseConnected) {
    const hit = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: { companyId },
        OR: [{ creatorId: userId }, { assignees: { some: { userId } } }],
      },
      select: { id: true },
    });
    return !!hit;
  }
  const task = devStore.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  return task.creatorId === userId || devStore.taskAssignees.some((ta) => ta.taskId === taskId && ta.userId === userId);
}

/** Throws 404 (not 403, so existence is not leaked) when a scoped user touches someone else's task. */
export async function assertTaskAccess(companyId: string, taskId: string, scopeUserId?: string) {
  if (!scopeUserId) return;
  if (!(await isTaskOwnedBy(companyId, taskId, scopeUserId))) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  }
}

export async function listTasks(companyId: string, query: ListTasksQuery, scopeUserId?: string) {
  const {
    page = 1,
    limit = 30,
    search,
    projectId,
    milestoneId,
    status,
    priority,
    assignedToId,
    isArchived = false,
    overdue,
    dueSoon,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const skip = (page - 1) * limit;
  const now = new Date();
  const threeDaysFromNow = new Date(Date.now() + 3 * 86400000);

  if (isDatabaseConnected) {
    const where: any = {
      project: { companyId },
      isArchived,
    };

    if (scopeUserId) {
      where.AND = [{ OR: [{ creatorId: scopeUserId }, { assignees: { some: { userId: scopeUserId } } }] }];
    }

    if (projectId) where.projectId = projectId;
    if (milestoneId) where.milestoneId = milestoneId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (assignedToId) {
      where.assignees = {
        some: { userId: assignedToId },
      };
    }

    if (overdue) {
      where.dueDate = { lt: now };
      where.status = { not: 'DONE' };
    }

    if (dueSoon) {
      where.dueDate = { gte: now, lte: threeDaysFromNow };
      where.status = { not: 'DONE' };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rawTasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          project: { select: { id: true, name: true } },
          milestone: { select: { id: true, name: true, title: true } },
          creator: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          _count: {
            select: {
              comments: true,
              timeEntries: true,
            },
          },
        },
      }),
    ]);

    const tasks = rawTasks.map((t: any) => {
      const isTaskOverdue = t.dueDate && t.dueDate < now && t.status !== 'DONE';
      return {
        ...t,
        isOverdue: Boolean(isTaskOverdue),
        commentsCount: t._count.comments,
        timeEntriesCount: t._count.timeEntries,
      };
    });

    return {
      data: tasks,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Dev Store fallback
  let filtered = devStore.tasks.filter((t) => {
    const proj = devStore.projects.find((p) => p.id === t.projectId && p.companyId === companyId);
    if (!proj) return false;
    if (scopeUserId && t.creatorId !== scopeUserId &&
        !devStore.taskAssignees.some((ta) => ta.taskId === t.id && ta.userId === scopeUserId)) {
      return false;
    }
    if (t.isArchived !== isArchived) return false;
    if (projectId && t.projectId !== projectId) return false;
    if (milestoneId && t.milestoneId !== milestoneId) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;

    if (assignedToId) {
      const isAssigned = devStore.taskAssignees.some(
        (ta) => ta.taskId === t.id && ta.userId === assignedToId
      );
      if (!isAssigned) return false;
    }

    if (overdue) {
      if (!t.dueDate || new Date(t.dueDate) >= now || t.status === 'DONE') return false;
    }

    if (dueSoon) {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      if (d < now || d > threeDaysFromNow || t.status === 'DONE') return false;
    }

    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.description && t.description.toLowerCase().includes(q))) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((a, b) => {
    let valA = (a as any)[sortBy];
    let valB = (b as any)[sortBy];
    if (valA instanceof Date) valA = valA.getTime();
    if (valB instanceof Date) valB = valB.getTime();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  const tasks = paginated.map((t) => {
    const project = devStore.projects.find((p) => p.id === t.projectId);
    const milestone = devStore.milestones.find((m) => m.id === t.milestoneId);
    const creator = devStore.users.find((u) => u.id === t.creatorId);
    const assignees = devStore.taskAssignees
      .filter((ta) => ta.taskId === t.id)
      .map((ta) => ({
        ...ta,
        user: devStore.users.find((u) => u.id === ta.userId) || null,
      }));
    const isTaskOverdue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE';

    return {
      ...t,
      project: project ? { id: project.id, name: project.name } : null,
      milestone: milestone ? { id: milestone.id, name: milestone.name, title: milestone.title } : null,
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
      assignees,
      isOverdue: Boolean(isTaskOverdue),
      commentsCount: devStore.taskComments.filter((c) => c.taskId === t.id).length,
      timeEntriesCount: devStore.timeEntries.filter((te) => te.taskId === t.id).length,
    };
  });

  return {
    data: tasks,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getTaskById(companyId: string, taskId: string) {
  const now = new Date();

  if (isDatabaseConnected) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: { companyId },
      },
      include: {
        project: { select: { id: true, name: true, status: true, customerId: true } },
        milestone: { select: { id: true, name: true, title: true, status: true } },
        creator: { select: { id: true, name: true, email: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        timeEntries: {
          orderBy: { startedAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

    const totalMinutes = task.timeEntries.reduce((sum: number, te: any) => sum + te.minutes, 0);
    const isTaskOverdue = task.dueDate && task.dueDate < now && task.status !== 'DONE';

    return {
      ...task,
      isOverdue: Boolean(isTaskOverdue),
      totalTrackedMinutes: totalMinutes,
      totalTrackedHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }

  // Dev Store fallback
  const task = devStore.tasks.find((t) => t.id === taskId);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

  const project = devStore.projects.find((p) => p.id === task.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

  const milestone = devStore.milestones.find((m) => m.id === task.milestoneId);
  const creator = devStore.users.find((u) => u.id === task.creatorId);
  const assignees = devStore.taskAssignees
    .filter((ta) => ta.taskId === task.id)
    .map((ta) => ({
      ...ta,
      user: devStore.users.find((u) => u.id === ta.userId) || null,
    }));

  const comments = devStore.taskComments
    .filter((c) => c.taskId === task.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => ({
      ...c,
      author: devStore.users.find((u) => u.id === c.authorId) || null,
    }));

  const timeEntries = devStore.timeEntries
    .filter((te) => te.taskId === task.id)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .map((te) => ({
      ...te,
      user: devStore.users.find((u) => u.id === te.userId) || null,
    }));

  const totalMinutes = timeEntries.reduce((sum, te) => sum + te.minutes, 0);
  const isTaskOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE';

  return {
    ...task,
    project: { id: project.id, name: project.name, status: project.status, customerId: project.customerId },
    milestone: milestone ? { id: milestone.id, name: milestone.name, title: milestone.title, status: milestone.status } : null,
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
    assignees,
    comments,
    timeEntries,
    isOverdue: Boolean(isTaskOverdue),
    totalTrackedMinutes: totalMinutes,
    totalTrackedHours: Math.round((totalMinutes / 60) * 10) / 10,
  };
}

async function createTaskRecord(
  companyId: string,
  userId: string,
  input: CreateTaskInput
) {
  // 1. Verify project belongs to company
  if (isDatabaseConnected) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in your company');

    // 2. Verify milestone belongs to the same project
    if (input.milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: { id: input.milestoneId, projectId: input.projectId },
      });
      if (!milestone) {
        throw new AppError(400, 'INVALID_MILESTONE', 'Milestone does not belong to the selected project');
      }
    }

    const completedAt = input.status === 'DONE' ? new Date() : null;

    return prisma.$transaction(async (tx: any) => {
      const task = await tx.task.create({
        data: {
          projectId: input.projectId,
          milestoneId: input.milestoneId || null,
          creatorId: userId,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          startDate: input.startDate,
          dueDate: input.dueDate,
          completedAt,
          estimatedHours: input.estimatedHours,
        },
      });

      if (input.assigneeIds && input.assigneeIds.length > 0) {
        for (const assigneeId of input.assigneeIds) {
          const u = await tx.user.findFirst({ where: { id: assigneeId, companyId } });
          if (u) {
            await tx.taskAssignee.create({
              data: {
                taskId: task.id,
                userId: assigneeId,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          companyId,
          actorId: userId,
          action: 'TASK_CREATED',
          entityType: 'Task',
          entityId: task.id,
          metadata: { title: task.title, status: task.status, priority: task.priority },
        },
      });

      return task;
    });
  }

  // Dev Store fallback
  const project = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found in your company');

  if (input.milestoneId) {
    const milestone = devStore.milestones.find(
      (m) => m.id === input.milestoneId && m.projectId === input.projectId
    );
    if (!milestone) {
      throw new AppError(400, 'INVALID_MILESTONE', 'Milestone does not belong to the selected project');
    }
  }

  const completedAt = input.status === 'DONE' ? new Date() : null;
  const newTask: DevTask = {
    id: randomUUID(),
    projectId: input.projectId,
    milestoneId: input.milestoneId || null,
    creatorId: userId,
    title: input.title,
    description: input.description || null,
    status: (input.status || 'TODO') as any,
    priority: (input.priority || 'MEDIUM') as any,
    startDate: input.startDate || null,
    dueDate: input.dueDate || null,
    completedAt,
    estimatedHours: input.estimatedHours || null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.tasks.unshift(newTask);

  if (input.assigneeIds && input.assigneeIds.length > 0) {
    for (const assigneeId of input.assigneeIds) {
      const u = devStore.users.find((user) => user.id === assigneeId && user.companyId === companyId);
      if (u) {
        devStore.taskAssignees.push({
          taskId: newTask.id,
          userId: assigneeId,
        });
      }
    }
  }

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'TASK_CREATED',
    entityType: 'Task',
    entityId: newTask.id,
    metadata: { title: newTask.title, status: newTask.status, priority: newTask.priority },
    createdAt: new Date(),
  });

  return newTask;
}

async function updateTaskRecord(
  companyId: string,
  userId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  if (isDatabaseConnected) {
    const existing = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: { companyId },
      },
    });
    if (!existing) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

    const effectiveProjectId = input.projectId || existing.projectId;

    if (input.milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: { id: input.milestoneId, projectId: effectiveProjectId },
      });
      if (!milestone) {
        throw new AppError(400, 'INVALID_MILESTONE', 'Milestone does not belong to the task project');
      }
    }

    const completedAt =
      input.completedAt !== undefined
        ? input.completedAt
        : input.status === 'DONE' && !existing.completedAt
        ? new Date()
        : input.status && input.status !== 'DONE'
        ? null
        : undefined;

    return prisma.$transaction(async (tx: any) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.projectId !== undefined && { projectId: input.projectId }),
          ...(input.milestoneId !== undefined && { milestoneId: input.milestoneId }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.startDate !== undefined && { startDate: input.startDate }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
          ...(completedAt !== undefined && { completedAt }),
          ...(input.estimatedHours !== undefined && { estimatedHours: input.estimatedHours }),
          ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
        },
      });

      if (input.assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        for (const aId of input.assigneeIds) {
          const u = await tx.user.findFirst({ where: { id: aId, companyId } });
          if (u) {
            await tx.taskAssignee.create({
              data: {
                taskId,
                userId: aId,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          companyId,
          actorId: userId,
          action: 'TASK_UPDATED',
          entityType: 'Task',
          entityId: taskId,
          metadata: { changes: input },
        },
      });

      return updated;
    });
  }

  // Dev Store fallback
  const idx = devStore.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

  const existing = devStore.tasks[idx];
  const project = devStore.projects.find((p) => p.id === existing.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

  const effectiveProjectId = input.projectId || existing.projectId;
  if (input.milestoneId) {
    const milestone = devStore.milestones.find(
      (m) => m.id === input.milestoneId && m.projectId === effectiveProjectId
    );
    if (!milestone) {
      throw new AppError(400, 'INVALID_MILESTONE', 'Milestone does not belong to the task project');
    }
  }

  const completedAt =
    input.completedAt !== undefined
      ? input.completedAt
      : input.status === 'DONE' && !existing.completedAt
      ? new Date()
      : input.status && input.status !== 'DONE'
      ? null
      : existing.completedAt;

  const updated: DevTask = {
    ...existing,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.projectId !== undefined && { projectId: input.projectId }),
    ...(input.milestoneId !== undefined && { milestoneId: input.milestoneId }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.priority !== undefined && { priority: input.priority }),
    ...(input.startDate !== undefined && { startDate: input.startDate }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
    completedAt,
    ...(input.estimatedHours !== undefined && { estimatedHours: input.estimatedHours }),
    ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    updatedAt: new Date(),
  };

  devStore.tasks[idx] = updated;

  if (input.assigneeIds !== undefined) {
    devStore.taskAssignees = devStore.taskAssignees.filter((ta) => ta.taskId !== taskId);
    for (const aId of input.assigneeIds) {
      const u = devStore.users.find((user) => user.id === aId && user.companyId === companyId);
      if (u) {
        devStore.taskAssignees.push({
          taskId,
          userId: aId,
        });
      }
    }
  }

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'TASK_UPDATED',
    entityType: 'Task',
    entityId: taskId,
    metadata: { changes: input },
    createdAt: new Date(),
  });

  return updated;
}

export async function updateTaskStatus(
  companyId: string,
  userId: string,
  taskId: string,
  status: any
) {
  return updateTask(companyId, userId, taskId, { status });
}

async function addTaskCommentRecord(
  companyId: string,
  userId: string,
  taskId: string,
  input: AddTaskCommentInput
) {
  if (isDatabaseConnected) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, project: { companyId } },
    });
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        authorId: userId,
        body: input.body,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: userId,
        action: 'TASK_COMMENT_ADDED',
        entityType: 'Task',
        entityId: taskId,
        metadata: { commentId: comment.id },
      },
    });

    return comment;
  }

  // Dev Store fallback
  const task = devStore.tasks.find((t) => t.id === taskId);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

  const project = devStore.projects.find((p) => p.id === task.projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

  const user = devStore.users.find((u) => u.id === userId);

  const newComment: DevTaskComment = {
    id: randomUUID(),
    taskId,
    authorId: userId,
    body: input.body,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.taskComments.unshift(newComment);

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'TASK_COMMENT_ADDED',
    entityType: 'Task',
    entityId: taskId,
    metadata: { commentId: newComment.id },
    createdAt: new Date(),
  });

  return {
    ...newComment,
    author: user ? { id: user.id, name: user.name, email: user.email } : null,
  };
}

export async function deleteTaskComment(
  companyId: string,
  userId: string,
  taskId: string,
  commentId: string
) {
  if (isDatabaseConnected) {
    const comment = await prisma.taskComment.findFirst({
      where: {
        id: commentId,
        taskId,
        task: { project: { companyId } },
      },
    });
    if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');

    // Only author or admin can delete
    if (comment.authorId !== userId) {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
      });
      const isAdmin = user?.userRoles.some((ur: any) => ur.role.name === 'Administrator');
      if (!isAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this comment');
      }
    }

    await prisma.taskComment.delete({ where: { id: commentId } });

    return { success: true, message: 'Comment deleted successfully' };
  }

  // Dev Store fallback
  const idx = devStore.taskComments.findIndex((c) => c.id === commentId && c.taskId === taskId);
  if (idx === -1) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');

  const comment = devStore.taskComments[idx];
  if (comment.authorId !== userId) {
    const user = devStore.users.find((u) => u.id === userId);
    const isAdmin = user?.roleIds.includes('10000000-0000-0000-0000-000000000001');
    if (!isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this comment');
    }
  }

  devStore.taskComments.splice(idx, 1);
  return { success: true, message: 'Comment deleted successfully' };
}


// ---------------------------------------------------------------------------
// Notifications: tell staff when they are assigned a task or someone comments.
// Delivery failures never block the task operation itself.
// ---------------------------------------------------------------------------

async function getAssigneeIds(taskId: string): Promise<string[]> {
  if (isDatabaseConnected) {
    const rows = await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
    return rows.map((r: { userId: string }) => r.userId);
  }
  return devStore.taskAssignees.filter((ta) => ta.taskId === taskId).map((ta) => ta.userId);
}

async function notifyTaskAssigned(
  companyId: string,
  actorId: string,
  task: { id: string; title: string },
  userIds: string[]
) {
  for (const uid of new Set(userIds)) {
    if (uid === actorId) continue;
    try {
      await createNotification(uid, {
        companyId,
        type: 'task.assigned',
        title: `New Task Assigned: ${task.title}`,
        body: `You have been assigned to task "${task.title}".`,
        link: `/work/tasks/${task.id}`,
        metadata: { taskId: task.id },
      });
    } catch {
      // ignore
    }
  }
}

export async function createTask(companyId: string, userId: string, input: CreateTaskInput) {
  const task = await createTaskRecord(companyId, userId, input);
  await notifyTaskAssigned(companyId, userId, task, input.assigneeIds ?? []);
  return task;
}

export async function updateTask(
  companyId: string,
  userId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  const before = input.assigneeIds !== undefined ? await getAssigneeIds(taskId) : [];
  const previousStatus = input.status !== undefined ? (await getTaskBrief(taskId))?.status : undefined;
  const task = await updateTaskRecord(companyId, userId, taskId, input);
  if (previousStatus !== undefined) {
    await notifyTaskStatusChange(companyId, userId, taskId, previousStatus);
  }
  if (input.assigneeIds !== undefined) {
    const added = input.assigneeIds.filter((id) => !before.includes(id));
    await notifyTaskAssigned(companyId, userId, task, added);
  }
  return task;
}

export async function addTaskComment(
  companyId: string,
  userId: string,
  taskId: string,
  input: AddTaskCommentInput
) {
  const comment = await addTaskCommentRecord(companyId, userId, taskId, input);
  try {
    const task = isDatabaseConnected
      ? await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, title: true } })
      : devStore.tasks.find((t) => t.id === taskId);
    const authorName = (comment as any).author?.name ?? 'A teammate';
    const assigneeIds = await getAssigneeIds(taskId);
    await notifyTaskCreatorOfComment(companyId, userId, taskId, assigneeIds);
    for (const uid of assigneeIds) {
      if (uid === userId || !task) continue;
      await createNotification(uid, {
        companyId,
        type: 'task.comment',
        title: `New Comment on: ${task.title}`,
        body: `${authorName} commented on a task assigned to you.`,
        link: `/work/tasks/${taskId}`,
        metadata: { taskId },
      });
    }
  } catch {
    // ignore
  }
  return comment;
}
