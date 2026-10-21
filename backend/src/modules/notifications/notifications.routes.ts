import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ListNotificationsQuerySchema } from './notifications.schema.js';
import * as controller from './notifications.controller.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  validate({ query: ListNotificationsQuerySchema }),
  controller.listNotifications
);

notificationsRouter.get(
  '/unread-count',
  controller.getUnreadCount
);

notificationsRouter.patch(
  '/mark-all-read',
  controller.markAllAsRead
);

notificationsRouter.post(
  '/mark-all-read',
  controller.markAllAsRead
);

notificationsRouter.patch(
  '/:notificationId/read',
  controller.markAsRead
);
