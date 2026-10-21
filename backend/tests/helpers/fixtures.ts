import crypto from 'node:crypto';
import {
  CustomerStatus,
  CustomerType,
  ProjectStatus,
  TaskPriority,
  TicketPriority,
  TicketStatus,
  UserStatus,
  ArticleStatus,
} from '@prisma/client';
import { devStore, DevCustomer, DevProject, DevTicket, DevKBArticle, DevUser } from '../../src/config/dev-store.js';

/**
 * Test-only fixtures. The application itself ships with no sample records, so every test that
 * needs a customer, project, ticket or extra staff member creates it here, in memory.
 */

const ROLE_IDS = {
  manager: '10000000-0000-0000-0000-000000000002',
  finance: '10000000-0000-0000-0000-000000000004',
  support: '10000000-0000-0000-0000-000000000005',
};

export const TEST_USER_IDS = {
  admin: '20000000-0000-0000-0000-000000000001',
  manager: '20000000-0000-0000-0000-000000000002',
  finance: '20000000-0000-0000-0000-000000000003',
  support: '20000000-0000-0000-0000-000000000004',
};

/** Adds manager, finance and support staff after the built-in administrator (users[1..3]). */
export function seedTestUsers(): DevUser[] {
  const now = new Date();
  const staff: Array<[string, string, string, string]> = [
    [TEST_USER_IDS.manager, 'Test Manager', 'manager@test.local', ROLE_IDS.manager],
    [TEST_USER_IDS.finance, 'Test Finance', 'finance@test.local', ROLE_IDS.finance],
    [TEST_USER_IDS.support, 'Test Support', 'support@test.local', ROLE_IDS.support],
  ];
  for (const [id, name, email, roleId] of staff) {
    if (devStore.users.some((u) => u.id === id)) continue;
    devStore.users.push({
      id,
      companyId: devStore.company.id,
      name,
      email,
      passwordHash: devStore.users[0].passwordHash,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      roleIds: [roleId],
    });
  }
  return devStore.users;
}

export function makeCustomer(overrides: Partial<DevCustomer> = {}): DevCustomer {
  const now = new Date();
  const id = crypto.randomUUID();
  const customer: DevCustomer = {
    id,
    companyId: devStore.company.id,
    type: CustomerType.COMPANY,
    name: 'Test Customer',
    companyName: null,
    email: `customer-${id}@test.local`,
    phone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    country: null,
    zipCode: null,
    taxId: null,
    status: CustomerStatus.ACTIVE,
    isArchived: false,
    assignedToId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  devStore.customers.push(customer);
  return customer;
}

export function makeProject(overrides: Partial<DevProject> = {}): DevProject {
  const now = new Date();
  const project: DevProject = {
    id: crypto.randomUUID(),
    companyId: devStore.company.id,
    customerId: null,
    name: 'Test Project',
    description: null,
    status: ProjectStatus.ACTIVE,
    priority: TaskPriority.MEDIUM,
    startDate: null,
    deadline: null,
    dueDate: null,
    progress: 0,
    budget: null,
    currency: 'INR',
    projectManagerId: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  devStore.projects.push(project);
  return project;
}

export function makeTicket(overrides: Partial<DevTicket> = {}): DevTicket {
  const now = new Date();
  const ticket: DevTicket = {
    id: crypto.randomUUID(),
    companyId: devStore.company.id,
    customerId: null,
    contactId: null,
    categoryId: null,
    ticketNumber: `TICK-TEST-${Math.floor(Math.random() * 1e6)}`,
    subject: 'Test ticket',
    description: 'Created by a test fixture.',
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    department: null,
    assignedTo: null,
    dueDate: null,
    slaDueAt: null,
    resolvedAt: null,
    closedAt: null,
    isArchived: false,
    attachmentUrls: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  devStore.tickets.push(ticket);
  return ticket;
}

export function makeDraftArticle(overrides: Partial<DevKBArticle> = {}): DevKBArticle {
  const now = new Date();
  const id = crypto.randomUUID();
  const article: DevKBArticle = {
    id,
    companyId: devStore.company.id,
    categoryId: null,
    authorId: devStore.users[0].id,
    title: 'Draft article',
    slug: `draft-article-${id.slice(0, 8)}`,
    summary: null,
    body: 'Draft body',
    status: ArticleStatus.DRAFT,
    views: 0,
    publishedAt: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    tagIds: [],
    ...overrides,
  };
  devStore.kbArticles.push(article);
  return article;
}
