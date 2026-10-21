import { describe, it, expect, beforeEach } from 'vitest';
import * as customersService from '../src/modules/customers/customers.service.js';
import { CustomerType, CustomerStatus } from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';

describe('Customers & Contacts Service', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;

  beforeEach(() => {
    // Reset test customers
    devStore.customers = [];
    devStore.contacts = [];
    devStore.notes = [];
  });

  it('creates a company customer with initial contact and note', async () => {
    const customer = await customersService.createCustomer(companyId, adminId, {
      type: CustomerType.COMPANY,
      name: 'Acme Enterprise Solutions',
      companyName: 'Acme Global Corp',
      email: 'contact@acmeglobal.com',
      phone: '+1-555-0199',
      website: 'https://acmeglobal.com',
      taxId: 'US-EIN-998877',
      status: CustomerStatus.ACTIVE,
      initialContact: {
        name: 'John Doe',
        email: 'johndoe@acmeglobal.com',
        phone: '+1-555-0123',
        title: 'Chief Technology Officer',
        isPrimary: true,
      },
      initialNote: 'Key enterprise account established during Q4 enterprise drive.',
    });

    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.name).toBe('Acme Enterprise Solutions');
    expect(customer.type).toBe(CustomerType.COMPANY);
    expect(customer.contacts).toHaveLength(1);
    expect(customer.contacts[0].name).toBe('John Doe');
    expect(customer.contacts[0].isPrimary).toBe(true);
    expect(customer.notes).toHaveLength(1);
    expect(customer.notes[0].body).toContain('Key enterprise account');
  });

  it('rejects duplicate customer email within the same company', async () => {
    await customersService.createCustomer(companyId, adminId, {
      type: CustomerType.COMPANY,
      name: 'First Corp',
      email: 'unique@corp.com',
      status: CustomerStatus.ACTIVE,
    });

    await expect(
      customersService.createCustomer(companyId, adminId, {
        type: CustomerType.COMPANY,
        name: 'Second Corp',
        email: 'unique@corp.com',
        status: CustomerStatus.ACTIVE,
      })
    ).rejects.toThrow('already exists');
  });

  it('creates individual customer and auto-creates primary contact', async () => {
    const customer = await customersService.createCustomer(companyId, adminId, {
      type: CustomerType.INDIVIDUAL,
      name: 'Dr. Jane Smith',
      email: 'dr.jane@smithconsulting.org',
      phone: '+44-20-7946-0958',
      status: CustomerStatus.ACTIVE,
    });

    expect(customer.type).toBe(CustomerType.INDIVIDUAL);
    expect(customer.contacts).toHaveLength(1);
    expect(customer.contacts[0].name).toBe('Dr. Jane Smith');
    expect(customer.contacts[0].isPrimary).toBe(true);
  });

  it('archives and restores a customer', async () => {
    const customer = await customersService.createCustomer(companyId, adminId, {
      type: CustomerType.COMPANY,
      name: 'Archivable Corp',
      email: 'archive@corp.com',
      status: CustomerStatus.ACTIVE,
    });

    const archiveRes = await customersService.archiveCustomer(companyId, adminId, customer.id);
    expect(archiveRes.success).toBe(true);

    const activeList = await customersService.listCustomers(companyId, { page: 1, limit: 20, isArchived: false } as any);
    expect(activeList.data.some((c) => c.id === customer.id)).toBe(false);

    const archivedList = await customersService.listCustomers(companyId, { page: 1, limit: 20, isArchived: true } as any);
    expect(archivedList.data.some((c) => c.id === customer.id)).toBe(true);

    const restoreRes = await customersService.restoreCustomer(companyId, adminId, customer.id);
    expect(restoreRes.success).toBe(true);

    const restoredList = await customersService.listCustomers(companyId, { page: 1, limit: 20, isArchived: false } as any);
    expect(restoredList.data.some((c) => c.id === customer.id)).toBe(true);
  });

  it('manages multiple contacts and ensures single primary contact', async () => {
    const customer = await customersService.createCustomer(companyId, adminId, {
      type: CustomerType.COMPANY,
      name: 'Multi-Contact Corp',
      status: CustomerStatus.ACTIVE,
    });

    const contact1 = await customersService.addContact(companyId, adminId, customer.id, {
      name: 'Primary Contact',
      email: 'c1@corp.com',
      isPrimary: true,
    });

    const contact2 = await customersService.addContact(companyId, adminId, customer.id, {
      name: 'Secondary Contact',
      email: 'c2@corp.com',
      isPrimary: false,
    });

    expect(contact1.isPrimary).toBe(true);
    expect(contact2.isPrimary).toBe(false);

    // Promote contact 2 to primary
    await customersService.updateContact(companyId, adminId, customer.id, contact2.id, {
      isPrimary: true,
    });

    const refreshed = await customersService.getCustomerById(companyId, customer.id);
    const updatedC1 = refreshed.contacts.find((c) => c.id === contact1.id);
    const updatedC2 = refreshed.contacts.find((c) => c.id === contact2.id);

    expect(updatedC1?.isPrimary).toBe(false);
    expect(updatedC2?.isPrimary).toBe(true);
  });
});
