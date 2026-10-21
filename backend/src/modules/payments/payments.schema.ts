import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const RecordPaymentSchema = z.object({
  invoiceId: z.string().uuid('Valid invoice ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  reference: z.string().max(255).optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().max(255).optional().nullable(),
});

export const ReversePaymentSchema = z.object({
  reason: z.string().min(3, 'Reversal reason is required to maintain audit integrity'),
});

export const ListPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  invoiceId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof ReversePaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuerySchema>;
