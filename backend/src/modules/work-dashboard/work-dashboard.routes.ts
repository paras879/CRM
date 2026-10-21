import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import * as controller from './work-dashboard.controller.js';

export const workDashboardRouter = Router();

workDashboardRouter.use(requireAuth);

workDashboardRouter.get(
  '/metrics',
  requirePermission('projects.view'),
  controller.getDashboardMetrics
);
