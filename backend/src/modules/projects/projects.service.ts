import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevProject, DevProjectMember } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsQuery,
  AddProjectMemberInput,
} from './projects.schema.js';
import { randomUUID } from 'crypto';
import { createNotification } from '../notifications/notifications.service.js';

export async function listProjects(companyId: string, query: ListProjectsQuery) {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    priority,
    customerId,
    projectManagerId,
    isArchived = false,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    const where: any = {
      companyId,
      isArchived,
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (customerId) where.customerId = customerId;
    if (projectManagerId) where.projectManagerId = projectManagerId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rawProjects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, name: true, companyName: true, email: true },
          },
          projectManager: {
            select: { id: true, name: true, email: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          tasks: {
            select: { id: true, status: true, dueDate: true },
          },
          _count: {
            select: {
              tasks: true,
              milestones: true,
              timeEntries: true,
            },
          },
        },
      }),
    ]);

    const projects = rawProjects.map((p: any) => {
      const totalTasks = p.tasks.length;
      const doneTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
      const calculatedProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : p.progress;

      return {
        ...p,
        progress: calculatedProgress,
        stats: {
          totalTasks,
          doneTasks,
          openTasks: totalTasks - doneTasks,
          milestonesCount: p._count.milestones,
          timeEntriesCount: p._count.timeEntries,
        },
      };
    });

    return {
      data: projects,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Fallback Dev Store mode
  let filtered = devStore.projects.filter(
    (p) => p.companyId === companyId && p.isArchived === isArchived
  );

  if (status) filtered = filtered.filter((p) => p.status === status);
  if (priority) filtered = filtered.filter((p) => p.priority === priority);
  if (customerId) filtered = filtered.filter((p) => p.customerId === customerId);
  if (projectManagerId) filtered = filtered.filter((p) => p.projectManagerId === projectManagerId);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // Sorting
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

  const projects = paginated.map((p) => {
    const customer = devStore.customers.find((c) => c.id === p.customerId);
    const pm = devStore.users.find((u) => u.id === p.projectManagerId);
    const projectMembers = devStore.projectMembers.filter((m) => m.projectId === p.id);
    const members = projectMembers.map((m) => {
      const u = devStore.users.find((user) => user.id === m.userId);
      return {
        ...m,
        user: u ? { id: u.id, name: u.name, email: u.email } : null,
      };
    });
    const tasks = devStore.tasks.filter((t) => t.projectId === p.id && !t.isArchived);
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
    const calculatedProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : p.progress;

    return {
      ...p,
      progress: calculatedProgress,
      customer: customer ? { id: customer.id, name: customer.name, companyName: customer.companyName, email: customer.email } : null,
      projectManager: pm ? { id: pm.id, name: pm.name, email: pm.email } : null,
      members,
      stats: {
        totalTasks,
        doneTasks,
        openTasks: totalTasks - doneTasks,
        milestonesCount: devStore.milestones.filter((m) => m.projectId === p.id && !m.isArchived).length,
        timeEntriesCount: devStore.timeEntries.filter((te) => te.projectId === p.id).length,
      },
    };
  });

  return {
    data: projects,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProjectById(companyId: string, projectId: string) {
  if (isDatabaseConnected) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      include: {
        customer: {
          select: { id: true, name: true, companyName: true, email: true, phone: true },
        },
        projectManager: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        milestones: {
          where: { isArchived: false },
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              select: { id: true, title: true, status: true, priority: true, dueDate: true },
            },
          },
        },
        tasks: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
          include: {
            creator: { select: { id: true, name: true, email: true } },
            assignees: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            milestone: { select: { id: true, name: true, title: true } },
          },
        },
        timeEntries: {
          orderBy: { startedAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
            task: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!project) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    const totalTasks = project.tasks.length;
    const doneTasks = project.tasks.filter((t: any) => t.status === 'DONE').length;
    const calculatedProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : project.progress;

    const totalMinutes = project.timeEntries.reduce((sum: number, te: any) => sum + te.minutes, 0);
    const billableMinutes = project.timeEntries.filter((te: any) => te.billable).reduce((sum: number, te: any) => sum + te.minutes, 0);

    return {
      ...project,
      progress: calculatedProgress,
      timeSummary: {
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        billableMinutes,
        billableHours: Math.round((billableMinutes / 60) * 10) / 10,
        nonBillableMinutes: totalMinutes - billableMinutes,
        nonBillableHours: Math.round(((totalMinutes - billableMinutes) / 60) * 10) / 10,
      },
    };
  }

  // Dev Store fallback
  const project = devStore.projects.find((p) => p.id === projectId && p.companyId === companyId);
  if (!project) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }

  const customer = devStore.customers.find((c) => c.id === project.customerId);
  const pm = devStore.users.find((u) => u.id === project.projectManagerId);
  const rawMembers = devStore.projectMembers.filter((m) => m.projectId === project.id);
  const members = rawMembers.map((m) => ({
    ...m,
    user: devStore.users.find((u) => u.id === m.userId) || null,
  }));

  const rawMilestones = devStore.milestones.filter((m) => m.projectId === project.id && !m.isArchived);
  const milestones = rawMilestones.map((m) => ({
    ...m,
    tasks: devStore.tasks.filter((t) => t.milestoneId === m.id && !t.isArchived),
  }));

  const rawTasks = devStore.tasks.filter((t) => t.projectId === project.id && !t.isArchived);
  const tasks = rawTasks.map((t) => {
    const creator = devStore.users.find((u) => u.id === t.creatorId);
    const assignees = devStore.taskAssignees
      .filter((ta) => ta.taskId === t.id)
      .map((ta) => ({
        ...ta,
        user: devStore.users.find((u) => u.id === ta.userId) || null,
      }));
    const milestone = devStore.milestones.find((m) => m.id === t.milestoneId);
    return {
      ...t,
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
      assignees,
      milestone: milestone ? { id: milestone.id, name: milestone.name, title: milestone.title } : null,
    };
  });

  const rawTimeEntries = devStore.timeEntries.filter((te) => te.projectId === project.id);
  const timeEntries = rawTimeEntries.map((te) => ({
    ...te,
    user: devStore.users.find((u) => u.id === te.userId) || null,
    task: devStore.tasks.find((t) => t.id === te.taskId) || null,
  }));

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const calculatedProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : project.progress;

  const totalMinutes = timeEntries.reduce((sum, te) => sum + te.minutes, 0);
  const billableMinutes = timeEntries.filter((te) => te.billable).reduce((sum, te) => sum + te.minutes, 0);

  return {
    ...project,
    progress: calculatedProgress,
    customer: customer ? { id: customer.id, name: customer.name, companyName: customer.companyName, email: customer.email, phone: customer.phone } : null,
    projectManager: pm ? { id: pm.id, name: pm.name, email: pm.email } : null,
    members,
    milestones,
    tasks,
    timeEntries,
    timeSummary: {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      billableMinutes,
      billableHours: Math.round((billableMinutes / 60) * 10) / 10,
      nonBillableMinutes: totalMinutes - billableMinutes,
      nonBillableHours: Math.round(((totalMinutes - billableMinutes) / 60) * 10) / 10,
    },
  };
}

