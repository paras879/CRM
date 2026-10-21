import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import { ReportQuerySchema } from './reports.schema.js';
import * as controller from './reports.controller.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get(
  '/crm',
  requirePermission('reports.view'),
  validate({ query: ReportQuerySchema }),
  controller.getCrmReport
);

reportsRouter.get(
  '/projects',
  requirePermission('reports.view'),
  controller.getProjectsReport
);

reportsRouter.get(
  '/finance',
  requirePermission('reports.view'),
  validate({ query: ReportQuerySchema }),
  controller.getFinancialReport
);

reportsRouter.get(
  '/support',
  requirePermission('reports.view'),
  controller.getSupportReport
);

reportsRouter.get(
  '/export',
  requirePermission('reports.export'),
  controller.exportReport
);
