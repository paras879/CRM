import { TicketPriority, TicketStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';

const HOUR_MS = 60 * 60 * 1000;
const DUE_SOON_HOURS = 4;
const LIST_LIMIT = 6;
const AT_RISK_LIMIT = 5;
/** Fetch a few more rows than we show, then rank them, so the most urgent ones win. */
const CANDIDATE_LIMIT = 40;

const CLOSED: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];
const URGENT_PRIORITIES: TicketPriority[] = [TicketPriority.HIGH, TicketPriority.URGENT];

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export interface TicketOverviewRow {
  id: string;
  ticketNumber: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerName: string | null;
  assigneeName: string | null;
  /** Earliest of the SLA deadline and the due date, if either is set. */
  dueAt: Date | null;
  createdAt: Date;
}

export interface SupportOverview {
  counts: {
    open: number;
    inProgress: number;
    waitingOnCustomer: number;
    unassigned: number;
    assignedToMe: number;
    highPriority: number;
    overdue: number;
    dueSoon: number;
    resolvedToday: number;
    myResolvedToday: number;
  };
  myTickets: TicketOverviewRow[];
  unassignedQueue: TicketOverviewRow[];
  atRisk: TicketOverviewRow[];
}

function earliest(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (a && b) return a < b ? a : b;
  return a ?? b ?? null;
}

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Most urgent first: past-due, then higher priority, then the oldest ticket. */
function byUrgency(now: Date) {
  return (a: TicketOverviewRow, b: TicketOverviewRow) => {
    const aLate = a.dueAt && a.dueAt < now ? 1 : 0;
    const bLate = b.dueAt && b.dueAt < now ? 1 : 0;
    if (aLate !== bLate) return bLate - aLate;
    const byPriority = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    if (byPriority !== 0) return byPriority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  };
}

/** Soonest deadline first, used for the "SLA at risk" list. */
function byDeadline(a: TicketOverviewRow, b: TicketOverviewRow) {
  return (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
}

type DevTicketRow = (typeof devStore.tickets)[number];

function toDevRow(t: DevTicketRow): TicketOverviewRow {
  const customer = t.customerId ? devStore.customers.find((c) => c.id === t.customerId) : null;
  const assignee = t.assignedTo ? devStore.users.find((u) => u.id === t.assignedTo) : null;
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    priority: t.priority,
    status: t.status,
    customerName: customer ? customer.companyName || customer.name : null,
    assigneeName: assignee?.name ?? null,
    dueAt: earliest(t.slaDueAt, t.dueDate),
    createdAt: t.createdAt,
  };
}

