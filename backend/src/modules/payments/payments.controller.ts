import { Request, Response, NextFunction } from 'express';
import * as service from './payments.service.js';
import { notifyPaymentRecorded, notifyPaymentReversed } from '../notifications/finance-notifications.js';

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listPayments(req.user!.companyId, req.query as any);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.recordPayment(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
    void notifyPaymentRecorded(req.user!.companyId, req.user!.id, {
      id: result.id,
      invoiceId: result.invoiceId,
      amount: Number(result.amount),
      currency: result.currency,
    });
  } catch (err) {
    next(err);
  }
}

export async function reversePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.reversePayment(req.user!.companyId, req.params.paymentId, req.user!.id, req.body);
    res.json(result);
    void notifyPaymentReversed(req.user!.companyId, req.user!.id, req.params.paymentId);
  } catch (err) {
    next(err);
  }
}
