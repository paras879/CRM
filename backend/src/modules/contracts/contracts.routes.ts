import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateContractSchema,
  UpdateContractSchema,
  ListContractsQuerySchema,
} from './contracts.schema.js';
import * as controller from './contracts.controller.js';

export const contractsRouter = Router();

contractsRouter.use(requireAuth);

contractsRouter.get(
  '/',
  requirePermission('contracts.view'),
  validate({ query: ListContractsQuerySchema }),
  controller.listContracts
);

contractsRouter.get(
  '/:contractId',
  requirePermission('contracts.view'),
  controller.getContract
);

contractsRouter.post(
  '/',
  requirePermission('contracts.create'),
  validate({ body: CreateContractSchema }),
  controller.createContract
);

contractsRouter.put(
  '/:contractId',
  requirePermission('contracts.update'),
  validate({ body: UpdateContractSchema }),
  controller.updateContract
);

contractsRouter.patch(
  '/:contractId',
  requirePermission('contracts.update'),
  validate({ body: UpdateContractSchema }),
  controller.updateContract
);

contractsRouter.patch(
  '/:contractId/archive',
  requirePermission('contracts.update'),
  controller.archiveContract
);
