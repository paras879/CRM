import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import * as auditService from './audit.service.js';

const router = Router();

const listAuditLogsQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  entityType: z.string().optional(),
  action: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  requirePermission('audit.view'),
  validate({ query: listAuditLogsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await auditService.listAuditLogs(req.user!.companyId, req.query as any);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export const auditRouter = router;
