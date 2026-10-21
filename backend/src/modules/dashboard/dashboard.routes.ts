import { Router, Request, Response, NextFunction } from 'express';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { getTeamUserIds, isTeamScopedManager } from '../users/team.service.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/summary',
  requirePermission('dashboard.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user!.companyId;
      const userId = req.user!.id;
      const userPermissions = new Set(req.user!.permissions || []);
      const userRoles = req.user!.roles || [];
      const isAdmin = userRoles.includes('Administrator');

      const canViewUsers = isAdmin || userPermissions.has('users.view');
      const canViewRoles = isAdmin || userPermissions.has('roles.view');
      const canViewLeads = isAdmin || userPermissions.has('leads.view');
      const canViewCustomers = isAdmin || userPermissions.has('customers.view');
      const canViewProjects = isAdmin || userPermissions.has('projects.view');
      const canViewInvoices = isAdmin || userPermissions.has('invoices.view');
      const canViewAudit = isAdmin || userPermissions.has('audit.view');
      const canViewTickets = isAdmin || userPermissions.has('tickets.view');
      const canViewKB = isAdmin || userPermissions.has('kb.view');

      const isElevatedStaff = isAdmin || userRoles.includes('Manager') || userRoles.includes('Support Specialist') || userRoles.includes('Support User');

      // Managers only see their own reporting tree; admins and other elevated roles stay company-wide.
      const teamIds = isTeamScopedManager(userRoles) ? await getTeamUserIds(companyId, userId) : null;
      const teamSet = teamIds ? new Set(teamIds) : null;

      const now = new Date();

      if (!isDatabaseConnected) {
        let openTickets: number | null = null;
        let inProgressTickets: number | null = null;
        let waitingOnCustomer: number | null = null;
        let highPriorityUnresolved: number | null = null;
        let overdueTickets: number | null = null;

        if (canViewTickets) {
          const tickets = devStore.tickets.filter((t) => {
            if (t.companyId !== companyId || t.isArchived) return false;
            // Staff members without elevated roles only see tickets assigned to them or unassigned
            if (teamSet) {
              return t.assignedTo === null || teamSet.has(t.assignedTo);
            }
            if (!isElevatedStaff) {
              return t.assignedTo === userId || t.assignedTo === null;
            }
            return true;
          });

          openTickets = tickets.filter((t) => t.status === 'OPEN').length;
          inProgressTickets = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
          waitingOnCustomer = tickets.filter((t) => t.status === 'WAITING_ON_CUSTOMER').length;
          highPriorityUnresolved = tickets.filter(
            (t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
          ).length;
          overdueTickets = tickets.filter(
            (t) =>
              t.status !== 'RESOLVED' &&
              t.status !== 'CLOSED' &&
              ((t.dueDate && new Date(t.dueDate) < now) || (t.slaDueAt && new Date(t.slaDueAt) < now))
          ).length;
        }

        const unreadNotifications = devStore.notifications.filter(
          (n) => n.userId === userId && n.readAt === null
        ).length;

        const publishedArticles = canViewKB
          ? devStore.kbArticles.filter((a) => a.companyId === companyId && a.status === 'PUBLISHED' && !a.isArchived).length
          : null;

        const recentActivity = canViewAudit
          ? devStore.auditLogs.slice(0, 5).map((l) => {
              const actor = devStore.users.find((u) => u.id === l.actorId);
              return {
                ...l,
                actor: actor ? { name: actor.name, email: actor.email } : null,
              };
            })
          : [];

        return res.json({
          summary: {
            activeUsers: canViewUsers ? devStore.users.filter((u) => u.status === 'ACTIVE').length : null,
            totalRoles: canViewRoles ? devStore.roles.length : null,
            totalLeads: canViewLeads
              ? devStore.leads.filter((l) => l.companyId === companyId && !l.isArchived && (!teamSet || (l.ownerId !== null && teamSet.has(l.ownerId)))).length
              : null,
            totalCustomers: canViewCustomers
              ? devStore.customers.filter((c) => c.companyId === companyId && !c.isArchived && (!teamSet || (c.assignedToId !== null && teamSet.has(c.assignedToId)))).length
              : null,
            totalProjects: canViewProjects ? devStore.projects.filter((p) => p.companyId === companyId && !p.isArchived).length : null,
            totalInvoices: canViewInvoices ? devStore.invoices.filter((i) => i.companyId === companyId && !i.isArchived).length : null,
            openTickets,
            inProgressTickets,
            waitingOnCustomer,
            highPriorityUnresolved,
            overdueTickets,
            unreadNotifications,
            publishedArticles,
            recentActivity,
          },
        });
      }

      // Prisma PostgreSQL branch
      const tasks: Promise<any>[] = [];

      const usersPromise = canViewUsers ? prisma.user.count({ where: { companyId, status: 'ACTIVE' } }) : Promise.resolve(null);
      const rolesPromise = canViewRoles ? prisma.role.count({ where: { companyId } }) : Promise.resolve(null);
      const leadsPromise = canViewLeads
        ? prisma.lead.count({ where: { companyId, isArchived: false, ...(teamIds ? { ownerId: { in: teamIds } } : {}) } })
        : Promise.resolve(null);
      const customersPromise = canViewCustomers
        ? prisma.customer.count({ where: { companyId, isArchived: false, ...(teamIds ? { assignedToId: { in: teamIds } } : {}) } })
        : Promise.resolve(null);
      const projectsPromise = canViewProjects ? prisma.project.count({ where: { companyId, isArchived: false } }) : Promise.resolve(null);
      const invoicesPromise = canViewInvoices ? prisma.invoice.count({ where: { companyId, isArchived: false } }) : Promise.resolve(null);

      const ticketBaseWhere: any = { companyId, isArchived: false };
      if (teamIds) {
        ticketBaseWhere.OR = [{ assignedTo: { in: teamIds } }, { assignedTo: null }];
      } else if (!isElevatedStaff) {
        ticketBaseWhere.OR = [{ assignedTo: userId }, { assignedTo: null }];
      }

      const openTicketsPromise = canViewTickets ? prisma.ticket.count({ where: { ...ticketBaseWhere, status: 'OPEN' } }) : Promise.resolve(null);
      const inProgressTicketsPromise = canViewTickets ? prisma.ticket.count({ where: { ...ticketBaseWhere, status: 'IN_PROGRESS' } }) : Promise.resolve(null);
      const waitingCustomerPromise = canViewTickets ? prisma.ticket.count({ where: { ...ticketBaseWhere, status: 'WAITING_ON_CUSTOMER' } }) : Promise.resolve(null);
      const highPriorityPromise = canViewTickets
        ? prisma.ticket.count({
            where: {
              ...ticketBaseWhere,
              priority: { in: ['HIGH', 'URGENT'] },
              status: { notIn: ['RESOLVED', 'CLOSED'] },
            },
          })
        : Promise.resolve(null);
      const overdueTicketsPromise = canViewTickets
        ? prisma.ticket.count({
            where: {
              AND: [
                ticketBaseWhere,
                {
                  status: { notIn: ['RESOLVED', 'CLOSED'] },
                  OR: [{ dueDate: { lt: now } }, { slaDueAt: { lt: now } }],
                },
              ],
            },
          })
        : Promise.resolve(null);

      const notifPromise = prisma.notification.count({ where: { userId, readAt: null } });
      const kbPromise = canViewKB ? prisma.knowledgeBaseArticle.count({ where: { companyId, status: 'PUBLISHED', isArchived: false } }) : Promise.resolve(null);
      const auditsPromise = canViewAudit
        ? prisma.auditLog.findMany({
            where: { companyId },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { actor: { select: { name: true, email: true } } },
          })
        : Promise.resolve([]);

      const [
        usersCount,
        rolesCount,
        leadsCount,
        customersCount,
        projectsCount,
        invoicesCount,
        openTicketsCount,
        inProgressTicketsCount,
        waitingCustomerCount,
        highPriorityUnresolvedCount,
        overdueTicketsCount,
        unreadNotificationsCount,
        publishedArticlesCount,
        recentAudits,
      ] = await Promise.all([
        usersPromise,
        rolesPromise,
        leadsPromise,
        customersPromise,
        projectsPromise,
        invoicesPromise,
        openTicketsPromise,
        inProgressTicketsPromise,
        waitingCustomerPromise,
        highPriorityPromise,
        overdueTicketsPromise,
        notifPromise,
        kbPromise,
        auditsPromise,
      ]);

      res.json({
        summary: {
          activeUsers: usersCount,
          totalRoles: rolesCount,
          totalLeads: leadsCount,
          totalCustomers: customersCount,
          totalProjects: projectsCount,
          totalInvoices: invoicesCount,
          openTickets: openTicketsCount,
          inProgressTickets: inProgressTicketsCount,
          waitingOnCustomer: waitingCustomerCount,
          highPriorityUnresolved: highPriorityUnresolvedCount,
          overdueTickets: overdueTicketsCount,
          unreadNotifications: unreadNotificationsCount,
          publishedArticles: publishedArticlesCount,
          recentActivity: recentAudits,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export const dashboardRouter = router;
