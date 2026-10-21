import { Prisma, CustomerType, CustomerStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevCustomer, DevContact, DevNote } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
  CreateContactInput,
  UpdateContactInput,
} from './customers.schema.js';
import crypto from 'node:crypto';

export async function listCustomers(companyId: string, query: ListCustomersQuery) {
  if (!isDatabaseConnected) {
    let list = devStore.customers.filter((c) => c.companyId === companyId);

    if (query.isArchived !== undefined) {
      list = list.filter((c) => c.isArchived === query.isArchived);
    } else {
      list = list.filter((c) => !c.isArchived);
    }

    if (query.type) {
      list = list.filter((c) => c.type === query.type);
    }
    if (query.status) {
      list = list.filter((c) => c.status === query.status);
    }
    if (query.assignedToId) {
      list = list.filter((c) => c.assignedToId === query.assignedToId);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.companyName && c.companyName.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    // Sort
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    list.sort((a: any, b: any) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const total = list.length;
    const paginated = list.slice((page - 1) * limit, page * limit);

    const formatted = paginated.map((c) => {
      const assignedUser = c.assignedToId
        ? devStore.users.find((u) => u.id === c.assignedToId)
        : null;
      const contacts = devStore.contacts.filter((ct) => ct.customerId === c.id);
      const primaryContact = contacts.find((ct) => ct.isPrimary) || contacts[0] || null;

      return {
        ...c,
        assignedTo: assignedUser ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email } : null,
        contactsCount: contacts.length,
        primaryContact: primaryContact ? { id: primaryContact.id, name: primaryContact.name, email: primaryContact.email, phone: primaryContact.phone } : null,
      };
    });

    return {
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = {
    companyId,
    ...(query.isArchived !== undefined
      ? { isArchived: query.isArchived }
      : { isArchived: false }),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { companyName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true, isPrimary: true },
        },
        _count: {
          select: { contacts: true, activities: true, notes: true, leads: true },
        },
      },
    }),
  ]);

  const formatted = items.map((item) => ({
    ...item,
    primaryContact: item.contacts.find((ct) => ct.isPrimary) || item.contacts[0] || null,
    contactsCount: item._count.contacts,
  }));

  return {
    data: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getCustomerById(companyId: string, customerId: string) {
  if (!isDatabaseConnected) {
    const customer = devStore.customers.find(
      (c) => c.companyId === companyId && c.id === customerId
    );
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
    }

    const assignedUser = customer.assignedToId
      ? devStore.users.find((u) => u.id === customer.assignedToId)
      : null;
    const contacts = devStore.contacts.filter((ct) => ct.customerId === customer.id);
    const notes = devStore.notes
      .filter((n) => n.customerId === customer.id)
      .map((n) => {
        const author = devStore.users.find((u) => u.id === n.authorId);
        return {
          ...n,
          author: author ? { id: author.id, name: author.name, email: author.email } : null,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const activities = devStore.activities
      .filter((a) => a.customerId === customer.id)
      .map((a) => {
        const assigned = a.assignedToId
          ? devStore.users.find((u) => u.id === a.assignedToId)
          : null;
        return {
          ...a,
          assignedTo: assigned ? { id: assigned.id, name: assigned.name } : null,
        };
      })
      .sort((a, b) => (b.dueDate?.getTime() || 0) - (a.dueDate?.getTime() || 0));

    const relatedLeads = devStore.leads
      .filter((l) => l.convertedToId === customer.id)
      .map((l) => ({
        id: l.id,
        name: l.name,
        companyName: l.companyName,
        value: l.value,
        convertedAt: l.convertedAt,
      }));

    return {
      ...customer,
      assignedTo: assignedUser ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email } : null,
      contacts,
      notes,
      activities,
      relatedLeads,
    };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      notes: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
      leads: {
        where: { convertedToId: customerId },
        select: { id: true, name: true, companyName: true, value: true, convertedAt: true },
      },
    },
  });

  if (!customer) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
  }

  return {
    ...customer,
    relatedLeads: customer.leads,
  };
}

