import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateActivitySchema,
  UpdateActivitySchema,
  CompleteActivitySchema,
  RescheduleActivitySchema,
  ListActivitiesQuerySchema,
} from './activities.schema.js';
import * as controller from './activities.controller.js';

export const activitiesRouter = Router();

// All activity routes require authentication
activitiesRouter.use(requireAuth);

activitiesRouter.get(
  '/',
  validate({ query: ListActivitiesQuerySchema }),
  controller.listActivities
);

activitiesRouter.get(
  '/:activityId',
  controller.getActivity
);

activitiesRouter.post(
  '/',
  validate({ body: CreateActivitySchema }),
  controller.createActivity
);

activitiesRouter.put(
  '/:activityId',
  validate({ body: UpdateActivitySchema }),
  controller.updateActivity
);

activitiesRouter.patch(
  '/:activityId/complete',
  validate({ body: CompleteActivitySchema }),
  controller.completeActivity
);

activitiesRouter.patch(
  '/:activityId/reschedule',
  validate({ body: RescheduleActivitySchema }),
  controller.rescheduleActivity
);

activitiesRouter.delete(
  '/:activityId',
  controller.deleteActivity
);
