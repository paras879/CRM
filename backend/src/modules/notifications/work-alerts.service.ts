import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { logger } from '../../utils/logger.js';
import { getTeamUserIds } from '../users/team.service.js';
import { createNotificationIfNew } from './notifications.service.js';
import { listCompanyIds } from './finance-alerts.service.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PROJECT_LOOKAHEAD_DAYS = 3;
const MAX_ROWS = 500;

interface OpenTask {
  id: string;
  title: string;
  dueDate: Date;
  assigneeIds: string[];
}

interface DueProject {
  id: string;
  name: string;
  dueDate: Date;
  projectManagerId: string | null;
}

interface DueActivity {
  id: string;
  subject: string;
  dueDate: Date;
  assignedToId: string;
}

/** Open tasks that are overdue or due within `horizon`, with who is assigned. */
async function findTasksDueBy(companyId: string, horizon: Date): Promise<OpenTask[]> {
  if (!isDatabaseConnected) {
    return devStore.tasks
      .filter((t) => {
        const project = devStore.projects.find((p) => p.id === t.projectId);
        return project?.companyId === companyId && !t.isArchived && t.status !== 'DONE' && t.dueDate && t.dueDate <= horizon;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate as Date,
        assigneeIds: devStore.taskAssignees.filter((a) => a.taskId === t.id).map((a) => a.userId),
      }));
  }
  const rows = await prisma.task.findMany({
    where: { project: { companyId }, isArchived: false, status: { not: 'DONE' }, dueDate: { lte: horizon } },
    select: { id: true, title: true, dueDate: true, assignees: { select: { userId: true } } },
    orderBy: { dueDate: 'asc' },
    take: MAX_ROWS,
  });
  return rows.map((r) => ({ id: r.id, title: r.title, dueDate: r.dueDate as Date, assigneeIds: r.assignees.map((a) => a.userId) }));
}

async function findProjectsDueBy(companyId: string, horizon: Date): Promise<DueProject[]> {
  if (!isDatabaseConnected) {
    return devStore.projects
      .filter((p) => p.companyId === companyId && !p.isArchived && !['COMPLETED', 'CANCELLED'].includes(p.status))
      .map((p) => ({ p, due: p.deadline ?? p.dueDate }))
      .filter((x): x is { p: (typeof devStore.projects)[number]; due: Date } => !!x.due && x.due <= horizon)
      .map(({ p, due }) => ({ id: p.id, name: p.name, dueDate: due, projectManagerId: p.projectManagerId }));
  }
  const rows = await prisma.project.findMany({
    where: {
      companyId,
      isArchived: false,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      OR: [{ deadline: { lte: horizon } }, { dueDate: { lte: horizon } }],
    },
    select: { id: true, name: true, deadline: true, dueDate: true, projectManagerId: true },
    take: MAX_ROWS,
  });
  return rows
    .map((r) => ({ r, due: r.deadline ?? r.dueDate }))
    .filter((x): x is { r: (typeof rows)[number]; due: Date } => !!x.due)
    .map(({ r, due }) => ({ id: r.id, name: r.name, dueDate: due, projectManagerId: r.projectManagerId }));
}

async function findActivitiesDueBy(companyId: string, horizon: Date): Promise<DueActivity[]> {
  if (!isDatabaseConnected) {
    return devStore.activities
      .filter((a) => a.companyId === companyId && a.status === 'PENDING' && a.assignedToId && a.dueDate && a.dueDate <= horizon)
      .map((a) => ({ id: a.id, subject: a.subject, dueDate: a.dueDate as Date, assignedToId: a.assignedToId as string }));
  }
  const rows = await prisma.activity.findMany({
    where: { companyId, status: 'PENDING', assignedToId: { not: null }, dueDate: { lte: horizon } },
    select: { id: true, subject: true, dueDate: true, assignedToId: true },
    take: MAX_ROWS,
  });
  return rows.map((r) => ({ id: r.id, subject: r.subject, dueDate: r.dueDate as Date, assignedToId: r.assignedToId as string }));
}

async function listManagers(companyId: string): Promise<Array<{ id: string; name: string }>> {
  if (!isDatabaseConnected) {
    return devStore.users
      .filter((u) => {
        if (u.companyId !== companyId || u.status !== 'ACTIVE') return false;
        const names = devStore.roles.filter((r) => u.roleIds.includes(r.id)).map((r) => r.name);
        return names.includes('Manager') && !names.includes('Administrator');
      })
      .map((u) => ({ id: u.id, name: u.name }));
  }
  return prisma.user.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
      userRoles: { some: { role: { name: 'Manager' } } },
      NOT: { userRoles: { some: { role: { name: 'Administrator' } } } },
    },
    select: { id: true, name: true },
  });
}

