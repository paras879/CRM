# Business CRM Admin Panel — Perfex CRM-Inspired Business Management Platform

A modern, production-grade multi-tenant Business Admin Panel & CRM inspired by Perfex CRM, built with Next.js App Router, Express, TypeScript, Tailwind CSS, and Prisma ORM.

---

## 🚀 Key Features by Module

### 1. Authentication & System Administration (Phase 1)
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (`users.*`, `roles.*`, `audit.*`, `dashboard.*`, etc.).
- **Dual-Token Authentication**: Secure short-lived JWT access tokens (15m) paired with cryptographically hashed refresh tokens (7d).
- **Security Hardening**: Double-submit CSRF cookie protection, Helmet security headers, bcrypt password hashing (12 rounds), login rate limiting (10 attempts / 15 mins), and sanitized audit logs.
- **Dual-Persistence**: Automatic PostgreSQL connection with fallback to an active in-memory DevStore for smooth local development.

### 2. CRM Core — Customers & Leads (Phase 2)
- **Customer & Contact Management**: Full CRUD, primary contact management, address and billing details.
- **Lead Pipeline**: Kanban/table lead tracker, stages (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION`, `WON`, `LOST`), and source tracking.
- **Atomic Lead Conversion**: 1-click transaction-safe conversion of qualified leads into active customers and contacts with duplicate conversion prevention.
- **Activity & Follow-up Timeline**: Calls, meetings, emails, and follow-up alerts.

### 3. Work & Project Delivery (Phase 3)
- **Project Tracking**: Budgets, deadlines, completion progress percentage, and billing models (`FIXED_COST`, `PROJECT_HOURS`, `TASK_HOURS`).
- **Milestones & Sprint Boards**: Milestone grouping with auto-calculated delivery progress.
- **Task Management**: Multi-assignee task boards, status workflows (`TODO`, `IN_PROGRESS`, `TESTING`, `DONE`), priorities, and comments.
- **Time Tracking**: Project and task-level hour logging with billable vs non-billable tracking.

### 4. Sales & Finance Management (Phase 4)
- **Proposals & Estimates**: Rich itemized services, tax rates, discounts, expiration dates, and 1-click conversion to invoices upon acceptance.
- **Contract Management**: Expiry tracking, active/expired statuses, and renewal notices.
- **Invoicing**: Automatic document numbering (`INV-YYYY-XXXX`), partial payments, tax totals, and immutable audit history.
- **Payments & Receipts**: Overpayment prevention, payment reversals with audit logging, and payment receipt tracking.
- **Business Expenses**: Multi-category expense tracking with approval/rejection workflows.
- **Multi-Currency Safety**: Absolute separation of currencies (`INR`, `USD`, `EUR`) in totals and financial reports.

### 5. Support Desk, Knowledge Base, Notifications & Reports (Phase 5)
- **Support Ticket Desk**: Auto ticket numbering (`TICK-YYYY-XXXX`), priority queues, departments, and SLA deadline breach tracking.
- **Private Internal Staff Notes**: Clear distinction between public customer replies and staff-only internal technical notes (`isInternal: true`), guaranteed never to leak to external queries or CSV exports.
- **Knowledge Base**: Category and tag support, collision-safe slug engine (`slug-2`), Markdown article reader, and publication controls.
- **In-App Notification Center**: Real-time event notifications, live unread counter badge in topbar, and ownership-enforced read status.
- **Analytics & RFC 4180 CSV Export**: Deep aggregate reports across CRM, Projects, Finance, and Support Desk with CSV formula injection sanitization.

### File Attachments
- Upload, download and delete files on customers, leads, projects, tasks, invoices, tickets, contracts, proposals and estimates (tenant-scoped, audited, executable types blocked, size limit via `MAX_UPLOAD_MB`, stored under `UPLOAD_DIR`).

### PDF Documents
- Download invoices, estimates and proposals as PDF (`GET /api/v1/{invoices|estimates|proposals}/:id/pdf`) with company header, customer, line items, totals, notes and terms (invoices also show paid amount and balance).

### Recurring Invoices
- Weekly, monthly, quarterly or yearly schedules that create invoices automatically (as drafts or issued), with end dates, pause/resume and generate-now. A background check runs every 15 minutes; runs are claimed atomically so several API instances never duplicate an invoice.

### Password Reset
- Administrators create a one-time reset link for a staff user (Administration → Staff Users → key icon). Links expire after 60 minutes, are single-use, and revoke the user's active sessions. Email delivery can be added later without changing the flow.

### Company Settings
- Company profile, reusable tax rates (single default, selectable on invoice, estimate and proposal line items) and currencies (default syncs the company base currency) under Administration → Company Settings.

### 6. Security Hardening & Audit (Phase 6)
- **Zero-Trust Record Isolation**: Strict tenant scoping on every route via `companyId`.
- **CSV Formula Injection Neutralization**: Automatic single-quote escaping for spreadsheet formula characters (`=`, `+`, `-`, `@`).
- **Complete Test Coverage**: 21 backend test suites (126 tests, plus 23 frontend component tests, 100% pass) and end-to-end verification scripts covering all 9 mission-critical business workflows.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | Node.js, Express, TypeScript, Zod, Helmet, Cors, Cookie-Parser, Bcrypt |
| **Database** | PostgreSQL, Prisma ORM (with in-memory DevStore fallback) |
| **Testing** | Vitest, Supertest |
| **Design System** | Tailored White/Blue theme (`#2563EB` primary, `#F8FAFC` background) per `DESIGN-SYSTEM.md` |

---

## 📋 Getting Started

### Prerequisites
- Node.js >= 18.18.0
- npm >= 9.0.0
- PostgreSQL >= 14 (Optional for local dev; in-memory store runs automatically if PostgreSQL is offline)

### Installation
```bash
# Clone repository
git clone <repo-url>
cd business-crm-blueprint

# Install all workspace dependencies
npm install
```

### Environment Configuration
```bash
# Copy root environment template
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### Database Migration (If PostgreSQL is running)
```bash
# Validate Prisma schema
npm run prisma:validate

# Generate Prisma Client
npm run prisma:generate

# Apply migrations
npm --prefix backend run prisma:migrate
```

### Running Locally
```bash
# Run both backend and frontend concurrently
npm run dev

# Or run individually:
npm run dev:backend    # Runs API on http://localhost:4000
npm run dev:frontend   # Runs Next.js on http://localhost:3000
```

### Default Development Credentials
There are two administrator accounts. Both hold the Administrator role and every day-to-day permission. The **Super Admin** can additionally manage access itself, which an ordinary **Admin** cannot:

| Only a Super Admin can | An Admin can still |
|---|---|
| Edit, deactivate, delete or reset the password of a Super Admin | Do all the day-to-day work and manage ordinary users |
| Create an Administrator, or give or remove the Administrator role | Create, edit and delete everyone else |
| Create, change or delete roles and permissions (Admins can read them) | Change tax rates and the company profile |
| Add, edit or delete currencies | |

Nobody can change their own role. If a company ever has no active Super Admin, its Administrators regain these abilities so access is never locked. Super Admin status is set by the seed (or directly in the database); there is no screen to grant it.

Local development (no database, in-memory store) has the two accounts below, both with the same password:

| Account | Email | Password |
|---|---|---|
| Super Admin | `superadmin@businesscrm.local` | `Admin@Secure123!` |
| Admin | `admin@businesscrm.local` | `Admin@Secure123!` |

The application ships with no sample records. A fresh database or the in-memory store contains only the built-in roles and permissions, these two accounts, the lead pipeline stages and an empty company profile (set it up under Administration → Company Settings). Everything else is created by your team after sign-in.

**Real deployments** must set the credentials before seeding (`npm --prefix backend run prisma:seed`), and the seed refuses to run in production without them:
`INITIAL_SUPER_ADMIN_EMAIL`, `INITIAL_SUPER_ADMIN_PASSWORD`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` and optionally `INITIAL_COMPANY_NAME`. Change both passwords after the first sign-in. Running the seed again never resets a password that was changed.

---

## 🧪 Testing & Quality Gates

```bash
# Run all 126 automated unit & integration tests
npm run test

# Run TypeScript typechecks across backend and frontend
npm run typecheck

# Run Next.js ESLint linting
npm run lint

# Run monorepo production builds
npm run build

# Run Phase 4 & Phase 5 Live End-to-End API Verifications
node backend/scripts/verify-phase4.mjs
node backend/scripts/verify-phase5.mjs
```

---

## 📖 Project Documentation
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) — Visual identity, color tokens, and UI guidelines.
- [`docs/04-api-specification.yaml`](docs/04-api-specification.yaml) — Complete OpenAPI 3.1 REST API specification.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Production deployment instructions and Nginx configuration.
- [`SECURITY.md`](SECURITY.md) — Security controls, vulnerability handling, and best practices.
- [`TESTING.md`](TESTING.md) — Test suites, coverage metrics, and verification procedures.
