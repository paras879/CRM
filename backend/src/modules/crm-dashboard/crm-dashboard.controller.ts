import { Request, Response, NextFunction } from 'express';
import * as crmDashboardService from './crm-dashboard.service.js';

export async function getMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const metrics = await crmDashboardService.getCrmDashboardMetrics(
      req.user!.companyId,
      isNaN(days) ? 30 : days
    );
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
}
