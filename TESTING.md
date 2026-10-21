# Business CRM Admin Panel — Testing & Quality Assurance Documentation

This document describes the automated test architecture, coverage metrics, and procedures for validating the Business CRM application.

---

## 1. Test Suite Summary

- **Test Runner**: Vitest v2.1.8
- **Total Test Files**: 21
- **Total Automated Tests**: 126
- **Test Pass Rate**: **100% (126/126 passed)**
- **Average Execution Time**: ~2.0 seconds

---

## 2. Test File Inventory & Module Coverage

| Test File | Module Covered | Key Tests / Scenarios |
|---|---|---|
| `tests/password.test.ts` | Authentication & Security | Password hashing, bcrypt 12 salt rounds, validation |
| `tests/tokens.test.ts` | Token Management | JWT access token & cryptographically random refresh tokens |
| `tests/permissions.test.ts` | RBAC & Tenancy | 401 unauthenticated, 403 insufficient permissions |
| `tests/customers.test.ts` | CRM Customers | Customer CRUD, contact relations, pagination |
| `tests/leads.test.ts` | CRM Leads | Lead pipeline, duplicate email rejection, status flow |
| `tests/activities.test.ts` | Activities | Follow-ups, meetings, calls, and customer linking |
| `tests/crm-dashboard.test.ts` | CRM Analytics | Funnel statistics, lead conversion ratios |
| `tests/projects-tasks.test.ts` | Work Delivery | Projects, milestones, task assignees, time logs |
| `tests/finance.test.ts` | Sales & Invoicing | Proposals, estimates, contracts, invoices, partial payments, reversals, expenses |
| `tests/decimal.test.ts` | Financial Math | Decimal precision, tax calculations, rounding |
| `tests/settings.test.ts` | Company Settings | Profile update, tax rate uniqueness/default, currency default sync, tenant isolation, validation |
| `tests/invoice-pdf.test.ts` | Invoice PDF | Valid PDF output, pagination of long invoices, auth and attachment headers over HTTP |
| `tests/document-pdf.test.ts` | Estimate & Proposal PDF | Shared renderer, no payment rows without a balance, auth and 404 handling |
| `tests/password-reset.test.ts` | Password Reset | Admin-issued one-time links, hashed storage, expiry, reuse, session revocation, no account enumeration |
| `tests/recurring-invoices.test.ts` | Recurring Invoices | Schedule maths, month-end clamping, catch-up runs, end date, pause, no duplicate runs, tenant isolation |
| `tests/attachments.test.ts` & `attachments-routes.test.ts` | File Attachments | Upload/download/delete, name sanitising, blocked types, tenant isolation, binary round-trip over HTTP |
| `tests/support-reports.test.ts` | Support & Reports | Ticket numbers, internal note privacy, slug collision, notifications, currency separation |
| `tests/validation.test.ts` | Input Validation | Zod schema validation, invalid UUID rejection |
| `tests/health.test.ts` | Infrastructure | Health check API, 404 route handling |
| `tests/phase6-workflows.test.ts` | End-to-End Workflows | Complete 9 mission-critical end-to-end business workflows |

---

## 3. Mission-Critical Workflows Tested (Phase 6)

1. **Lead Lifecycle & Conversion**: Create lead → assign to user → add follow-up → convert to customer/contact → verify duplicate conversion rejection.
2. **Project Delivery & Tracking**: Create project → add milestone → create task under milestone → track billable hours.
3. **Sales to Cashflow**: Create proposal → accept proposal → convert to invoice → issue invoice → record partial payment → verify remaining balance → settle full balance.
4. **Expense Management**: Add business expense → approve expense → verify aggregate in financial report under correct currency.
5. **Support Ticket & Privacy**: Create support ticket (`TICK-YYYY-XXXX`) → post public reply → post staff-only internal note → verify internal note omitted in customer views → resolve ticket with timestamp.
6. **Knowledge Base Publishing**: Create article → create duplicate title to test collision-safe slug (`slug-2`) → verify draft articles hidden from published queries.
7. **In-App Notifications**: Trigger notification upon assignment → verify recipient unread count → mark as read → verify cross-user ownership isolation.
8. **Reports & Formula Injection**: Generate tabular CSV report → verify dangerous spreadsheet formulas (`=`, `+`, `-`, `@`) are neutralized with single-quote prefix.
9. **Tenant Isolation**: Verify cross-company ticket and customer access attempts are rejected with 404/403.

---

## 4. Test & Quality Commands

```bash
# Run all 126 automated tests
npm run test

# Run tests in watch mode during development
cd backend && npm run test -- --watch

# Run a specific test suite
cd backend && npx vitest run tests/phase6-workflows.test.ts

# Run TypeScript typechecks across both projects
npm run typecheck

# Run Next.js ESLint linting
npm run lint

# Run monorepo production builds
npm run build

# Run Live Server End-to-End Verifications (Requires server on port 4000)
node backend/scripts/verify-phase4.mjs
node backend/scripts/verify-phase5.mjs
```


---

## Frontend Component Tests

- **Runner**: Vitest + React Testing Library (jsdom), run with `npm run test:frontend`.
- **Files** (`frontend/tests/`): `api.test.ts` (API client: CSRF, errors, public pages), `tax-rate-select.test.tsx`, `attachments-panel.test.tsx`, `reset-password-page.test.tsx`.
- **Total**: 4 files, 23 tests, all passing.
- Browser end-to-end tests (Playwright) are not set up yet.
