export type UserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  usersCount?: number;
  permissionsCount?: number;
  permissionKeys?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: string;
  key: string;
  description?: string | null;
  module?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  lastLoginAt?: string | null;
  createdAt?: string;
  managerId?: string | null;
  manager?: { id: string; name: string } | null;
  /** Shown as a badge. */
  isSuperAdmin?: boolean;
  /** Whether this person may manage access (Super Admin, or an administrator when no Super Admin exists). */
  canManageAccess?: boolean;
  companyId: string;
  company?: {
    id: string;
    name: string;
    email?: string | null;
    currency?: string;
  };
  roles: string[] | Role[];
  permissions: string[];
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  csrfToken?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface DashboardSummary {
  activeUsers?: number | null;
  totalRoles?: number | null;
  totalLeads?: number | null;
  totalCustomers?: number | null;
  totalProjects?: number | null;
  totalInvoices?: number | null;
  openTickets?: number | null;
  inProgressTickets?: number | null;
  waitingOnCustomer?: number | null;
  highPriorityUnresolved?: number | null;
  overdueTickets?: number | null;
  unreadNotifications?: number | null;
  publishedArticles?: number | null;
  recentActivity?: AuditLog[];
}

// ---------------------------------------------------------------------
// Phase 2 CRM Core Types
// ---------------------------------------------------------------------

