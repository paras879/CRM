import { z } from 'zod';

export const CreateTimeEntrySchema = z
  .object({
    projectId: z.string().uuid('Invalid project ID'),
    taskId: z.string().uuid('Invalid task ID').optional().nullable(),
    userId: z.string().uuid('Invalid user ID').optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date().optional().nullable(),
    minutes: z.coerce.number().int().min(1).max(10080).optional(),
    billable: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.startedAt && data.endedAt) {
        return new Date(data.endedAt).getTime() >= new Date(data.startedAt).getTime();
      }
      return true;
    },
    {
      message: 'End time cannot be earlier than start time',
      path: ['endedAt'],
    }
  );

export const UpdateTimeEntrySchema = z
  .object({
    projectId: z.string().uuid('Invalid project ID').optional(),
    taskId: z.string().uuid('Invalid task ID').optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional().nullable(),
    minutes: z.coerce.number().int().min(1).max(10080).optional(),
    billable: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startedAt && data.endedAt) {
        return new Date(data.endedAt).getTime() >= new Date(data.startedAt).getTime();
      }
      return true;
    },
    {
      message: 'End time cannot be earlier than start time',
      path: ['endedAt'],
    }
  );

export const ListTimeEntriesQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  billable: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateTimeEntryInput = z.infer<typeof CreateTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof UpdateTimeEntrySchema>;
export type ListTimeEntriesQuery = z.infer<typeof ListTimeEntriesQuerySchema>;
