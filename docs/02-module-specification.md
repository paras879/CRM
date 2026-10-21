# 02 — Module Specification

## 1. Authentication and users
Screens: Login, Forgot Password, Reset Password, Users list, User detail, Roles, Permission matrix.
Acceptance: inactive users cannot log in; protected endpoints reject unauthenticated requests; every permission is enforced by backend middleware/service.

## 2. Dashboard
Widgets: leads by status, open projects, overdue tasks, invoice totals/outstanding balance, recent activity, open tickets.
Acceptance: metrics are derived from authorized server-side queries; date range and currency assumptions are visible; empty data displays zero/empty states rather than fake sample data.

## 3. Leads
Fields: name/company, email, phone, source, status, assigned user, value (optional), next follow-up, notes.
Actions: create, edit, assign, status update, activity log, convert.
Acceptance: conversion is transactional and idempotency/duplicate handling is considered; lead history remains available after conversion.

## 4. Customers and contacts
Customer fields: name/company name, type, email, phone, address, website, tax identifier (only if required), owner, status.
Contact fields: customer, name, email, phone, title, primary flag.
Acceptance: customer detail page shows permitted related projects, estimates, invoices, tickets and activities.

## 5. Projects, milestones and tasks
Project fields: customer, name, description, status, start/end dates, owner, members, progress.
Task fields: project, milestone (optional), title, description, status, priority, due date, assignees.
Acceptance: due-date and status changes are validated; unauthorized users cannot read or mutate unrelated projects; comments and attachments inherit parent-record access rules.

## 6. Estimates, proposals and contracts
Documents have draft/sent/accepted/rejected/expired/cancelled lifecycle as appropriate.
Line items store description, quantity, unit price, tax reference/rate snapshot and calculated totals.
Acceptance: sent/accepted state transitions are validated; document totals are calculated on server; PDF rendering uses persisted values and a consistent template.

## 7. Invoices and payments
Invoice states: draft, issued, partially_paid, paid, overdue, void (with explicit transition rules).
Payment fields: invoice, amount, currency, method, reference, paid date, recorded by.
Acceptance: payment amount must be positive and currency must match invoice unless a deliberate FX feature is added; duplicate submission protection is required; balance/status are updated in a transaction. No online gateway in MVP.

## 8. Expenses
Fields: category, description, amount, currency, tax, date, vendor (optional), attachment, creator, status.
Acceptance: permission-controlled create/edit/approve actions; reports exclude void/rejected entries according to documented business rules.

## 9. Support tickets
Fields: ticket number, customer/contact, subject, description, priority, status, assigned user, created/updated dates.
Replies: author, body, internal/public flag, attachments.
Acceptance: only authorized staff can see internal notes; customer portal is not in MVP; status changes are logged.

## 10. Notifications and activity
Notifications: assigned task, follow-up due, invoice due/overdue, ticket reply.
Acceptance: in-app notification delivery is reliable; email delivery is optional until provider configured; notification actions check permission.

## 11. Reports
Reports: lead funnel, sales documents, invoice aging, payments, expenses, project status, overdue tasks, ticket status.
Acceptance: filter and export behavior matches visible filters; report queries are permission scoped; totals reconcile with underlying records.

## 12. Settings
Company profile, currency defaults, tax rates, document numbering, email configuration, user/role settings.
Acceptance: secrets are write-only/obfuscated; configuration changes are audited; sensitive settings require elevated permission.
