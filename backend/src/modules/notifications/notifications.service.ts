import crypto from 'node:crypto';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevNotification } from '../../config/dev-store.js';
import { ListNotificationsQuery, CreateNotificationInput } from './notifications.schema.js';
import { AppError } from '../../utils/app-error.js';

export async function getUserNotifications(userId: string, query: ListNotificationsQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  if (!isDatabaseConnected) {
    let items = devStore.notifications.filter((n) => n.userId === userId);

    if (query.isUnread !== undefined) {
      items = items.filter((n) => (query.isUnread ? n.readAt === null : n.readAt !== null));
    }
    if (query.type) {
      items = items.filter((n) => n.type === query.type);
    }

    const total = items.length;
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const paged = items.slice(skip, skip + limit);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  const where: any = { userId };
  if (query.isUnread !== undefined) {
    where.readAt = query.isUnread ? null : { not: null };
  }
  if (query.type) {
    where.type = query.type;
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isDatabaseConnected) {
    return devStore.notifications.filter((n) => n.userId === userId && n.readAt === null).length;
  }

  return await prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markAsRead(userId: string, notificationId: string) {
  const now = new Date();

  if (!isDatabaseConnected) {
    const notif = devStore.notifications.find((n) => n.id === notificationId);
    if (!notif) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
    if (notif.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot modify another user’s notification.');
    }

    notif.readAt = now;
    return notif;
  }

  const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notif) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }
  if (notif.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot modify another user’s notification.');
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: now },
  });
}

export async function markAllAsRead(userId: string) {
  const now = new Date();

  if (!isDatabaseConnected) {
    let count = 0;
    devStore.notifications.forEach((n) => {
      if (n.userId === userId && n.readAt === null) {
        n.readAt = now;
        count++;
      }
    });
    return { success: true, updatedCount: count };
  }

  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: now },
  });

  return { success: true, updatedCount: result.count };
}

export interface CreateNotificationOptions {
  /**
   * How long an identical notification (same user, type and link) suppresses a new one. Defaults to
   * 5 minutes. Use 0 to always create one, e.g. two separate payments against the same invoice.
   */
  dedupeWindowMs?: number;
  /** Also treat already-read notifications as duplicates. Used by scheduled reminders. */
  includeRead?: boolean;
}

/** Like `createNotification`, but also says whether a new row was written or a recent duplicate was reused. */
export async function createNotificationIfNew(
  userId: string,
  input: CreateNotificationInput,
  options: CreateNotificationOptions = {}
) {
  const windowMs = options.dedupeWindowMs ?? 5 * 60 * 1000;
  const unreadOnly = !options.includeRead;
  const windowStart = new Date(Date.now() - windowMs);

  if (!isDatabaseConnected) {
    const existing =
      windowMs > 0
        ? devStore.notifications.find(
            (n) =>
              n.userId === userId &&
              n.type === input.type &&
              n.link === (input.link ?? null) &&
              (!unreadOnly || n.readAt === null) &&
              n.createdAt > windowStart
          )
        : undefined;
    if (existing) return { notification: existing, created: false };

    const newNotif: DevNotification = {
      id: crypto.randomUUID(),
      companyId: input.companyId ?? null,
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? null,
      readAt: null,
      createdAt: new Date(),
    };
    devStore.notifications.unshift(newNotif);
    return { notification: newNotif, created: true };
  }

  const existing =
    windowMs > 0
      ? await prisma.notification.findFirst({
          where: {
            userId,
            type: input.type,
            link: input.link ?? null,
            ...(unreadOnly ? { readAt: null } : {}),
            createdAt: { gt: windowStart },
          },
        })
      : null;
  if (existing) return { notification: existing, created: false };

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
  return { notification, created: true };
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput,
  options: CreateNotificationOptions = {}
) {
  return (await createNotificationIfNew(userId, input, options)).notification;
}
