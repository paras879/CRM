import { z } from 'zod';
import { UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Valid email is required')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  roleIds: z.array(z.string().uuid()).min(1, 'At least one role must be assigned'),
  managerId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().email('Valid email is required'))
    .optional(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .optional(),
  status: z.nativeEnum(UserStatus).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  managerId: z.string().uuid().nullable().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
