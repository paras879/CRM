import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { ticketsRouter } from '../src/modules/tickets/tickets.routes.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { generateAccessToken } from '../src/utils/tokens.js';
import { getSupportOverview } from '../src/modules/tickets/tickets-overview.service.js';
import { notifyTicketQueued, runSupportAlerts } from '../src/modules/notifications/support-notifications.js';
import { TEST_USER_IDS, makeTicket, seedTestUsers } from './helpers/fixtures.js';

const companyId = devStore.company.id;
const HOUR = 3_600_000;
const SUPPORT = TEST_USER_IDS.support;
const OTHER_AGENT = '20000000-0000-0000-0000-0000000000b1';
const ADMIN = TEST_USER_IDS.admin;

const app = express();
app.use(express.json());
app.use('/api/v1/tickets', ticketsRouter);
app.use(errorHandler);

function notificationsFor(userId: string, type?: string) {
  return devStore.notifications.filter((n) => n.userId === userId && (!type || n.type === type));
}

describe('Support dashboard', () => {
  beforeEach(() => {
    seedTestUsers();
    devStore.tickets.length = 0;
    devStore.notifications.length = 0;
  });

  it('counts the shared queue and the agent\'s own work separately', async () => {
    const now = new Date();
    makeTicket({ ticketNumber: 'TK-1', assignedTo: SUPPORT, status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH });
    makeTicket({ ticketNumber: 'TK-2', assignedTo: null, status: TicketStatus.OPEN, priority: TicketPriority.URGENT });
    makeTicket({ ticketNumber: 'TK-3', assignedTo: OTHER_AGENT, status: TicketStatus.WAITING_ON_CUSTOMER });
    makeTicket({ ticketNumber: 'TK-4', assignedTo: SUPPORT, status: TicketStatus.RESOLVED, resolvedAt: now });
    makeTicket({ ticketNumber: 'TK-5', assignedTo: null, status: TicketStatus.OPEN, isArchived: true });

    const { counts, myTickets, unassignedQueue } = await getSupportOverview(companyId, SUPPORT);
    expect(counts).toMatchObject({
      open: 1,
      inProgress: 1,
      waitingOnCustomer: 1,
      unassigned: 1,
      assignedToMe: 1,
      highPriority: 2,
      resolvedToday: 1,
      myResolvedToday: 1,
    });
    expect(myTickets.map((t) => t.ticketNumber)).toEqual(['TK-1']);
    expect(unassignedQueue.map((t) => t.ticketNumber)).toEqual(['TK-2']);
  });

  it('flags late and soon-due tickets and ranks the worst first', async () => {
    const now = Date.now();
    makeTicket({ ticketNumber: 'LATE', slaDueAt: new Date(now - 5 * HOUR), assignedTo: null });
    makeTicket({ ticketNumber: 'SOON', slaDueAt: new Date(now + 2 * HOUR), assignedTo: null });
    makeTicket({ ticketNumber: 'LATER', slaDueAt: new Date(now + 30 * HOUR), assignedTo: null });
    makeTicket({ ticketNumber: 'DUE-DATE-LATE', dueDate: new Date(now - HOUR), assignedTo: null });

    const overview = await getSupportOverview(companyId, SUPPORT);
    expect(overview.counts.overdue).toBe(2);
    expect(overview.counts.dueSoon).toBe(1);
    expect(overview.atRisk.map((t) => t.ticketNumber)).toEqual(['LATE', 'DUE-DATE-LATE', 'SOON']);
    expect(overview.unassignedQueue[0].ticketNumber).toBe('LATE');
  });

  it('serves the overview over HTTP to a support agent', async () => {
    makeTicket({ ticketNumber: 'TK-HTTP', assignedTo: null });
    const token = generateAccessToken({ userId: SUPPORT, email: 'support@test.local', companyId });
    const res = await request(app).get('/api/v1/tickets/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.counts.unassigned).toBe(1);
    expect(res.body.data.unassignedQueue[0].ticketNumber).toBe('TK-HTTP');
  });

  it('tells the support team about an unassigned ticket, but not the person who raised it', async () => {
    const ticket = makeTicket({ ticketNumber: 'TK-NEW', priority: TicketPriority.URGENT, assignedTo: null });
    await notifyTicketQueued(companyId, ADMIN, ticket);
    const notice = notificationsFor(SUPPORT, 'ticket.queued');
    expect(notice).toHaveLength(1);
    expect(notice[0].title).toContain('Urgent ticket');
    expect(notice[0].link).toBe(`/support/tickets/${ticket.id}`);
    expect(notificationsFor(ADMIN)).toHaveLength(0);
  });

  it('does not announce a ticket that already has an owner', async () => {
    const ticket = makeTicket({ assignedTo: SUPPORT });
    await notifyTicketQueued(companyId, ADMIN, ticket);
    expect(devStore.notifications).toHaveLength(0);
  });

  it('reminds the assignee once a day about a ticket past its deadline', async () => {
    makeTicket({ ticketNumber: 'TK-LATE', assignedTo: SUPPORT, slaDueAt: new Date(Date.now() - 3 * HOUR) });
    makeTicket({ ticketNumber: 'TK-FINE', assignedTo: SUPPORT, slaDueAt: new Date(Date.now() + 3 * HOUR) });
    makeTicket({ ticketNumber: 'TK-DONE', assignedTo: SUPPORT, status: TicketStatus.RESOLVED, slaDueAt: new Date(Date.now() - 3 * HOUR) });

    expect((await runSupportAlerts()).overdueTickets).toBe(1);
    const reminders = notificationsFor(SUPPORT, 'ticket.overdue');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toContain('TK-LATE');

    reminders[0].readAt = new Date();
    expect((await runSupportAlerts()).overdueTickets).toBe(0);
  });

  it('sends an unassigned late ticket to the whole support team', async () => {
    makeTicket({ ticketNumber: 'TK-ORPHAN', assignedTo: null, dueDate: new Date(Date.now() - 2 * HOUR) });
    await runSupportAlerts();
    const notice = notificationsFor(SUPPORT, 'ticket.overdue');
    expect(notice).toHaveLength(1);
    expect(notice[0].body).toContain('Nobody is assigned');
  });
});
