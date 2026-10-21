import { Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevExpense, DevExpenseCategory } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { roundMoney } from '../../utils/financial-math.js';
import {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  UpdateExpenseApprovalInput,
  ListExpensesQuery,
} from './expenses.schema.js';

export async function listCategories(companyId: string) {
  if (isDatabaseConnected) {
    try {
      const categories = await prisma.expenseCategory.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
      });
      return categories;
    } catch {
      // Fallback
    }
  }

  return devStore.expenseCategories
    .filter((c) => c.companyId === companyId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCategory(companyId: string, input: CreateExpenseCategoryInput) {
  if (isDatabaseConnected) {
    try {
      const created = await prisma.expenseCategory.create({
        data: {
          companyId,
          name: input.name.trim(),
          description: input.description || null,
          isDefault: input.isDefault || false,
        },
      });
      return created;
    } catch {
      // Fallback
    }
  }

  const newId = `c1000000-0000-0000-0000-${String(devStore.expenseCategories.length + 1).padStart(12, '0')}`;
  const newCat: DevExpenseCategory = {
    id: newId,
    companyId,
    name: input.name.trim(),
    description: input.description || null,
    isDefault: input.isDefault || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.expenseCategories.push(newCat);
  return newCat;
}

export async function listExpenses(companyId: string, query: ListExpensesQuery) {
  const { page, limit, search, category, categoryId, projectId, customerId, startDate, endDate, approvalStatus, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  if (isDatabaseConnected) {
    try {
      const where: Prisma.ExpenseWhereInput = {
        companyId,
        ...(category ? { category } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(approvalStatus ? { approvalStatus } : {}),
        ...(startDate || endDate
          ? {
              incurredAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { vendor: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [expenses, totalCount, aggregations] = await Promise.all([
        prisma.expense.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
            categoryRef: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
        prisma.expense.count({ where }),
        prisma.expense.groupBy({
          by: ['currency'],
          where,
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const formatted = expenses.map((e) => ({
        ...e,
        amount: Number(e.amount),
      }));

      const summary = aggregations.map((a) => ({
        currency: a.currency,
        totalAmount: Number(a._sum.amount || 0),
        count: a._count.id,
      }));

      return {
        data: formatted,
        summary,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  let list = devStore.expenses.filter((e) => e.companyId === companyId);

  if (category) list = list.filter((e) => e.category === category);
  if (categoryId) list = list.filter((e) => e.categoryId === categoryId);
  if (projectId) list = list.filter((e) => e.projectId === projectId);
  if (customerId) list = list.filter((e) => e.customerId === customerId);
  if (approvalStatus) list = list.filter((e) => e.approvalStatus === approvalStatus);

  if (startDate) {
    const start = new Date(startDate).getTime();
    list = list.filter((e) => e.incurredAt.getTime() >= start);
  }
  if (endDate) {
    const end = new Date(endDate).getTime();
    list = list.filter((e) => e.incurredAt.getTime() <= end);
  }

  if (search) {
    const s = search.toLowerCase();
    list = list.filter((e) => {
      return (
        (e.title && e.title.toLowerCase().includes(s)) ||
        e.description.toLowerCase().includes(s) ||
        (e.vendor && e.vendor.toLowerCase().includes(s)) ||
        e.category.toLowerCase().includes(s)
      );
    });
  }

  list.sort((a, b) => {
    let aVal: any = a[sortBy as keyof DevExpense];
    let bVal: any = b[sortBy as keyof DevExpense];
    if (aVal instanceof Date) aVal = aVal.getTime();
    if (bVal instanceof Date) bVal = bVal.getTime();
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCount = list.length;
  const paged = list.slice(skip, skip + limit);

  const formatted = paged.map((e) => {
    const customer = e.customerId ? devStore.customers.find((c) => c.id === e.customerId) : null;
    const project = e.projectId ? devStore.projects.find((p) => p.id === e.projectId) : null;
    const categoryRef = e.categoryId ? devStore.expenseCategories.find((c) => c.id === e.categoryId) : null;
    const createdBy = e.createdById ? devStore.users.find((u) => u.id === e.createdById) : null;

    return {
      ...e,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      project: project ? { id: project.id, name: project.name } : null,
      categoryRef: categoryRef ? { id: categoryRef.id, name: categoryRef.name } : null,
      createdBy: createdBy ? { id: createdBy.id, name: createdBy.name, email: createdBy.email } : null,
    };
  });

  // Summary by currency
  const currencyTotals: Record<string, { totalAmount: number; count: number }> = {};
  for (const exp of list) {
    const cur = exp.currency || 'INR';
    if (!currencyTotals[cur]) currencyTotals[cur] = { totalAmount: 0, count: 0 };
    currencyTotals[cur].totalAmount = roundMoney(currencyTotals[cur].totalAmount + exp.amount);
    currencyTotals[cur].count += 1;
  }

  const summary = Object.entries(currencyTotals).map(([currency, data]) => ({
    currency,
    totalAmount: data.totalAmount,
    count: data.count,
  }));

  return {
    data: formatted,
    summary,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

export async function getExpenseById(companyId: string, expenseId: string) {
  if (isDatabaseConnected) {
    try {
      const expense = await prisma.expense.findFirst({
        where: { id: expenseId, companyId },
        include: {
          customer: { select: { id: true, name: true, companyName: true } },
          project: { select: { id: true, name: true } },
          categoryRef: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!expense) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');

      return {
        ...expense,
        amount: Number(expense.amount),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
    }
  }

  // DevStore
  const expense = devStore.expenses.find((e) => e.id === expenseId && e.companyId === companyId);
  if (!expense) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');

  const customer = expense.customerId ? devStore.customers.find((c) => c.id === expense.customerId) : null;
  const project = expense.projectId ? devStore.projects.find((p) => p.id === expense.projectId) : null;
  const categoryRef = expense.categoryId ? devStore.expenseCategories.find((c) => c.id === expense.categoryId) : null;
  const createdBy = expense.createdById ? devStore.users.find((u) => u.id === expense.createdById) : null;

  return {
    ...expense,
    customer: customer || null,
    project: project || null,
    categoryRef: categoryRef || null,
    createdBy: createdBy || null,
  };
}

export async function createExpense(companyId: string, actorId: string, input: CreateExpenseInput) {
  // Validate relations
  if (isDatabaseConnected) {
    if (input.customerId) {
      const cust = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
      if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found in this company');
    }
    if (input.projectId) {
      const proj = await prisma.project.findFirst({ where: { id: input.projectId, companyId } });
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project not found in this company');
    }
  } else {
    if (input.customerId) {
      const cust = devStore.customers.find((c) => c.id === input.customerId && c.companyId === companyId);
      if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found in this company');
    }
    if (input.projectId) {
      const proj = devStore.projects.find((p) => p.id === input.projectId && p.companyId === companyId);
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project not found in this company');
    }
  }

  const incurredAt = input.incurredAt ? new Date(input.incurredAt) : new Date();
  const amount = roundMoney(input.amount);
  const description = input.description || input.title;
  let categoryName = input.category;
  if (!categoryName && input.categoryId) {
    const foundCat = devStore.expenseCategories.find((c) => c.id === input.categoryId);
    if (foundCat) categoryName = foundCat.name;
  }
  if (!categoryName) categoryName = 'General';

  if (isDatabaseConnected) {
    try {
      const created = await prisma.expense.create({
        data: {
          companyId,
          title: input.title,
          description,
          categoryId: input.categoryId || null,
          category: categoryName,
          amount,
          currency: input.currency || 'INR',
          vendor: input.vendor || null,
          customerId: input.customerId || null,
          projectId: input.projectId || null,
          paymentMethod: input.paymentMethod || null,
          referenceNumber: input.referenceNumber || null,
          notes: input.notes || null,
          receiptUrl: input.receiptUrl || null,
          approvalStatus: input.approvalStatus || 'APPROVED',
          createdById: actorId,
          incurredAt,
        },
        include: { customer: true, project: true, categoryRef: true },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'EXPENSE_CREATED',
          entityType: 'Expense',
          entityId: created.id,
          metadata: { title: input.title, amount, category: input.category },
        },
      });

      return {
        ...created,
        amount: Number(created.amount),
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const newId = `e0000000-0000-0000-0000-${String(devStore.expenses.length + 1).padStart(12, '0')}`;
  const newExpense: DevExpense = {
    id: newId,
    companyId,
    title: input.title,
    description,
    categoryId: input.categoryId || null,
    category: categoryName,
    amount,
    currency: input.currency || 'INR',
    vendor: input.vendor || null,
    customerId: input.customerId || null,
    projectId: input.projectId || null,
    paymentMethod: input.paymentMethod || null,
    referenceNumber: input.referenceNumber || null,
    notes: input.notes || null,
    receiptUrl: input.receiptUrl || null,
    approvalStatus: input.approvalStatus || 'APPROVED',
    createdById: actorId,
    incurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  devStore.expenses.unshift(newExpense);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'EXPENSE_CREATED',
    entityType: 'Expense',
    entityId: newId,
    metadata: { title: input.title, amount, category: input.category },
    createdAt: new Date(),
  });

  return {
    ...newExpense,
    customer: input.customerId ? devStore.customers.find((c) => c.id === input.customerId) || null : null,
    project: input.projectId ? devStore.projects.find((p) => p.id === input.projectId) || null : null,
  };
}

export async function updateExpense(
  companyId: string,
  expenseId: string,
  actorId: string,
  input: UpdateExpenseInput
) {
  const existing = await getExpenseById(companyId, expenseId);
  const incurredAt = input.incurredAt !== undefined ? (input.incurredAt ? new Date(input.incurredAt) : new Date()) : existing.incurredAt;
  const amount = input.amount !== undefined ? roundMoney(input.amount) : existing.amount;

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.expense.update({
        where: { id: expenseId },
        data: {
          title: input.title || existing.title,
          description: input.description || existing.description,
          categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
          category: input.category || existing.category,
          amount,
          currency: input.currency || existing.currency,
          vendor: input.vendor !== undefined ? input.vendor : existing.vendor,
          customerId: input.customerId !== undefined ? input.customerId : existing.customerId,
          projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
          paymentMethod: input.paymentMethod !== undefined ? input.paymentMethod : existing.paymentMethod,
          referenceNumber: input.referenceNumber !== undefined ? input.referenceNumber : existing.referenceNumber,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          receiptUrl: input.receiptUrl !== undefined ? input.receiptUrl : existing.receiptUrl,
          approvalStatus: input.approvalStatus || existing.approvalStatus,
          incurredAt,
        },
        include: { customer: true, project: true, categoryRef: true },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'EXPENSE_UPDATED',
          entityType: 'Expense',
          entityId: expenseId,
          metadata: { amount, category: updated.category },
        },
      });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const storeExp = devStore.expenses.find((e) => e.id === expenseId);
  if (!storeExp) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');

  if (input.title) storeExp.title = input.title;
  if (input.description) storeExp.description = input.description;
  if (input.categoryId !== undefined) storeExp.categoryId = input.categoryId;
  if (input.category) storeExp.category = input.category;
  if (input.amount !== undefined) storeExp.amount = amount;
  if (input.currency) storeExp.currency = input.currency;
  if (input.vendor !== undefined) storeExp.vendor = input.vendor;
  if (input.customerId !== undefined) storeExp.customerId = input.customerId;
  if (input.projectId !== undefined) storeExp.projectId = input.projectId;
  if (input.paymentMethod !== undefined) storeExp.paymentMethod = input.paymentMethod;
  if (input.referenceNumber !== undefined) storeExp.referenceNumber = input.referenceNumber;
  if (input.notes !== undefined) storeExp.notes = input.notes;
  if (input.receiptUrl !== undefined) storeExp.receiptUrl = input.receiptUrl;
  if (input.approvalStatus) storeExp.approvalStatus = input.approvalStatus;
  storeExp.incurredAt = incurredAt;
  storeExp.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'EXPENSE_UPDATED',
    entityType: 'Expense',
    entityId: expenseId,
    metadata: { amount, category: storeExp.category },
    createdAt: new Date(),
  });

  return getExpenseById(companyId, expenseId);
}

export async function updateExpenseApproval(
  companyId: string,
  expenseId: string,
  actorId: string,
  input: UpdateExpenseApprovalInput
) {
  const existing = await getExpenseById(companyId, expenseId);

  if (isDatabaseConnected) {
    try {
      const updated = await prisma.expense.update({
        where: { id: expenseId },
        data: {
          approvalStatus: input.approvalStatus,
          notes: input.notes ? `${existing.notes || ''}\n[Approval Note]: ${input.notes}`.trim() : existing.notes,
        },
      });

      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'EXPENSE_APPROVAL_UPDATED',
          entityType: 'Expense',
          entityId: expenseId,
          metadata: { approvalStatus: input.approvalStatus, notes: input.notes },
        },
      });

      return {
        ...updated,
        amount: Number(updated.amount),
      };
    } catch {
      // Fallback
    }
  }

  const storeExp = devStore.expenses.find((e) => e.id === expenseId);
  if (!storeExp) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');

  storeExp.approvalStatus = input.approvalStatus;
  if (input.notes) {
    storeExp.notes = `${storeExp.notes || ''}\n[Approval Note]: ${input.notes}`.trim();
  }
  storeExp.updatedAt = new Date();

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'EXPENSE_APPROVAL_UPDATED',
    entityType: 'Expense',
    entityId: expenseId,
    metadata: { approvalStatus: input.approvalStatus, notes: input.notes },
    createdAt: new Date(),
  });

  return getExpenseById(companyId, expenseId);
}

export async function deleteExpense(companyId: string, expenseId: string, actorId: string) {
  const existing = await getExpenseById(companyId, expenseId);

  if (isDatabaseConnected) {
    try {
      await prisma.expense.delete({ where: { id: expenseId } });
      await prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'EXPENSE_DELETED',
          entityType: 'Expense',
          entityId: expenseId,
          metadata: { title: existing.title, amount: existing.amount },
        },
      });
      return { success: true };
    } catch {
      // Fallback
    }
  }

  devStore.expenses = devStore.expenses.filter((e) => e.id !== expenseId);

  devStore.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    companyId,
    actorId,
    action: 'EXPENSE_DELETED',
    entityType: 'Expense',
    entityId: expenseId,
    metadata: { title: existing.title, amount: existing.amount },
    createdAt: new Date(),
  });

  return { success: true };
}