export async function createProject(
  companyId: string,
  userId: string,
  input: CreateProjectInput
) {
  // Validate customer if provided
  if (input.customerId) {
    if (isDatabaseConnected) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, companyId },
      });
      if (!customer) {
        throw new AppError(400, 'INVALID_CUSTOMER', 'Selected customer does not exist in your company');
      }
    } else {
      const customer = devStore.customers.find(
        (c) => c.id === input.customerId && c.companyId === companyId
      );
      if (!customer) {
        throw new AppError(400, 'INVALID_CUSTOMER', 'Selected customer does not exist in your company');
      }
    }
  }

  // Validate project manager if provided
  if (input.projectManagerId) {
    if (isDatabaseConnected) {
      const pm = await prisma.user.findFirst({
        where: { id: input.projectManagerId, companyId },
      });
      if (!pm) {
        throw new AppError(400, 'INVALID_PROJECT_MANAGER', 'Selected project manager does not exist in your company');
      }
    } else {
      const pm = devStore.users.find(
        (u) => u.id === input.projectManagerId && u.companyId === companyId
      );
      if (!pm) {
        throw new AppError(400, 'INVALID_PROJECT_MANAGER', 'Selected project manager does not exist in your company');
      }
    }
  }

  const { memberIds, ...projectData } = input;
  const deadline = projectData.deadline || projectData.dueDate || null;
  const dueDate = projectData.dueDate || projectData.deadline || null;

  if (isDatabaseConnected) {
    return prisma.$transaction(async (tx: any) => {
      const project = await tx.project.create({
        data: {
          companyId,
          name: projectData.name,
          description: projectData.description,
          customerId: projectData.customerId,
          status: projectData.status,
          priority: projectData.priority,
          startDate: projectData.startDate,
          deadline,
          dueDate,
          progress: projectData.progress,
          budget: projectData.budget,
          currency: projectData.currency || 'INR',
          projectManagerId: projectData.projectManagerId,
        },
      });

      // Always include project manager or creator as member
      const initialMemberIds = new Set<string>();
      if (userId) initialMemberIds.add(userId);
      if (projectData.projectManagerId) initialMemberIds.add(projectData.projectManagerId);
      if (memberIds && memberIds.length > 0) {
        memberIds.forEach((id) => initialMemberIds.add(id));
      }

      for (const mUserId of initialMemberIds) {
        const role = mUserId === projectData.projectManagerId ? 'PROJECT_MANAGER' : 'MEMBER';
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: mUserId,
            role,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          actorId: userId,
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: project.id,
          metadata: { name: project.name, status: project.status },
        },
      });

      return project;
    });
  }

  // Dev Store fallback
  const newProject: DevProject = {
    id: randomUUID(),
    companyId,
    customerId: projectData.customerId || null,
    name: projectData.name,
    description: projectData.description || null,
    status: projectData.status,
    priority: projectData.priority,
    startDate: projectData.startDate || null,
    deadline,
    dueDate,
    progress: projectData.progress || 0,
    budget: projectData.budget || null,
    currency: projectData.currency || 'INR',
    projectManagerId: projectData.projectManagerId || null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.projects.unshift(newProject);

  const initialMemberIds = new Set<string>();
  if (userId) initialMemberIds.add(userId);
  if (projectData.projectManagerId) initialMemberIds.add(projectData.projectManagerId);
  if (memberIds && memberIds.length > 0) {
    memberIds.forEach((id) => initialMemberIds.add(id));
  }

  for (const mUserId of initialMemberIds) {
    const role = mUserId === projectData.projectManagerId ? 'PROJECT_MANAGER' : 'MEMBER';
    devStore.projectMembers.push({
      projectId: newProject.id,
      userId: mUserId,
      role,
      createdAt: new Date(),
    });
  }

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'PROJECT_CREATED',
    entityType: 'Project',
    entityId: newProject.id,
    metadata: { name: newProject.name, status: newProject.status },
    createdAt: new Date(),
  });

  return newProject;
}

