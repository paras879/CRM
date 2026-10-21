import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateEstimateSchema,
  UpdateEstimateSchema,
  ListEstimatesQuerySchema,
} from './estimates.schema.js';
import * as controller from './estimates.controller.js';

export const estimatesRouter = Router();

estimatesRouter.use(requireAuth);

estimatesRouter.get(
  '/',
  requirePermission('estimates.view'),
  validate({ query: ListEstimatesQuerySchema }),
  controller.listEstimates
);

estimatesRouter.get(
  '/:estimateId/pdf',
  requirePermission('estimates.view'),
  controller.downloadEstimatePdf
);

estimatesRouter.get(
  '/:estimateId',
  requirePermission('estimates.view'),
  controller.getEstimate
);

estimatesRouter.post(
  '/',
  requirePermission('estimates.create'),
  validate({ body: CreateEstimateSchema }),
  controller.createEstimate
);

estimatesRouter.put(
  '/:estimateId',
  requirePermission('estimates.update'),
  validate({ body: UpdateEstimateSchema }),
  controller.updateEstimate
);

estimatesRouter.patch(
  '/:estimateId',
  requirePermission('estimates.update'),
  validate({ body: UpdateEstimateSchema }),
  controller.updateEstimate
);

estimatesRouter.post(
  '/:estimateId/convert-to-invoice',
  requirePermission('invoices.create'),
  controller.convertEstimateToInvoice
);

estimatesRouter.patch(
  '/:estimateId/archive',
  requirePermission('estimates.update'),
  controller.archiveEstimate
);
