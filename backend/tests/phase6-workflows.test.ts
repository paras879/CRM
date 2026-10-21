import { describe, it, expect, beforeEach } from 'vitest';
import { devStore } from '../src/config/dev-store.js';
import * as leadService from '../src/modules/leads/leads.service.js';
import * as customerService from '../src/modules/customers/customers.service.js';
import * as projectService from '../src/modules/projects/projects.service.js';
import * as milestoneService from '../src/modules/milestones/milestones.service.js';
import * as taskService from '../src/modules/tasks/tasks.service.js';
import * as timeService from '../src/modules/time-tracking/time-tracking.service.js';
import * as proposalService from '../src/modules/proposals/proposals.service.js';
import * as invoiceService from '../src/modules/invoices/invoices.service.js';
import * as paymentService from '../src/modules/payments/payments.service.js';
import * as expenseService from '../src/modules/expenses/expenses.service.js';
import * as ticketService from '../src/modules/tickets/tickets.service.js';
import * as kbService from '../src/modules/knowledge-base/kb.service.js';
import * as notificationService from '../src/modules/notifications/notifications.service.js';
import * as reportsService from '../src/modules/reports/reports.service.js';
import {
  CustomerType,
  LeadStatus,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  ProposalStatus,
  InvoiceStatus,
  TicketStatus,
  TicketPriority,
  ArticleStatus,
} from '@prisma/client';
import { seedTestUsers, makeCustomer, makeTicket } from './helpers/fixtures.js';

