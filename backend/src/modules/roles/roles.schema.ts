import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50),
  description: z.string().max(255).optional(),
  permissionKeys: z.array(z.string()).min(1, 'At least one permission must be granted'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