/** Everything the support dashboard needs in one round trip. The whole queue is shared across the team. */
export async function getSupportOverview(companyId: string, userId: string, now: Date = new Date()): Promise<SupportOverview> {
  const soon = new Date(now.getTime() + DUE_SOON_HOURS * HOUR_MS);
  const today = startOfToday(now);

  if (!isDatabaseConnected) {
    const all = devStore.tickets.filter((t) => t.companyId === companyId && !t.isArchived);
    const active = all.filter((t) => !CLOSED.includes(t.status));
    // Either deadline counts: a ticket is late when its SLA or its due date has passed.
    const deadlines = (t: DevTicketRow) => [t.slaDueAt, t.dueDate].filter((d): d is Date => !!d);
    const isLate = (t: DevTicketRow) => deadlines(t).some((d) => d < now);
    const isDueSoon = (t: DevTicketRow) => deadlines(t).some((d) => d >= now && d <= soon);
    const resolvedToday = all.filter((t) => t.resolvedAt && t.resolvedAt >= today);

    const rank = byUrgency(now);
    return {
      counts: {
        open: all.filter((t) => t.status === TicketStatus.OPEN).length,
        inProgress: all.filter((t) => t.status === TicketStatus.IN_PROGRESS).length,
        waitingOnCustomer: all.filter((t) => t.status === TicketStatus.WAITING_ON_CUSTOMER).length,
        unassigned: active.filter((t) => t.assignedTo === null).length,
        assignedToMe: active.filter((t) => t.assignedTo === userId).length,
        highPriority: active.filter((t) => URGENT_PRIORITIES.includes(t.priority)).length,
        overdue: active.filter(isLate).length,
        dueSoon: active.filter(isDueSoon).length,
        resolvedToday: resolvedToday.length,
        myResolvedToday: resolvedToday.filter((t) => t.assignedTo === userId).length,
      },
      myTickets: active.filter((t) => t.assignedTo === userId).map(toDevRow).sort(rank).slice(0, LIST_LIMIT),
      unassignedQueue: active.filter((t) => t.assignedTo === null).map(toDevRow).sort(rank).slice(0, LIST_LIMIT),
      atRisk: active
        .filter((t) => isLate(t) || isDueSoon(t))
        .map(toDevRow)
        .sort(byDeadline)
        .slice(0, AT_RISK_LIMIT),
    };
  }

  const base = { companyId, isArchived: false };
  const active = { ...base, status: { notIn: CLOSED } };
  const lateOrSoon = { OR: [{ dueDate: { lte: soon } }, { slaDueAt: { lte: soon } }] };
  const late = { OR: [{ dueDate: { lt: now } }, { slaDueAt: { lt: now } }] };
  const dueSoonOnly = {
    OR: [{ dueDate: { gte: now, lte: soon } }, { slaDueAt: { gte: now, lte: soon } }],
  };

  const include = {
    customer: { select: { name: true, companyName: true } },
    assignee: { select: { name: true } },
  };

  const [
    open,
    inProgress,
    waitingOnCustomer,
    unassigned,
    assignedToMe,
    highPriority,
    overdue,
    dueSoon,
    resolvedToday,
    myResolvedToday,
    myRows,
    unassignedRows,
    atRiskRows,
  ] = await Promise.all([
    prisma.ticket.count({ where: { ...base, status: TicketStatus.OPEN } }),
    prisma.ticket.count({ where: { ...base, status: TicketStatus.IN_PROGRESS } }),
    prisma.ticket.count({ where: { ...base, status: TicketStatus.WAITING_ON_CUSTOMER } }),
    prisma.ticket.count({ where: { ...active, assignedTo: null } }),
    prisma.ticket.count({ where: { ...active, assignedTo: userId } }),
    prisma.ticket.count({ where: { ...active, priority: { in: URGENT_PRIORITIES } } }),
    prisma.ticket.count({ where: { AND: [active, late] } }),
    prisma.ticket.count({ where: { AND: [active, dueSoonOnly] } }),
    prisma.ticket.count({ where: { ...base, resolvedAt: { gte: today } } }),
    prisma.ticket.count({ where: { ...base, assignedTo: userId, resolvedAt: { gte: today } } }),
    prisma.ticket.findMany({ where: { ...active, assignedTo: userId }, include, orderBy: { createdAt: 'asc' }, take: CANDIDATE_LIMIT }),
    prisma.ticket.findMany({ where: { ...active, assignedTo: null }, include, orderBy: { createdAt: 'asc' }, take: CANDIDATE_LIMIT }),
    prisma.ticket.findMany({ where: { AND: [active, lateOrSoon] }, include, take: CANDIDATE_LIMIT }),
  ]);

  const toRow = (t: (typeof myRows)[number]): TicketOverviewRow => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    priority: t.priority,
    status: t.status,
    customerName: t.customer ? t.customer.companyName || t.customer.name : null,
    assigneeName: t.assignee?.name ?? null,
    dueAt: earliest(t.slaDueAt, t.dueDate),
    createdAt: t.createdAt,
  });

  const rank = byUrgency(now);
  return {
    counts: { open, inProgress, waitingOnCustomer, unassigned, assignedToMe, highPriority, overdue, dueSoon, resolvedToday, myResolvedToday },
    myTickets: myRows.map(toRow).sort(rank).slice(0, LIST_LIMIT),
    unassignedQueue: unassignedRows.map(toRow).sort(rank).slice(0, LIST_LIMIT),
    atRisk: atRiskRows.map(toRow).sort(byDeadline).slice(0, AT_RISK_LIMIT),
  };
}