seedTestUsers();
describe('Phase 6 — Complete End-to-End Workflows & Security Verification', () => {
  const companyId = devStore.company.id;
  const adminUserId = '20000000-0000-0000-0000-000000000001';
  const staffUserId = '20000000-0000-0000-0000-000000000002';
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';

  // --------------------------------------------------------------------------
  // WORKFLOW 1: Create a lead → assign it → add a follow-up → convert to customer
  // --------------------------------------------------------------------------
  describe('Workflow 1: Lead Lifecycle & Conversion', () => {
    it('creates a lead, assigns it, adds follow-up, and converts it into a customer and contact', async () => {
      // 1. Create lead
      const lead = await leadService.createLead(companyId, adminUserId, {
        name: 'Johnathan Tech Lead',
        companyName: 'Apex Innovations Ltd',
        email: 'johnathan@apexinnovations.test',
        phone: '+91 9876543210',
        value: 750000,
        currency: 'INR',
      });
      expect(lead.id).toBeDefined();
      expect(lead.status).toBe(LeadStatus.NEW);

      // 2. Assign lead to staff
      const assigned = await leadService.assignLead(companyId, adminUserId, lead.id, staffUserId);
      expect(assigned.ownerId).toBe(staffUserId);

      // 3. Add follow-up note / activity
      const updatedWithFollowup = await leadService.updateLead(companyId, adminUserId, lead.id, {
        nextFollowUp: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(updatedWithFollowup.nextFollowUp).not.toBeNull();

      // 4. Convert lead to customer
      const conversionResult = await leadService.convertLead(companyId, adminUserId, lead.id, {
        customerType: CustomerType.COMPANY,
        companyName: 'Apex Innovations Ltd',
        contactName: 'Johnathan Tech Lead',
        email: 'johnathan@apexinnovations.test',
      });

      expect(conversionResult.lead.status).toBe(LeadStatus.WON);
      expect(conversionResult.lead.convertedToId).toBeDefined();
      expect(conversionResult.customer).toBeDefined();
      expect(conversionResult.customer.name).toBe('Apex Innovations Ltd');

      // 5. Verify duplicate conversion prevention
      await expect(
        leadService.convertLead(companyId, adminUserId, lead.id, {
          customerType: CustomerType.COMPANY,
        })
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 2: Create a project → add a milestone → create a task → record time
  // --------------------------------------------------------------------------
  describe('Workflow 2: Project Delivery, Milestones, Tasks & Time Tracking', () => {
    it('creates project, milestone, task, and tracks billable hours', async () => {
      // 1. Create Project
      const project = await projectService.createProject(companyId, adminUserId, {
        name: 'Enterprise Core CRM Rollout',
        customerId: makeCustomer().id,
        billingType: 'FIXED_COST',
        totalRate: 500000,
        currency: 'INR',
        startDate: new Date().toISOString(),
        deadline: new Date(Date.now() + 60 * 86400000).toISOString(),
      });
      expect(project.id).toBeDefined();
      expect(project.status).toBe(ProjectStatus.NOT_STARTED);

      // 2. Add Milestone
      const milestone = await milestoneService.createMilestone(companyId, adminUserId, {
        projectId: project.id,
        name: 'Phase 1 - Architecture & Database Schema',
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
        order: 1,
      });
      expect(milestone.id).toBeDefined();
      expect(milestone.projectId).toBe(project.id);

      // 3. Create Task under milestone
      const task = await taskService.createTask(companyId, adminUserId, {
        projectId: project.id,
        milestoneId: milestone.id,
        title: 'Design high-availability Postgres schema with dual-write fallback',
        priority: TaskPriority.HIGH,
        billable: true,
        hourlyRate: 1500,
      });
      expect(task.id).toBeDefined();
      expect(task.status).toBe(TaskStatus.TODO);

      // 4. Record Time Entry
      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      const timeLog = await timeService.createTimeEntry(companyId, adminUserId, {
        projectId: project.id,
        taskId: task.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        minutes: 60,
        billable: true,
        note: 'Completed schema verification and migration testing',
      });
      expect(timeLog.id).toBeDefined();
      expect(timeLog.minutes).toBe(60);
      expect(timeLog.billable).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 3: Proposal/Estimate → Invoice → Partial Payment → Remaining Balance
  // --------------------------------------------------------------------------
  describe('Workflow 3: Sales to Invoice, Partial Payment & Balance Calculation', () => {
    it('converts proposal to invoice, records partial payment, and verifies remaining balance and status', async () => {
      // 1. Create Proposal
      const proposal = await proposalService.createProposal(companyId, adminUserId, {
        customerId: makeCustomer().id,
        title: 'Platform Architecture Modernization Proposal',
        subject: 'Modernization Scope',
        currency: 'INR',
        discount: 0,
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
        items: [
          { description: 'Cloud Setup', quantity: 1, unitPrice: 100000, discount: 0, taxRate: 0.18 },
        ],
      });
      expect(proposal.total).toBe(118000); // 100000 + 18% tax

      // 2. Accept Proposal
      await proposalService.updateProposal(companyId, proposal.id, adminUserId, {
        status: ProposalStatus.ACCEPTED,
      });

      // 3. Convert to Invoice
      const conversionRes = await proposalService.convertProposalToInvoice(companyId, proposal.id, adminUserId);
      const invoice = conversionRes.invoice;
      expect(invoice).toBeDefined();
      expect(invoice.id).toBeDefined();
      expect(invoice.total).toBe(118000);
      expect(invoice.amountPaid).toBe(0);

      // Issue the invoice so payment can be made
      await invoiceService.updateInvoice(companyId, invoice.id, adminUserId, {
        status: InvoiceStatus.ISSUED,
      });

      // 4. Record Partial Payment (50,000)
      const payment1 = await paymentService.recordPayment(companyId, adminUserId, {
        invoiceId: invoice.id,
        amount: 50000,
        method: 'BANK_TRANSFER',
        reference: 'TXN-WF-001',
      });
      expect(payment1.amount).toBe(50000);
      expect(payment1.updatedInvoice.amountPaid).toBe(50000);
      expect(payment1.updatedInvoice.balanceDue).toBe(68000);
      expect(payment1.updatedInvoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);

      // 5. Verify over-payment rejection
      await expect(
        paymentService.recordPayment(companyId, adminUserId, {
          invoiceId: invoice.id,
          amount: 70000, // exceeds 68000
          method: 'CASH',
        })
      ).rejects.toThrow();

      // 6. Record remaining payment (68,000)
      const payment2 = await paymentService.recordPayment(companyId, adminUserId, {
        invoiceId: invoice.id,
        amount: 68000,
        method: 'BANK_TRANSFER',
        reference: 'TXN-WF-002',
      });
      expect(payment2.updatedInvoice.amountPaid).toBe(118000);
      expect(payment2.updatedInvoice.balanceDue).toBe(0);
      expect(payment2.updatedInvoice.status).toBe(InvoiceStatus.PAID);
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 4: Add Expense → Verify Report
  // --------------------------------------------------------------------------
  describe('Workflow 4: Expense Management & Financial Reporting', () => {
    it('creates an expense and verifies it appears in financial report under correct category and currency', async () => {
      const expCategory = devStore.expenseCategories[0]?.name || 'Infrastructure';
      const expense = await expenseService.createExpense(companyId, adminUserId, {
        title: 'AWS Production Cloud Hosting Q3',
        amount: 45000,
        currency: 'INR',
        category: expCategory,
        paymentMethod: 'CREDIT_CARD',
        expenseDate: new Date().toISOString(),
      });
      expect(expense.id).toBeDefined();

      // Verify financial report
      const finReport = await reportsService.getFinancialReport(companyId, {});
      expect(finReport.totalsByCurrency.INR).toBeDefined();
      expect(finReport.expenses.totalCount).toBeGreaterThan(0);
      expect(finReport.expenses.byCurrency.INR).toBeGreaterThanOrEqual(45000);
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 5: Support Ticket → Public Reply → Internal Note → Resolve Ticket
  // --------------------------------------------------------------------------
  describe('Workflow 5: Support Ticket, Internal Note Privacy & Resolution', () => {
    it('creates ticket, adds public reply, adds staff note, verifies non-leakage, and resolves ticket', async () => {
      // 1. Create ticket
      const ticket = await ticketService.createTicket(companyId, adminUserId, {
        subject: 'Database deadlocks on high concurrency load',
        description: 'Transaction deadlocks observed during stress testing.',
        priority: TicketPriority.URGENT,
      });
      expect(ticket.ticketNumber).toMatch(/^TICK-\d{4}-\d{4}$/);

      // 2. Customer-facing reply
      const publicReply = await ticketService.createTicketReply(companyId, ticket.id, adminUserId, {
        body: 'We are investigating the query lock order.',
        isInternal: false,
      });
      expect(publicReply.isInternal).toBe(false);

      // 3. Staff-only internal note
      const internalNote = await ticketService.createTicketReply(companyId, ticket.id, adminUserId, {
        body: 'CONFIDENTIAL: Lock acquired on invoice row before proposal table.',
        isInternal: true,
      });
      expect(internalNote.isInternal).toBe(true);

      // 4. Verify privacy: Customer/public query MUST omit internal note
      const publicView = await ticketService.getTicketById(companyId, ticket.id, false);
      expect(publicView.replies.some((r) => r.isInternal)).toBe(false);

      const staffView = await ticketService.getTicketById(companyId, ticket.id, true);
      expect(staffView.replies.some((r) => r.isInternal)).toBe(true);

      // 5. Resolve ticket
      const resolved = await ticketService.updateTicket(companyId, ticket.id, adminUserId, {
        status: TicketStatus.RESOLVED,
      });
      expect(resolved.status).toBe(TicketStatus.RESOLVED);
      expect(resolved.resolvedAt).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 6: Knowledge Base Article → Slug Collision → Visibility Rules
  // --------------------------------------------------------------------------
  describe('Workflow 6: Knowledge Base Publishing & Visibility', () => {
    it('handles duplicate slug collision and enforces draft vs published visibility', async () => {
      const title = 'Configuring Production Reverse Proxy';

      // 1. Create published article
      const art1 = await kbService.createArticle(companyId, adminUserId, {
        title,
        body: 'Nginx reverse proxy setup instructions.',
        status: ArticleStatus.PUBLISHED,
      });
      expect(art1.slug).toBe('configuring-production-reverse-proxy');
      expect(art1.status).toBe(ArticleStatus.PUBLISHED);

      // 2. Create another article with identical title (test collision)
      const art2 = await kbService.createArticle(companyId, adminUserId, {
        title,
        body: 'Draft version of reverse proxy.',
        status: ArticleStatus.DRAFT,
      });
      expect(art2.slug).not.toBe(art1.slug);
      expect(art2.slug).toMatch(/^configuring-production-reverse-proxy-\d+$/);

      // 3. Visibility check: Draft article must not appear in public published list
      const publishedList = await kbService.listArticles(companyId, { status: ArticleStatus.PUBLISHED });
      expect(publishedList.items.every((a) => a.status === ArticleStatus.PUBLISHED)).toBe(true);
      expect(publishedList.items.some((a) => a.id === art2.id)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 7: Trigger Notification → Verify User Access & Mark Read
  // --------------------------------------------------------------------------
  describe('Workflow 7: In-App Notifications & Ownership', () => {
    it('creates notification for specific user, checks unread count, and marks read', async () => {
      // 1. Create notification for staff user
      const notif = await notificationService.createNotification(staffUserId, {
        companyId,
        type: 'task.assigned',
        title: 'New High Priority Task Assigned',
        body: 'You have been assigned to Postgres High-Availability sprint.',
        link: '/work/tasks',
      });
      expect(notif.userId).toBe(staffUserId);
      expect(notif.readAt).toBeNull();

      // 2. Fetch unread count for staff
      const count = await notificationService.getUnreadCount(staffUserId);
      expect(count).toBeGreaterThan(0);

      // 3. Mark notification as read
      const readNotif = await notificationService.markAsRead(staffUserId, notif.id);
      expect(readNotif.readAt).not.toBeNull();

      // 4. Verify cross-user ownership: another user cannot mark this notification
      await expect(
        notificationService.markAsRead('another-random-user-id', notif.id)
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 8: Export Report → Verify RFC 4180 & CSV Formula Injection Neutralization
  // --------------------------------------------------------------------------
  describe('Workflow 8: Reports & Formula Injection Protection', () => {
    it('exports CSV with sanitized formula cells preventing spreadsheet injection', async () => {
      // Create a ticket with a dangerous spreadsheet formula payload
      await ticketService.createTicket(companyId, adminUserId, {
        subject: '=1+1;cmd|/c calc!A0',
        description: '+HYPERLINK("http://malicious-site.com","Click")',
        priority: TicketPriority.LOW,
      });

      const csv = await reportsService.exportReportCsv(companyId, 'support');
      expect(csv).toBeDefined();

      // Formulas must be escaped with single quote `'`
      expect(csv).toContain(`'=1+1;cmd|/c calc!A0`);
      expect(csv).not.toMatch(/\n[^,]+,=1\+1/);
    });
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 9: Cross-Company Access Denied (Tenancy & Record Isolation)
  // --------------------------------------------------------------------------
  describe('Workflow 9: Cross-Company Access Restrictions', () => {
    it('denies access to tickets, customers, and reports across different companies', async () => {
      // Attempt to access company A ticket from company B scope
      const ticket = makeTicket();
      await expect(
        ticketService.getTicketById(otherCompanyId, ticket.id)
      ).rejects.toThrow();

      // Attempt to access company A customer from company B scope
      const customer = makeCustomer();
      await expect(
        customerService.getCustomerById(otherCompanyId, customer.id)
      ).rejects.toThrow();

      // Attempt to access reports for another company with empty scope
      const rep = await reportsService.getSupportReport(otherCompanyId);
      expect(rep.totalTickets).toBe(0);
    });
  });
});
