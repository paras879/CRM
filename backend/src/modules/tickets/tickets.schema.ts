import { z } from 'zod';
import { fileLinkSchema } from '../../utils/file-link.js';
import { TicketStatus, TicketPriority } from '@prisma/client';

export const TicketCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(255).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const CreateTicketSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required').optional().nullable(),
  contactId: z.string().uuid('Invalid contact ID').optional().nullable(),
  categoryId: z.string().optional().nullable(),
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().min(1, 'Description is required'),
  status: z.nativeEnum(TicketStatus).optional().default(TicketStatus.OPEN),
  priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.MEDIUM),
  department: z.string().max(100).optional().nullable(),
  assignedTo: z.string().uuid('Invalid assigned user ID').optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  slaDueAt: z.string().datetime().optional().nullable(),
  attachmentUrls: z.array(fileLinkSchema).optional().default([]),
});

export const UpdateTicketSchema = CreateTicketSchema.partial().extend({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  resolvedAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
});

export const CreateTicketReplySchema = z.object({
  body: z.string().min(1, 'Reply message cannot be empty'),
  isInternal: z.boolean().optional().default(false),
  attachmentUrls: z.array(fileLinkSchema).optional().default([]),
});

export const ListTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  categoryId: z.string().optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  department: z.string().optional(),
  isOverdue: z.coerce.boolean().optional(),
  isArchived: z.coerce.boolean().optional().default(false),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'slaDueAt', 'priority', 'status', 'ticketNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type CreateTicketReplyInput = z.infer<typeof CreateTicketReplySchema>;
export type ListTicketsQuery = z.infer<typeof ListTicketsQuerySchema>;
export type TicketCategoryInput = z.infer<typeof TicketCategorySchema>;
