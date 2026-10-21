import { Request, Response, NextFunction } from 'express';
import * as crmDashboardService from './crm-dashboard.service.js';
import { AppError } from '../../utils/app-error.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD. Both are needed; the end date covers the whole day. */
function parseRange(query: Request['query']) {
  const { startDate, endDate } = query;
  if (startDate === undefined && endDate === undefined) return undefined;
  if (typeof startDate !== 'string' || typeof endDate !== 'string' || !DATE_ONLY.test(startDate) || !DATE_ONLY.test(endDate)) {
    throw AppError.badRequest('Provide both startDate and endDate as YYYY-MM-DD');
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  // JavaScript quietly rolls 2026-02-31 over to March 3, so confirm the date survives a round trip.
  const isRealDate = (date: Date, text: string) => !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
  if (!isRealDate(start, startDate) || !isRealDate(end, endDate)) {
    throw AppError.badRequest('startDate and endDate must be real calendar dates');
  }
  if (start > end) {
    throw AppError.badRequest('startDate cannot be after endDate');
  }
  return { start, end };
}

export async function getMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const metrics = await crmDashboardService.getCrmDashboardMetrics(
      req.user!.companyId,
      isNaN(days) ? 30 : days,
      parseRange(req.query)
    );
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
}
