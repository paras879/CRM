import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import * as controller from './crm-dashboard.controller.js';

export const crmDashboardRouter = Router();

crmDashboardRouter.use(requireAuth);

crmDashboardRouter.get(
  '/metrics',
  requirePermission('dashboard.view'),
  controller.getMetrics
);
