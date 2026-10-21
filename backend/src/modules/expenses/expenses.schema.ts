import { z } from 'zod';
import { fileLinkSchema } from '../../utils/file-link.js';
import { PaymentMethod } from '@prisma/client';

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const CreateExpenseSchema = z.object({
  title: z.string().min(1, 'Expense title is required').max(255),
  description: z.string().optional().default(''),
  categoryId: z.string().uuid().nullable().optional(),
  category: z.string().optional().default('General'),
  amount: z.number().positive('Expense amount must be greater than zero'),
  currency: z.string().min(3).max(3).optional().default('INR'),
  vendor: z.string().max(255).optional().nullable(),
  customerId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.OTHER),
  referenceNumber: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  receiptUrl: fileLinkSchema.nullable().optional(),
  incurredAt: z.string().datetime().optional().nullable(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().default('APPROVED'),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export const UpdateExpenseApprovalSchema = z.object({
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  notes: z.string().optional().nullable(),
});

export const ListExpensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  sortBy: z.enum(['incurredAt', 'createdAt', 'amount', 'title']).default('incurredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategorySchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
export type UpdateExpenseApprovalInput = z.infer<typeof UpdateExpenseApprovalSchema>;
export type ListExpensesQuery = z.infer<typeof ListExpensesQuerySchema>;
