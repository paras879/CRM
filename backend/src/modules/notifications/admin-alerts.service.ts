import { logger } from '../../utils/logger.js';
import { getFinancialSummary } from '../finance-dashboard/finance-dashboard.service.js';
import { getSupportOverview } from '../tickets/tickets-overview.service.js';
import { getWorkDashboardMetrics } from '../work-dashboard/work-dashboard.service.js';
import { getUserIdsWithPermission, notifyPermissionHolders } from './finance-notifications.js';
import { listCompanyIds } from './finance-alerts.service.js';
import { getUserStats } from '../users/team.service.js';

/** Sent about once a day: a 23 hour window leaves room for the hourly job to drift. */
const DIGEST_EVERY_MS = 23 * 60 * 60 * 1000;

interface DigestItem {
  count: number;
  singular: string;
  plural: string;
}

function describe(items: DigestItem[]): string {
  return items
    .filter((i) => i.count > 0)
    .map((i) => `${i.count} ${i.count === 1 ? i.singular : i.plural}`)
    .join(' • ');
}

export interface AdminAlertsResult {
  digests: number;
}

/**
 * One daily summary for administrators of everything that is late or waiting: overdue invoices,
 * tickets past their deadline, overdue tasks and projects, expenses awaiting approval and invitations
 * nobody has accepted. Nothing is sent when there is nothing to act on.
 */
export async function runAdminAlerts(now: Date = new Date()): Promise<AdminAlertsResult> {
  const result: AdminAlertsResult = { digests: 0 };

  for (const companyId of await listCompanyIds()) {
    try {
      const [finance, userStats] = await Promise.all([getFinancialSummary(companyId), getUserStats(companyId, now)]);
      const adminIds = await getUserIdsWithPermission(companyId, 'audit.view');
      if (adminIds.length === 0) continue;

      const support = await getSupportOverview(companyId, adminIds[0], now);
      const work = await getWorkDashboardMetrics(companyId, adminIds[0], [], ['Administrator']);

      const items: DigestItem[] = [
        { count: finance.actionNeeded.overdueInvoiceCount, singular: 'overdue invoice', plural: 'overdue invoices' },
        { count: support.counts.overdue, singular: 'ticket past its deadline', plural: 'tickets past their deadline' },
        { count: work.overdueTasksCount, singular: 'overdue task', plural: 'overdue tasks' },
        { count: work.overdueProjectsCount, singular: 'overdue project', plural: 'overdue projects' },
        { count: finance.actionNeeded.pendingExpenseCount, singular: 'expense awaiting approval', plural: 'expenses awaiting approval' },
        { count: userStats.staleInvites, singular: 'invitation not accepted', plural: 'invitations not accepted' },
      ];
      const total = items.reduce((sum, i) => sum + i.count, 0);
      if (total === 0) continue;

      const sent = await notifyPermissionHolders(
        companyId,
        'audit.view',
        {
          type: 'admin.digest',
          title: `Daily summary: ${total} item${total === 1 ? ' needs' : 's need'} attention`,
          body: describe(items),
          link: '/dashboard',
        },
        { dedupeWindowMs: DIGEST_EVERY_MS, includeRead: true }
      );
      if (sent > 0) result.digests += 1;
    } catch (error) {
      logger.warn('Failed to build the admin summary', { error, companyId });
    }
  }

  if (result.digests > 0) logger.info(`Admin alerts: ${result.digests} daily summary notification(s)`);
  return result;
}
