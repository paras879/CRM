import { z } from 'zod';
import { ProjectStatus, TaskPriority } from '@prisma/client';

export const CreateProjectSchema = z
  .object({
    name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
    status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    startDate: z.coerce.date().optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    progress: z.coerce.number().int().min(0).max(100).default(0),
    budget: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(10).default('INR'),
    projectManagerId: z.string().uuid('Invalid project manager ID').optional().nullable(),
    memberIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      const end = data.deadline || data.dueDate;
      if (data.startDate && end) {
        return new Date(end).getTime() >= new Date(data.startDate).getTime();
      }
      return true;
    },
    {
      message: 'Deadline/due date cannot be earlier than start date',
      path: ['deadline'],
    }
  );

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
    status: z.nativeEnum(ProjectStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    startDate: z.coerce.date().optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    progress: z.coerce.number().int().min(0).max(100).optional(),
    budget: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(10).optional(),
    projectManagerId: z.string().uuid('Invalid project manager ID').optional().nullable(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const end = data.deadline || data.dueDate;
      if (data.startDate && end) {
        return new Date(end).getTime() >= new Date(data.startDate).getTime();
      }
      return true;
    },
    {
      message: 'Deadline/due date cannot be earlier than start date',
      path: ['deadline'],
    }
  );

export const ListProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  customerId: z.string().uuid().optional(),
  projectManagerId: z.string().uuid().optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['name', 'status', 'priority', 'startDate', 'deadline', 'progress', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AddProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.string().trim().max(50).default('MEMBER'),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;
