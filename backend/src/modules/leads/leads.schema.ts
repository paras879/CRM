import { z } from 'zod';
import { LeadStatus, LeadPriority, CustomerType } from '@prisma/client';

export const CreateLeadSchema = z.object({
  title: z.string().trim().max(150).optional().nullable(),
  name: z.string().trim().min(2, 'Contact/Lead name must be at least 2 characters').max(150),
  companyName: z.string().trim().max(150).optional().nullable(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  value: z.coerce.number().min(0, 'Value must be positive').optional().nullable(),
  currency: z.string().trim().default('INR'),
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  statusId: z.string().uuid().optional().nullable(),
  source: z.string().trim().max(100).optional().nullable(),
  sourceId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(LeadPriority).default(LeadPriority.MEDIUM),
  description: z.string().trim().max(2000).optional().nullable(),
  nextFollowUp: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((val) => new Date(val).toISOString())),
  ownerId: z.string().uuid().optional().nullable(),
  initialNote: z.string().trim().min(1).optional(),
});

export const UpdateLeadSchema = CreateLeadSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const ListLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
  sourceId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  isConverted: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['name', 'companyName', 'value', 'createdAt', 'nextFollowUp', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const AssignLeadSchema = z.object({
  ownerId: z.string().uuid('Invalid user ID').nullable(),
});

export const ConvertLeadSchema = z.object({
  customerType: z.nativeEnum(CustomerType).default(CustomerType.COMPANY),
  companyName: z.string().trim().max(150).optional().nullable(),
  customerName: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  zipCode: z.string().trim().max(30).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  contactName: z.string().trim().min(2).optional(),
  contactTitle: z.string().trim().max(100).optional().nullable(),
});

export const CreateLeadSourceSchema = z.object({
  name: z.string().trim().min(2, 'Source name must be at least 2 characters').max(80),
  isDefault: z.boolean().default(false),
});

export const CreateLeadStatusSchema = z.object({
  name: z.string().trim().min(2, 'Status name must be at least 2 characters').max(80),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color').optional().nullable(),
  order: z.number().int().default(0),
  isDefault: z.boolean().default(false),
});

export const AddLeadNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note content cannot be empty').max(5000),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof ListLeadsQuerySchema>;
export type AssignLeadInput = z.infer<typeof AssignLeadSchema>;
export type ConvertLeadInput = z.infer<typeof ConvertLeadSchema>;
export type CreateLeadSourceInput = z.infer<typeof CreateLeadSourceSchema>;
export type CreateLeadStatusInput = z.infer<typeof CreateLeadStatusSchema>;
export type AddLeadNoteInput = z.infer<typeof AddLeadNoteSchema>;
