import { Request, Response, NextFunction } from 'express';
import { getCompany } from '../settings/settings.service.js';
import { renderDocumentPdf, DocumentPdfData } from '../../utils/document-pdf.js';
import * as service from './estimates.service.js';

export async function listEstimates(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listEstimates(req.user!.companyId, req.query as any);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getEstimateById(req.user!.companyId, req.params.estimateId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createEstimate(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateEstimate(req.user!.companyId, req.params.estimateId, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function convertEstimateToInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.convertEstimateToInvoice(req.user!.companyId, req.params.estimateId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function archiveEstimate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.archiveEstimate(req.user!.companyId, req.params.estimateId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function downloadEstimatePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const doc = await service.getEstimateById(companyId, req.params.estimateId);
    const company = await getCompany(companyId);
    const pdf = await renderDocumentPdf(
      { ...(doc as any), documentType: 'ESTIMATE', invoiceNumber: doc.estimateNumber, validUntil: doc.validUntil ?? null } as DocumentPdfData,
      company
    );
    const safeName = String(doc.estimateNumber).replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}
