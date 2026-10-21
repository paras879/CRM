import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateRecurringInvoiceSchema,
  UpdateRecurringInvoiceSchema,
  RecurringIdParamSchema,
} from './recurring-invoices.schema.js';
import * as service from './recurring-invoices.service.js';

export const recurringInvoicesRouter = Router();

recurringInvoicesRouter.use(requireAuth);

type Handler = (req: Request) => Promise<{ status?: number; body?: unknown }>;

function handle(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status = 200, body } = await fn(req);
      if (body === undefined) res.status(status).send();
      else res.status(status).json(body);
    } catch (error) {
      next(error);
    }
  };
}

const companyId = (req: Request) => req.user!.companyId;
const actorId = (req: Request) => req.user!.id;

recurringInvoicesRouter.get(
  '/',
  requirePermission('invoices.view'),
  handle(async (req) => ({ body: { data: await service.listRecurringInvoices(companyId(req)) } }))
);

recurringInvoicesRouter.post(
  '/',
  requirePermission('invoices.create'),
  validate({ body: CreateRecurringInvoiceSchema }),
  handle(async (req) => ({
    status: 201,
    body: { data: await service.createRecurringInvoice(companyId(req), actorId(req), req.body) },
  }))
);

// Generates every invoice that is due for this company (also runs automatically in the background).
recurringInvoicesRouter.post(
  '/run-due',
  requirePermission('invoices.create'),
  handle(async (req) => ({
    body: { data: await service.runDueRecurringInvoices({ companyId: companyId(req), actorId: actorId(req) }) },
  }))
);

recurringInvoicesRouter.get(
  '/:id',
  requirePermission('invoices.view'),
  validate({ params: RecurringIdParamSchema }),
  handle(async (req) => ({ body: { data: await service.getRecurringInvoice(companyId(req), req.params.id) } }))
);

recurringInvoicesRouter.put(
  '/:id',
  requirePermission('invoices.update'),
  validate({ params: RecurringIdParamSchema, body: UpdateRecurringInvoiceSchema }),
  handle(async (req) => ({
    body: { data: await service.updateRecurringInvoice(companyId(req), actorId(req), req.params.id, req.body) },
  }))
);

recurringInvoicesRouter.post(
  '/:id/generate',
  requirePermission('invoices.create'),
  validate({ params: RecurringIdParamSchema }),
  handle(async (req) => ({
    status: 201,
    body: { data: await service.generateNow(companyId(req), actorId(req), req.params.id) },
  }))
);

recurringInvoicesRouter.delete(
  '/:id',
  requirePermission('invoices.update'),
  validate({ params: RecurringIdParamSchema }),
  handle(async (req) => {
    await service.deleteRecurringInvoice(companyId(req), actorId(req), req.params.id);
    return { status: 204 };
  })
);