export async function updateProject(
  companyId: string,
  userId: string,
  projectId: string,
  input: UpdateProjectInput
) {
  // Validate customer if provided
  if (input.customerId) {
    if (isDatabaseConnected) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, companyId },
      });
      if (!customer) {
        throw new AppError(400, 'INVALID_CUSTOMER', 'Selected customer does not exist in your company');
      }
    } else {
      const customer = devStore.customers.find(
        (c) => c.id === input.customerId && c.companyId === companyId
      );
      if (!customer) {
        throw new AppError(400, 'INVALID_CUSTOMER', 'Selected customer does not exist in your company');
      }
    }
  }

  // Validate PM if provided
  if (input.projectManagerId) {
    if (isDatabaseConnected) {
      const pm = await prisma.user.findFirst({
        where: { id: input.projectManagerId, companyId },
      });
      if (!pm) {
        throw new AppError(400, 'INVALID_PROJECT_MANAGER', 'Selected project manager does not exist in your company');
      }
    } else {
      const pm = devStore.users.find(
        (u) => u.id === input.projectManagerId && u.companyId === companyId
      );
      if (!pm) {
        throw new AppError(400, 'INVALID_PROJECT_MANAGER', 'Selected project manager does not exist in your company');
      }
    }
  }

  const deadline = input.deadline !== undefined ? input.deadline : input.dueDate;
  const dueDate = input.dueDate !== undefined ? input.dueDate : input.deadline;

  if (isDatabaseConnected) {
    const existing = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!existing) {
      throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.customerId !== undefined && { customerId: input.customerId }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(deadline !== undefined && { deadline }),
        ...(dueDate !== undefined && { dueDate }),
        ...(input.progress !== undefined && { progress: input.progress }),
        ...(input.budget !== undefined && { budget: input.budget }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.projectManagerId !== undefined && { projectManagerId: input.projectManagerId }),
        ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: userId,
        action: 'PROJECT_UPDATED',
        entityType: 'Project',
        entityId: projectId,
        metadata: { changes: input },
      },
    });

    return updated;
  }

  // Dev Store fallback
  const idx = devStore.projects.findIndex((p) => p.id === projectId && p.companyId === companyId);
  if (idx === -1) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }

  const current = devStore.projects[idx];
  const updated: DevProject = {
    ...current,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.customerId !== undefined && { customerId: input.customerId }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.priority !== undefined && { priority: input.priority }),
    ...(input.startDate !== undefined && { startDate: input.startDate }),
    ...(deadline !== undefined && { deadline }),
    ...(dueDate !== undefined && { dueDate }),
    ...(input.progress !== undefined && { progress: input.progress }),
    ...(input.budget !== undefined && { budget: input.budget }),
    ...(input.currency !== undefined && { currency: input.currency }),
    ...(input.projectManagerId !== undefined && { projectManagerId: input.projectManagerId }),
    ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
    updatedAt: new Date(),
  };

  devStore.projects[idx] = updated;

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: userId,
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: projectId,
    metadata: { changes: input },
    createdAt: new Date(),
  });

  return updated;
}

