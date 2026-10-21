import { Request, Response, NextFunction } from 'express';
import * as service from './expenses.service.js';
import { notifyExpenseDecision, notifyExpenseSubmitted } from '../notifications/finance-notifications.js';

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listCategories(req.user!.companyId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createCategory(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listExpenses(req.user!.companyId, req.query as any);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getExpenseById(req.user!.companyId, req.params.expenseId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createExpense(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
    void notifyExpenseSubmitted(req.user!.companyId, req.user!.id, result);
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateExpense(req.user!.companyId, req.params.expenseId, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateExpenseApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateExpenseApproval(req.user!.companyId, req.params.expenseId, req.user!.id, req.body);
    res.json({ success: true, data: result });
    void notifyExpenseDecision(req.user!.companyId, req.user!.id, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteExpense(req.user!.companyId, req.params.expenseId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
