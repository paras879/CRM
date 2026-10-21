import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import { requireSuperAdmin } from '../users/super-admin.js';
import {
  UpdateCompanySchema,
  CreateTaxRateSchema,
  UpdateTaxRateSchema,
  UpdateCurrencySchema,
  CreateCurrencySchema,
  IdParamSchema,
} from './settings.schema.js';
import * as service from './settings.service.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

type Handler = (req: Request) => Promise<{ status?: number; body?: unknown }>;

function handle(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status = 200, body } = await fn(req);
      if (body === undefined) {
        res.status(status).send();
      } else {
        res.status(status).json(body);
      }
    } catch (error) {
      next(error);
    }
  };
}

const companyId = (req: Request) => req.user!.companyId;
const actorId = (req: Request) => req.user!.id;

// Company profile
settingsRouter.get(
  '/company',
  requirePermission('company.view'),
  handle(async (req) => ({ body: { data: await service.getCompany(companyId(req)) } }))
);

settingsRouter.put(
  '/company',
  requirePermission('company.update'),
  validate({ body: UpdateCompanySchema }),
  handle(async (req) => ({ body: { data: await service.updateCompany(companyId(req), actorId(req), req.body) } }))
);

// Tax rates
settingsRouter.get(
  '/tax-rates',
  requirePermission('company.view'),
  handle(async (req) => ({ body: { data: await service.listTaxRates(companyId(req)) } }))
);

settingsRouter.post(
  '/tax-rates',
  requirePermission('company.update'),
  validate({ body: CreateTaxRateSchema }),
  handle(async (req) => ({
    status: 201,
    body: { data: await service.createTaxRate(companyId(req), actorId(req), req.body) },
  }))
);

settingsRouter.put(
  '/tax-rates/:id',
  requirePermission('company.update'),
  validate({ params: IdParamSchema, body: UpdateTaxRateSchema }),
  handle(async (req) => ({
    body: { data: await service.updateTaxRate(companyId(req), actorId(req), req.params.id, req.body) },
  }))
);

settingsRouter.delete(
  '/tax-rates/:id',
  requirePermission('company.update'),
  validate({ params: IdParamSchema }),
  handle(async (req) => {
    await service.deleteTaxRate(companyId(req), actorId(req), req.params.id);
    return { status: 204 };
  })
);

// Currencies
settingsRouter.get(
  '/currencies',
  requirePermission('company.view'),
  handle(async (req) => ({ body: { data: await service.listCurrencies(companyId(req)) } }))
);

settingsRouter.post(
  '/currencies',
  requirePermission('company.update'),
  requireSuperAdmin('change currencies'),
  validate({ body: CreateCurrencySchema }),
  handle(async (req) => ({
    status: 201,
    body: { data: await service.createCurrency(companyId(req), actorId(req), req.body) },
  }))
);

settingsRouter.put(
  '/currencies/:id',
  requirePermission('company.update'),
  requireSuperAdmin('change currencies'),
  validate({ params: IdParamSchema, body: UpdateCurrencySchema }),
  handle(async (req) => ({
    body: { data: await service.updateCurrency(companyId(req), actorId(req), req.params.id, req.body) },
  }))
);

settingsRouter.post(
  '/currencies/:id/default',
  requirePermission('company.update'),
  requireSuperAdmin('change currencies'),
  validate({ params: IdParamSchema }),
  handle(async (req) => ({
    body: { data: await service.setDefaultCurrency(companyId(req), actorId(req), req.params.id) },
  }))
);

settingsRouter.delete(
  '/currencies/:id',
  requirePermission('company.update'),
  requireSuperAdmin('change currencies'),
  validate({ params: IdParamSchema }),
  handle(async (req) => {
    await service.deleteCurrency(companyId(req), actorId(req), req.params.id);
    return { status: 204 };
  })
);