export async function archiveProject(companyId: string, userId: string, projectId: string) {
  return updateProject(companyId, userId, projectId, { isArchived: true });
}

export async function restoreProject(companyId: string, userId: string, projectId: string) {
  return updateProject(companyId, userId, projectId, { isArchived: false });
}

async function addProjectMemberRecord(
  companyId: string,
  actorUserId: string,
  projectId: string,
  input: AddProjectMemberInput
) {
  if (isDatabaseConnected) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const targetUser = await prisma.user.findFirst({
      where: { id: input.userId, companyId },
    });
    if (!targetUser) throw new AppError(400, 'USER_NOT_FOUND', 'User does not belong to your company');

    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: input.userId,
        },
      },
    });

    if (existingMember) {
      throw new AppError(400, 'MEMBER_EXISTS', 'User is already a member of this project');
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: input.userId,
        role: input.role || 'MEMBER',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: actorUserId,
        action: 'PROJECT_MEMBER_ADDED',
        entityType: 'Project',
        entityId: projectId,
        metadata: { addedUserId: input.userId, role: input.role },
      },
    });

    return member;
  }

  // Dev Store fallback
  const project = devStore.projects.find((p) => p.id === projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  const targetUser = devStore.users.find((u) => u.id === input.userId && u.companyId === companyId);
  if (!targetUser) throw new AppError(400, 'USER_NOT_FOUND', 'User does not belong to your company');

  const exists = devStore.projectMembers.some(
    (m) => m.projectId === projectId && m.userId === input.userId
  );
  if (exists) {
    throw new AppError(400, 'MEMBER_EXISTS', 'User is already a member of this project');
  }

  const newMember: DevProjectMember = {
    projectId,
    userId: input.userId,
    role: input.role || 'MEMBER',
    createdAt: new Date(),
  };

  devStore.projectMembers.push(newMember);

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: actorUserId,
    action: 'PROJECT_MEMBER_ADDED',
    entityType: 'Project',
    entityId: projectId,
    metadata: { addedUserId: input.userId, role: input.role },
    createdAt: new Date(),
  });

  return {
    ...newMember,
    user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
  };
}

export async function removeProjectMember(
  companyId: string,
  actorUserId: string,
  projectId: string,
  memberUserId: string
) {
  if (isDatabaseConnected) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found on this project');
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: memberUserId,
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        actorId: actorUserId,
        action: 'PROJECT_MEMBER_REMOVED',
        entityType: 'Project',
        entityId: projectId,
        metadata: { removedUserId: memberUserId },
      },
    });

    return { success: true, message: 'Member removed successfully' };
  }

  // Dev Store fallback
  const project = devStore.projects.find((p) => p.id === projectId && p.companyId === companyId);
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  const idx = devStore.projectMembers.findIndex(
    (m) => m.projectId === projectId && m.userId === memberUserId
  );
  if (idx === -1) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found on this project');
  }

  devStore.projectMembers.splice(idx, 1);

  devStore.auditLogs.unshift({
    id: randomUUID(),
    companyId,
    actorId: actorUserId,
    action: 'PROJECT_MEMBER_REMOVED',
    entityType: 'Project',
    entityId: projectId,
    metadata: { removedUserId: memberUserId },
    createdAt: new Date(),
  });

  return { success: true, message: 'Member removed successfully' };
}


export async function addProjectMember(
  companyId: string,
  actorUserId: string,
  projectId: string,
  input: AddProjectMemberInput
) {
  const member = await addProjectMemberRecord(companyId, actorUserId, projectId, input);
  if (input.userId !== actorUserId) {
    try {
      const project = isDatabaseConnected
        ? await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
        : devStore.projects.find((p) => p.id === projectId);
      await createNotification(input.userId, {
        companyId,
        type: 'project.member_added',
        title: 'Added to a Project',
        body: `You were added to project "${project?.name ?? 'a project'}".`,
        link: `/work/projects/${projectId}`,
        metadata: { projectId },
      });
    } catch {
      // ignore
    }
  }
  return member;
}
