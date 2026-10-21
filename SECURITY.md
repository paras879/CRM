# Business CRM Admin Panel — Security Architecture & Guidelines

This document outlines the security controls, threat mitigations, and compliance measures implemented across the Business CRM application.

---

## 1. Authentication & Session Management

- **Dual-Token Architecture**:
  - Short-lived Access Token (15-minute lifespan) signed with HMAC-SHA256 (`JWT_SECRET`, min 32 characters).
  - Long-lived cryptographically hashed Refresh Token (7-day lifespan) stored in database and devStore.
  - Revocation support on user logout and password resets.
- **Password Security**:
  - Passwords hashed using `bcryptjs` with **12 salt rounds**.
  - Minimum 8-character complexity rules enforced via Zod validation.
  - Plaintext passwords never stored, logged, or included in API responses.
- **Account State Verification**:
  - `status === 'ACTIVE'` verified on every single authenticated request. Disabled or invited accounts are rejected immediately with HTTP 403.

---

## 2. Authorization & Multi-Tenancy

- **Role-Based Access Control (RBAC)**:
  - Permissions are strictly evaluated server-side using `requirePermission(...)` middleware before any service or database mutation.
  - Super-administrators cannot be escalated by unauthorized users.
- **Tenant & Record Scoping**:
  - Every single business entity (`Customer`, `Lead`, `Project`, `Invoice`, `Ticket`, `Notification`, etc.) is scoped to a `companyId`.
  - Database queries and DevStore filters always enforce `companyId: req.user.companyId`.
  - Insecure Direct Object References (IDOR) are prevented: attempting to access another company's record returns 404/403.

---

## 3. Threat Mitigation & Defense-in-Depth

### A. Cross-Site Request Forgery (CSRF)
- Double-Submit Cookie pattern implemented via `csrfProtection` middleware.
- Client reads `crm_csrf` cookie and submits it via `x-csrf-token` header.
- Safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) and Bearer token requests are excluded from CSRF checks.

### B. Cross-Site Scripting (XSS)
- All user-generated rich text, descriptions, ticket notes, and knowledge base article bodies are sanitized via HTML sanitization functions (`sanitizeText`).
- Frontend renders Markdown securely without raw `dangerouslySetInnerHTML` on untrusted inputs.

### C. CSV Formula Injection (CWE-1236)
- Tabular CSV exports (`/api/v1/reports/export`) sanitize all cell contents.
- If a string begins with spreadsheet formula triggers (`=`, `+`, `-`, `@`), a single quote (`'`) is prepended before RFC 4180 quotation to neutralize code execution in Microsoft Excel, LibreOffice, and Google Sheets.

### D. Private Data Leakage Prevention
- **Support Desk Internal Notes**: Staff internal notes (`isInternal: true`) are excluded from customer-facing queries, public notifications, and CSV exports.
- **Log Sanitization**: `logger.ts` redacts sensitive keys: `password`, `token`, `secret`, `authorization`, `cookie`, `creditCard`, `cvv`.
- **Production Error Handling**: Stack traces and raw internal error details are suppressed when `NODE_ENV === 'production'`.

### E. Brute Force & Rate Limiting
- Sensitive authentication routes (`/api/v1/auth/login`, `/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`) are protected by an in-memory sliding window rate limiter: **max 10 attempts per 15 minutes per IP**.

### F. Security Headers & CORS
- Helmet HTTP security headers are enabled (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`).
- CORS strictly whitelists the configured `APP_ORIGIN` and rejects wildcard origins with credentials.

---

## 4. Security Incident Reporting

To report a security vulnerability or concern:
- Do NOT open public GitHub issues.
- Email security reports directly to: `security@businesscrm.local` or contact your system administrator.
