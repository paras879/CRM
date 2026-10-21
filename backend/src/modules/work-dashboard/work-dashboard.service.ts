import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { getTeamUserIds, isTeamScopedManager } from '../users/team.service.js';

export async function getWorkDashboardMetrics(
  companyId: string,
  currentUserId: string,
  userPermissions: string[] = [],
  userRoles: string[] = []
) {
  const now = new Date();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000);

  let isElevated =
    userRoles.includes('Administrator') ||
    userRoles.includes('Manager') ||
    userPermissions.includes('projects.create') ||
    userPermissions.includes('projects.delete');

  if (userRoles.length === 0 && userPermissions.length === 0) {
    if (!isDatabaseConnected) {
      const u = devStore.users.find((user) => user.id === currentUserId);
      if (u) {
        const uRoles = devStore.roles.filter((r) => u.roleIds.includes(r.id));
        const roleNames = uRoles.map((r) => r.name);
        isElevated = roleNames.includes('Administrator') || roleNames.includes('Manager');
      }
    }
  }

  // Managers see their own reporting tree (themselves + everyone below them), not the whole company.
  const teamIds = isTeamScopedManager(userRoles) ? await getTeamUserIds(companyId, currentUserId) : null;
  const teamMeta = teamIds ? { isTeamScoped: true, teamSize: teamIds.length - 1 } : {};

  if (isDatabaseConnected) {
    const projectScopeWhere: any = teamIds
      ? {
          companyId,
          isArchived: false,
          OR: [{ members: { some: { userId: { in: teamIds } } } }, { projectManagerId: { in: teamIds } }],
        }
      : isElevated
      ? { companyId, isArchived: false }
      : {
          companyId,
          isArchived: false,
          OR: [
            { members: { some: { userId: currentUserId } } },
            { projectManagerId: currentUserId },
          ],
        };

    const taskScopeWhere: any = teamIds
      ? { project: { companyId }, isArchived: false, assignees: { some: { userId: { in: teamIds } } } }
      : isElevated
      ? { project: { companyId }, isArchived: false }
      : {
          project: { companyId },
          isArchived: false,
          assignees: { some: { userId: currentUserId } },
        };

    const [
      activeProjectsCount,
      overdueProjectsCount,
      nearingDeadlineProjectsCount,
      openTasksCount,
      overdueTasksCount,
      assignedTasksCount,
      recentProjects,
      timeEntries,
    ] = await Promise.all([
      // Active projects
      prisma.project.count({
        where: { ...projectScopeWhere, status: 'ACTIVE' },
      }),
      // Overdue projects
      prisma.project.count({
        where: {
          AND: [
            projectScopeWhere,
            {
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              OR: [{ deadline: { lt: now } }, { dueDate: { lt: now } }],
            },
          ],
        },
      }),
      // Projects nearing deadline (within 7 days)
      prisma.project.count({
        where: {
          AND: [
            projectScopeWhere,
            {
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              OR: [
                { deadline: { gte: now, lte: sevenDaysFromNow } },
                { dueDate: { gte: now, lte: sevenDaysFromNow } },
              ],
            },
          ],
        },
      }),
      // Open tasks
      prisma.task.count({
        where: {
          ...taskScopeWhere,
          status: { not: 'DONE' },
        },
      }),
      // Overdue tasks
      prisma.task.count({
        where: {
          ...taskScopeWhere,
          status: { not: 'DONE' },
          dueDate: { lt: now },
        },
      }),
      // Tasks assigned to current user
      prisma.task.count({
        where: {
          project: { companyId },
          isArchived: false,
          status: { not: 'DONE' },
          assignees: { some: { userId: currentUserId } },
        },
      }),
      // Recently updated projects
      prisma.project.findMany({
        where: projectScopeWhere,
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, companyName: true } },
          tasks: { select: { id: true, status: true } },
          _count: { select: { tasks: true, members: true } },
        },
      }),
      // Tracked time for company (or user if staff)
      prisma.timeEntry.findMany({
        where: teamIds
          ? { project: { companyId }, userId: { in: teamIds } }
          : isElevated
          ? { project: { companyId } }
          : { project: { companyId }, userId: currentUserId },
        select: { minutes: true, billable: true },
      }),
    ]);

    const formattedRecentProjects = recentProjects.map((p: any) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
      const progress = total > 0 ? Math.round((done / total) * 100) : p.progress;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        deadline: p.deadline || p.dueDate,
        progress,
        customerName: p.customer?.companyName || p.customer?.name || 'Internal',
        totalTasks: total,
        membersCount: p._count.members,
      };
    });

    const totalTrackedMinutes = timeEntries.reduce((sum: number, te: any) => sum + te.minutes, 0);
    const billableTrackedMinutes = timeEntries.filter((te: any) => te.billable).reduce((sum: number, te: any) => sum + te.minutes, 0);

    return {
      activeProjectsCount,
      overdueProjectsCount,
      nearingDeadlineProjectsCount,
      openTasksCount,
      overdueTasksCount,
      assignedTasksCount,
      recentProjects: formattedRecentProjects,
      isScopedToUser: !isElevated,
      ...teamMeta,
      timeTracking: {
        totalHours: Math.round((totalTrackedMinutes / 60) * 10) / 10,
        billableHours: Math.round((billableTrackedMinutes / 60) * 10) / 10,
        nonBillableHours: Math.round(((totalTrackedMinutes - billableTrackedMinutes) / 60) * 10) / 10,
      },
    };
  }

  // Dev Store fallback
  const scopeUserIds = new Set(teamIds ?? [currentUserId]);
  const userProjectIds = new Set(
    devStore.projectMembers.filter((m) => scopeUserIds.has(m.userId)).map((m) => m.projectId)
  );

  const projects = devStore.projects.filter((p) => {
    if (p.companyId !== companyId || p.isArchived) return false;
    if (teamIds || !isElevated) {
      return userProjectIds.has(p.id) || (p.projectManagerId !== null && scopeUserIds.has(p.projectManagerId));
    }
    return true;
  });

  const activeProjectsCount = projects.filter((p) => p.status === 'ACTIVE').length;

  const overdueProjectsCount = projects.filter((p) => {
    if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
    const end = p.deadline || p.dueDate;
    return end && new Date(end) < now;
  }).length;

  const nearingDeadlineProjectsCount = projects.filter((p) => {
    if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
    const end = p.deadline || p.dueDate;
    if (!end) return false;
    const d = new Date(end);
    return d >= now && d <= sevenDaysFromNow;
  }).length;

  const assignedTaskIds = new Set(
    devStore.taskAssignees.filter((ta) => ta.userId === currentUserId).map((ta) => ta.taskId)
  );
  const scopeTaskIds = new Set(
    devStore.taskAssignees.filter((ta) => scopeUserIds.has(ta.userId)).map((ta) => ta.taskId)
  );

  const tasks = devStore.tasks.filter((t) => {
    const p = devStore.projects.find((proj) => proj.id === t.projectId && proj.companyId === companyId);
    if (!p || t.isArchived) return false;
    if (teamIds || !isElevated) {
      return scopeTaskIds.has(t.id);
    }
    return true;
  });

  const openTasksCount = tasks.filter((t) => t.status !== 'DONE').length;
  const overdueTasksCount = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
  const assignedTasksCount = devStore.tasks.filter(
    (t) => !t.isArchived && t.status !== 'DONE' && assignedTaskIds.has(t.id)
  ).length;

  const sortedProjects = [...projects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
  const formattedRecentProjects = sortedProjects.map((p) => {
    const cust = devStore.customers.find((c) => c.id === p.customerId);
    const projTasks = devStore.tasks.filter((t) => t.projectId === p.id && !t.isArchived);
    const total = projTasks.length;
    const done = projTasks.filter((t) => t.status === 'DONE').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : p.progress;

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      deadline: p.deadline || p.dueDate,
      progress,
      customerName: cust?.companyName || cust?.name || 'Internal',
      totalTasks: total,
      membersCount: devStore.projectMembers.filter((m) => m.projectId === p.id).length,
    };
  });

  const timeEntries = devStore.timeEntries.filter((te) => {
    const p = devStore.projects.find((proj) => proj.id === te.projectId && proj.companyId === companyId);
    if (!p) return false;
    if (teamIds || !isElevated) {
      return scopeUserIds.has(te.userId);
    }
    return true;
  });

  const totalTrackedMinutes = timeEntries.reduce((sum, te) => sum + te.minutes, 0);
  const billableTrackedMinutes = timeEntries.filter((te) => te.billable).reduce((sum, te) => sum + te.minutes, 0);

  return {
    activeProjectsCount,
    overdueProjectsCount,
    nearingDeadlineProjectsCount,
    openTasksCount,
    overdueTasksCount,
    assignedTasksCount,
    recentProjects: formattedRecentProjects,
    isScopedToUser: !isElevated,
    ...teamMeta,
    timeTracking: {
      totalHours: Math.round((totalTrackedMinutes / 60) * 10) / 10,
      billableHours: Math.round((billableTrackedMinutes / 60) * 10) / 10,
      nonBillableHours: Math.round(((totalTrackedMinutes - billableTrackedMinutes) / 60) * 10) / 10,
    },
  };
}
