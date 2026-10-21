import { z } from 'zod';

const currencyCode = z
  .string()
  .trim()
  .length(3, 'Currency code must be 3 letters')
  .regex(/^[A-Za-z]{3}$/, 'Currency code must be 3 letters')
  .transform((v) => v.toUpperCase());

export const UpdateCompanySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().nullable().or(z.literal('').transform(() => null)),
    phone: z.string().trim().max(50).nullable().or(z.literal('').transform(() => null)),
    address: z.string().trim().max(500).nullable().or(z.literal('').transform(() => null)),
  })
  .partial();

export const CreateTaxRateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  rate: z.coerce.number().min(0, 'Rate cannot be negative').max(100, 'Rate cannot exceed 100'),
  isDefault: z.boolean().optional().default(false),
});

export const UpdateTaxRateSchema = CreateTaxRateSchema.partial();

export const CreateCurrencySchema = z.object({
  code: currencyCode,
  symbol: z.string().trim().min(1, 'Symbol is required').max(8),
  isDefault: z.boolean().optional().default(false),
});

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});

export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
export type CreateTaxRateInput = z.infer<typeof CreateTaxRateSchema>;
export type UpdateTaxRateInput = z.infer<typeof UpdateTaxRateSchema>;
export type CreateCurrencyInput = z.infer<typeof CreateCurrencySchema>;
