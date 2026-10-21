import { z } from 'zod';
import { ActivityType, ActivityStatus } from '@prisma/client';

const ActivityFields = z.object({
  type: z.nativeEnum(ActivityType).default(ActivityType.FOLLOW_UP),
  customType: z.string().trim().max(60, 'Keep the type under 60 characters').optional().nullable(),
  subject: z.string().trim().min(2, 'Subject must be at least 2 characters').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((val) => new Date(val).toISOString())),
  assignedToId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
});

const otherNeedsALabel = (value: { type?: ActivityType; customType?: string | null }, ctx: z.RefinementCtx) => {
  if (value.type === ActivityType.OTHER && !value.customType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customType'], message: 'Say what kind of activity this is' });
  }
};

export const CreateActivitySchema = ActivityFields.superRefine(otherNeedsALabel);

export const UpdateActivitySchema = ActivityFields.partial()
  .extend({ status: z.nativeEnum(ActivityStatus).optional() })
  .superRefine(otherNeedsALabel);

export const CompleteActivitySchema = z.object({
  completedAt: z.string().datetime().optional().nullable(),
  completionNote: z.string().trim().max(1000).optional().nullable(),
});

export const RescheduleActivitySchema = z.object({
  newDueDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((val) => new Date(val).toISOString())),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const ListActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.nativeEnum(ActivityType).optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
  assignedToId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  timeframe: z.enum(['upcoming', 'overdue', 'completed', 'today', 'all']).default('all'),
  sortBy: z.enum(['dueDate', 'createdAt', 'subject']).default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;
export type CompleteActivityInput = z.infer<typeof CompleteActivitySchema>;
export type RescheduleActivityInput = z.infer<typeof RescheduleActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof ListActivitiesQuerySchema>;
