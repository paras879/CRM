import { TicketStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { logger } from '../../utils/logger.js';
import { createNotificationIfNew } from './notifications.service.js';
import { notifyPermissionHolders } from './finance-notifications.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_REMINDER_EVERY_MS = DAY_MS;
const MAX_ALERTS_PER_RUN = 100;
/** Anyone who can update tickets can pick one up from the queue. */
const QUEUE_PERMISSION = 'tickets.update';

interface TicketBrief {
  id: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  assignedTo?: string | null;
}

/** An unassigned ticket just arrived: tell the support team so someone picks it up. */
export async function notifyTicketQueued(companyId: string, actorId: string, ticket: TicketBrief) {
  if (ticket.assignedTo) return;
  const label =
    ticket.priority === 'URGENT' ? 'Urgent ticket' : ticket.priority === 'HIGH' ? 'High priority ticket' : 'New ticket';
  await notifyPermissionHolders(
    companyId,
    QUEUE_PERMISSION,
    {
      type: 'ticket.queued',
      title: `${label} in the queue: ${ticket.ticketNumber}`,
      body: ticket.subject,
      link: `/support/tickets/${ticket.id}`,
      metadata: { ticketId: ticket.id },
    },
    { excludeUserId: actorId, dedupeWindowMs: 0 }
  );
}

interface LateTicket extends TicketBrief {
  dueAt: Date;
}

async function listCompanyIds(): Promise<string[]> {
  if (!isDatabaseConnected) return [devStore.company.id];
  const rows = await prisma.company.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

async function findLateTickets(companyId: string, now: Date): Promise<LateTicket[]> {
  const closed: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
  const earliestPast = (a?: Date | null, b?: Date | null): Date | null => {
    const past = [a, b].filter((d): d is Date => !!d && d < now);
    return past.length ? new Date(Math.min(...past.map((d) => d.getTime()))) : null;
  };

  if (!isDatabaseConnected) {
    return devStore.tickets
      .filter((t) => t.companyId === companyId && !t.isArchived && !closed.includes(t.status))
      .map((t) => ({ t, dueAt: earliestPast(t.slaDueAt, t.dueDate) }))
      .filter((x): x is { t: (typeof devStore.tickets)[number]; dueAt: Date } => x.dueAt !== null)
      .map(({ t, dueAt }) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        priority: t.priority,
        assignedTo: t.assignedTo,
        dueAt,
      }));
  }

  const rows = await prisma.ticket.findMany({
    where: {
      companyId,
      isArchived: false,
      status: { notIn: closed },
      OR: [{ dueDate: { lt: now } }, { slaDueAt: { lt: now } }],
    },
    select: { id: true, ticketNumber: true, subject: true, priority: true, assignedTo: true, dueDate: true, slaDueAt: true },
    take: MAX_ALERTS_PER_RUN,
  });
  return rows
    .map((r) => ({ r, dueAt: earliestPast(r.slaDueAt, r.dueDate) }))
    .filter((x): x is { r: (typeof rows)[number]; dueAt: Date } => x.dueAt !== null)
    .map(({ r, dueAt }) => ({
      id: r.id,
      ticketNumber: r.ticketNumber,
      subject: r.subject,
      priority: r.priority,
      assignedTo: r.assignedTo,
      dueAt,
    }));
}

export interface SupportAlertsResult {
  overdueTickets: number;
}

/**
 * Daily reminder for tickets that have passed their SLA or due date. The assignee gets it; an
 * unassigned ticket goes to the whole support team. At most one reminder per ticket per day.
 */
export async function runSupportAlerts(now: Date = new Date()): Promise<SupportAlertsResult> {
  const result: SupportAlertsResult = { overdueTickets: 0 };

  for (const companyId of await listCompanyIds()) {
    for (const ticket of await findLateTickets(companyId, now)) {
      const hours = Math.max(1, Math.floor((now.getTime() - ticket.dueAt.getTime()) / (60 * 60 * 1000)));
      const late = hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} hour${hours === 1 ? '' : 's'}`;
      const payload = {
        type: 'ticket.overdue',
        title: `Ticket past its deadline: ${ticket.ticketNumber}`,
        body: `${ticket.subject} is ${late} overdue.${ticket.assignedTo ? '' : ' Nobody is assigned yet.'}`,
        link: `/support/tickets/${ticket.id}`,
        metadata: { ticketId: ticket.id },
      };
      const options = { dedupeWindowMs: OVERDUE_REMINDER_EVERY_MS, includeRead: true };

      try {
        if (ticket.assignedTo) {
          const { created } = await createNotificationIfNew(ticket.assignedTo, { ...payload, companyId }, options);
          if (created) result.overdueTickets += 1;
        } else if ((await notifyPermissionHolders(companyId, QUEUE_PERMISSION, payload, options)) > 0) {
          result.overdueTickets += 1;
        }
      } catch (error) {
        logger.warn('Failed to send ticket reminder', { error, ticketId: ticket.id });
      }
    }
  }

  if (result.overdueTickets) {
    logger.info(`Support alerts: ${result.overdueTickets} overdue ticket reminder(s)`);
  }
  return result;
}
