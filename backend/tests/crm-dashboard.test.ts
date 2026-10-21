import { describe, it, expect, beforeEach } from 'vitest';
import * as crmDashboardService from '../src/modules/crm-dashboard/crm-dashboard.service.js';
import * as leadsService from '../src/modules/leads/leads.service.js';
import * as customersService from '../src/modules/customers/customers.service.js';
import * as activitiesService from '../src/modules/activities/activities.service.js';
import { LeadStatus, CustomerType, ActivityType } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';

describe('CRM Dashboard Aggregation Service', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;

  beforeEach(() => {
    devStore.leads = [];
    devStore.customers = [];
    devStore.contacts = [];
    devStore.activities = [];
  });

  it('calculates real dashboard KPI metrics, conversion rate, and status breakdown', async () => {
    // 1. Create 3 leads
    const lead1 = await leadsService.createLead(companyId, adminId, {
      name: 'Lead Alpha',
      value: 50000,
      status: LeadStatus.NEW,
      source: 'Website Form',
    });

    const lead2 = await leadsService.createLead(companyId, adminId, {
      name: 'Lead Beta',
      value: 75000,
      status: LeadStatus.QUALIFIED,
      source: 'LinkedIn Campaign',
    });

    const lead3 = await leadsService.createLead(companyId, adminId, {
      name: 'Lead Gamma',
      value: 100000,
      status: LeadStatus.PROPOSAL,
      source: 'Referral',
    });

    // 2. Convert 1 lead into customer
    await leadsService.convertLead(companyId, adminId, lead1.id, {
      customerType: CustomerType.COMPANY,
      customerName: 'Alpha Corp',
    });

    // 3. Create 1 standalone customer
    await customersService.createCustomer(companyId, adminId, {
      type: CustomerType.INDIVIDUAL,
      name: 'Dr. Individual Customer',
    });

    // 4. Create 1 upcoming and 1 overdue activity
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.FOLLOW_UP,
      subject: 'Upcoming Call',
      dueDate: tomorrow.toISOString(),
    });

    await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.CALL,
      subject: 'Overdue Follow-up',
      dueDate: yesterday.toISOString(),
    });

    // Fetch dashboard metrics
    const metrics = await crmDashboardService.getCrmDashboardMetrics(companyId, 30);

    // Active leads = lead2 + lead3 (lead1 is WON so not in active pipeline)
    expect(metrics.totalActiveLeads).toBe(2);
    expect(metrics.newLeadsInPeriod).toBe(3);
    expect(metrics.totalCustomers).toBe(2);
    expect(metrics.companyCustomers).toBe(1);
    expect(metrics.individualCustomers).toBe(1);
    expect(metrics.convertedLeads).toBe(1);
    // 1 converted out of 3 total leads = 33.3%
    expect(metrics.conversionRate).toBe(33.3);
    expect(metrics.upcomingFollowUps).toBe(1);
    expect(metrics.overdueFollowUps).toBe(1);
    expect(metrics.totalPipelineValue).toBe(175000); // 75000 + 100000
    expect(metrics.recentLeads).toHaveLength(3);
    expect(metrics.recentActivities).toHaveLength(2);
  });
});
