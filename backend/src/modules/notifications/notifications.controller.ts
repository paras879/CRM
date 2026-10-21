import { Request, Response, NextFunction } from 'express';
import * as notificationService from './notifications.service.js';
import { ListNotificationsQuery } from './notifications.schema.js';

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await notificationService.getUserNotifications(
      req.user!.id,
      req.query as unknown as ListNotificationsQuery
    );
    res.json({
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({ count, data: { unreadCount: count } });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const notif = await notificationService.markAsRead(req.user!.id, req.params.notificationId);
    res.json({ data: notif });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await notificationService.markAllAsRead(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
