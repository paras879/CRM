import { z } from 'zod';
import { MilestoneStatus } from '@prisma/client';

export const CreateMilestoneSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  name: z.string().trim().min(2, 'Milestone name must be at least 2 characters').max(150),
  title: z.string().trim().max(150).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(MilestoneStatus).default(MilestoneStatus.PENDING),
  order: z.coerce.number().int().default(0),
});

export const UpdateMilestoneSchema = z.object({
  name: z.string().trim().min(2, 'Milestone name must be at least 2 characters').max(150).optional(),
  title: z.string().trim().max(150).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  completedAt: z.coerce.date().optional().nullable(),
  order: z.coerce.number().int().optional(),
  isArchived: z.boolean().optional(),
});

export const ListMilestonesQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;
export type ListMilestonesQuery = z.infer<typeof ListMilestonesQuerySchema>;
