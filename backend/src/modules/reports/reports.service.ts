import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { InvoiceStatus, TicketStatus, ProjectStatus, TaskStatus, ActivityType, ActivityStatus } from '@prisma/client';
import { ReportQuery } from './reports.schema.js';
import { buildCsv } from '../../utils/csv.js';
import type { ExportTable } from '../../utils/table-export.js';
import { getFinancialSummary } from '../finance-dashboard/finance-dashboard.service.js';

export { sanitizeCsvCell, buildCsv } from '../../utils/csv.js';

export async function getCrmReport(companyId: string, query: ReportQuery, scopeUserIds?: string[] | null) {
  const scope = scopeUserIds ? new Set(scopeUserIds) : null;
  const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 90 * 86400000);
  const endDate = query.endDate ? new Date(query.endDate) : new Date();

  if (!isDatabaseConnected) {
    const allLeads = devStore.leads.filter(
      (l) => l.companyId === companyId && !l.isArchived && (!scope || (l.ownerId !== null && scope.has(l.ownerId)))
    );
    const leadsInRange = allLeads.filter((l) => l.createdAt >= startDate && l.createdAt <= endDate);

    // Leads by status
    const statusCounts: Record<string, number> = {};
    allLeads.forEach((l) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });

    // Leads by source
    const sourceCounts: Record<string, number> = {};
    allLeads.forEach((l) => {
      const src = l.source ?? 'Direct / Organic';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    // Conversion rate
    const convertedCount = allLeads.filter((l) => l.convertedToId !== null || l.status === 'WON').length;
    const conversionRate = allLeads.length > 0 ? Number(((convertedCount / allLeads.length) * 100).toFixed(2)) : 0;

    // Follow-ups
    const now = new Date();
    const followUps = devStore.activities.filter(
      (a) =>
        a.companyId === companyId &&
        a.type === ActivityType.FOLLOW_UP &&
        (!scope || (a.assignedToId !== null && scope.has(a.assignedToId)))
    );
    const completedFollowUps = followUps.filter((a) => a.status === ActivityStatus.COMPLETED).length;
    const upcomingFollowUps = followUps.filter(
      (a) => a.status === ActivityStatus.PENDING && a.dueDate && new Date(a.dueDate) >= now
    ).length;
    const overdueFollowUps = followUps.filter(
      (a) => a.status === ActivityStatus.PENDING && a.dueDate && new Date(a.dueDate) < now
    ).length;

    // Customer growth
    const customers = devStore.customers.filter(
      (c) => c.companyId === companyId && !c.isArchived && (!scope || (c.assignedToId !== null && scope.has(c.assignedToId)))
    );
    const newCustomersInRange = customers.filter((c) => c.createdAt >= startDate && c.createdAt <= endDate).length;

    return {
      dateRange: { startDate, endDate },
      totalLeads: allLeads.length,
      newLeadsInRange: leadsInRange.length,
      conversionRate,
      convertedCount,
      leadsByStatus: statusCounts,
      leadsBySource: sourceCounts,
      customers: {
        total: customers.length,
        newInRange: newCustomersInRange,
      },
      followUps: {
        total: followUps.length,
        completed: completedFollowUps,
        upcoming: upcomingFollowUps,
        overdue: overdueFollowUps,
      },
    };
  }

  // Database aggregates
  const leadScope = scopeUserIds ? { ownerId: { in: scopeUserIds } } : {};
  const activityScope = scopeUserIds ? { assignedToId: { in: scopeUserIds } } : {};
  const customerScope = scopeUserIds ? { assignedToId: { in: scopeUserIds } } : {};
  const [totalLeads, leadsInRange, allLeads, followUps, customers] = await Promise.all([
    prisma.lead.count({ where: { companyId, isArchived: false, ...leadScope } }),
    prisma.lead.count({ where: { companyId, isArchived: false, ...leadScope, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.lead.findMany({ where: { companyId, isArchived: false, ...leadScope }, select: { status: true, source: true, convertedToId: true } }),
    prisma.activity.findMany({ where: { companyId, type: ActivityType.FOLLOW_UP, ...activityScope }, select: { status: true, dueDate: true } }),
    prisma.customer.findMany({ where: { companyId, isArchived: false, ...customerScope }, select: { createdAt: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let convertedCount = 0;

  allLeads.forEach((l) => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    const src = l.source ?? 'Direct / Organic';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    if (l.convertedToId || l.status === 'WON') convertedCount++;
  });

  const conversionRate = totalLeads > 0 ? Number(((convertedCount / totalLeads) * 100).toFixed(2)) : 0;

  const now = new Date();
  let completedFollowUps = 0;
  let upcomingFollowUps = 0;
  let overdueFollowUps = 0;

  followUps.forEach((a) => {
    if (a.status === ActivityStatus.COMPLETED) completedFollowUps++;
    else if (a.dueDate && a.dueDate < now) overdueFollowUps++;
    else upcomingFollowUps++;
  });

  const newCustomersInRange = customers.filter((c) => c.createdAt >= startDate && c.createdAt <= endDate).length;

  return {
    dateRange: { startDate, endDate },
    totalLeads,
    newLeadsInRange: leadsInRange,
    conversionRate,
    convertedCount,
    leadsByStatus: statusCounts,
    leadsBySource: sourceCounts,
    customers: {
      total: customers.length,
      newInRange: newCustomersInRange,
    },
    followUps: {
      total: followUps.length,
      completed: completedFollowUps,
      upcoming: upcomingFollowUps,
      overdue: overdueFollowUps,
    },
  };
}

export async function getProjectsReport(companyId: string) {
  const now = new Date();

  if (!isDatabaseConnected) {
    const projects = devStore.projects.filter((p) => p.companyId === companyId && !p.isArchived);
    const activeProjects = projects.filter((p) => p.status === ProjectStatus.ACTIVE).length;
    const completedProjects = projects.filter((p) => p.status === ProjectStatus.COMPLETED).length;
    const overdueProjects = projects.filter(
      (p) =>
        p.deadline &&
        new Date(p.deadline) < now &&
        p.status !== ProjectStatus.COMPLETED &&
        p.status !== ProjectStatus.CANCELLED
    ).length;

    const avgProgress =
      projects.length > 0
        ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length)
        : 0;

    // Tasks
    const projectIds = new Set(projects.map((p) => p.id));
    const tasks = devStore.tasks.filter((t) => projectIds.has(t.projectId));
    const tasksByStatus: Record<string, number> = {};
    const tasksByPriority: Record<string, number> = {};
    let overdueTasks = 0;

    tasks.forEach((t) => {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
      tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
      if (t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE) {
        overdueTasks++;
      }
    });

    // Time entries
    const timeEntries = devStore.timeEntries.filter((te) => projectIds.has(te.projectId));
    const totalMinutesLogged = timeEntries.reduce((acc, te) => acc + (te.minutes || 0), 0);
    const totalHoursLogged = Number((totalMinutesLogged / 60).toFixed(1));

    return {
      projects: {
        total: projects.length,
        active: activeProjects,
        completed: completedProjects,
        overdue: overdueProjects,
        averageProgress: avgProgress,
      },
      tasks: {
        total: tasks.length,
        byStatus: tasksByStatus,
        byPriority: tasksByPriority,
        overdue: overdueTasks,
      },
      timeTracking: {
        totalHoursLogged,
        totalEntries: timeEntries.length,
      },
    };
  }

  const [projects, tasks, timeEntries] = await Promise.all([
    prisma.project.findMany({
      where: { companyId, isArchived: false },
      select: { id: true, status: true, deadline: true, progress: true },
    }),
    prisma.task.findMany({
      where: { project: { companyId, isArchived: false } },
      select: { status: true, priority: true, dueDate: true },
    }),
    prisma.timeEntry.findMany({
      where: { project: { companyId, isArchived: false } },
      select: { minutes: true },
    }),
  ]);

  let activeProjects = 0;
  let completedProjects = 0;
  let overdueProjects = 0;
  let progressSum = 0;

  projects.forEach((p) => {
    if (p.status === ProjectStatus.ACTIVE) activeProjects++;
    if (p.status === ProjectStatus.COMPLETED) completedProjects++;
    if (p.deadline && p.deadline < now && p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.CANCELLED) {
      overdueProjects++;
    }
    progressSum += p.progress || 0;
  });

  const tasksByStatus: Record<string, number> = {};
  const tasksByPriority: Record<string, number> = {};
  let overdueTasks = 0;

  tasks.forEach((t) => {
    tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
    if (t.dueDate && t.dueDate < now && t.status !== TaskStatus.DONE) overdueTasks++;
  });

  const totalMinutes = timeEntries.reduce((acc, te) => acc + (te.minutes || 0), 0);

  return {
    projects: {
      total: projects.length,
      active: activeProjects,
      completed: completedProjects,
      overdue: overdueProjects,
      averageProgress: projects.length > 0 ? Math.round(progressSum / projects.length) : 0,
    },
    tasks: {
      total: tasks.length,
      byStatus: tasksByStatus,
      byPriority: tasksByPriority,
      overdue: overdueTasks,
    },
    timeTracking: {
      totalHoursLogged: Number((totalMinutes / 60).toFixed(1)),
      totalEntries: timeEntries.length,
    },
  };
}

export async function getFinancialReport(companyId: string, query: ReportQuery) {
  const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 365 * 86400000);
  const endDate = query.endDate ? new Date(query.endDate) : new Date();
  const targetCurrency = query.currency;

  if (!isDatabaseConnected) {
    let invoices = devStore.invoices.filter((i) => i.companyId === companyId && !i.isArchived);
    if (targetCurrency) invoices = invoices.filter((i) => i.currency === targetCurrency);

    // Totals by currency
    const totalsByCurrency: Record<string, { totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }> = {};
    const invoiceStatusCounts: Record<string, number> = {};
    const now = new Date();

    invoices.forEach((i) => {
      invoiceStatusCounts[i.status] = (invoiceStatusCounts[i.status] || 0) + 1;

      if (!totalsByCurrency[i.currency]) {
        totalsByCurrency[i.currency] = { totalInvoiced: 0, totalPaid: 0, outstanding: 0, overdue: 0 };
      }

      // Exclude VOID or CANCELLED from receivables
      if (i.status !== InvoiceStatus.VOID && i.status !== InvoiceStatus.CANCELLED) {
        totalsByCurrency[i.currency].totalInvoiced += i.total;
        totalsByCurrency[i.currency].totalPaid += i.amountPaid;
        const due = i.total - i.amountPaid;
        if (due > 0) {
          totalsByCurrency[i.currency].outstanding += due;
          if (i.dueDate && new Date(i.dueDate) < now) {
            totalsByCurrency[i.currency].overdue += due;
          }
        }
      }
    });

    // Payments collected in date range
    const invoiceIds = new Set(invoices.map((i) => i.id));
    const payments = devStore.payments.filter(
      (p) => invoiceIds.has(p.invoiceId) && !p.isReversed && p.paidAt >= startDate && p.paidAt <= endDate
    );
    const paymentsByCurrency: Record<string, number> = {};
    payments.forEach((p) => {
      paymentsByCurrency[p.currency] = (paymentsByCurrency[p.currency] || 0) + p.amount;
    });

    // Expenses by category
    const expenses = devStore.expenses.filter(
      (e) => e.companyId === companyId && e.incurredAt >= startDate && e.incurredAt <= endDate
    );
    const expensesByCategory: Record<string, number> = {};
    const expensesByCurrency: Record<string, number> = {};
    expenses.forEach((e) => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
      expensesByCurrency[e.currency] = (expensesByCurrency[e.currency] || 0) + e.amount;
    });

    return {
      dateRange: { startDate, endDate },
      totalsByCurrency,
      invoiceStatusCounts,
      paymentsCollected: paymentsByCurrency,
      expenses: {
        byCategory: expensesByCategory,
        byCurrency: expensesByCurrency,
        totalCount: expenses.length,
      },
    };
  }

  // Database aggregates
  const whereInvoices: any = { companyId, isArchived: false };
  if (targetCurrency) whereInvoices.currency = targetCurrency;

  const [invoices, payments, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: whereInvoices,
      select: { id: true, status: true, currency: true, total: true, amountPaid: true, dueDate: true },
    }),
    prisma.payment.findMany({
      where: {
        invoice: whereInvoices,
        isReversed: false,
        paidAt: { gte: startDate, lte: endDate },
      },
      select: { currency: true, amount: true },
    }),
    prisma.expense.findMany({
      where: {
        companyId,
        incurredAt: { gte: startDate, lte: endDate },
      },
      select: { category: true, currency: true, amount: true },
    }),
  ]);

  const totalsByCurrency: Record<string, { totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }> = {};
  const invoiceStatusCounts: Record<string, number> = {};
  const now = new Date();

  invoices.forEach((i) => {
    invoiceStatusCounts[i.status] = (invoiceStatusCounts[i.status] || 0) + 1;
    const cur = i.currency;
    if (!totalsByCurrency[cur]) {
      totalsByCurrency[cur] = { totalInvoiced: 0, totalPaid: 0, outstanding: 0, overdue: 0 };
    }

    if (i.status !== InvoiceStatus.VOID && i.status !== InvoiceStatus.CANCELLED) {
      const tot = Number(i.total);
      const paid = Number(i.amountPaid);
      totalsByCurrency[cur].totalInvoiced += tot;
      totalsByCurrency[cur].totalPaid += paid;
      const due = tot - paid;
      if (due > 0) {
        totalsByCurrency[cur].outstanding += due;
        if (i.dueDate && i.dueDate < now) totalsByCurrency[cur].overdue += due;
      }
    }
  });

  const paymentsByCurrency: Record<string, number> = {};
  payments.forEach((p) => {
    paymentsByCurrency[p.currency] = (paymentsByCurrency[p.currency] || 0) + Number(p.amount);
  });

  const expensesByCategory: Record<string, number> = {};
  const expensesByCurrency: Record<string, number> = {};
  expenses.forEach((e) => {
    const amt = Number(e.amount);
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + amt;
    expensesByCurrency[e.currency] = (expensesByCurrency[e.currency] || 0) + amt;
  });

  return {
    dateRange: { startDate, endDate },
    totalsByCurrency,
    invoiceStatusCounts,
    paymentsCollected: paymentsByCurrency,
    expenses: {
      byCategory: expensesByCategory,
      byCurrency: expensesByCurrency,
      totalCount: expenses.length,
    },
  };
}

export async function getSupportReport(companyId: string) {
  const now = new Date();

  if (!isDatabaseConnected) {
    const tickets = devStore.tickets.filter((t) => t.companyId === companyId && !t.isArchived);
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let overdueCount = 0;
    let resolvedCount = 0;
    let totalResolutionHours = 0;

    tickets.forEach((t) => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

      // Assignee
      const assigneeUser = t.assignedTo ? devStore.users.find((u) => u.id === t.assignedTo) : null;
      const assigneeName = assigneeUser ? assigneeUser.name : 'Unassigned';
      byAssignee[assigneeName] = (byAssignee[assigneeName] || 0) + 1;

      // Category
      const cat = t.categoryId ? devStore.ticketCategories.find((c) => c.id === t.categoryId) : null;
      const catName = cat ? cat.name : 'General';
      byCategory[catName] = (byCategory[catName] || 0) + 1;

      // Overdue check
      if (t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED) {
        if ((t.dueDate && new Date(t.dueDate) < now) || (t.slaDueAt && new Date(t.slaDueAt) < now)) {
          overdueCount++;
        }
      }

      // Resolution time
      if (t.resolvedAt) {
        resolvedCount++;
        const diffMs = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        totalResolutionHours += diffMs / (1000 * 60 * 60);
      }
    });

    const avgResolutionHours =
      resolvedCount > 0 ? Number((totalResolutionHours / resolvedCount).toFixed(1)) : 0;

    return {
      totalTickets: tickets.length,
      openTickets: tickets.filter((t) => t.status === TicketStatus.OPEN).length,
      inProgressTickets: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).length,
      waitingOnCustomer: tickets.filter((t) => t.status === TicketStatus.WAITING_ON_CUSTOMER).length,
      resolvedTickets: resolvedCount,
      overdueTickets: overdueCount,
      averageResolutionHours: avgResolutionHours,
      byStatus,
      byPriority,
      byAssignee,
      byCategory,
    };
  }

  // Database aggregate
  const tickets = await prisma.ticket.findMany({
    where: { companyId, isArchived: false },
    select: {
      status: true,
      priority: true,
      assignedTo: true,
      assignee: { select: { name: true } },
      category: { select: { name: true } },
      dueDate: true,
      slaDueAt: true,
      resolvedAt: true,
      createdAt: true,
    },
  });

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let overdueCount = 0;
  let resolvedCount = 0;
  let totalResolutionHours = 0;

  tickets.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

    const assigneeName = t.assignee?.name ?? 'Unassigned';
    byAssignee[assigneeName] = (byAssignee[assigneeName] || 0) + 1;

    const catName = t.category?.name ?? 'General';
    byCategory[catName] = (byCategory[catName] || 0) + 1;

    if (t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED) {
      if ((t.dueDate && t.dueDate < now) || (t.slaDueAt && t.slaDueAt < now)) {
        overdueCount++;
      }
    }

    if (t.resolvedAt) {
      resolvedCount++;
      const diffMs = t.resolvedAt.getTime() - t.createdAt.getTime();
      totalResolutionHours += diffMs / (1000 * 60 * 60);
    }
  });

  const avgResolutionHours =
    resolvedCount > 0 ? Number((totalResolutionHours / resolvedCount).toFixed(1)) : 0;

  return {
    totalTickets: tickets.length,
    openTickets: byStatus[TicketStatus.OPEN] || 0,
    inProgressTickets: byStatus[TicketStatus.IN_PROGRESS] || 0,
    waitingOnCustomer: byStatus[TicketStatus.WAITING_ON_CUSTOMER] || 0,
    resolvedTickets: resolvedCount,
    overdueTickets: overdueCount,
    averageResolutionHours: avgResolutionHours,
    byStatus,
    byPriority,
    byAssignee,
    byCategory,
  };
}

