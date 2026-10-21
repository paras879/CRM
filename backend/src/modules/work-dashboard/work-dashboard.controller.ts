import { Request, Response, NextFunction } from 'express';
import * as workDashboardService from './work-dashboard.service.js';

export async function getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await workDashboardService.getWorkDashboardMetrics(
      req.user!.companyId,
      req.user!.id,
      req.user!.permissions,
      req.user!.roles
    );
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
}
