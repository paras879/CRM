import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  RecordPaymentSchema,
  ReversePaymentSchema,
  ListPaymentsQuerySchema,
} from './payments.schema.js';
import * as controller from './payments.controller.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

paymentsRouter.get(
  '/',
  requirePermission('payments.view'),
  validate({ query: ListPaymentsQuerySchema }),
  controller.listPayments
);

paymentsRouter.post(
  '/',
  requirePermission('payments.record'),
  validate({ body: RecordPaymentSchema }),
  controller.recordPayment
);

paymentsRouter.post(
  '/:paymentId/reverse',
  requirePermission('payments.record'),
  validate({ body: ReversePaymentSchema }),
  controller.reversePayment
);
