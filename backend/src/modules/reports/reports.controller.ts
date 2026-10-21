import { Request, Response, NextFunction } from 'express';
import { getTeamUserIds, isTeamScopedManager } from '../users/team.service.js';
import * as reportsService from './reports.service.js';
import { ReportQuery } from './reports.schema.js';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { EXPORT_CONTENT_TYPES, isExportFormat, renderTable } from '../../utils/table-export.js';
import { EXPORT_TABLE_PERMISSIONS, EXPORT_TABLE_TYPES, ExportTableType } from './reports.service.js';

export async function getCrmReport(req: Request, res: Response, next: NextFunction) {
  try {
    const scopeUserIds = isTeamScopedManager(req.user!.roles)
      ? await getTeamUserIds(req.user!.companyId, req.user!.id)
      : null;
    const report = await reportsService.getCrmReport(
      req.user!.companyId,
      req.query as unknown as ReportQuery,
      scopeUserIds
    );
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
}

export async function getProjectsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportsService.getProjectsReport(req.user!.companyId);
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
}

export async function getFinancialReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportsService.getFinancialReport(req.user!.companyId, req.query as unknown as ReportQuery);
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
}

export async function getSupportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await reportsService.getSupportReport(req.user!.companyId);
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
}

async function getCompanyName(companyId: string): Promise<string | undefined> {
  if (!isDatabaseConnected) return devStore.company.name || undefined;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  return company?.name;
}

/** Download a report table as CSV, Excel (.xlsx) or PDF: GET /reports/export?type=invoices-table&format=xlsx */
export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedType = String(req.query.type ?? 'tickets-table');
    const type = (EXPORT_TABLE_TYPES as readonly string[]).includes(requestedType)
      ? (requestedType as ExportTableType)
      : 'tickets-table';
    const format = req.query.format === undefined ? 'csv' : req.query.format;
    if (!isExportFormat(format)) {
      throw AppError.badRequest('Export format must be one of: csv, xlsx, pdf');
    }

    // The route only checks reports.export; each table also needs access to the data behind it.
    const isAdmin = req.user!.roles.includes('Administrator');
    const required = EXPORT_TABLE_PERMISSIONS[type];
    if (!isAdmin && !req.user!.permissions.includes(required)) {
      throw AppError.forbidden(`You need the ${required} permission to export this report`);
    }

    const companyId = req.user!.companyId;
    const generatedAt = new Date();
    const table = await reportsService.getExportTable(companyId, type);
    const body = await renderTable(format, table, { companyName: await getCompanyName(companyId), generatedAt });

    res.setHeader('Content-Type', EXPORT_CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${generatedAt.toISOString().split('T')[0]}.${format}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(body);
  } catch (error) {
    next(error);
  }
}
