import { z } from 'zod';
import { ProposalStatus } from '@prisma/client';

export const ProposalItemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discount: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).max(1).optional().default(0),
  order: z.number().int().optional(),
});

export const CreateProposalSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  contactId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().max(255).optional(),
  subject: z.string().min(1, 'Subject is required').max(255),
  currency: z.string().min(3).max(3).optional().default('INR'),
  discount: z.number().min(0).optional().default(0),
  validUntil: z.string().datetime().optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.nativeEnum(ProposalStatus).optional().default(ProposalStatus.DRAFT),
  items: z.array(ProposalItemSchema).min(1, 'At least one line item is required'),
});

export const UpdateProposalSchema = CreateProposalSchema.partial().extend({
  items: z.array(ProposalItemSchema).min(1).optional(),
});

export const ListProposalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(ProposalStatus).optional(),
  sortBy: z.enum(['createdAt', 'issuedAt', 'validUntil', 'total', 'proposalNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateProposalInput = z.infer<typeof CreateProposalSchema>;
export type UpdateProposalInput = z.infer<typeof UpdateProposalSchema>;
export type ListProposalsQuery = z.infer<typeof ListProposalsQuerySchema>;