export const EXPORT_TABLE_TYPES = [
  'leads-table',
  'customers-table',
  'projects-table',
  'invoices-table',
  'payments-table',
  'expenses-table',
  'tickets-table',
  'finance-summary',
] as const;

export type ExportTableType = (typeof EXPORT_TABLE_TYPES)[number];

/** Permission needed to export each table. Administrators hold every permission. */
export const EXPORT_TABLE_PERMISSIONS: Record<ExportTableType, string> = {
  'leads-table': 'leads.view',
  'customers-table': 'customers.view',
  'projects-table': 'projects.view',
  'invoices-table': 'invoices.view',
  'payments-table': 'payments.view',
  'expenses-table': 'expenses.view',
  'tickets-table': 'tickets.view',
  'finance-summary': 'reports.view',
};

const isoDay = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString().split('T')[0] : '';

const money = (value: unknown) => Number(value ?? 0).toFixed(2);

/** The rows behind an export, independent of the file format. Unknown types fall back to the tickets table. */
export async function getExportTable(companyId: string, type: string): Promise<ExportTable> {
  if (type === 'leads-table') {
    const leads = !isDatabaseConnected
      ? devStore.leads.filter((l) => l.companyId === companyId && !l.isArchived)
      : await prisma.lead.findMany({ where: { companyId, isArchived: false } });

    return {
      title: 'Leads',
      headers: ['Lead Name', 'Company', 'Email', 'Phone', 'Status', 'Source', 'Priority', 'Value', 'Currency', 'Created At'],
      numericColumns: [7],
      rows: leads.map((l) => [
        l.name,
        l.companyName ?? '',
        l.email ?? '',
        l.phone ?? '',
        l.status,
        l.source ?? '',
        l.priority,
        Number(l.value ?? 0),
        l.currency,
        isoDay(l.createdAt),
      ]),
    };
  }

  if (type === 'customers-table') {
    const customers = !isDatabaseConnected
      ? devStore.customers.filter((c) => c.companyId === companyId && !c.isArchived)
      : await prisma.customer.findMany({ where: { companyId, isArchived: false } });

    return {
      title: 'Customers',
      headers: ['Name', 'Company', 'Type', 'Email', 'Phone', 'Status', 'Created At'],
      rows: customers.map((c) => [
        c.name,
        c.companyName ?? '',
        c.type,
        c.email ?? '',
        c.phone ?? '',
        c.status,
        isoDay(c.createdAt),
      ]),
    };
  }

  if (type === 'projects-table') {
    const projects = !isDatabaseConnected
      ? devStore.projects
          .filter((p) => p.companyId === companyId && !p.isArchived)
          .map((p) => ({ ...p, customerName: devStore.customers.find((c) => c.id === p.customerId)?.name ?? '' }))
      : await prisma.project
          .findMany({ where: { companyId, isArchived: false }, include: { customer: { select: { name: true } } } })
          .then((res) => res.map((p) => ({ ...p, customerName: p.customer?.name ?? '' })));

    return {
      title: 'Projects',
      headers: ['Project Name', 'Customer', 'Status', 'Priority', 'Progress (%)', 'Start Date', 'Deadline'],
      numericColumns: [4],
      rows: projects.map((p) => [
        p.name,
        p.customerName,
        p.status,
        p.priority,
        p.progress ?? 0,
        isoDay(p.startDate),
        isoDay(p.deadline),
      ]),
    };
  }

  if (type === 'invoices-table') {
    const invoices = !isDatabaseConnected
      ? devStore.invoices
          .filter((i) => i.companyId === companyId && !i.isArchived)
          .map((i) => ({ ...i, customerName: devStore.customers.find((c) => c.id === i.customerId)?.name ?? '' }))
      : await prisma.invoice
          .findMany({ where: { companyId, isArchived: false }, include: { customer: { select: { name: true } } } })
          .then((res) => res.map((i) => ({ ...i, customerName: i.customer.name })));

    return {
      title: 'Invoices',
      headers: ['Invoice Number', 'Customer', 'Status', 'Currency', 'Subtotal', 'Tax', 'Total', 'Amount Paid', 'Balance Due', 'Due Date'],
      numericColumns: [4, 5, 6, 7, 8],
      rows: invoices.map((i) => [
        i.invoiceNumber,
        i.customerName,
        i.status,
        i.currency,
        money(i.subtotal),
        money(i.taxTotal),
        money(i.total),
        money(i.amountPaid),
        (Number(i.total) - Number(i.amountPaid)).toFixed(2),
        isoDay(i.dueDate),
      ]),
    };
  }

  if (type === 'payments-table') {
    const payments = !isDatabaseConnected
      ? devStore.payments
          .map((p) => ({ p, inv: devStore.invoices.find((i) => i.id === p.invoiceId) }))
          .filter(({ inv }) => inv && inv.companyId === companyId)
          .map(({ p, inv }) => ({
            ...p,
            invoiceNumber: inv!.invoiceNumber,
            customerName: devStore.customers.find((c) => c.id === inv!.customerId)?.name ?? '',
          }))
      : await prisma.payment
          .findMany({
            where: { invoice: { companyId } },
            orderBy: { paidAt: 'desc' },
            include: { invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } } },
          })
          .then((res) =>
            res.map((p) => ({
              ...p,
              invoiceNumber: p.invoice.invoiceNumber,
              customerName: p.invoice.customer?.name ?? '',
            }))
          );

    return {
      title: 'Payments',
      headers: ['Invoice', 'Customer', 'Method', 'Reference', 'Amount', 'Currency', 'Paid On', 'Status'],
      numericColumns: [4],
      rows: payments.map((p) => [
        p.invoiceNumber,
        p.customerName,
        String(p.method).replace(/_/g, ' '),
        p.reference ?? '',
        money(p.amount),
        p.currency,
        isoDay(p.paidAt),
        p.isReversed ? 'Reversed' : 'Completed',
      ]),
    };
  }

  if (type === 'expenses-table') {
    const expenses = !isDatabaseConnected
      ? devStore.expenses.filter((e) => e.companyId === companyId)
      : await prisma.expense.findMany({ where: { companyId } });

    return {
      title: 'Expenses',
      headers: ['Title / Description', 'Category', 'Amount', 'Currency', 'Vendor', 'Status', 'Incurred At'],
      numericColumns: [2],
      rows: expenses.map((e) => [
        e.title ?? e.description,
        e.category,
        money(e.amount),
        e.currency,
        e.vendor ?? '',
        e.approvalStatus,
        isoDay(e.incurredAt),
      ]),
    };
  }

  if (type === 'finance-summary') {
    const summary = await getFinancialSummary(companyId);
    return {
      title: 'Finance Summary',
      headers: ['Currency', 'Total Invoiced', 'Total Received', 'Outstanding', 'Overdue', 'Approved Expenses', 'Net (Received - Expenses)'],
      numericColumns: [1, 2, 3, 4, 5, 6],
      rows: Object.entries(summary.currencyMetrics).map(([currency, m]) => [
        currency,
        money(m.totalInvoiced),
        money(m.totalReceived),
        money(m.outstandingBalance),
        money(m.overdueAmount),
        money(m.totalExpenses),
        (m.totalReceived - m.totalExpenses).toFixed(2),
      ]),
    };
  }

  // Support tickets table (default)
  const tickets = !isDatabaseConnected
    ? devStore.tickets
        .filter((t) => t.companyId === companyId && !t.isArchived)
        .map((t) => ({
          ...t,
          assigneeName: (t.assignedTo && devStore.users.find((user) => user.id === t.assignedTo)?.name) || 'Unassigned',
        }))
    : await prisma.ticket
        .findMany({
          where: { companyId, isArchived: false },
          include: { assignee: { select: { name: true } } },
        })
        .then((res) => res.map((t) => ({ ...t, assigneeName: t.assignee?.name ?? 'Unassigned' })));

  return {
    title: 'Support Tickets',
    headers: ['Ticket Number', 'Subject', 'Status', 'Priority', 'Department', 'Assignee', 'Created At', 'Resolved At'],
    rows: tickets.map((t) => [
      t.ticketNumber,
      t.subject,
      t.status,
      t.priority,
      t.department ?? '',
      t.assigneeName,
      isoDay(t.createdAt),
      isoDay(t.resolvedAt),
    ]),
  };
}

export async function exportReportCsv(companyId: string, type: string) {
  const table = await getExportTable(companyId, type);
  return buildCsv(table.headers, table.rows);
}
