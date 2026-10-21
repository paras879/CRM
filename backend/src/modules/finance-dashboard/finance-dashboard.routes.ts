import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import * as controller from './finance-dashboard.controller.js';

export const financeDashboardRouter = Router();

financeDashboardRouter.use(requireAuth);

financeDashboardRouter.get(
  '/summary',
  requirePermission('reports.view'),
  controller.getFinancialSummary
);
