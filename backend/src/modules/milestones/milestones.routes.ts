import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  ListMilestonesQuerySchema,
} from './milestones.schema.js';
import * as controller from './milestones.controller.js';

export const milestonesRouter = Router();

milestonesRouter.use(requireAuth);

milestonesRouter.get(
  '/',
  requirePermission('projects.view'),
  validate({ query: ListMilestonesQuerySchema }),
  controller.listMilestones
);

milestonesRouter.get(
  '/:milestoneId',
  requirePermission('projects.view'),
  controller.getMilestone
);

milestonesRouter.post(
  '/',
  requirePermission('projects.create'),
  validate({ body: CreateMilestoneSchema }),
  controller.createMilestone
);

milestonesRouter.put(
  '/:milestoneId',
  requirePermission('projects.update'),
  validate({ body: UpdateMilestoneSchema }),
  controller.updateMilestone
);
