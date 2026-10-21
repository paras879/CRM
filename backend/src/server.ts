import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, prisma } from './config/database.js';
import { logger } from './utils/logger.js';
import { runDueRecurringInvoices } from './modules/recurring-invoices/recurring-invoices.service.js';
import { runFinanceAlerts } from './modules/notifications/finance-alerts.service.js';
import { runSupportAlerts } from './modules/notifications/support-notifications.js';
import { runWorkAlerts } from './modules/notifications/work-alerts.service.js';
import { runAdminAlerts } from './modules/notifications/admin-alerts.service.js';

const RECURRING_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const FINANCE_ALERTS_INTERVAL_MS = 60 * 60 * 1000;

async function bootstrap() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Business CRM API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`👉 Health check: http://localhost:${env.PORT}/api/v1/health`);
    logger.info(`👉 API Base: http://localhost:${env.PORT}/api/v1`);
  });

  // Generate due recurring invoices on start-up and every 15 minutes. Runs are claimed atomically,
  // so several API instances can safely do this at the same time.
  const runRecurring = async () => {
    try {
      const { generated, failed } = await runDueRecurringInvoices();
      if (generated.length || failed.length) {
        logger.info(`Recurring invoices: ${generated.length} generated, ${failed.length} failed`);
      }
    } catch (error) {
      logger.error('Recurring invoice run failed:', { error });
    }
  };
  void runRecurring();
  const recurringTimer = setInterval(runRecurring, RECURRING_CHECK_INTERVAL_MS);

  // Remind the finance team about overdue invoices and expiring contracts, support about late tickets, and everyone about late work. Reminders are
  // de-duplicated, so an hourly check sends at most one per invoice per day.
  const runAlerts = async () => {
    try {
      await runFinanceAlerts();
      await runSupportAlerts();
      await runWorkAlerts();
      await runAdminAlerts();
    } catch (error) {
      logger.error('Finance alerts run failed:', { error });
    }
  };
  void runAlerts();
  const alertsTimer = setInterval(runAlerts, FINANCE_ALERTS_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received: closing HTTP server...`);
    clearInterval(recurringTimer);
    clearInterval(alertsTimer);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await prisma.$disconnect();
      logger.info('Prisma disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', { error });
  process.exit(1);
});
