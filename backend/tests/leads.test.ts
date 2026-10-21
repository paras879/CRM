import { describe, it, expect, beforeEach } from 'vitest';
import * as leadsService from '../src/modules/leads/leads.service.js';
import * as activitiesService from '../src/modules/activities/activities.service.js';
import { LeadStatus, LeadPriority, CustomerType, ActivityType } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { seedTestUsers } from './helpers/fixtures.js';

seedTestUsers();
describe('Leads Management & Conversion Service', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;
  const managerId = devStore.users[1].id;

  beforeEach(() => {
    devStore.leads = [];
    devStore.customers = [];
    devStore.contacts = [];
    devStore.activities = [];
    devStore.notes = [];
  });

  it('creates and filters leads with configurable status and priority', async () => {
    const lead = await leadsService.createLead(companyId, adminId, {
      name: 'Robert Stark',
      companyName: 'Winterfell Logistics',
      email: 'robert@winterfell.org',
      phone: '+1-555-7788',
      value: 125000,
      currency: 'INR',
      status: LeadStatus.NEW,
      priority: LeadPriority.HIGH,
      source: 'LinkedIn Campaign',
      initialNote: 'Introduced via inbound lead magnet.',
    });

    expect(lead).toBeDefined();
    expect(lead.id).toBeDefined();
    expect(lead.companyName).toBe('Winterfell Logistics');
    expect(lead.priority).toBe(LeadPriority.HIGH);
    expect(lead.notes).toHaveLength(1);

    const list = await leadsService.listLeads(companyId, {
      page: 1,
      limit: 20,
      priority: LeadPriority.HIGH,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    } as any);

    expect(list.data).toHaveLength(1);
    expect(list.data[0].id).toBe(lead.id);
  });

  it('assigns a lead to another user', async () => {
    const lead = await leadsService.createLead(companyId, adminId, {
      name: 'Elena Rostova',
      email: 'elena@rostova.com',
      ownerId: adminId,
    });

    const updated = await leadsService.assignLead(companyId, adminId, lead.id, managerId);
    expect(updated.ownerId).toBe(managerId);
    expect(updated.owner?.id).toBe(managerId);
  });

  it('atomically converts a lead into a customer and contact and links activities', async () => {
    const lead = await leadsService.createLead(companyId, adminId, {
      name: 'Michael Scott',
      companyName: 'Dunder Mifflin Paper Co',
      email: 'michael@dundermifflin.com',
      phone: '+1-555-9000',
      value: 45000,
      status: LeadStatus.QUALIFIED,
    });

    // Create an activity linked to this lead
    const activity = await activitiesService.createActivity(companyId, adminId, {
      type: ActivityType.MEETING,
      subject: 'Final Proposal Presentation',
      leadId: lead.id,
      dueDate: new Date().toISOString(),
    });

    // Convert lead
    const conversion = await leadsService.convertLead(companyId, adminId, lead.id, {
      customerType: CustomerType.COMPANY,
      companyName: 'Dunder Mifflin Inc',
      customerName: 'Dunder Mifflin Paper Co',
      contactName: 'Michael G. Scott',
      contactTitle: 'Regional Manager',
    });

    expect(conversion.message).toBe('Lead converted successfully');
    expect(conversion.customer).toBeDefined();
    expect(conversion.customer.name).toBe('Dunder Mifflin Paper Co');
    expect(conversion.contact.name).toBe('Michael G. Scott');
    expect(conversion.contact.isPrimary).toBe(true);

    // Verify lead status is updated to WON and references customer
    const refreshedLead = await leadsService.getLeadById(companyId, lead.id);
    expect(refreshedLead.status).toBe(LeadStatus.WON);
    expect(refreshedLead.convertedToId).toBe(conversion.customer.id);
    expect(refreshedLead.convertedContactId).toBe(conversion.contact.id);
    expect(refreshedLead.convertedAt).toBeDefined();

    // Verify activity is linked to new customer as well
    const refreshedActivity = await activitiesService.getActivityById(companyId, activity.id);
    expect(refreshedActivity.customerId).toBe(conversion.customer.id);
    expect(refreshedActivity.leadId).toBe(lead.id);
  });

  it('strictly prevents duplicate conversion of an already-converted lead', async () => {
    const lead = await leadsService.createLead(companyId, adminId, {
      name: 'Bruce Wayne',
      companyName: 'Wayne Enterprises',
      email: 'bruce@wayne.corp',
    });

    await leadsService.convertLead(companyId, adminId, lead.id, {
      customerType: CustomerType.COMPANY,
    });

    // Attempting second conversion must fail with conflict error
    await expect(
      leadsService.convertLead(companyId, adminId, lead.id, {
        customerType: CustomerType.COMPANY,
      })
    ).rejects.toThrow('already been converted');
  });
});
