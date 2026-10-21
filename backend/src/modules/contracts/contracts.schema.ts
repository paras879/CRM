import { z } from 'zod';
import { fileLinkSchema } from '../../utils/file-link.js';
import { ContractStatus } from '@prisma/client';

export const ContractBaseSchema = z.object({
  customerId: z.string().uuid('Valid customer ID is required'),
  projectId: z.string().uuid().nullable().optional(),
  subject: z.string().min(1, 'Contract subject is required').max(255),
  contractType: z.string().max(100).optional().default('Standard'),
  value: z.number().min(0, 'Contract value cannot be negative').optional(),
  contractValue: z.number().min(0).optional(),
  currency: z.string().min(3).max(3).optional().default('INR'),
  status: z.nativeEnum(ContractStatus).optional().default(ContractStatus.DRAFT),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable().optional(),
  description: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  attachmentUrl: fileLinkSchema.nullable().optional(),
});

export const CreateContractSchema = ContractBaseSchema.refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate).getTime() >= new Date(data.startDate).getTime();
    }
    return true;
  },
  {
    message: 'Contract end date must be on or after start date',
    path: ['endDate'],
  }
);

export const UpdateContractSchema = ContractBaseSchema.partial();

export const ListContractsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  expiringSoon: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'value', 'contractNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
export type ListContractsQuery = z.infer<typeof ListContractsQuerySchema>;
