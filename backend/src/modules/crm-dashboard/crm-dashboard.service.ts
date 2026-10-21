import { LeadStatus, ActivityStatus, CustomerType } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';

export interface CrmDashboardRange {
  start: Date;
  /** Inclusive: the whole of this day is counted. */
  end: Date;
}

/** `range` (a custom start and end date) takes priority over `daysFilter` (the last N days, 0 = all time). */
export async function getCrmDashboardMetrics(companyId: string, daysFilter = 30, range?: CrmDashboardRange) {
  const now = new Date();
  const periodStart = range
    ? range.start
    : daysFilter > 0
    ? new Date(now.getTime() - daysFilter * 24 * 60 * 60 * 1000)
    : new Date(0);
  const periodEnd = range ? range.end : now;
  const periodDaysValue = range ? 0 : daysFilter;

  if (!isDatabaseConnected) {
    const leads = devStore.leads.filter((l) => l.companyId === companyId);
    const customers = devStore.customers.filter((c) => c.companyId === companyId);
    const activities = devStore.activities.filter((a) => a.companyId === companyId);
    const sources = devStore.leadSources.filter((s) => s.companyId === companyId);

    // Active leads (not archived, not WON or LOST)
    const activeLeads = leads.filter(
      (l) => !l.isArchived && l.status !== LeadStatus.WON && l.status !== LeadStatus.LOST
    );

    // New leads in period
    const newLeadsInPeriod = leads.filter(
      (l) => !l.isArchived && l.createdAt >= periodStart && l.createdAt <= periodEnd
    );

    // Customers
    const activeCustomers = customers.filter((c) => !c.isArchived);
    const companyCustomers = activeCustomers.filter((c) => c.type === CustomerType.COMPANY).length;
    const individualCustomers = activeCustomers.filter((c) => c.type === CustomerType.INDIVIDUAL).length;

    // Conversion
    const totalLeadsCount = leads.length;
    const convertedLeads = leads.filter((l) => l.convertedToId !== null).length;
    const conversionRate = totalLeadsCount > 0 ? Number(((convertedLeads / totalLeadsCount) * 100).toFixed(1)) : 0;

    // Follow-ups & Activities
    const upcomingFollowUps = activities.filter(
      (a) => a.status === ActivityStatus.PENDING && a.dueDate && a.dueDate >= now
    ).length;

    const overdueFollowUps = activities.filter(
      (a) => a.status === ActivityStatus.PENDING && a.dueDate && a.dueDate < now
    ).length;

    // Total Pipeline Value
    const totalPipelineValue = activeLeads.reduce((acc, l) => acc + (l.value || 0), 0);

    // Recent Leads (last 5)
    const recentLeads = [...leads]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((l) => {
        const owner = l.ownerId ? devStore.users.find((u) => u.id === l.ownerId) : null;
        return {
          id: l.id,
          name: l.name,
          companyName: l.companyName,
          value: l.value,
          currency: l.currency,
          status: l.status,
          priority: l.priority,
          createdAt: l.createdAt,
          ownerName: owner?.name || 'Unassigned',
        };
      });

    // Recent Activities (last 6)
    const recentActivities = [...activities]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6)
      .map((a) => {
        const assigned = a.assignedToId ? devStore.users.find((u) => u.id === a.assignedToId) : null;
        const customer = a.customerId ? devStore.customers.find((c) => c.id === a.customerId) : null;
        const lead = a.leadId ? devStore.leads.find((l) => l.id === a.leadId) : null;
        return {
          id: a.id,
          subject: a.subject,
          type: a.type,
          status: a.status,
          dueDate: a.dueDate,
          createdAt: a.createdAt,
          assignedToName: assigned?.name || null,
          relatedName: customer?.name || lead?.name || null,
        };
      });

    // Status Distribution
    const statusMap = new Map<string, number>();
    Object.values(LeadStatus).forEach((st) => statusMap.set(st, 0));
    leads.forEach((l) => {
      statusMap.set(l.status, (statusMap.get(l.status) || 0) + 1);
    });
    const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: totalLeadsCount > 0 ? Math.round((count / totalLeadsCount) * 100) : 0,
    }));

    // Source Breakdown
    const sourceMap = new Map<string, number>();
    leads.forEach((l) => {
      const srcName = l.source || 'Other / Direct';
      sourceMap.set(srcName, (sourceMap.get(srcName) || 0) + 1);
    });
    const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, count]) => ({
      source,
      count,
      percentage: totalLeadsCount > 0 ? Math.round((count / totalLeadsCount) * 100) : 0,
    }));

    return {
      periodDays: periodDaysValue,
      period: range ? { from: range.start.toISOString(), to: range.end.toISOString() } : null,
      totalActiveLeads: activeLeads.length,
      newLeadsInPeriod: newLeadsInPeriod.length,
      totalCustomers: activeCustomers.length,
      companyCustomers,
      individualCustomers,
      convertedLeads,
      conversionRate,
      upcomingFollowUps,
      overdueFollowUps,
      totalPipelineValue,
      recentLeads,
      recentActivities,
      statusDistribution,
      sourceBreakdown,
    };
  }

  // Database connected via Prisma
  const [
    totalLeadsCount,
    activeLeadsCount,
    newLeadsInPeriodCount,
    totalCustomersCount,
    companyCustomersCount,
    individualCustomersCount,
    convertedLeadsCount,
    upcomingFollowUpsCount,
    overdueFollowUpsCount,
    pipelineValueAggregate,
    recentLeadsData,
    recentActivitiesData,
    leadStatusesGroup,
    leadSourcesGroup,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({
      where: {
        companyId,
        isArchived: false,
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      },
    }),
    prisma.lead.count({
      where: {
        companyId,
        isArchived: false,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.customer.count({ where: { companyId, isArchived: false } }),
    prisma.customer.count({ where: { companyId, isArchived: false, type: CustomerType.COMPANY } }),
    prisma.customer.count({ where: { companyId, isArchived: false, type: CustomerType.INDIVIDUAL } }),
    prisma.lead.count({ where: { companyId, convertedToId: { not: null } } }),
    prisma.activity.count({
      where: { companyId, status: ActivityStatus.PENDING, dueDate: { gte: now } },
    }),
    prisma.activity.count({
      where: { companyId, status: ActivityStatus.PENDING, dueDate: { lt: now } },
    }),
    prisma.lead.aggregate({
      where: {
        companyId,
        isArchived: false,
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
      },
      _sum: { value: true },
    }),
    prisma.lead.findMany({
      where: { companyId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { owner: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { companyId },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { name: true } },
        customer: { select: { name: true } },
        lead: { select: { name: true } },
      },
    }),
    prisma.lead.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { status: true },
    }),
    prisma.lead.groupBy({
      by: ['source'],
      where: { companyId },
      _count: { source: true },
    }),
  ]);

  const conversionRate = totalLeadsCount > 0 ? Number(((convertedLeadsCount / totalLeadsCount) * 100).toFixed(1)) : 0;

  const statusDistribution = leadStatusesGroup.map((g) => ({
    status: g.status,
    count: g._count.status,
    percentage: totalLeadsCount > 0 ? Math.round((g._count.status / totalLeadsCount) * 100) : 0,
  }));

  const sourceBreakdown = leadSourcesGroup.map((g) => ({
    source: g.source || 'Other / Direct',
    count: g._count.source,
    percentage: totalLeadsCount > 0 ? Math.round((g._count.source / totalLeadsCount) * 100) : 0,
  }));

  return {
    periodDays: periodDaysValue,
      period: range ? { from: range.start.toISOString(), to: range.end.toISOString() } : null,
    totalActiveLeads: activeLeadsCount,
    newLeadsInPeriod: newLeadsInPeriodCount,
    totalCustomers: totalCustomersCount,
    companyCustomers: companyCustomersCount,
    individualCustomers: individualCustomersCount,
    convertedLeads: convertedLeadsCount,
    conversionRate,
    upcomingFollowUps: upcomingFollowUpsCount,
    overdueFollowUps: overdueFollowUpsCount,
    totalPipelineValue: pipelineValueAggregate._sum.value ? Number(pipelineValueAggregate._sum.value) : 0,
    recentLeads: recentLeadsData.map((l) => ({
      id: l.id,
      name: l.name,
      companyName: l.companyName,
      value: l.value ? Number(l.value) : null,
      currency: l.currency,
      status: l.status,
      priority: l.priority,
      createdAt: l.createdAt,
      ownerName: l.owner?.name || 'Unassigned',
    })),
    recentActivities: recentActivitiesData.map((a) => ({
      id: a.id,
      subject: a.subject,
      type: a.type,
      status: a.status,
      dueDate: a.dueDate,
      createdAt: a.createdAt,
      assignedToName: a.assignedTo?.name || null,
      relatedName: a.customer?.name || a.lead?.name || null,
    })),
    statusDistribution,
    sourceBreakdown,
  };
}