export async function createCustomer(
  companyId: string,
  actorId: string,
  input: CreateCustomerInput
) {
  // Validate duplicate sensible check (email within company)
  if (input.email) {
    if (!isDatabaseConnected) {
      const existing = devStore.customers.find(
        (c) => c.companyId === companyId && c.email?.toLowerCase() === input.email?.toLowerCase()
      );
      if (existing) {
        throw new AppError(
          409,
          'DUPLICATE_CUSTOMER',
          `A customer with email ${input.email} already exists.`
        );
      }
    } else {
      const existing = await prisma.customer.findFirst({
        where: { companyId, email: { equals: input.email, mode: 'insensitive' } },
      });
      if (existing) {
        throw new AppError(
          409,
          'DUPLICATE_CUSTOMER',
          `A customer with email ${input.email} already exists.`
        );
      }
    }
  }

  if (!isDatabaseConnected) {
    const customerId = crypto.randomUUID();
    const newCustomer: DevCustomer = {
      id: customerId,
      companyId,
      type: input.type,
      name: input.name,
      companyName: input.type === CustomerType.COMPANY ? (input.companyName || input.name) : null,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      country: input.country || null,
      zipCode: input.zipCode || null,
      taxId: input.taxId || null,
      status: input.status,
      isArchived: false,
      assignedToId: input.assignedToId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    devStore.customers.push(newCustomer);

    // Initial contact
    if (input.initialContact) {
      const newContact: DevContact = {
        id: crypto.randomUUID(),
        customerId,
        name: input.initialContact.name,
        email: input.initialContact.email || null,
        phone: input.initialContact.phone || null,
        title: input.initialContact.title || null,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devStore.contacts.push(newContact);
    } else if (input.type === CustomerType.INDIVIDUAL) {
      // Auto-create contact from individual customer details
      const newContact: DevContact = {
        id: crypto.randomUUID(),
        customerId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        title: 'Primary Contact',
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devStore.contacts.push(newContact);
    }

    // Initial note
    if (input.initialNote) {
      const newNote: DevNote = {
        id: crypto.randomUUID(),
        companyId,
        authorId: actorId,
        body: input.initialNote,
        customerId,
        leadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devStore.notes.push(newNote);
    }

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { name: newCustomer.name, type: newCustomer.type },
    });

    return getCustomerById(companyId, customerId);
  }

  const created = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        companyId,
        type: input.type,
        name: input.name,
        companyName: input.type === CustomerType.COMPANY ? (input.companyName || input.name) : null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        country: input.country || null,
        zipCode: input.zipCode || null,
        taxId: input.taxId || null,
        status: input.status,
        assignedToId: input.assignedToId || null,
        contacts: input.initialContact
          ? {
              create: {
                name: input.initialContact.name,
                email: input.initialContact.email || null,
                phone: input.initialContact.phone || null,
                title: input.initialContact.title || null,
                isPrimary: true,
              },
            }
          : input.type === CustomerType.INDIVIDUAL
          ? {
              create: {
                name: input.name,
                email: input.email || null,
                phone: input.phone || null,
                title: 'Primary Contact',
                isPrimary: true,
              },
            }
          : undefined,
        notes: input.initialNote
          ? {
              create: {
                companyId,
                authorId: actorId,
                body: input.initialNote,
              },
            }
          : undefined,
      },
      include: {
        contacts: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return customer;
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CUSTOMER_CREATED',
    entityType: 'Customer',
    entityId: created.id,
    metadata: { name: created.name, type: created.type },
  });

  return getCustomerById(companyId, created.id);
}

