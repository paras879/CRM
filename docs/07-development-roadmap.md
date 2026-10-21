# 07 — Development Roadmap

## Phase 0 — Confirm requirements
Deliverables: approved scope, brand, roles, tax/currency rules, hosting, email and file storage decisions.
Exit: client decisions documented; out-of-scope features explicitly listed.

## Phase 1 — Foundation
- Create independent frontend/backend packages and repository.
- Configure TypeScript, linting, formatting, env validation and health endpoints.
- Configure PostgreSQL, Prisma migrations and seed script for a first administrator.
- Implement authentication, session lifecycle, roles/permissions, audit logging.
- Build responsive app shell, sidebar, topbar and dashboard skeleton.
Exit: login works, protected API rejects anonymous requests, role restrictions are tested, migrations run from a clean database.

## Phase 2 — CRM core
- Leads, sources/statuses, activities and follow-ups.
- Customers, contacts and notes.
- Lead conversion transaction.
Exit: CRUD, filters, pagination, validation and permission tests pass.

## Phase 3 — Projects and tasks
- Projects, project members, milestones, tasks, assignees, comments, attachments, time entries.
Exit: record-level access tests pass; due dates and status transitions work.

## Phase 4 — Sales and finance
- Proposals, estimates, contracts, invoices, line items, payment recording, expenses and PDF templates.
Exit: financial calculations and payment consistency tests pass; issued document rules are enforced.

## Phase 5 — Support, reports and notifications
- Tickets/replies, in-app notifications, email integration, business reports and exports.
Exit: permission-scoped reports reconcile to records; notification failures are observable.

## Phase 6 — Hardening and deployment
- E2E tests, accessibility checks, performance review, dependency/security scans.
- Production secrets, database backups, migration procedure, monitoring and restore test.
Exit: release checklist in `08-testing-and-deployment.md` completed.

## Working rules for coding agents
1. Inspect only this new repository. Do not inspect or change the existing HRMS.
2. Before each phase, summarize files and migrations to be added/changed.
3. Implement complete vertical slices: UI + API + validation + database + tests.
4. Do not leave buttons connected to mock handlers or use fake production data.
5. Do not claim a feature is complete unless its tests and acceptance criteria pass.
6. Keep `.env`, secrets, production data and credentials out of commits.
7. Update docs and API contract whenever behavior changes.
8. Stop and report blockers honestly; do not silently remove requirements.
