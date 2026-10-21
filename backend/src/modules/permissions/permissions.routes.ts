import { Router, Request, Response, NextFunction } from 'express';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  requirePermission('permissions.view'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDatabaseConnected) {
        const permissions = devStore.permissions;
        const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
          const mod = p.module || 'other';
          if (!acc[mod]) acc[mod] = [];
          acc[mod].push(p);
          return acc;
        }, {});
        return res.json({ permissions, grouped });
      }

      const permissions = await prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { key: 'asc' }],
      });

      const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
        const mod = p.module || 'other';
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push(p);
        return acc;
      }, {});

      res.json({ permissions, grouped });
    } catch (error) {
      next(error);
    }
  }
);

export const permissionsRouter = router;