export async function updateCustomer(
  companyId: string,
  actorId: string,
  customerId: string,
  input: UpdateCustomerInput
) {
  if (!isDatabaseConnected) {
    const index = devStore.customers.findIndex(
      (c) => c.companyId === companyId && c.id === customerId
    );
    if (index === -1) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
    }

    if (input.email && input.email !== devStore.customers[index].email) {
      const duplicate = devStore.customers.find(
        (c) => c.companyId === companyId && c.id !== customerId && c.email?.toLowerCase() === input.email?.toLowerCase()
      );
      if (duplicate) {
        throw new AppError(409, 'DUPLICATE_CUSTOMER', `Customer email ${input.email} is already in use.`);
      }
    }

    const current = devStore.customers[index];
    const updated: DevCustomer = {
      ...current,
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.zipCode !== undefined ? { zipCode: input.zipCode } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      updatedAt: new Date(),
    };

    devStore.customers[index] = updated;

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CUSTOMER_UPDATED',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { changes: Object.keys(input) },
    });

    return getCustomerById(companyId, customerId);
  }

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        companyId,
        id: { not: customerId },
        email: { equals: input.email, mode: 'insensitive' },
      },
    });
    if (duplicate) {
      throw new AppError(409, 'DUPLICATE_CUSTOMER', `Customer email ${input.email} is already in use.`);
    }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.zipCode !== undefined ? { zipCode: input.zipCode } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
    },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CUSTOMER_UPDATED',
    entityType: 'Customer',
    entityId: customerId,
    metadata: { changes: Object.keys(input) },
  });

  return getCustomerById(companyId, customerId);
}

export async function archiveCustomer(companyId: string, actorId: string, customerId: string) {
  if (!isDatabaseConnected) {
    const customer = devStore.customers.find((c) => c.companyId === companyId && c.id === customerId);
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
    }
    customer.isArchived = true;
    customer.updatedAt = new Date();

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CUSTOMER_ARCHIVED',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { name: customer.name },
    });

    return { success: true, message: 'Customer archived successfully' };
  }

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { isArchived: true },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CUSTOMER_ARCHIVED',
    entityType: 'Customer',
    entityId: customerId,
    metadata: { name: existing.name },
  });

  return { success: true, message: 'Customer archived successfully' };
}

export async function restoreCustomer(companyId: string, actorId: string, customerId: string) {
  if (!isDatabaseConnected) {
    const customer = devStore.customers.find((c) => c.companyId === companyId && c.id === customerId);
    if (!customer) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
    }
    customer.isArchived = false;
    customer.updatedAt = new Date();

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CUSTOMER_RESTORED',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { name: customer.name },
    });

    return { success: true, message: 'Customer restored successfully' };
  }

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { isArchived: false },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CUSTOMER_RESTORED',
    entityType: 'Customer',
    entityId: customerId,
    metadata: { name: existing.name },
  });

  return { success: true, message: 'Customer restored successfully' };
}

export async function deleteCustomer(companyId: string, actorId: string, customerId: string) {
  if (!isDatabaseConnected) {
    const index = devStore.customers.findIndex((c) => c.companyId === companyId && c.id === customerId);
    if (index === -1) {
      throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
    }
    const [deleted] = devStore.customers.splice(index, 1);
    devStore.contacts = devStore.contacts.filter((ct) => ct.customerId !== customerId);

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CUSTOMER_DELETED',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { name: deleted.name },
    });

    return { success: true, message: 'Customer deleted successfully' };
  }

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });
  if (!existing) {
    throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer record not found');
  }

  await prisma.customer.delete({
    where: { id: customerId },
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CUSTOMER_DELETED',
    entityType: 'Customer',
    entityId: customerId,
    metadata: { name: existing.name },
  });

  return { success: true, message: 'Customer deleted successfully' };
}

// Contacts Management
export async function addContact(
  companyId: string,
  actorId: string,
  customerId: string,
  input: CreateContactInput
) {
  const customer = await getCustomerById(companyId, customerId);

  if (!isDatabaseConnected) {
    if (input.isPrimary) {
      devStore.contacts
        .filter((ct) => ct.customerId === customerId)
        .forEach((ct) => {
          ct.isPrimary = false;
        });
    }

    const contact: DevContact = {
      id: crypto.randomUUID(),
      customerId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      title: input.title || null,
      isPrimary: input.isPrimary,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    devStore.contacts.push(contact);

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CONTACT_CREATED',
      entityType: 'Contact',
      entityId: contact.id,
      metadata: { customerId, name: contact.name },
    });

    return contact;
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.contact.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }

    return tx.contact.create({
      data: {
        customerId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        title: input.title || null,
        isPrimary: input.isPrimary,
      },
    });
  });

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CONTACT_CREATED',
    entityType: 'Contact',
    entityId: contact.id,
    metadata: { customerId, name: contact.name },
  });

  return contact;
}

