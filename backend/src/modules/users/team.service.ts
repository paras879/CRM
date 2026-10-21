import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';

/**
 * A Manager is limited to their own reporting tree. Administrators keep
 * company-wide visibility, so they are never team-scoped.
 */
export function isTeamScopedManager(roles: string[] = []): boolean {
  return roles.includes('Manager') && !roles.includes('Administrator');
}

type ReportingEdge = { id: string; managerId: string | null };

function collectTree(rootId: string, edges: ReportingEdge[]): string[] {
  const childrenByManager = new Map<string, string[]>();
  for (const { id, managerId } of edges) {
    if (!managerId) continue;
    const list = childrenByManager.get(managerId) ?? [];
    list.push(id);
    childrenByManager.set(managerId, list);
  }

  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenByManager.get(current) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return Array.from(seen);
}

async function loadEdges(companyId: string): Promise<ReportingEdge[]> {
  if (!isDatabaseConnected) {
    return devStore.users
      .filter((u) => u.companyId === companyId)
      .map((u) => ({ id: u.id, managerId: u.managerId ?? null }));
  }
  return prisma.user.findMany({
    where: { companyId },
    select: { id: true, managerId: true },
  });
}

/** The manager plus everyone who reports to them, directly or indirectly. */
export async function getTeamUserIds(companyId: string, managerId: string): Promise<string[]> {
  return collectTree(managerId, await loadEdges(companyId));
}

/** True when `candidateManagerId` already sits below `userId`, i.e. assigning it would create a loop. */
export async function wouldCreateReportingLoop(
  companyId: string,
  userId: string,
  candidateManagerId: string
): Promise<boolean> {
  if (userId === candidateManagerId) return true;
  const subtree = collectTree(userId, await loadEdges(companyId));
  return subtree.includes(candidateManagerId);
}

export interface TeamMemberOverview {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  directManagerId: string | null;
  lastLoginAt: Date | null;
  openTasks: number;
  overdueTasks: number;
  openTickets: number;
}

const CLOSED_TICKET_STATUSES = ['RESOLVED', 'CLOSED'];

/** Everyone below `managerId` in the reporting tree, with a snapshot of their current workload. */
export async function getTeamOverview(companyId: string, managerId: string): Promise<TeamMemberOverview[]> {
  const memberIds = (await getTeamUserIds(companyId, managerId)).filter((id) => id !== managerId);
  if (memberIds.length === 0) return [];

  const now = new Date();

  if (!isDatabaseConnected) {
    const members = devStore.users.filter((u) => memberIds.includes(u.id));
    return members.map((u) => {
      const taskIds = new Set(devStore.taskAssignees.filter((ta) => ta.userId === u.id).map((ta) => ta.taskId));
      const tasks = devStore.tasks.filter((t) => taskIds.has(t.id) && !t.isArchived && t.status !== 'DONE');
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        roles: devStore.roles.filter((r) => u.roleIds.includes(r.id)).map((r) => r.name),
        directManagerId: u.managerId ?? null,
        lastLoginAt: u.lastLoginAt,
        openTasks: tasks.length,
        overdueTasks: tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length,
        openTickets: devStore.tickets.filter(
          (t) => !t.isArchived && t.assignedTo === u.id && !CLOSED_TICKET_STATUSES.includes(t.status)
        ).length,
      };
    });
  }

  const members = await prisma.user.findMany({
    where: { companyId, id: { in: memberIds } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      managerId: true,
      lastLoginAt: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });

  return Promise.all(
    members.map(async (u) => {
      const openTaskWhere = {
        project: { companyId },
        isArchived: false,
        status: { not: 'DONE' as const },
        assignees: { some: { userId: u.id } },
      };
      const [openTasks, overdueTasks, openTickets] = await Promise.all([
        prisma.task.count({ where: openTaskWhere }),
        prisma.task.count({ where: { ...openTaskWhere, dueDate: { lt: now } } }),
        prisma.ticket.count({
          where: { companyId, isArchived: false, assignedTo: u.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        }),
      ]);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        roles: u.userRoles.map((ur) => ur.role.name),
        directManagerId: u.managerId,
        lastLoginAt: u.lastLoginAt,
        openTasks,
        overdueTasks,
        openTickets,
      };
    })
  );
}

export interface UserStats {
  total: number;
  active: number;
  invited: number;
  disabled: number;
  /** Active accounts that have never signed in. */
  neverSignedIn: number;
  /** Invited accounts that were created more than a week ago and are still waiting. */
  staleInvites: number;
  /** Active staff who do not report to anyone, so no manager sees their work. */
  withoutManager: number;
  byRole: Array<{ role: string; count: number }>;
}

const STALE_INVITE_DAYS = 7;

/** Headcount and account health for the administrator's dashboard. */
export async function getUserStats(companyId: string, now: Date = new Date()): Promise<UserStats> {
  type Row = {
    status: string;
    lastLoginAt: Date | null;
    createdAt: Date;
    managerId: string | null;
    roles: string[];
  };

  const rows: Row[] = !isDatabaseConnected
    ? devStore.users
        .filter((u) => u.companyId === companyId)
        .map((u) => ({
          status: u.status,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          managerId: u.managerId ?? null,
          roles: devStore.roles.filter((r) => u.roleIds.includes(r.id)).map((r) => r.name),
        }))
    : (
        await prisma.user.findMany({
          where: { companyId },
          select: {
            status: true,
            lastLoginAt: true,
            createdAt: true,
            managerId: true,
            userRoles: { select: { role: { select: { name: true } } } },
          },
        })
      ).map((u) => ({
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        managerId: u.managerId,
        roles: u.userRoles.map((ur) => ur.role.name),
      }));

  const staleBefore = now.getTime() - STALE_INVITE_DAYS * 24 * 60 * 60 * 1000;
  const roleCounts = new Map<string, number>();
  for (const row of rows.filter((r) => r.status === 'ACTIVE')) {
    for (const role of row.roles) roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  const active = rows.filter((r) => r.status === 'ACTIVE');
  return {
    total: rows.length,
    active: active.length,
    invited: rows.filter((r) => r.status === 'INVITED').length,
    disabled: rows.filter((r) => r.status === 'DISABLED').length,
    neverSignedIn: active.filter((r) => !r.lastLoginAt).length,
    staleInvites: rows.filter((r) => r.status === 'INVITED' && r.createdAt.getTime() < staleBefore).length,
    withoutManager: active.filter(
      (r) => !r.managerId && !r.roles.includes('Administrator') && !r.roles.includes('Manager')
    ).length,
    byRole: Array.from(roleCounts, ([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
  };
}
