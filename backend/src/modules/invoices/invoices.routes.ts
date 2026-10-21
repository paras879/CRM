import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  ListInvoicesQuerySchema,
} from './invoices.schema.js';
import * as controller from './invoices.controller.js';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);

invoicesRouter.get(
  '/',
  requirePermission('invoices.view'),
  validate({ query: ListInvoicesQuerySchema }),
  controller.listInvoices
);

invoicesRouter.get(
  '/:invoiceId/pdf',
  requirePermission('invoices.view'),
  controller.downloadInvoicePdf
);

invoicesRouter.get(
  '/:invoiceId',
  requirePermission('invoices.view'),
  controller.getInvoice
);

invoicesRouter.post(
  '/',
  requirePermission('invoices.create'),
  validate({ body: CreateInvoiceSchema }),
  controller.createInvoice
);

invoicesRouter.put(
  '/:invoiceId',
  requirePermission('invoices.update'),
  validate({ body: UpdateInvoiceSchema }),
  controller.updateInvoice
);

invoicesRouter.patch(
  '/:invoiceId/issue',
  requirePermission('invoices.issue'),
  controller.issueInvoice
);

invoicesRouter.post(
  '/:invoiceId/issue',
  requirePermission('invoices.issue'),
  controller.issueInvoice
);

invoicesRouter.patch(
  '/:invoiceId/void',
  requirePermission('invoices.void'),
  controller.voidInvoice
);

invoicesRouter.post(
  '/:invoiceId/void',
  requirePermission('invoices.void'),
  controller.voidInvoice
);

invoicesRouter.delete(
  '/:invoiceId',
  requirePermission('invoices.update'),
  controller.deleteInvoice
);
