# 05 — UI/UX Guidelines

## Visual direction
Create an original, clean, business-focused interface inspired by common CRM conventions. Do not copy proprietary source, logos, or licensed assets. Use the client's own brand identity once supplied.

## Layout
- Desktop: collapsible left sidebar, top navigation, breadcrumb/page title and main content.
- Topbar: global search (only if implemented securely), notifications, profile menu.
- Sidebar groups: Dashboard; CRM (Leads, Customers); Work (Projects, Tasks, Calendar); Sales (Proposals, Estimates, Contracts); Finance (Invoices, Payments, Expenses); Support (Tickets, Knowledge Base); Reports; Settings.
- Responsive: sidebar becomes a drawer on small screens; tables support deliberate horizontal overflow or mobile card presentation.

## Screen standards
- Lists: title, primary action, search, filters, sortable columns, pagination, bulk actions only when safe.
- Forms: labeled fields, inline validation, save/cancel actions, unsaved-change warning for complex forms.
- Detail pages: overview, related records, documents, notes/activity timeline.
- Destructive actions: confirmation dialog and explicit impact text.
- Every async screen: loading, error, empty, and success states.
- Never display sample metrics as real production values.

## Reusable components
AppShell, Sidebar, Topbar, Breadcrumbs, PageHeader, DataTable, SearchFilterBar, StatusBadge, FormField, ConfirmDialog, EmptyState, ErrorState, LoadingSkeleton, Toast, Pagination, ActivityTimeline, FileUpload, PermissionGate.

## Accessibility
- Semantic headings and labels; keyboard navigation; visible focus states.
- Dialog focus management and escape behavior.
- Contrast meeting WCAG AA where practical.
- Do not communicate status by color alone.
- Respect reduced-motion preference.

## UX consistency
- Use consistent date, number, currency and timezone formatting.
- Keep filters in URL query parameters when useful.
- Confirm success only after the server confirms the operation.
- Disable duplicate submit while requests are in flight, while still enforcing idempotency/constraints server-side.
- Use optimistic UI only where rollback is safe.
