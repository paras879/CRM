import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateProposalSchema,
  UpdateProposalSchema,
  ListProposalsQuerySchema,
} from './proposals.schema.js';
import * as controller from './proposals.controller.js';

export const proposalsRouter = Router();

proposalsRouter.use(requireAuth);

proposalsRouter.get(
  '/',
  requirePermission('proposals.view'),
  validate({ query: ListProposalsQuerySchema }),
  controller.listProposals
);

proposalsRouter.get(
  '/:proposalId/pdf',
  requirePermission('proposals.view'),
  controller.downloadProposalPdf
);

proposalsRouter.get(
  '/:proposalId',
  requirePermission('proposals.view'),
  controller.getProposal
);

proposalsRouter.post(
  '/',
  requirePermission('proposals.create'),
  validate({ body: CreateProposalSchema }),
  controller.createProposal
);

proposalsRouter.put(
  '/:proposalId',
  requirePermission('proposals.update'),
  validate({ body: UpdateProposalSchema }),
  controller.updateProposal
);

proposalsRouter.patch(
  '/:proposalId',
  requirePermission('proposals.update'),
  validate({ body: UpdateProposalSchema }),
  controller.updateProposal
);

proposalsRouter.post(
  '/:proposalId/convert-to-invoice',
  requirePermission('invoices.create'),
  controller.convertProposalToInvoice
);

proposalsRouter.patch(
  '/:proposalId/archive',
  requirePermission('proposals.update'),
  controller.archiveProposal
);
