import { z } from 'zod';
import { TaskStatus, TaskPriority } from '@prisma/client';

export const CreateTaskSchema = z
  .object({
    projectId: z.string().uuid('Invalid project ID'),
    milestoneId: z.string().uuid('Invalid milestone ID').optional().nullable(),
    title: z.string().trim().min(2, 'Task title must be at least 2 characters').max(200),
    description: z.string().trim().max(3000).optional().nullable(),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    startDate: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    estimatedHours: z.coerce.number().min(0).max(1000).optional().nullable(),
    assigneeIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return new Date(data.dueDate).getTime() >= new Date(data.startDate).getTime();
      }
      return true;
    },
    {
      message: 'Due date cannot be earlier than start date',
      path: ['dueDate'],
    }
  );

export const UpdateTaskSchema = z
  .object({
    projectId: z.string().uuid('Invalid project ID').optional(),
    milestoneId: z.string().uuid('Invalid milestone ID').optional().nullable(),
    title: z.string().trim().min(2, 'Task title must be at least 2 characters').max(200).optional(),
    description: z.string().trim().max(3000).optional().nullable(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    startDate: z.coerce.date().optional().nullable(),
    dueDate: z.coerce.date().optional().nullable(),
    completedAt: z.coerce.date().optional().nullable(),
    estimatedHours: z.coerce.number().min(0).max(1000).optional().nullable(),
    isArchived: z.boolean().optional(),
    assigneeIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return new Date(data.dueDate).getTime() >= new Date(data.startDate).getTime();
      }
      return true;
    },
    {
      message: 'Due date cannot be earlier than start date',
      path: ['dueDate'],
    }
  );

export const UpdateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

export const ListTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
  search: z.string().trim().optional(),
  projectId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignedToId: z.string().uuid().optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  dueSoon: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['title', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AddTaskCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

export const UpdateTaskCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;
export type AddTaskCommentInput = z.infer<typeof AddTaskCommentSchema>;
export type UpdateTaskCommentInput = z.infer<typeof UpdateTaskCommentSchema>;
