import express, { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { env } from '../../config/env.js';
import * as service from './uploads.service.js';

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

const UploadQuerySchema = z.object({ fileName: z.string().trim().min(1).max(255) });
const UploadParamsSchema = z.object({ uploadId: z.string().uuid() });

/**
 * Upload a file to attach to a record that does not exist yet, such as a new contract or expense. The
 * file is the raw request body; the response gives the link to store on the record.
 */
uploadsRouter.post(
  '/',
  validate({ query: UploadQuerySchema }),
  express.raw({ type: () => true, limit: `${env.MAX_UPLOAD_MB}mb` }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.saveUpload(req.user!.companyId, String(req.query.fileName), req.body as Buffer);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }
);

uploadsRouter.get(
  '/:uploadId',
  validate({ params: UploadParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = await service.readUpload(req.user!.companyId, req.params.uploadId);
      const asciiName = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.data.length);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      res.setHeader(
        'Content-Disposition',
        `${file.inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
      );
      res.send(file.data);
    } catch (error) {
      next(error);
    }
  }
);
