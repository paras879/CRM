import {
  UserStatus,
  CustomerType,
  CustomerStatus,
  LeadStatus,
  LeadPriority,
  ActivityType,
  ActivityStatus,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  MilestoneStatus,
  ProposalStatus,
  EstimateStatus,
  ContractStatus,
  InvoiceStatus,
  PaymentMethod,
  TicketStatus,
  TicketPriority,
  ArticleStatus,
} from '@prisma/client';

export interface DevAttachment {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById: string | null;
  createdAt: Date;
}

export interface DevTaxRate {
  id: string;
  companyId: string;
  name: string;
  rate: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevCurrency {
  id: string;
  companyId: string;
  code: string;
  symbol: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevRecurringInvoice {
  id: string;
  companyId: string;
  customerId: string;
  projectId: string | null;
  title: string;
  currency: string;
  discount: number;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  intervalCount: number;
  startDate: Date;
  nextRunDate: Date;
  endDate: Date | null;
  dueInDays: number;
  autoIssue: boolean;
  isActive: boolean;
  items: Array<{ description: string; quantity: number; unitPrice: number; discount: number; taxRate: number }>;
  notes: string | null;
  terms: string | null;
  lastRunAt: Date | null;
  generatedCount: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevCompany {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevPermission {
  id: string;
  key: string;
  description: string | null;
  module: string | null;
}

export interface DevRole {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissionKeys: string[];
}

export interface DevUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roleIds: string[];
  managerId?: string | null;
}

export interface DevContact {
  id: string;
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevCustomer {
  id: string;
  companyId: string;
  type: CustomerType;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  taxId: string | null;
  status: CustomerStatus;
  isArchived: boolean;
  assignedToId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevLeadSource {
  id: string;
  companyId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevLeadStatusConfig {
  id: string;
  companyId: string;
  name: string;
  color: string | null;
  order: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevLead {
  id: string;
  companyId: string;
  title: string | null;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  value: number | null;
  currency: string;
  status: LeadStatus;
  statusId: string | null;
  source: string | null;
  sourceId: string | null;
  priority: LeadPriority;
  description: string | null;
  nextFollowUp: Date | null;
  ownerId: string | null;
  isArchived: boolean;
  convertedToId: string | null;
  convertedContactId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevActivity {
  id: string;
  companyId: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  dueDate: Date | null;
  status: ActivityStatus;
  completedAt: Date | null;
  assignedToId: string | null;
  customerId: string | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevNote {
  id: string;
  companyId: string;
  authorId: string;
  body: string;
  customerId: string | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  revoked: boolean;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface DevPasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  used: boolean;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface DevAuditLog {
  id: string;
  companyId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: Date;
}

export interface DevProject {
  id: string;
  companyId: string;
  customerId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  startDate: Date | null;
  deadline: Date | null;
  dueDate: Date | null;
  progress: number;
  budget: number | null;
  currency: string;
  projectManagerId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevProjectMember {
  projectId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface DevMilestone {
  id: string;
  projectId: string;
  name: string;
  title: string | null;
  description: string | null;
  dueDate: Date | null;
  status: MilestoneStatus;
  completedAt: Date | null;
  order: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevTask {
  id: string;
  projectId: string;
  milestoneId: string | null;
  creatorId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  estimatedHours: number | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevTaskAssignee {
  taskId: string;
  userId: string;
}

export interface DevTaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevTimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  userId: string;
  description: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  billable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevProposal {
  id: string;
  companyId: string;
  customerId: string;
  contactId: string | null;
  projectId: string | null;
  proposalNumber: string;
  title: string | null;
  subject: string;
  status: ProposalStatus;
  currency: string;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  validUntil: Date | null;
  issuedAt: Date | null;
  notes: string | null;
  terms: string | null;
  isArchived: boolean;
  convertedToEstimateId: string | null;
  convertedToInvoiceId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevProposalItem {
  id: string;
  proposalId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  order: number;
}

export interface DevEstimate {
  id: string;
  companyId: string;
  customerId: string;
  contactId: string | null;
  projectId: string | null;
  estimateNumber: string;
  title: string | null;
  status: EstimateStatus;
  currency: string;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  validUntil: Date | null;
  issuedAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  notes: string | null;
  terms: string | null;
  isArchived: boolean;
  convertedToInvoiceId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevEstimateItem {
  id: string;
  estimateId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  order: number;
}

export interface DevContract {
  id: string;
  companyId: string;
  customerId: string;
  projectId: string | null;
  contractNumber: string;
  subject: string;
  contractType: string | null;
  value: number;
  currency: string;
  status: ContractStatus;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  terms: string | null;
  attachmentUrl: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevInvoice {
  id: string;
  companyId: string;
  customerId: string;
  projectId: string | null;
  invoiceNumber: string;
  title: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  issuedAt: Date | null;
  dueDate: Date | null;
  notes: string | null;
  terms: string | null;
  isArchived: boolean;
  recurringInvoiceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevInvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  order: number;
}

export interface DevPayment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
  notes: string | null;
  status: string;
  isReversed: boolean;
  reversedAt: Date | null;
  reversalReason: string | null;
  recordedBy: string;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface DevExpenseCategory {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevExpense {
  id: string;
  companyId: string;
  title: string | null;
  description: string;
  categoryId: string | null;
  category: string;
  amount: number;
  currency: string;
  vendor: string | null;
  customerId: string | null;
  projectId: string | null;
  paymentMethod: PaymentMethod | null;
  referenceNumber: string | null;
  notes: string | null;
  receiptUrl: string | null;
  approvalStatus: string;
  createdById: string | null;
  incurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevTicketCategory {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevTicket {
  id: string;
  companyId: string;
  customerId: string | null;
  contactId: string | null;
  categoryId: string | null;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  department: string | null;
  assignedTo: string | null;
  dueDate: Date | null;
  slaDueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  isArchived: boolean;
  attachmentUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DevTicketReply {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  attachmentUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DevKBCategory {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevKBTag {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface DevKBArticle {
  id: string;
  companyId: string;
  categoryId: string | null;
  authorId: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  status: ArticleStatus;
  views: number;
  publishedAt: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  tagIds: string[];
}

export interface DevNotification {
  id: string;
  companyId: string | null;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: any | null;
  readAt: Date | null;
  createdAt: Date;
}

class DevInMemoryStore {
  public company: DevCompany = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'My Company',
    email: null,
    phone: null,
    address: null,
    currency: 'INR',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  public permissions: DevPermission[] = [
    { id: 'p-1', key: 'dashboard.view', description: 'View dashboard metrics', module: 'dashboard' },
    { id: 'p-2', key: 'company.view', description: 'View company settings', module: 'company' },
    { id: 'p-3', key: 'company.update', description: 'Update company settings', module: 'company' },
    { id: 'p-4', key: 'settings.view', description: 'View general settings', module: 'settings' },
    { id: 'p-5', key: 'settings.update', description: 'Update general settings', module: 'settings' },
    { id: 'p-6', key: 'users.view', description: 'View staff users', module: 'users' },
    { id: 'p-7', key: 'users.create', description: 'Create staff users', module: 'users' },
    { id: 'p-8', key: 'users.update', description: 'Update staff users', module: 'users' },
    { id: 'p-9', key: 'users.delete', description: 'Deactivate or delete users', module: 'users' },
    { id: 'p-10', key: 'roles.view', description: 'View roles', module: 'roles' },
    { id: 'p-11', key: 'roles.manage', description: 'Create and update roles', module: 'roles' },
    { id: 'p-12', key: 'permissions.view', description: 'View permissions list', module: 'permissions' },
    { id: 'p-13', key: 'audit.view', description: 'View system audit logs', module: 'audit' },
    { id: 'p-14', key: 'leads.view', description: 'View leads', module: 'leads' },
    { id: 'p-15', key: 'leads.create', description: 'Create leads', module: 'leads' },
    { id: 'p-16', key: 'leads.update', description: 'Update leads', module: 'leads' },
    { id: 'p-17', key: 'leads.delete', description: 'Delete leads', module: 'leads' },
    { id: 'p-18', key: 'leads.convert', description: 'Convert leads to customers', module: 'leads' },
    { id: 'p-19', key: 'customers.view', description: 'View customers', module: 'customers' },
    { id: 'p-20', key: 'customers.create', description: 'Create customers', module: 'customers' },
    { id: 'p-21', key: 'customers.update', description: 'Update customers', module: 'customers' },
    { id: 'p-22', key: 'customers.delete', description: 'Delete customers', module: 'customers' },
    { id: 'p-23', key: 'projects.view', description: 'View projects', module: 'projects' },
    { id: 'p-24', key: 'projects.create', description: 'Create projects', module: 'projects' },
    { id: 'p-25', key: 'projects.update', description: 'Update projects', module: 'projects' },
    { id: 'p-26', key: 'projects.delete', description: 'Delete projects', module: 'projects' },
    { id: 'p-27', key: 'tasks.view', description: 'View tasks', module: 'tasks' },
    { id: 'p-28', key: 'tasks.create', description: 'Create tasks', module: 'tasks' },
    { id: 'p-29', key: 'tasks.update', description: 'Update tasks', module: 'tasks' },
    { id: 'p-30', key: 'tasks.delete', description: 'Delete tasks', module: 'tasks' },
    { id: 'p-31', key: 'proposals.view', description: 'View proposals', module: 'sales' },
    { id: 'p-32', key: 'proposals.create', description: 'Create proposals', module: 'sales' },
    { id: 'p-33', key: 'proposals.update', description: 'Update proposals', module: 'sales' },
    { id: 'p-34', key: 'proposals.delete', description: 'Delete proposals', module: 'sales' },
    { id: 'p-35', key: 'estimates.view', description: 'View estimates', module: 'sales' },
    { id: 'p-36', key: 'estimates.create', description: 'Create estimates', module: 'sales' },
    { id: 'p-37', key: 'estimates.update', description: 'Update estimates', module: 'sales' },
    { id: 'p-38', key: 'estimates.delete', description: 'Delete estimates', module: 'sales' },
    { id: 'p-39', key: 'contracts.view', description: 'View contracts', module: 'sales' },
    { id: 'p-40', key: 'contracts.create', description: 'Create contracts', module: 'sales' },
    { id: 'p-41', key: 'contracts.update', description: 'Update contracts', module: 'sales' },
    { id: 'p-42', key: 'contracts.delete', description: 'Delete contracts', module: 'sales' },
    { id: 'p-43', key: 'invoices.view', description: 'View invoices', module: 'finance' },
    { id: 'p-44', key: 'invoices.create', description: 'Create invoices', module: 'finance' },
    { id: 'p-45', key: 'invoices.update', description: 'Update draft invoices', module: 'finance' },
    { id: 'p-46', key: 'invoices.issue', description: 'Issue finalized invoices', module: 'finance' },
    { id: 'p-47', key: 'invoices.void', description: 'Void issued invoices', module: 'finance' },
    { id: 'p-48', key: 'payments.view', description: 'View recorded payments', module: 'finance' },
    { id: 'p-49', key: 'payments.record', description: 'Record invoice payments', module: 'finance' },
    { id: 'p-50', key: 'expenses.view', description: 'View recorded expenses', module: 'finance' },
    { id: 'p-51', key: 'expenses.create', description: 'Create expenses', module: 'finance' },
    { id: 'p-52', key: 'expenses.update', description: 'Update expenses', module: 'finance' },
    { id: 'p-53', key: 'expenses.approve', description: 'Approve or reject expenses', module: 'finance' },
    { id: 'p-54', key: 'tickets.view', description: 'View support tickets', module: 'support' },
    { id: 'p-55', key: 'tickets.create', description: 'Create support tickets', module: 'support' },
    { id: 'p-56', key: 'tickets.update', description: 'Update support tickets', module: 'support' },
    { id: 'p-57', key: 'tickets.reply', description: 'Reply to support tickets', module: 'support' },
    { id: 'p-58', key: 'tickets.delete', description: 'Delete or archive support tickets', module: 'support' },
    { id: 'p-59', key: 'kb.view', description: 'View knowledge base articles', module: 'kb' },
    { id: 'p-60', key: 'kb.create', description: 'Create knowledge base articles', module: 'kb' },
    { id: 'p-61', key: 'kb.update', description: 'Update knowledge base articles', module: 'kb' },
    { id: 'p-62', key: 'kb.publish', description: 'Publish or archive knowledge base articles', module: 'kb' },
    { id: 'p-63', key: 'kb.delete', description: 'Delete knowledge base articles', module: 'kb' },
    { id: 'p-64', key: 'notifications.view', description: 'View user notifications', module: 'notifications' },
    { id: 'p-65', key: 'notifications.update', description: 'Mark notifications as read', module: 'notifications' },
    { id: 'p-66', key: 'reports.view', description: 'View business reports', module: 'reports' },
    { id: 'p-67', key: 'reports.export', description: 'Export report data', module: 'reports' },
    { id: 'p-68', key: 'attachments.view', description: 'View and download attachments', module: 'attachments' },
    { id: 'p-69', key: 'attachments.upload', description: 'Upload attachments', module: 'attachments' },
    { id: 'p-70', key: 'attachments.delete', description: 'Delete attachments', module: 'attachments' },
  ];

  public roles: DevRole[] = [];
  public users: DevUser[] = [];
  public customers: DevCustomer[] = [];
  public contacts: DevContact[] = [];
  public leadSources: DevLeadSource[] = [];
  public leadStatuses: DevLeadStatusConfig[] = [];
  public leads: DevLead[] = [];
  public activities: DevActivity[] = [];
  public notes: DevNote[] = [];
  public refreshTokens: DevRefreshToken[] = [];
  public auditLogs: DevAuditLog[] = [];
  public projects: DevProject[] = [];
  public projectMembers: DevProjectMember[] = [];
  public milestones: DevMilestone[] = [];
  public tasks: DevTask[] = [];
  public taskAssignees: DevTaskAssignee[] = [];
  public taskComments: DevTaskComment[] = [];
  public timeEntries: DevTimeEntry[] = [];
  public proposals: DevProposal[] = [];
  public proposalItems: DevProposalItem[] = [];
  public estimates: DevEstimate[] = [];
  public estimateItems: DevEstimateItem[] = [];
  public contracts: DevContract[] = [];
  public invoices: DevInvoice[] = [];
  public invoiceItems: DevInvoiceItem[] = [];
  public payments: DevPayment[] = [];
  public expenseCategories: DevExpenseCategory[] = [];
  public expenses: DevExpense[] = [];
  public ticketCategories: DevTicketCategory[] = [];
  public tickets: DevTicket[] = [];
  public ticketReplies: DevTicketReply[] = [];
  public kbCategories: DevKBCategory[] = [];
  public kbTags: DevKBTag[] = [];
  public kbArticles: DevKBArticle[] = [];
  public notifications: DevNotification[] = [];
  public attachments: DevAttachment[] = [];
  public passwordResetTokens: DevPasswordResetToken[] = [];
  public recurringInvoices: DevRecurringInvoice[] = [];
  public taxRates: DevTaxRate[] = [];
  public currencies: DevCurrency[] = [];

  constructor() {
    this.initDefaultData();
  }

  private initDefaultData() {
    const allPermKeys = this.permissions.map((p) => p.key);

    this.roles = [
      {
        id: '10000000-0000-0000-0000-000000000001',
        companyId: this.company.id,
        name: 'Administrator',
        description: 'Full system control and unrestricted access across all business modules',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionKeys: allPermKeys,
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        companyId: this.company.id,
        name: 'Manager',
        description: 'Manage customers, leads, projects, tasks and business reports',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionKeys: [
          'dashboard.view', 'company.view', 'users.view',
          'leads.view', 'leads.create', 'leads.update', 'leads.delete', 'leads.convert',
          'customers.view', 'customers.create', 'customers.update', 'customers.delete',
          'projects.view', 'projects.create', 'projects.update',
          'tasks.view', 'tasks.create', 'tasks.update',
          'proposals.view', 'proposals.create', 'proposals.update',
          'estimates.view', 'estimates.create', 'estimates.update',
          'invoices.view', 'payments.view', 'expenses.view',
          'tickets.view', 'tickets.create', 'tickets.update', 'tickets.reply', 'tickets.delete',
          'kb.view', 'kb.create', 'kb.update', 'kb.publish', 'kb.delete',
          'notifications.view', 'notifications.update',
          'reports.view', 'reports.export',
          'attachments.view', 'attachments.upload', 'attachments.delete',
        ],
      },
      {
        id: '10000000-0000-0000-0000-000000000003',
        companyId: this.company.id,
        name: 'Staff Member',
        description: 'Assigned projects, tasks and ticket support',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionKeys: [
          'dashboard.view',
          'projects.view',
          'tasks.view', 'tasks.create', 'tasks.update',
          'tickets.view', 'tickets.reply',
          'notifications.view', 'notifications.update',
          'attachments.view', 'attachments.upload',
        ],
      },
      {
        id: '10000000-0000-0000-0000-000000000004',
        companyId: this.company.id,
        name: 'Finance User',
        description: 'Sales documents, invoices, payment recording and expenses',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionKeys: [
          'dashboard.view', 'customers.view',
          'proposals.view', 'estimates.view', 'contracts.view',
          'invoices.view', 'invoices.create', 'invoices.update', 'invoices.issue', 'invoices.void',
          'payments.view', 'payments.record',
          'expenses.view', 'expenses.create', 'expenses.update', 'expenses.approve',
          'notifications.view', 'notifications.update',
          'reports.view', 'reports.export',
        ],
      },
      {
        id: '10000000-0000-0000-0000-000000000005',
        companyId: this.company.id,
        name: 'Support Specialist',
        description: 'Customer help desk, ticket replies, knowledge base and notifications',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionKeys: [
          'dashboard.view', 'customers.view',
          'tickets.view', 'tickets.create', 'tickets.update', 'tickets.reply',
          'kb.view', 'kb.create', 'kb.update', 'kb.publish',
          'notifications.view', 'notifications.update',
          'reports.view',
        ],
      },
    ];

    // Actual bcrypt hash for 'Admin@Secure123!'
    const adminPasswordHash = '$2a$10$ylVFU18JSM.k9aTAy0JZ2u3oN.zEWgPVAYpvHHaYV0Cf8ROiFNbya';

    // Local in-memory mode starts with only the two administrator accounts and no business data.
    this.users = [
      {
        id: '20000000-0000-0000-0000-000000000010',
        companyId: this.company.id,
        name: 'Super Admin',
        email: 'superadmin@businesscrm.local',
        passwordHash: adminPasswordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        roleIds: ['10000000-0000-0000-0000-000000000001'],
      },
      {
        id: '20000000-0000-0000-0000-000000000001',
        companyId: this.company.id,
        name: 'Admin',
        email: 'admin@businesscrm.local',
        passwordHash: adminPasswordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        roleIds: ['10000000-0000-0000-0000-000000000001'],
      },
    ];

    this.leadStatuses = [
      { id: 'lst-1', companyId: this.company.id, name: 'NEW', color: '#3B82F6', order: 1, isDefault: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'lst-2', companyId: this.company.id, name: 'CONTACTED', color: '#8B5CF6', order: 2, isDefault: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'lst-3', companyId: this.company.id, name: 'QUALIFIED', color: '#10B981', order: 3, isDefault: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'lst-4', companyId: this.company.id, name: 'PROPOSAL', color: '#F59E0B', order: 4, isDefault: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'lst-5', companyId: this.company.id, name: 'WON', color: '#059669', order: 5, isDefault: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'lst-6', companyId: this.company.id, name: 'LOST', color: '#EF4444', order: 6, isDefault: false, createdAt: new Date(), updatedAt: new Date() },
    ];

  }
}

export const devStore = new DevInMemoryStore();
