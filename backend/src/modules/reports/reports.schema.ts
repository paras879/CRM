import { z } from 'zod';

export const ReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  currency: z.string().max(3).optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
  type: z.enum(['crm', 'projects', 'finance', 'support', 'leads-table', 'projects-table', 'invoices-table', 'expenses-table', 'tickets-table']).optional().default('crm'),
});

export type ReportQuery = z.infer<typeof ReportQuerySchema>;
