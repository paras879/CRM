import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateTimeEntrySchema,
  UpdateTimeEntrySchema,
  ListTimeEntriesQuerySchema,
} from './time-tracking.schema.js';
import * as controller from './time-tracking.controller.js';

export const timeTrackingRouter = Router();

timeTrackingRouter.use(requireAuth);

timeTrackingRouter.get(
  '/',
  requirePermission('projects.view'),
  validate({ query: ListTimeEntriesQuerySchema }),
  controller.listTimeEntries
);

timeTrackingRouter.post(
  '/',
  requirePermission('tasks.update'),
  validate({ body: CreateTimeEntrySchema }),
  controller.createTimeEntry
);

timeTrackingRouter.put(
  '/:entryId',
  requirePermission('tasks.update'),
  validate({ body: UpdateTimeEntrySchema }),
  controller.updateTimeEntry
);

timeTrackingRouter.delete(
  '/:entryId',
  requirePermission('tasks.update'),
  controller.deleteTimeEntry
);
