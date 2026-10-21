import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';

export const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discount: z.number().min(0, 'Discount cannot be negative').optional().default(0),
  taxRate: z.number().min(0, 'Tax rate cannot be negative').max(1, 'Tax rate must be between 0 and 1').optional().default(0),
  order: z.number().int().optional(),
});

export const CreateInvoiceSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  projectId: z.string().uuid('Invalid project ID').nullable().optional(),
  title: z.string().max(255).optional(),
  currency: z.string().min(3).max(3).optional().default('INR'),
  discount: z.number().min(0).optional().default(0),
  issuedAt: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  items: z.array(InvoiceItemSchema).min(1, 'At least one line item is required'),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().extend({
  items: z.array(InvoiceItemSchema).min(1).optional(),
});

export const ListInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  sortBy: z.enum(['createdAt', 'issuedAt', 'dueDate', 'total', 'invoiceNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof ListInvoicesQuerySchema>;
