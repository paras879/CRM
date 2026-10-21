import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { logger } from '../../utils/logger.js';
import { createNotification } from './notifications.service.js';
import { notifyPermissionHolders } from './finance-notifications.js';

/** Notifications that follow an action in the work, CRM and admin areas. Every function here swallows its own errors. */

async function getUserName(userId: string): Promise<string> {
  if (!isDatabaseConnected) return devStore.users.find((u) => u.id === userId)?.name ?? 'Someone';
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? 'Someone';
}

async function sendTo(userIds: Array<string | null | undefined>, actorId: string, build: () => Parameters<typeof createNotification>[1]) {
  const recipients = Array.from(new Set(userIds.filter((id): id is string => !!id && id !== actorId)));
  if (recipients.length === 0) return;
  const payload = build();
  await Promise.all(recipients.map((id) => createNotification(id, payload, { dedupeWindowMs: 0 })));
}

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------

export interface TaskBrief {
  id: string;
  title: string;
  status: string;
  creatorId: string | null;
  projectManagerId: string | null;
}

export async function getTaskBrief(taskId: string): Promise<TaskBrief | null> {
  if (!isDatabaseConnected) {
    const task = devStore.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const project = devStore.projects.find((p) => p.id === task.projectId);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      creatorId: task.creatorId,
      projectManagerId: project?.projectManagerId ?? null,
    };
  }
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, status: true, creatorId: true, project: { select: { projectManagerId: true } } },
  });
  return task
    ? {
        id: task.id,
        title: task.title,
        status: task.status,
        creatorId: task.creatorId,
        projectManagerId: task.project?.projectManagerId ?? null,
      }
    : null;
}

/** Tell whoever set the work (task creator and project manager) when it is finished or stuck. */
export async function notifyTaskStatusChange(companyId: string, actorId: string, taskId: string, previousStatus?: string) {
  try {
    const task = await getTaskBrief(taskId);
    if (!task || !previousStatus || previousStatus === task.status) return;
    if (task.status !== 'DONE' && task.status !== 'BLOCKED') return;

    const actorName = await getUserName(actorId);
    const done = task.status === 'DONE';
    await sendTo([task.creatorId, task.projectManagerId], actorId, () => ({
      companyId,
      type: done ? 'task.completed' : 'task.blocked',
      title: done ? `Task completed: ${task.title}` : `Task blocked: ${task.title}`,
      body: done ? `${actorName} marked "${task.title}" as done.` : `${actorName} marked "${task.title}" as blocked. It needs a decision.`,
      link: `/work/tasks/${task.id}`,
      metadata: { taskId: task.id },
    }));
  } catch (error) {
    logger.warn('Failed to send task status notification', { error });
  }
}

/** The person who created the task hears about comments too, not only the people assigned to it. */
export async function notifyTaskCreatorOfComment(companyId: string, authorId: string, taskId: string, assigneeIds: string[]) {
  try {
    const task = await getTaskBrief(taskId);
    if (!task || !task.creatorId || assigneeIds.includes(task.creatorId)) return;
    const authorName = await getUserName(authorId);
    await sendTo([task.creatorId], authorId, () => ({
      companyId,
      type: 'task.comment',
      title: `New Comment on: ${task.title}`,
      body: `${authorName} commented on a task you created.`,
      link: `/work/tasks/${task.id}`,
      metadata: { taskId: task.id },
    }));
  } catch (error) {
    logger.warn('Failed to send task comment notification', { error });
  }
}

// ---------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------

export async function notifyLeadAssigned(companyId: string, actorId: string, leadId: string, ownerId?: string | null) {
  if (!ownerId) return;
  try {
    const lead = !isDatabaseConnected
      ? devStore.leads.find((l) => l.id === leadId)
      : await prisma.lead.findUnique({ where: { id: leadId }, select: { name: true, companyName: true } });
    if (!lead) return;
    const label = lead.companyName ? `${lead.name} (${lead.companyName})` : lead.name;
    await sendTo([ownerId], actorId, () => ({
      companyId,
      type: 'lead.assigned',
      title: `New lead assigned: ${lead.name}`,
      body: `${label} is now yours to follow up.`,
      link: `/crm/leads/${leadId}`,
      metadata: { leadId },
    }));
  } catch (error) {
    logger.warn('Failed to send lead notification', { error });
  }
}

