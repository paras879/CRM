import { z } from 'zod';
import { CustomerType, CustomerStatus } from '@prisma/client';

export const CreateCustomerSchema = z.object({
  type: z.nativeEnum(CustomerType).default(CustomerType.COMPANY),
  name: z.string().trim().min(2, 'Customer name must be at least 2 characters').max(150),
  companyName: z.string().trim().max(150).optional().nullable(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  zipCode: z.string().trim().max(30).optional().nullable(),
  taxId: z.string().trim().max(50).optional().nullable(),
  status: z.nativeEnum(CustomerStatus).default(CustomerStatus.ACTIVE),
  assignedToId: z.string().uuid().optional().nullable(),
  initialContact: z
    .object({
      name: z.string().trim().min(2, 'Contact name must be at least 2 characters'),
      email: z.string().trim().email().optional().nullable().or(z.literal('')),
      phone: z.string().trim().optional().nullable(),
      title: z.string().trim().optional().nullable(),
      isPrimary: z.boolean().default(true),
    })
    .optional(),
  initialNote: z.string().trim().min(1).optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const ListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  type: z.nativeEnum(CustomerType).optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  assignedToId: z.string().uuid().optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.enum(['name', 'companyName', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateContactSchema = z.object({
  name: z.string().trim().min(2, 'Contact name must be at least 2 characters').max(120),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(40).optional().nullable(),
  title: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export const AddNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note content cannot be empty').max(5000),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;
export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type AddNoteInput = z.infer<typeof AddNoteSchema>;
