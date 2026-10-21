import { Request, Response, NextFunction } from 'express';
import { getCompany } from '../settings/settings.service.js';
import { renderDocumentPdf, DocumentPdfData } from '../../utils/document-pdf.js';
import * as service from './proposals.service.js';

export async function listProposals(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listProposals(req.user!.companyId, req.query as any);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getProposalById(req.user!.companyId, req.params.proposalId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createProposal(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateProposal(req.user!.companyId, req.params.proposalId, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function convertProposalToInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.convertProposalToInvoice(req.user!.companyId, req.params.proposalId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function archiveProposal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.archiveProposal(req.user!.companyId, req.params.proposalId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function downloadProposalPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const doc = await service.getProposalById(companyId, req.params.proposalId);
    const company = await getCompany(companyId);
    const pdf = await renderDocumentPdf(
      { ...(doc as any), documentType: 'PROPOSAL', invoiceNumber: doc.proposalNumber, validUntil: doc.validUntil ?? null } as DocumentPdfData,
      company
    );
    const safeName = String(doc.proposalNumber).replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}