export async function notifyActivityAssigned(
  companyId: string,
  actorId: string,
  activity: {
    id: string;
    subject: string;
    type: string;
    customType?: string | null;
    dueDate?: Date | string | null;
    assignedToId?: string | null;
  }
) {
  if (!activity.assignedToId) return;
  try {
    const due = activity.dueDate ? ` Due ${new Date(activity.dueDate).toLocaleDateString('en-IN')}.` : '';
    const kind =
      activity.type === 'FOLLOW_UP'
        ? 'follow-up'
        : activity.type === 'OTHER' && activity.customType
        ? activity.customType.toLowerCase()
        : String(activity.type).toLowerCase().replace('_', ' ');
    await sendTo([activity.assignedToId], actorId, () => ({
      companyId,
      type: 'activity.assigned',
      title: `New ${kind} assigned: ${activity.subject}`,
      body: `You have a new ${kind} to do.${due}`,
      link: '/crm/activities',
      metadata: { activityId: activity.id },
    }));
  } catch (error) {
    logger.warn('Failed to send activity notification', { error });
  }
}

// ---------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------

export type AdminUserEvent = 'created' | 'deactivated' | 'deleted' | 'roles_changed' | 'password_reset';

const ADMIN_EVENT_COPY: Record<AdminUserEvent, (who: string, by: string) => { title: string; body: string }> = {
  created: (who, by) => ({ title: `New user added: ${who}`, body: `${by} created an account for ${who}.` }),
  deactivated: (who, by) => ({ title: `User deactivated: ${who}`, body: `${by} deactivated ${who}'s account. They can no longer sign in.` }),
  deleted: (who, by) => ({ title: `User deleted: ${who}`, body: `${by} permanently deleted ${who}'s account.` }),
  roles_changed: (who, by) => ({ title: `Roles changed: ${who}`, body: `${by} changed the roles assigned to ${who}.` }),
  password_reset: (who, by) => ({ title: `Password reset issued: ${who}`, body: `${by} created a password reset link for ${who}.` }),
};

/** Account changes are security-relevant, so administrators hear about each one that someone else made. */
export async function notifyAdminsOfUserEvent(
  companyId: string,
  actorId: string,
  event: AdminUserEvent,
  targetUser: { id: string; name: string }
) {
  try {
    const actorName = await getUserName(actorId);
    const copy = ADMIN_EVENT_COPY[event](targetUser.name, actorName);
    await notifyPermissionHolders(
      companyId,
      'audit.view',
      { type: `user.${event}`, ...copy, link: '/admin/users', metadata: { userId: targetUser.id } },
      { excludeUserId: actorId, dedupeWindowMs: 0 }
    );
  } catch (error) {
    logger.warn('Failed to send admin notification', { error });
  }
}

export type AdminRoleEvent = 'created' | 'updated' | 'deleted';

/** Roles decide who can see and do what, so every change to them is announced to the other administrators. */
export async function notifyAdminsOfRoleEvent(
  companyId: string,
  actorId: string,
  event: AdminRoleEvent,
  role: { id: string; name: string }
) {
  try {
    const actorName = await getUserName(actorId);
    const verb = event === 'created' ? 'created' : event === 'updated' ? 'changed the permissions of' : 'deleted';
    await notifyPermissionHolders(
      companyId,
      'audit.view',
      {
        type: `role.${event}`,
        title: `Role ${event}: ${role.name}`,
        body: `${actorName} ${verb} the "${role.name}" role.`,
        link: '/admin/roles',
        metadata: { roleId: role.id },
      },
      { excludeUserId: actorId, dedupeWindowMs: 0 }
    );
  } catch (error) {
    logger.warn('Failed to send role notification', { error });
  }
}