export async function updateContact(
  companyId: string,
  actorId: string,
  customerId: string,
  contactId: string,
  input: UpdateContactInput
) {
  await getCustomerById(companyId, customerId);

  if (!isDatabaseConnected) {
    const contact = devStore.contacts.find((ct) => ct.customerId === customerId && ct.id === contactId);
    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact record not found');
    }

    if (input.isPrimary) {
      devStore.contacts
        .filter((ct) => ct.customerId === customerId && ct.id !== contactId)
        .forEach((ct) => {
          ct.isPrimary = false;
        });
    }

    if (input.name !== undefined) contact.name = input.name;
    if (input.email !== undefined) contact.email = input.email || null;
    if (input.phone !== undefined) contact.phone = input.phone || null;
    if (input.title !== undefined) contact.title = input.title || null;
    if (input.isPrimary !== undefined) contact.isPrimary = input.isPrimary;
    contact.updatedAt = new Date();

    return contact;
  }

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, customerId },
  });
  if (!existing) {
    throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact record not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.contact.updateMany({
        where: { customerId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    return tx.contact.update({
      where: { id: contactId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.title !== undefined ? { title: input.title || null } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      },
    });
  });

  return updated;
}

export async function deleteContact(
  companyId: string,
  actorId: string,
  customerId: string,
  contactId: string
) {
  await getCustomerById(companyId, customerId);

  if (!isDatabaseConnected) {
    const index = devStore.contacts.findIndex((ct) => ct.customerId === customerId && ct.id === contactId);
    if (index === -1) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact record not found');
    }
    const [deleted] = devStore.contacts.splice(index, 1);

    // If deleted contact was primary, pick another contact as primary if available
    if (deleted.isPrimary) {
      const remaining = devStore.contacts.find((ct) => ct.customerId === customerId);
      if (remaining) remaining.isPrimary = true;
    }

    await recordAuditLog({
      companyId,
      actorId,
      action: 'CONTACT_DELETED',
      entityType: 'Contact',
      entityId: contactId,
      metadata: { customerId, name: deleted.name },
    });

    return { success: true, message: 'Contact deleted successfully' };
  }

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, customerId },
  });
  if (!existing) {
    throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact record not found');
  }

  await prisma.contact.delete({
    where: { id: contactId },
  });

  // If deleted was primary, promote earliest created contact
  if (existing.isPrimary) {
    const nextPrimary = await prisma.contact.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    if (nextPrimary) {
      await prisma.contact.update({
        where: { id: nextPrimary.id },
        data: { isPrimary: true },
      });
    }
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CONTACT_DELETED',
    entityType: 'Contact',
    entityId: contactId,
    metadata: { customerId, name: existing.name },
  });

  return { success: true, message: 'Contact deleted successfully' };
}

// Add Note to Customer
export async function addCustomerNote(
  companyId: string,
  actorId: string,
  customerId: string,
  body: string
) {
  await getCustomerById(companyId, customerId);

  if (!isDatabaseConnected) {
    const note: DevNote = {
      id: crypto.randomUUID(),
      companyId,
      authorId: actorId,
      body,
      customerId,
      leadId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.notes.push(note);
    const author = devStore.users.find((u) => u.id === actorId);

    return {
      ...note,
      author: author ? { id: author.id, name: author.name, email: author.email } : null,
    };
  }

  const note = await prisma.note.create({
    data: {
      companyId,
      authorId: actorId,
      customerId,
      body,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return note;
}
