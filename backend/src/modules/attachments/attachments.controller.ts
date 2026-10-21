import { Request, Response, NextFunction } from 'express';
import * as service from './attachments.service.js';
import { ListAttachmentsQuery, UploadAttachmentQuery } from './attachments.schema.js';

export async function listAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listAttachments(req.user!.companyId, req.query as unknown as ListAttachmentsQuery);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.uploadAttachment(
      req.user!.companyId,
      req.user!.id,
      req.query as unknown as UploadAttachmentQuery,
      req.headers['content-type'] || '',
      req.body as Buffer
    );
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { attachment, data } = await service.getAttachmentFile(req.user!.companyId, req.params.attachmentId);
    const asciiName = attachment.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', data.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`
    );
    res.send(data);
  } catch (error) {
    next(error);
  }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteAttachment(req.user!.companyId, req.user!.id, req.params.attachmentId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
