import express, { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import { env } from '../../config/env.js';
import {
  ListAttachmentsQuerySchema,
  UploadAttachmentQuerySchema,
  AttachmentParamsSchema,
} from './attachments.schema.js';
import * as controller from './attachments.controller.js';

export const attachmentsRouter = Router();

attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  '/',
  requirePermission('attachments.view'),
  validate({ query: ListAttachmentsQuerySchema }),
  controller.listAttachments
);

// Raw binary body: the file is the request body, metadata travels in the query string.
attachmentsRouter.post(
  '/',
  requirePermission('attachments.upload'),
  validate({ query: UploadAttachmentQuerySchema }),
  express.raw({ type: () => true, limit: `${env.MAX_UPLOAD_MB}mb` }),
  controller.uploadAttachment
);

attachmentsRouter.get(
  '/:attachmentId/download',
  requirePermission('attachments.view'),
  validate({ params: AttachmentParamsSchema }),
  controller.downloadAttachment
);

attachmentsRouter.delete(
  '/:attachmentId',
  requirePermission('attachments.delete'),
  validate({ params: AttachmentParamsSchema }),
  controller.deleteAttachment
);
