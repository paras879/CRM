# 03 — Database Design

## Modeling principles
- PostgreSQL is the source of truth; Prisma schema and migrations are versioned.
- UUID primary keys; timestamps stored consistently in UTC.
- Add `companyId` to business entities and scope all queries by the authenticated user's company.
- Use foreign keys and explicit delete behavior. Prefer soft-archive/status transitions for business records.
- Use `Decimal`/PostgreSQL numeric for money, never binary floating point.
- Store tax rate, currency, item description, and unit price snapshots on issued documents so historical documents remain reproducible.
- Store uploaded file metadata in the database; keep file bytes in private object storage or a private local volume, not public webroot.
- Keep audit log entries append-only to the extent practical.

## Core relationships
- Company 1—many Users, Customers, Leads, Projects, Sales Documents, Invoices, Expenses, Tickets.
- User many—many Roles through UserRole; Role many—many Permissions through RolePermission.
- Customer 1—many Contacts, Projects, Estimates, Proposals, Invoices, Tickets.
- Lead optionally converts to one Customer/Contact; conversion must preserve source and history.
- Project many—many Users through ProjectMember.
- Project 1—many Milestones and Tasks; Task many—many Users through TaskAssignee.
- Task 1—many Comments and TimeEntries.
- Invoice 1—many InvoiceItems and Payments.
- Ticket 1—many TicketReplies.
- Attachment metadata references an allowed parent record; authorization follows the parent.
- AuditLog references actor and target entity by entity type/id; do not expose arbitrary cross-company records.

## Table groups
Identity: Company, User, Role, Permission, UserRole, RolePermission, RefreshToken, PasswordResetToken.
CRM: Lead, LeadSource, LeadStatus, Customer, Contact, Note, Activity, FollowUp.
Delivery: Project, ProjectMember, Milestone, Task, TaskAssignee, TaskComment, TimeEntry, Attachment.
Sales: Proposal, ProposalItem, Estimate, EstimateItem, Contract.
Finance: Invoice, InvoiceItem, Payment, Expense, TaxRate, Currency.
Support/platform: Ticket, TicketReply, KnowledgeArticle, Notification, AuditLog, EmailTemplate, CustomFieldDefinition, CustomFieldValue.

## Indexes and constraints
- Unique `(companyId, email)` for users and contacts where applicable; normalize email to lowercase before storage.
- Unique `(companyId, invoiceNumber)` and document numbers.
- Index `(companyId, status)`, `(companyId, createdAt)`, owner/assignee IDs, due dates and foreign keys used in filters.
- Index `customerId`, `projectId`, `invoiceId`, `ticketId` on child tables.
- Use database constraints for positive quantities, nonnegative totals where appropriate, and valid unique identifiers.
- Define explicit delete rules; never cascade-delete issued invoices/payments/audit records by accident.

## Financial consistency
- Persist invoice subtotal, discount, tax and total as Decimal snapshots.
- Recompute totals server-side from validated items and tax rules.
- Record payments as append-only transactions; update invoice status/balance in the same database transaction.
- Use idempotency keys or a robust duplicate submission strategy for payment recording.
- Use credit notes/adjustments for post-issue corrections as business rules require.

## Multi-company note
Initial deployment may contain one company, but `companyId` alone does not provide tenant isolation. Every service query, relation traversal, uniqueness constraint, background job and export must enforce company scope before multi-company use.
