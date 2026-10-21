import { Request, Response, NextFunction } from 'express';
import * as service from './invoices.service.js';
import { notifyInvoiceVoided } from '../notifications/finance-notifications.js';
import { getCompany } from '../settings/settings.service.js';
import { renderInvoicePdf, InvoicePdfData } from './invoice-pdf.js';

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listInvoices(req.user!.companyId, req.query as any);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getInvoiceById(req.user!.companyId, req.params.invoiceId);
    res.json({ success: true, data: result, invoice: result });
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createInvoice(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result, invoice: result });
  } catch (err) {
    next(err);
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateInvoice(req.user!.companyId, req.params.invoiceId, req.user!.id, req.body);
    res.json({ success: true, data: result, invoice: result });
  } catch (err) {
    next(err);
  }
}

export async function issueInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.issueInvoice(req.user!.companyId, req.params.invoiceId, req.user!.id);
    res.json({ success: true, data: result, invoice: result });
  } catch (err) {
    next(err);
  }
}

export async function voidInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.voidInvoice(req.user!.companyId, req.params.invoiceId, req.user!.id, req.body.reason);
    res.json({ success: true, data: result, invoice: result });
    void notifyInvoiceVoided(req.user!.companyId, req.user!.id, req.params.invoiceId);
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteInvoice(req.user!.companyId, req.params.invoiceId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function downloadInvoicePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId;
    const invoice = await service.getInvoiceById(companyId, req.params.invoiceId);
    const company = await getCompany(companyId);
    const pdf = await renderInvoicePdf(invoice as unknown as InvoicePdfData, company);
    const safeName = invoice.invoiceNumber.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}
