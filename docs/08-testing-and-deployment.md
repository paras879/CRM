# 08 — Testing and Deployment

## Test layers
- Unit: money/tax calculations, status transitions, permission policies, validation.
- Integration: API + PostgreSQL, Prisma transactions, auth/session lifecycle.
- E2E: login, create lead, convert lead, create customer/project/task, issue invoice, record payment, reply to ticket.
- Security: unauthenticated access, horizontal/vertical privilege escalation, IDOR, cross-company scoping, rate limits, unsafe upload tests.
- UI: responsive breakpoints, loading/error/empty states, keyboard access, form validation.

## Critical test scenarios
- Staff without `invoices.issue` cannot issue an invoice by direct API request.
- User cannot access another company's or unauthorized project's record by guessing its ID.
- Invalid or negative payment amount is rejected.
- Repeated payment request does not create duplicate payment records.
- Invoice balance/status update atomically with payment record.
- Issued invoice cannot be silently edited/deleted.
- Deactivated user loses access according to the session revocation policy.
- CSV/PDF export respects the same permissions and filters as the UI.
- File download checks access to the parent record.

## Environment configuration
Provide `.env.example` with placeholders only. Expected variables may include:
- `DATABASE_URL`
- `APP_ORIGIN`
- `API_PORT`
- `SESSION_SECRET` or equivalent token secrets
- `CORS_ORIGINS`
- Email provider configuration (optional)
- Private file storage configuration (optional)

Validate required variables at startup and fail fast with a safe message. Never print secrets.

## Deployment checklist
- Separate staging and production environments.
- TLS for frontend, API and database connections.
- Production database not publicly exposed; least-privilege credentials.
- Run reviewed migrations as a controlled deployment step.
- Configure exact CORS origins and trusted proxy settings.
- Configure backups, retention and a tested restore procedure.
- Configure logs, uptime/health monitoring and error alerting.
- Verify outbound email sender/domain if enabled.
- Seed production admin securely; do not ship default shared passwords.
- Run smoke tests and permission checks after deployment.
- Document rollback strategy; database migrations may need forward fixes rather than blind rollback.

## Definition of done
A feature is done only when UI, API, validation, permissions, persistence, error/loading/empty states, audit behavior where applicable, tests, and docs are implemented and verified.