export type CustomerType = 'COMPANY' | 'INDIVIDUAL';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  companyId: string;
  type: CustomerType;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  taxId?: string | null;
  status: CustomerStatus;
  isArchived: boolean;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  contactsCount?: number;
  primaryContact?: Contact | null;
  contacts?: Contact[];
  notes?: Note[];
  activities?: Activity[];
  relatedLeads?: Array<{
    id: string;
    name: string;
    companyName?: string | null;
    value?: number | null;
    convertedAt?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface LeadSource {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface LeadStatusConfig {
  id: string;
  name: string;
  color?: string | null;
  order: number;
  isDefault?: boolean;
}

export interface Lead {
  id: string;
  companyId: string;
  title?: string | null;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  value?: number | null;
  currency: string;
  status: LeadStatus;
  statusId?: string | null;
  statusRef?: LeadStatusConfig | null;
  source?: string | null;
  sourceId?: string | null;
  sourceRef?: LeadSource | null;
  priority: LeadPriority;
  description?: string | null;
  nextFollowUp?: string | null;
  ownerId?: string | null;
  owner?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  isArchived: boolean;
  convertedToId?: string | null;
  convertedTo?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  convertedContactId?: string | null;
  convertedContact?: Contact | null;
  convertedAt?: string | null;
  activitiesCount?: number;
  notesCount?: number;
  activities?: Activity[];
  notes?: Note[];
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = 'CALL' | 'MEETING' | 'TASK' | 'EMAIL' | 'FOLLOW_UP' | 'OTHER';
export type ActivityStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface Activity {
  id: string;
  companyId: string;
  type: ActivityType;
  /** What was typed in for the "Other" type. */
  customType?: string | null;
  subject: string;
  description?: string | null;
  dueDate?: string | null;
  status: ActivityStatus;
  completedAt?: string | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  customerId?: string | null;
  customer?: {
    id: string;
    name: string;
    companyName?: string | null;
  } | null;
  leadId?: string | null;
  lead?: {
    id: string;
    name: string;
    companyName?: string | null;
  } | null;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  authorId: string;
  author?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  body: string;
  customerId?: string | null;
  leadId?: string | null;
  createdAt: string;
}

export interface CrmDashboardMetrics {
  periodDays: number;
  /** Set when a custom date range was requested. */
  period?: { from: string; to: string } | null;
  totalActiveLeads: number;
  newLeadsInPeriod: number;
  totalCustomers: number;
  companyCustomers: number;
  individualCustomers: number;
  convertedLeads: number;
  conversionRate: number;
  upcomingFollowUps: number;
  overdueFollowUps: number;
  totalPipelineValue: number;
  recentLeads: Array<{
    id: string;
    name: string;
    companyName?: string | null;
    value?: number | null;
    currency: string;
    status: LeadStatus;
    priority: LeadPriority;
    createdAt: string;
    ownerName: string;
  }>;
  recentActivities: Array<{
    id: string;
    subject: string;
    type: ActivityType;
    status: ActivityStatus;
    dueDate?: string | null;
    createdAt: string;
    assignedToName?: string | null;
    relatedName?: string | null;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  sourceBreakdown: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
}

// ---------------------------------------------------------------------
// Phase 3 Project Management & Task Tracking Types
// ---------------------------------------------------------------------

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MilestoneStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface ProjectMember {
  projectId: string;
  userId: string;
  role?: string | null;
  createdAt?: string;
  user?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  title?: string | null;
  description?: string | null;
  dueDate?: string | null;
  status: MilestoneStatus;
  completedAt?: string | null;
  order: number;
  isArchived: boolean;
  progress?: number;
  isOverdue?: boolean;
  totalTasks?: number;
  doneTasks?: number;
  project?: { id: string; name: string; status?: string } | null;
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  taskId: string;
  userId: string;
  user?: { id: string; name: string; email?: string | null } | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  author?: { id: string; name: string; email?: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId?: string | null;
  userId: string;
  description?: string | null;
  startedAt: string;
  endedAt?: string | null;
  minutes: number;
  billable: boolean;
  user?: { id: string; name: string; email?: string | null } | null;
  project?: { id: string; name: string } | null;
  task?: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  customerId?: string | null;
  name: string;
  projectName?: string;
  description?: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  startDate?: string | null;
  deadline?: string | null;
  dueDate?: string | null;
  progress: number;
  budget?: number | null;
  currency: string;
  projectManagerId?: string | null;
  isArchived: boolean;
  customer?: {
    id: string;
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  projectManager?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  members?: ProjectMember[];
  milestones?: Milestone[];
  tasks?: Task[];
  timeEntries?: TimeEntry[];
  stats?: {
    totalTasks: number;
    doneTasks: number;
    openTasks: number;
    milestonesCount: number;
    timeEntriesCount: number;
  };
  timeSummary?: {
    totalMinutes: number;
    totalHours: number;
    billableMinutes: number;
    billableHours: number;
    nonBillableMinutes: number;
    nonBillableHours: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  creatorId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  estimatedHours?: number | null;
  isArchived: boolean;
  project?: { id: string; name: string; status?: string; customerId?: string | null } | null;
  milestone?: { id: string; name: string; title?: string | null; status?: string } | null;
  creator?: { id: string; name: string; email?: string | null } | null;
  assignees?: TaskAssignee[];
  comments?: TaskComment[];
  timeEntries?: TimeEntry[];
  isOverdue?: boolean;
  commentsCount?: number;
  timeEntriesCount?: number;
  totalTrackedMinutes?: number;
  totalTrackedHours?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkDashboardMetrics {
  activeProjectsCount: number;
  overdueProjectsCount: number;
  nearingDeadlineProjectsCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
  assignedTasksCount: number;
  isScopedToUser?: boolean;
  isTeamScoped?: boolean;
  teamSize?: number;
  recentProjects: Array<{
    id: string;
    name: string;
    status: ProjectStatus;
    priority: TaskPriority;
    deadline?: string | null;
    progress: number;
    customerName: string;
    totalTasks: number;
    membersCount: number;
  }>;
  timeTracking: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
  };
}

// ---------------------------------------------------------------------
// Phase 4 Sales & Finance Types
// ---------------------------------------------------------------------

export type ProposalStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type EstimateStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID' | 'CANCELLED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'CREDIT_CARD' | 'CHEQUE' | 'OTHER';

export interface ProposalItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  total?: number;
  order?: number;
}

export interface Proposal {
  id: string;
  companyId: string;
  customerId: string;
  contactId?: string | null;
  projectId?: string | null;
  proposalNumber: string;
  title?: string | null;
  subject: string;
  status: ProposalStatus;
  currency: string;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  validUntil?: string | null;
  issuedAt?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  isArchived: boolean;
  convertedToEstimateId?: string | null;
  convertedToInvoiceId?: string | null;
  convertedAt?: string | null;
  customer?: { id: string; name: string; email?: string | null; companyName?: string | null } | null;
  contact?: { id: string; name: string; email?: string | null } | null;
  project?: { id: string; name: string } | null;
  items: ProposalItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EstimateItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  total?: number;
  order?: number;
}

export interface Estimate {
  id: string;
  companyId: string;
  customerId: string;
  contactId?: string | null;
  projectId?: string | null;
  estimateNumber: string;
  title: string;
  status: EstimateStatus;
  currency: string;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  validUntil?: string | null;
  issuedAt?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  notes?: string | null;
  terms?: string | null;
  isArchived: boolean;
  convertedToInvoiceId?: string | null;
  convertedAt?: string | null;
  customer?: { id: string; name: string; email?: string | null; companyName?: string | null } | null;
  contact?: { id: string; name: string; email?: string | null } | null;
  project?: { id: string; name: string } | null;
  items: EstimateItem[];
  relatedInvoice?: { id: string; invoiceNumber: string; status: InvoiceStatus; total: number; amountPaid: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  companyId: string;
  customerId: string;
  projectId?: string | null;
  contractNumber: string;
  subject: string;
  contractType?: string | null;
  value: number;
  contractValue?: number;
  currency: string;
  status: ContractStatus;
  calculatedStatus?: ContractStatus;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  terms?: string | null;
  attachmentUrl?: string | null;
  isArchived: boolean;
  customer?: { id: string; name: string; email?: string | null; companyName?: string | null } | null;
  project?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  order?: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  customerId: string;
  projectId?: string | null;
  invoiceNumber: string;
  title?: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  issuedAt?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  isArchived: boolean;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zipCode?: string | null;
    taxId?: string | null;
    companyName?: string | null;
  } | null;
  project?: { id: string; name: string } | null;
  items: InvoiceItem[];
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}

export type ExpenseApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paymentMethod?: PaymentMethod;
  reference?: string | null;
  paymentNumber?: string;
  transactionReference?: string | null;
  paidAt: string;
  paymentDate?: string;
  notes?: string | null;
  status: string;
  isReversed: boolean;
  reversedAt?: string | null;
  reversalReason?: string | null;
  recordedBy: string;
  recorder?: { id: string; name: string; email?: string | null } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    status: InvoiceStatus;
    customer?: { id: string; name: string } | null;
  } | null;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
}

export interface Expense {
  id: string;
  companyId: string;
  title?: string | null;
  description: string;
  categoryId?: string | null;
  category: string;
  amount: number;
  currency: string;
  vendor?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  paymentMethod?: PaymentMethod | null;
  referenceNumber?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdById?: string | null;
  customer?: { id: string; name: string; companyName?: string | null } | null;
  project?: { id: string; name: string } | null;
  categoryRef?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string; email?: string | null } | null;
  incurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialSummary {
  currencyMetrics: Record<
    string,
    {
      totalInvoiced: number;
      totalReceived: number;
      outstandingBalance: number;
      overdueAmount: number;
      totalExpenses: number;
    }
  >;
  statusDistribution: Record<string, number>;
  expenseByCategory: Array<{
    category: string;
    totalAmount: number;
    count: number;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    paidAt: string;
    method: PaymentMethod;
    invoice?: {
      invoiceNumber: string;
      customer?: { name: string } | null;
    } | null;
  }>;
  expiringContracts: Array<{
    id: string;
    contractNumber: string;
    subject: string;
    value: number;
    currency: string;
    calculatedStatus: ContractStatus;
    endDate?: string | null;
    customer?: { name: string } | null;
  }>;
  actionNeeded: {
    overdueInvoiceCount: number;
    draftInvoiceCount: number;
    pendingExpenseCount: number;
    overdueInvoices: Array<{
      id: string;
      invoiceNumber: string;
      customerName: string | null;
      balance: number;
      currency: string;
      dueDate?: string | null;
    }>;
    pendingExpenses: Array<{
      id: string;
      description: string;
      category: string;
      amount: number;
      currency: string;
      vendor?: string | null;
    }>;
  };
}

// ---------------------------------------------------------------------
// Phase 5 Support Desk, Knowledge Base, Notifications & Reports Types
// ---------------------------------------------------------------------

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface TicketCategory {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface Ticket {
  id: string;
  companyId: string;
  customerId?: string | null;
  contactId?: string | null;
  categoryId?: string | null;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  department?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
  slaDueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  isArchived: boolean;
  attachmentUrls?: string[];
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; companyName?: string | null } | null;
  contact?: { id: string; name: string; email?: string | null } | null;
  category?: TicketCategory | null;
  assignee?: { id: string; name: string; email?: string | null } | null;
  replies?: TicketReply[];
}

export interface SupportOverviewTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerName: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface SupportOverview {
  counts: {
    open: number;
    inProgress: number;
    waitingOnCustomer: number;
    unassigned: number;
    assignedToMe: number;
    highPriority: number;
    overdue: number;
    dueSoon: number;
    resolvedToday: number;
    myResolvedToday: number;
  };
  myTickets: SupportOverviewTicket[];
  unassignedQueue: SupportOverviewTicket[];
  atRisk: SupportOverviewTicket[];
}

export interface KBCategory {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: { articles: number };
}

export interface KBTag {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface KBArticle {
  id: string;
  companyId: string;
  categoryId?: string | null;
  authorId: string;
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
  status: ArticleStatus;
  views: number;
  publishedAt?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  category?: KBCategory | null;
  author?: { id: string; name: string; email?: string | null } | null;
  tags?: Array<{ tag: KBTag }>;
  relatedArticles?: Array<{ id: string; title: string; slug: string; summary?: string | null; publishedAt?: string | null }>;
}

export interface NotificationItem {
  id: string;
  companyId?: string | null;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, any> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface CRMReportData {
  dateRange: { startDate: string; endDate: string };
  totalLeads: number;
  newLeadsInRange: number;
  conversionRate: number;
  convertedCount: number;
  leadsByStatus: Record<string, number>;
  leadsBySource: Record<string, number>;
  customers: { total: number; newInRange: number };
  followUps: { total: number; completed: number; upcoming: number; overdue: number };
}

export interface ProjectsReportData {
  projects: { total: number; active: number; completed: number; overdue: number; averageProgress: number };
  tasks: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; overdue: number };
  timeTracking: { totalHoursLogged: number; totalEntries: number };
}

export interface FinancialReportData {
  dateRange: { startDate: string; endDate: string };
  totalsByCurrency: Record<string, { totalInvoiced: number; totalPaid: number; outstanding: number; overdue: number }>;
  invoiceStatusCounts: Record<string, number>;
  paymentsCollected: Record<string, number>;
  expenses: { byCategory: Record<string, number>; byCurrency: Record<string, number>; totalCount: number };
}

export interface SupportReportData {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  waitingOnCustomer: number;
  resolvedTickets: number;
  overdueTickets: number;
  averageResolutionHours: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: Record<string, number>;
  byCategory: Record<string, number>;
}



