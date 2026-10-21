import { Request, Response, NextFunction } from 'express';
import * as service from './finance-dashboard.service.js';

export async function getFinancialSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getFinancialSummary(req.user!.companyId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
