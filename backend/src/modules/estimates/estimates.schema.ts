import { z } from 'zod';
import { EstimateStatus } from '@prisma/client';

export const EstimateItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discount: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).max(1).optional().default(0),
  order: z.number().int().optional(),
});

export const CreateEstimateSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  contactId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1, 'Title is required').max(255),
  currency: z.string().min(3).max(3).optional().default('INR'),
  discount: z.number().min(0).optional().default(0),
  validUntil: z.string().datetime().optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.nativeEnum(EstimateStatus).optional().default(EstimateStatus.DRAFT),
  items: z.array(EstimateItemSchema).min(1, 'At least one line item is required'),
});

export const UpdateEstimateSchema = CreateEstimateSchema.partial().extend({
  items: z.array(EstimateItemSchema).min(1).optional(),
});

export const ListEstimatesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(EstimateStatus).optional(),
  sortBy: z.enum(['createdAt', 'issuedAt', 'validUntil', 'total', 'estimateNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateEstimateInput = z.infer<typeof CreateEstimateSchema>;
export type UpdateEstimateInput = z.infer<typeof UpdateEstimateSchema>;
export type ListEstimatesQuery = z.infer<typeof ListEstimatesQuerySchema>;
