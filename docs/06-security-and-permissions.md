# 06 — Security and Permissions

## Authentication
- Hash passwords using Argon2id or a currently recommended password-hashing configuration.
- Use short-lived access tokens or secure server sessions; refresh tokens must be revocable, stored hashed when persisted, and rotated.
- For browser sessions, prefer Secure, HttpOnly, SameSite cookies; protect state-changing cookie-authenticated requests against CSRF.
- Rate-limit login, password reset and sensitive endpoints; avoid account enumeration in reset responses.
- Never log passwords, reset tokens, session cookies, access tokens or payment secrets.

## Authorization
- Implement permission checks in backend middleware/service layer, not only frontend.
- Example permission names: `customers.view`, `customers.create`, `customers.update`, `customers.delete`, `invoices.view`, `invoices.issue`, `payments.record`, `users.manage`, `roles.manage`, `audit.view`.
- Verify both action permission and record-level access for every ID supplied by the client.
- Project members see only records granted by the policy; admin access must be explicit and audited.
- Deny by default. Hiding a button is not authorization.

## Data and application security
- Validate request bodies, query parameters and path parameters with schemas.
- Configure CORS with exact allowed origins; never use wildcard credentials.
- Use secure headers, TLS, rate limiting and request size limits.
- Protect against SQL injection (ORM parameterization), XSS, CSRF, SSRF and insecure direct object references.
- Uploads: allowlist file types, validate size and content, generate server-side names, store privately, scan where feasible, authorize downloads.
- Keep secrets in deployment environment/secret manager; commit only `.env.example`.
- Apply least-privilege database credentials and restrict production database network access.
- Back up database and test restoration.

## Audit logging
Record actor, action, target type/id, timestamp, request/correlation ID, and carefully selected before/after fields for sensitive changes. Exclude secrets and unnecessary personal data. Restrict log access and prevent ordinary users from editing logs.

## Finance controls
- Use Decimal values and server-calculated totals.
- Transactionally record payments and update balances.
- Use unique document numbering constraints and duplicate-submit protection.
- Prevent silent mutation/deletion of issued financial records; implement explicit void/credit/adjustment workflows.
- Never store card PAN or CVV; payment gateway integration is deferred.

## Release gates
No production release until auth/permission tests, dependency audit, secret scan, backup/restore verification, and critical workflow tests pass.
