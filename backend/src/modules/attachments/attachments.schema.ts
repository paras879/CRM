import { z } from 'zod';

export const ATTACHMENT_ENTITY_TYPES = [
  'customer',
  'lead',
  'project',
  'task',
  'invoice',
  'ticket',
  'contract',
  'proposal',
  'estimate',
] as const;

export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export const ListAttachmentsQuerySchema = z.object({
  entityType: z.enum(ATTACHMENT_ENTITY_TYPES),
  entityId: z.string().uuid(),
});

export const UploadAttachmentQuerySchema = ListAttachmentsQuerySchema.extend({
  fileName: z.string().trim().min(1).max(255),
});

export const AttachmentParamsSchema = z.object({
  attachmentId: z.string().uuid(),
});

export type ListAttachmentsQuery = z.infer<typeof ListAttachmentsQuerySchema>;
export type UploadAttachmentQuery = z.infer<typeof UploadAttachmentQuerySchema>;
