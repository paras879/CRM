import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isUnread: z.coerce.boolean().optional(),
  type: z.string().optional(),
});

export const CreateNotificationInputSchema = z.object({
  companyId: z.string().uuid().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;
