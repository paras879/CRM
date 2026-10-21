# 01 — Product Requirements

## Product goal
Build an original business-management CRM inspired by common CRM workflows and the broad feature set of Perfex CRM. Do not copy proprietary source code, branding, or licensed assets.

## Goals
- Centralize leads, customers, projects, tasks, sales documents, invoices, expenses, and support.
- Give staff only the access required for their role.
- Provide an auditable record of important business actions.
- Offer a consistent responsive interface with real API-backed workflows.
- Keep this product fully independent from the completed HRMS.

## Out of scope
- Attendance, leave management, payroll, appraisals, and HRMS workflows.
- Shared codebase, database, authentication session, or deployment with HRMS.
- Customer self-service portal in the first release.
- Online payment processing in the first release.
- Complex multi-tenant SaaS provisioning in the first release.

## Actors
- **Administrator:** system configuration, users, roles, company data, and all explicitly authorized modules.
- **Manager:** assigned business areas, customers, leads, projects, tasks, and reports as granted.
- **Staff member:** assigned tasks/projects and permitted CRM records.
- **Finance user:** estimates, invoices, payment recording, expenses, and finance reports as granted.
- **Support user:** ticket queue and replies as granted.
- **Read-only/reporting user:** view permitted records and reports; no mutation rights.

Roles are configurable. Never rely on frontend hiding alone for authorization.

## Functional requirements
### Foundation
- Login, logout, password reset, session/refresh-token handling, user activation/deactivation.
- Role and permission administration.
- Company profile and settings.
- Dashboard metrics computed from real data.
- Audit logs for sensitive mutations.
- Search, filtering, sorting, pagination and empty/loading/error states.

### CRM
- Leads: create, edit, assign, track source/status, add notes and follow-ups.
- Lead conversion: controlled transaction to create customer/contact and preserve conversion history.
- Customers: company/customer profile, contacts, notes, related projects, sales documents, invoices and tickets.
- Activities: timestamped record of relevant actions and follow-up outcomes.

### Projects and tasks
- Projects with client, owner, members, dates, status and progress.
- Milestones and tasks with priority, assignees, due date, status, comments and attachments.
- Time entries with duration, user, task/project and description.
- Enforce project membership/permissions on reads and writes.

### Sales and finance
- Estimates and proposals with line items, currency, tax, status, validity and document history.
- Contracts with status, effective/expiry dates and attachment metadata.
- Invoices with line items, due dates, tax, discounts, currency, issue status and balance.
- Manual payment records with reference, date, method, amount and audit trail.
- Expenses with category, date, amount, tax/currency and attachment.
- Never derive financial totals from untrusted client-calculated values; calculate and validate server-side.
- Issued invoices and payment records should be corrected through controlled adjustments/credit notes rather than silent destructive edits.

### Support and reporting
- Tickets with priority, status, assignee, customer, replies and attachments.
- Knowledge articles with draft/published status (later phase if schedule is tight).
- Date-filtered sales, invoice, payment, expense, lead conversion and project reports.
- CSV export only for records the user is allowed to access.

## Non-functional requirements
- TypeScript in frontend and backend.
- Server-side input validation and normalized error responses.
- Responsive layout and keyboard-accessible controls.
- Database migrations committed to version control.
- Automated tests for permissions, financial calculations, and critical workflows.
- Environment secrets never committed.
- Logging and monitoring without credentials, tokens, or sensitive payment data.
- Backups and a tested restore procedure before production.

## Product decisions to confirm with client
- Company name, branding, logo and preferred colors.
- Required roles and approval flows.
- Applicable tax rules, currencies, invoice numbering and legal invoice fields.
- Email provider/SMTP and notification preferences.
- File storage provider and retention policy.
- Hosting, domain, backup frequency and data residency requirements.
