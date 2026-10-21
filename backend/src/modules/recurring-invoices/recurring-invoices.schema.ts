import { z } from 'zod';
import { InvoiceItemSchema } from '../invoices/invoices.schema.js';

export const FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

const dateInput = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid date')
  .transform((v) => new Date(v));

export const CreateRecurringInvoiceSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(255),
  currency: z.string().length(3).transform((v) => v.toUpperCase()).optional().default('INR'),
  discount: z.number().min(0).optional().default(0),
  frequency: z.enum(FREQUENCIES),
  intervalCount: z.number().int().min(1).max(24).optional().default(1),
  startDate: dateInput,
  endDate: dateInput.nullable().optional(),
  dueInDays: z.number().int().min(0).max(365).optional().default(14),
  autoIssue: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema).min(1, 'At least one line item is required'),
});

export const UpdateRecurringInvoiceSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  discount: z.number().min(0).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  intervalCount: z.number().int().min(1).max(24).optional(),
  endDate: dateInput.nullable().optional(),
  dueInDays: z.number().int().min(0).max(365).optional(),
  autoIssue: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema).min(1).optional(),
});

export const RecurringIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateRecurringInvoiceInput = z.infer<typeof CreateRecurringInvoiceSchema>;
export type UpdateRecurringInvoiceInput = z.infer<typeof UpdateRecurringInvoiceSchema>;
export type Frequency = (typeof FREQUENCIES)[number];
