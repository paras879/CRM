import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { csrfProtection } from './middleware/csrf.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { permissionsRouter } from './modules/permissions/permissions.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { customersRouter } from './modules/customers/customers.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';
import { activitiesRouter } from './modules/activities/activities.routes.js';
import { crmDashboardRouter } from './modules/crm-dashboard/crm-dashboard.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { milestonesRouter } from './modules/milestones/milestones.routes.js';
import { tasksRouter } from './modules/tasks/tasks.routes.js';
import { timeTrackingRouter } from './modules/time-tracking/time-tracking.routes.js';
import { workDashboardRouter } from './modules/work-dashboard/work-dashboard.routes.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { proposalsRouter } from './modules/proposals/proposals.routes.js';
import { estimatesRouter } from './modules/estimates/estimates.routes.js';
import { contractsRouter } from './modules/contracts/contracts.routes.js';
import { expensesRouter } from './modules/expenses/expenses.routes.js';
import { financeDashboardRouter } from './modules/finance-dashboard/finance-dashboard.routes.js';
import { ticketsRouter } from './modules/tickets/tickets.routes.js';
import { kbRouter } from './modules/knowledge-base/kb.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { attachmentsRouter } from './modules/attachments/attachments.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { recurringInvoicesRouter } from './modules/recurring-invoices/recurring-invoices.routes.js';
import { AppError } from './utils/app-error.js';

export function createApp() {
  const app = express();

  // Behind a hosting proxy (Render, Railway, Vercel rewrites, Nginx) every request arrives from the
  // proxy's address. Trust one hop so req.ip is the real client and per-client rate limits work.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS configuration with explicit credentials and allowed origins
  app.use(
    cors({
      origin: [env.APP_ORIGIN, 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-xsrf-token'],
      exposedHeaders: ['set-cookie'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // 4. CSRF protection on cookie-authenticated requests
  app.use(csrfProtection);

  // 5. Health Check Endpoint
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'business-crm-api',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // 6. Mount Module Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/audit-logs', auditRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/v1/leads', leadsRouter);
  app.use('/api/v1/activities', activitiesRouter);
  app.use('/api/v1/crm-dashboard', crmDashboardRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/milestones', milestonesRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/time-entries', timeTrackingRouter);
  app.use('/api/v1/work-dashboard', workDashboardRouter);
  app.use('/api/v1/invoices', invoicesRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/recurring-invoices', recurringInvoicesRouter);
  app.use('/api/v1/proposals', proposalsRouter);
  app.use('/api/v1/estimates', estimatesRouter);
  app.use('/api/v1/contracts', contractsRouter);
  app.use('/api/v1/expenses', expensesRouter);
  app.use('/api/v1/finance-dashboard', financeDashboardRouter);
  app.use('/api/v1/tickets', ticketsRouter);
  app.use('/api/v1/knowledge-base', kbRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/attachments', attachmentsRouter);
  app.use('/api/v1/uploads', uploadsRouter);
  app.use('/api/v1/settings', settingsRouter);

  // 7. Catch 404 for unhandled API routes
  app.use('*', (req: Request, _res: Response, next) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
  });

  // 8. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
