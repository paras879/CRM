import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateLeadSchema,
  UpdateLeadSchema,
  ListLeadsQuerySchema,
  AssignLeadSchema,
  ConvertLeadSchema,
  CreateLeadSourceSchema,
  CreateLeadStatusSchema,
  AddLeadNoteSchema,
} from './leads.schema.js';
import * as controller from './leads.controller.js';

export const leadsRouter = Router();

// All lead routes require authentication
leadsRouter.use(requireAuth);

// Configurable Sources & Statuses
leadsRouter.get(
  '/sources',
  requirePermission('leads.view'),
  controller.listLeadSources
);

leadsRouter.post(
  '/sources',
  requirePermission('leads.create'),
  validate({ body: CreateLeadSourceSchema }),
  controller.createLeadSource
);

leadsRouter.get(
  '/statuses',
  requirePermission('leads.view'),
  controller.listLeadStatuses
);

leadsRouter.post(
  '/statuses',
  requirePermission('leads.create'),
  validate({ body: CreateLeadStatusSchema }),
  controller.createLeadStatus
);

// Lead CRUD
leadsRouter.get(
  '/',
  requirePermission('leads.view'),
  validate({ query: ListLeadsQuerySchema }),
  controller.listLeads
);

leadsRouter.get(
  '/:leadId',
  requirePermission('leads.view'),
  controller.getLead
);

leadsRouter.post(
  '/',
  requirePermission('leads.create'),
  validate({ body: CreateLeadSchema }),
  controller.createLead
);

leadsRouter.put(
  '/:leadId',
  requirePermission('leads.update'),
  validate({ body: UpdateLeadSchema }),
  controller.updateLead
);

leadsRouter.patch(
  '/:leadId/assign',
  requirePermission('leads.update'),
  validate({ body: AssignLeadSchema }),
  controller.assignLead
);

leadsRouter.patch(
  '/:leadId/archive',
  requirePermission('leads.update'),
  controller.archiveLead
);

leadsRouter.patch(
  '/:leadId/restore',
  requirePermission('leads.update'),
  controller.restoreLead
);

leadsRouter.delete(
  '/:leadId',
  requirePermission('leads.delete'),
  controller.deleteLead
);

// Lead Conversion
leadsRouter.post(
  '/:leadId/convert',
  requirePermission('leads.convert'),
  validate({ body: ConvertLeadSchema }),
  controller.convertLead
);

// Lead Notes
leadsRouter.post(
  '/:leadId/notes',
  requirePermission('leads.update'),
  validate({ body: AddLeadNoteSchema }),
  controller.addLeadNote
);