async function userNames(companyId: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  if (!isDatabaseConnected) {
    return new Map(devStore.users.filter((u) => ids.includes(u.id)).map((u) => [u.id, u.name]));
  }
  const rows = await prisma.user.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function spanText(ms: number): string {
  const hours = Math.floor(Math.abs(ms) / HOUR_MS);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return 'less than an hour';
}

export interface WorkAlertsResult {
  taskReminders: number;
  projectReminders: number;
  followUpReminders: number;
  teamDigests: number;
}

/**
 * Time-based reminders for everyday work. Each one is sent at most once a day per item, so running the
 * job every hour never repeats a message: tasks that are due soon or overdue, projects near their
 * deadline, follow-ups that are due, and a daily digest of overdue work for each manager.
 */
export async function runWorkAlerts(now: Date = new Date()): Promise<WorkAlertsResult> {
  const result: WorkAlertsResult = { taskReminders: 0, projectReminders: 0, followUpReminders: 0, teamDigests: 0 };
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const send = async (userId: string, companyId: string, payload: { type: string; title: string; body: string; link: string; metadata?: Record<string, unknown> }) => {
    try {
      const { created } = await createNotificationIfNew(userId, { ...payload, companyId }, { dedupeWindowMs: DAY_MS, includeRead: true });
      return created;
    } catch (error) {
      logger.warn('Failed to send work reminder', { error, type: payload.type });
      return false;
    }
  };

  for (const companyId of await listCompanyIds()) {
    // Tasks: due within 24 hours, or already overdue.
    const tasks = await findTasksDueBy(companyId, new Date(now.getTime() + DAY_MS));
    for (const task of tasks) {
      const overdue = task.dueDate < now;
      for (const userId of task.assigneeIds) {
        const created = await send(userId, companyId, {
          type: overdue ? 'task.overdue' : 'task.due_soon',
          title: overdue ? `Task overdue: ${task.title}` : `Task due soon: ${task.title}`,
          body: overdue
            ? `This task was due ${spanText(now.getTime() - task.dueDate.getTime())} ago.`
            : `This task is due in ${spanText(task.dueDate.getTime() - now.getTime())}.`,
          link: `/work/tasks/${task.id}`,
          metadata: { taskId: task.id },
        });
        if (created) result.taskReminders += 1;
      }
    }

    // Projects: due within a few days, or past their deadline. The project manager owns the outcome.
    const projects = await findProjectsDueBy(companyId, new Date(now.getTime() + PROJECT_LOOKAHEAD_DAYS * DAY_MS));
    for (const project of projects) {
      if (!project.projectManagerId) continue;
      const overdue = project.dueDate < now;
      const created = await send(project.projectManagerId, companyId, {
        type: 'project.deadline',
        title: overdue ? `Project overdue: ${project.name}` : `Project deadline approaching: ${project.name}`,
        body: overdue
          ? `The deadline passed ${spanText(now.getTime() - project.dueDate.getTime())} ago.`
          : `The deadline is in ${spanText(project.dueDate.getTime() - now.getTime())}.`,
        link: `/work/projects/${project.id}`,
        metadata: { projectId: project.id },
      });
      if (created) result.projectReminders += 1;
    }

    // Follow-ups and other activities that are due today or earlier.
    for (const activity of await findActivitiesDueBy(companyId, endOfToday)) {
      const overdue = activity.dueDate < now;
      const created = await send(activity.assignedToId, companyId, {
        type: 'followup.due',
        title: overdue ? `Follow-up overdue: ${activity.subject}` : `Follow-up due today: ${activity.subject}`,
        body: overdue
          ? `This was due ${spanText(now.getTime() - activity.dueDate.getTime())} ago.`
          : 'Make the call or send the message before the day ends.',
        link: '/crm/activities',
        metadata: { activityId: activity.id },
      });
      if (created) result.followUpReminders += 1;
    }

    // Managers: one digest of what is late across their team.
    const overdueTasks = tasks.filter((t) => t.dueDate < now);
    if (overdueTasks.length > 0) {
      for (const manager of await listManagers(companyId)) {
        const team = new Set((await getTeamUserIds(companyId, manager.id)).filter((id) => id !== manager.id));
        if (team.size === 0) continue;

        const perPerson = new Map<string, number>();
        for (const task of overdueTasks) {
          for (const userId of task.assigneeIds) {
            if (team.has(userId)) perPerson.set(userId, (perPerson.get(userId) ?? 0) + 1);
          }
        }
        const total = Array.from(perPerson.values()).reduce((a, b) => a + b, 0);
        if (total === 0) continue;

        const names = await userNames(companyId, Array.from(perPerson.keys()));
        const breakdown = Array.from(perPerson, ([id, count]) => `${names.get(id) ?? 'Someone'} (${count})`).join(', ');
        const created = await send(manager.id, companyId, {
          type: 'team.overdue',
          title: `${total} overdue task${total === 1 ? '' : 's'} in your team`,
          body: breakdown,
          link: '/team',
        });
        if (created) result.teamDigests += 1;
      }
    }
  }

  const sent = result.taskReminders + result.projectReminders + result.followUpReminders + result.teamDigests;
  if (sent > 0) {
    logger.info(
      `Work alerts: ${result.taskReminders} task, ${result.projectReminders} project, ${result.followUpReminders} follow-up, ${result.teamDigests} team digest(s)`
    );
  }
  return result;
}
