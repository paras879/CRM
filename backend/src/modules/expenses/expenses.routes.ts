import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateExpenseCategorySchema,
  CreateExpenseSchema,
  UpdateExpenseSchema,
  UpdateExpenseApprovalSchema,
  ListExpensesQuerySchema,
} from './expenses.schema.js';
import * as controller from './expenses.controller.js';

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

// Categories
expensesRouter.get(
  '/categories',
  requirePermission('expenses.view'),
  controller.listCategories
);

expensesRouter.post(
  '/categories',
  requirePermission('expenses.create'),
  validate({ body: CreateExpenseCategorySchema }),
  controller.createCategory
);

// Expenses CRUD
expensesRouter.get(
  '/',
  requirePermission('expenses.view'),
  validate({ query: ListExpensesQuerySchema }),
  controller.listExpenses
);

expensesRouter.get(
  '/:expenseId',
  requirePermission('expenses.view'),
  controller.getExpense
);

expensesRouter.post(
  '/',
  requirePermission('expenses.create'),
  validate({ body: CreateExpenseSchema }),
  controller.createExpense
);

expensesRouter.put(
  '/:expenseId',
  requirePermission('expenses.update'),
  validate({ body: UpdateExpenseSchema }),
  controller.updateExpense
);

expensesRouter.patch(
  '/:expenseId',
  requirePermission('expenses.update'),
  validate({ body: UpdateExpenseSchema }),
  controller.updateExpense
);

expensesRouter.patch(
  '/:expenseId/approval',
  requirePermission('expenses.approve'),
  validate({ body: UpdateExpenseApprovalSchema }),
  controller.updateExpenseApproval
);

expensesRouter.post(
  '/:expenseId/approve',
  requirePermission('expenses.approve'),
  (req, res, next) => {
    req.body = { approvalStatus: 'APPROVED' };
    controller.updateExpenseApproval(req, res, next);
  }
);

expensesRouter.post(
  '/:expenseId/reject',
  requirePermission('expenses.approve'),
  (req, res, next) => {
    req.body = { approvalStatus: 'REJECTED' };
    controller.updateExpenseApproval(req, res, next);
  }
);

expensesRouter.delete(
  '/:expenseId',
  requirePermission('expenses.update'),
  controller.deleteExpense
);
