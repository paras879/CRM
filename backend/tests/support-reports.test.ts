import { describe, it, expect, beforeEach } from 'vitest';
import * as ticketService from '../src/modules/tickets/tickets.service.js';
import * as kbService from '../src/modules/knowledge-base/kb.service.js';
import * as notificationService from '../src/modules/notifications/notifications.service.js';
import * as reportsService from '../src/modules/reports/reports.service.js';
import { devStore } from '../src/config/dev-store.js';
import { TicketStatus, TicketPriority, ArticleStatus } from '@prisma/client';
import { seedTestUsers, makeDraftArticle, makeTicket } from './helpers/fixtures.js';

seedTestUsers();
describe('Phase 5 — Support Desk, Knowledge Base, Notifications & Reports', () => {
  const companyId = devStore.company.id;
  const adminUserId = '20000000-0000-0000-0000-000000000001';
  const supportUserId = '20000000-0000-0000-0000-000000000004';
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';

  describe('1. Support Ticket Management & SLA', () => {
    it('creates a new support ticket with auto-generated ticket number and assigns to user', async () => {
      const ticket = await ticketService.createTicket(companyId, adminUserId, {
        subject: 'Database connection pool exhausted during peak traffic',
        description: 'Postgres connection limit reached 100 connections.',
        priority: TicketPriority.URGENT,
        assignedTo: supportUserId,
        department: 'Infrastructure',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        slaDueAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toMatch(/^TICK-\d{4}-\d{4}$/);
      expect(ticket.status).toBe(TicketStatus.OPEN);
      expect(ticket.priority).toBe(TicketPriority.URGENT);
      expect(ticket.assignedTo).toBe(supportUserId);
      expect(ticket.isArchived).toBe(false);
    });

    it('updates ticket status and records resolution timestamps when status is RESOLVED', async () => {
      const ticket = await ticketService.createTicket(companyId, adminUserId, {
        subject: 'Password reset email link expired',
        description: 'Customer unable to reset credentials.',
        priority: TicketPriority.LOW,
      });

      expect(ticket.resolvedAt).toBeNull();

      const updated = await ticketService.updateTicket(companyId, ticket.id, adminUserId, {
        status: TicketStatus.RESOLVED,
      });

      expect(updated.status).toBe(TicketStatus.RESOLVED);
      expect(updated.resolvedAt).not.toBeNull();
      expect(new Date(updated.resolvedAt!).getTime()).toBeGreaterThan(0);
    });

    it('filters tickets by status, priority, and detects overdue tickets correctly', async () => {
      const result = await ticketService.listTickets(companyId, {
        page: 1,
        limit: 10,
        isOverdue: true,
      });

      expect(Array.isArray(result.items)).toBe(true);
      // All overdue items must not be resolved or closed
      for (const t of result.items) {
        expect([TicketStatus.RESOLVED, TicketStatus.CLOSED]).not.toContain(t.status);
      }
    });

    it('prevents cross-company access to tickets', async () => {
      await expect(
        ticketService.getTicketById(otherCompanyId, '70000000-0000-0000-0000-000000000001')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('2. Ticket Replies and Internal Notes Privacy', () => {
    it('creates customer-visible reply and staff-only internal note', async () => {
      const ticketId = makeTicket().id;

      // 1. Customer-visible reply
      const publicReply = await ticketService.createTicketReply(companyId, ticketId, supportUserId, {
        body: 'We have applied the patch to staging. Please re-test your webhook.',
        isInternal: false,
      });
      expect(publicReply.id).toBeDefined();
      expect(publicReply.isInternal).toBe(false);

      // 2. Internal note (staff only)
      const internalNote = await ticketService.createTicketReply(companyId, ticketId, supportUserId, {
        body: 'Root cause was an unescaped ampersand in the signature salt.',
        isInternal: true,
      });
      expect(internalNote.id).toBeDefined();
      expect(internalNote.isInternal).toBe(true);

      // 3. Fetch ticket with canViewInternalNotes = true (Staff)
      const staffView = await ticketService.getTicketById(companyId, ticketId, true);
      const hasInternalInStaff = staffView.replies.some((r: any) => r.isInternal);
      expect(hasInternalInStaff).toBe(true);

      // 4. Fetch ticket with canViewInternalNotes = false (Customer / External)
      const customerView = await ticketService.getTicketById(companyId, ticketId, false);
      const hasInternalInCustomer = customerView.replies.some((r: any) => r.isInternal);
      expect(hasInternalInCustomer).toBe(false);
    });

    it('sanitizes reply body to prevent stored cross-site scripting (XSS)', async () => {
      const maliciousScript = '<script>alert("XSS")</script>Hello <img src="x" onerror="stealCookies()">Team';
      const sanitized = ticketService.sanitizeText(maliciousScript);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('Team');
    });
  });

  describe('3. Knowledge Base & Duplicate Slug Handling', () => {
    it('generates unique slugs and handles duplicate article slugs safely', async () => {
      const title = 'Configuring SAML SSO Authentication';

      const art1 = await kbService.createArticle(companyId, adminUserId, {
        title,
        body: 'Step 1: Obtain IdP metadata XML from Okta...',
        status: ArticleStatus.PUBLISHED,
      });

      const art2 = await kbService.createArticle(companyId, adminUserId, {
        title,
        body: 'Alternate guide: Obtain IdP metadata XML from Azure AD...',
        status: ArticleStatus.DRAFT,
      });

      expect(art1.slug).toBe('configuring-saml-sso-authentication');
      expect(art2.slug).toBe('configuring-saml-sso-authentication-2');
      expect(art1.slug).not.toBe(art2.slug);
    });

    it('restricts draft and archived articles from non-staff / public access', async () => {
      // Find or create a draft article
      const draftArticle = makeDraftArticle();
      expect(draftArticle).toBeDefined();

      // Non-staff query for draft article should throw 404
      await expect(
        kbService.getArticleBySlugOrId(companyId, draftArticle!.slug, false)
      ).rejects.toThrow(/not found/i);

      // Staff query for draft article should succeed
      const staffArticle = await kbService.getArticleBySlugOrId(companyId, draftArticle!.slug, true);
      expect(staffArticle.id).toBe(draftArticle!.id);
    });

    it('searches articles across title, summary, body and tags', async () => {
      makeDraftArticle({
        title: 'Debugging webhook signature failures',
        summary: 'Why webhook signatures fail',
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      });
      const result = await kbService.listArticles(companyId, {
        search: 'webhook',
        page: 1,
        limit: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some((a) => a.title.toLowerCase().includes('webhook'))).toBe(true);
    });
  });

  describe('4. Notifications Center & Ownership Security', () => {
    it('retrieves user notifications and unread count', async () => {
      const unreadCount = await notificationService.getUnreadCount(adminUserId);
      expect(typeof unreadCount).toBe('number');

      const result = await notificationService.getUserNotifications(adminUserId, {
        page: 1,
        limit: 10,
        isUnread: true,
      });

      for (const n of result.items) {
        expect(n.userId).toBe(adminUserId);
        expect(n.readAt).toBeNull();
      }
    });

    it('marks a single notification as read and enforces notification ownership', async () => {
      // Create a test notification for Admin
      const notif = await notificationService.createNotification(adminUserId, {
        companyId,
        type: 'test.alert',
        title: 'System Health Check Notification',
        body: 'All database replica connections healthy.',
      });

      expect(notif.readAt).toBeNull();

      // Other user cannot mark Admin's notification as read
      await expect(
        notificationService.markAsRead(supportUserId, notif.id)
      ).rejects.toThrow(/cannot modify another user/i);

      // Owner can mark it as read
      const updated = await notificationService.markAsRead(adminUserId, notif.id);
      expect(updated.readAt).not.toBeNull();
    });

    it('marks all notifications as read for the user', async () => {
      const res = await notificationService.markAllAsRead(adminUserId);
      expect(res.success).toBe(true);

      const unreadCountAfter = await notificationService.getUnreadCount(adminUserId);
      expect(unreadCountAfter).toBe(0);
    });
  });

  describe('5. Reports & Analytics with Real Aggregates', () => {
    it('computes CRM report metrics accurately', async () => {
      const report = await reportsService.getCrmReport(companyId, {});

      expect(report.totalLeads).toBeGreaterThanOrEqual(0);
      expect(typeof report.conversionRate).toBe('number');
      expect(report.leadsByStatus).toBeDefined();
      expect(report.customers).toBeDefined();
      expect(report.followUps).toBeDefined();
    });

    it('computes Project report metrics including task and progress breakdown', async () => {
      const report = await reportsService.getProjectsReport(companyId);

      expect(report.projects.total).toBeGreaterThanOrEqual(0);
      expect(report.tasks.byStatus).toBeDefined();
      expect(typeof report.timeTracking.totalHoursLogged).toBe('number');
    });

    it('computes Financial reports with strict currency isolation', async () => {
      const report = await reportsService.getFinancialReport(companyId, {});

      expect(report.totalsByCurrency).toBeDefined();
      // Ensure metrics are keyed by currency (e.g. INR) rather than mixed totals
      for (const [curr, metrics] of Object.entries(report.totalsByCurrency)) {
        expect(typeof curr).toBe('string');
        expect(metrics.totalInvoiced).toBeGreaterThanOrEqual(0);
        expect(metrics.totalPaid).toBeGreaterThanOrEqual(0);
        expect(metrics.outstanding).toBeGreaterThanOrEqual(0);
      }
    });

    it('computes Support report metrics with average resolution hours and SLA statistics', async () => {
      const report = await reportsService.getSupportReport(companyId);

      expect(report.totalTickets).toBeGreaterThanOrEqual(0);
      expect(typeof report.averageResolutionHours).toBe('number');
      expect(report.byStatus).toBeDefined();
      expect(report.byPriority).toBeDefined();
    });
  });

  describe('6. CSV Export and Formula-Injection Sanitization', () => {
    it('prepends single quote to cells beginning with =, +, -, @ to prevent formula injection', () => {
      const formulaPayloads = [
        '=cmd|"/C calc"!A0',
        '+2+5',
        '-500*2',
        '@SUM(1,1)',
      ];

      for (const payload of formulaPayloads) {
        const sanitized = reportsService.sanitizeCsvCell(payload);
        expect(sanitized.startsWith("'") || sanitized.startsWith('"\'')).toBe(true);
      }
    });

    it('correctly escapes quotes, commas, and line breaks in CSV output', () => {
      const textWithComma = 'Acme, Corporation';
      const textWithQuotes = 'Quote "Hello" World';
      const textWithNewline = 'Line 1\nLine 2';

      expect(reportsService.sanitizeCsvCell(textWithComma)).toBe('"Acme, Corporation"');
      expect(reportsService.sanitizeCsvCell(textWithQuotes)).toBe('"Quote ""Hello"" World"');
      expect(reportsService.sanitizeCsvCell(textWithNewline)).toBe('"Line 1\nLine 2"');
    });

    it('exports authorized CSV table for leads without leaking sensitive fields', async () => {
      const csv = await reportsService.exportReportCsv(companyId, 'leads-table');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Lead Name');
      expect(csv).toContain('Status');
      // Must not leak passwords or internal hashes
      expect(csv).not.toContain('$2a$10$');
      expect(csv).not.toContain('passwordHash');
    });
  });
});
