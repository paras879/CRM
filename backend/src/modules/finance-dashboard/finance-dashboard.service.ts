import { InvoiceStatus, ContractStatus } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore } from '../../config/dev-store.js';
import { roundMoney } from '../../utils/financial-math.js';
import { evaluateContractStatus } from '../contracts/contracts.service.js';

const ACTION_LIST_LIMIT = 5;

interface OverdueInvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  balance: number;
  currency: string;
  dueDate: Date | null;
}

function pickOverdueInvoices(rows: OverdueInvoiceRow[]) {
  return [...rows]
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, ACTION_LIST_LIMIT);
}

export async function getFinancialSummary(companyId: string) {
  if (isDatabaseConnected) {
    try {
      const now = new Date();
      const activeInvoiceStatuses = [
        InvoiceStatus.ISSUED,
        InvoiceStatus.UNPAID,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE,
      ];

      const [invoices, payments, expenses, contracts, draftInvoiceCount, pendingExpenseCount, pendingExpenses] = await Promise.all([
        prisma.invoice.findMany({
          where: { companyId, isArchived: false, status: { in: activeInvoiceStatuses } },
          select: { id: true, total: true, amountPaid: true, status: true, dueDate: true, currency: true, invoiceNumber: true, customer: { select: { name: true } } },
        }),
        prisma.payment.findMany({
          where: { invoice: { companyId }, isReversed: false },
          select: { id: true, amount: true, currency: true, paidAt: true, method: true, invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } } },
          orderBy: { paidAt: 'desc' },
          take: 10,
        }),
        prisma.expense.findMany({
          where: { companyId, approvalStatus: 'APPROVED' },
          select: { id: true, amount: true, currency: true, category: true, incurredAt: true },
        }),
        prisma.contract.findMany({
          where: { companyId, isArchived: false },
          select: { id: true, contractNumber: true, subject: true, value: true, currency: true, status: true, endDate: true, customer: { select: { name: true } } },
        }),
        prisma.invoice.count({ where: { companyId, isArchived: false, status: InvoiceStatus.DRAFT } }),
        prisma.expense.count({ where: { companyId, approvalStatus: 'PENDING' } }),
        prisma.expense.findMany({
          where: { companyId, approvalStatus: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: ACTION_LIST_LIMIT,
          select: { id: true, description: true, title: true, category: true, amount: true, currency: true, vendor: true },
        }),
      ]);
      const overdueRows: OverdueInvoiceRow[] = [];

      // Metrics by currency
      const currencyMetrics: Record<string, {
        totalInvoiced: number;
        totalReceived: number;
        outstandingBalance: number;
        overdueAmount: number;
        totalExpenses: number;
      }> = {};

      const statusDistribution: Record<string, number> = {};

      for (const inv of invoices) {
        const cur = inv.currency || 'INR';
        if (!currencyMetrics[cur]) {
          currencyMetrics[cur] = { totalInvoiced: 0, totalReceived: 0, outstandingBalance: 0, overdueAmount: 0, totalExpenses: 0 };
        }
        const total = Number(inv.total);
        const paid = Number(inv.amountPaid);
        const balance = Math.max(0, total - paid);

        currencyMetrics[cur].totalInvoiced = roundMoney(currencyMetrics[cur].totalInvoiced + total);
        currencyMetrics[cur].totalReceived = roundMoney(currencyMetrics[cur].totalReceived + paid);
        currencyMetrics[cur].outstandingBalance = roundMoney(currencyMetrics[cur].outstandingBalance + balance);

        if (inv.status === InvoiceStatus.OVERDUE || (inv.dueDate && new Date(inv.dueDate).getTime() < now.getTime() && balance > 0)) {
          currencyMetrics[cur].overdueAmount = roundMoney(currencyMetrics[cur].overdueAmount + balance);
          overdueRows.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customer?.name ?? null,
            balance,
            currency: cur,
            dueDate: inv.dueDate,
          });
        }

        statusDistribution[inv.status] = (statusDistribution[inv.status] || 0) + 1;
      }

      // Expense breakdown by category
      const expenseByCategory: Record<string, { totalAmount: number; count: number }> = {};
      for (const exp of expenses) {
        const cur = exp.currency || 'INR';
        if (!currencyMetrics[cur]) {
          currencyMetrics[cur] = { totalInvoiced: 0, totalReceived: 0, outstandingBalance: 0, overdueAmount: 0, totalExpenses: 0 };
        }
        const amt = Number(exp.amount);
        currencyMetrics[cur].totalExpenses = roundMoney(currencyMetrics[cur].totalExpenses + amt);

        if (!expenseByCategory[exp.category]) {
          expenseByCategory[exp.category] = { totalAmount: 0, count: 0 };
        }
        expenseByCategory[exp.category].totalAmount = roundMoney(expenseByCategory[exp.category].totalAmount + amt);
        expenseByCategory[exp.category].count += 1;
      }

      // Expiring contracts (within 30 days)
      const expiringContracts = contracts
        .map((c) => ({
          ...c,
          value: Number(c.value),
          calculatedStatus: evaluateContractStatus(c.status, c.endDate),
        }))
        .filter((c) => c.calculatedStatus === ContractStatus.EXPIRING || c.calculatedStatus === ContractStatus.EXPIRED)
        .slice(0, 5);

      return {
        currencyMetrics,
        statusDistribution,
        expenseByCategory: Object.entries(expenseByCategory).map(([category, d]) => ({
          category,
          totalAmount: d.totalAmount,
          count: d.count,
        })),
        recentPayments: payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
        expiringContracts,
        actionNeeded: {
          overdueInvoiceCount: overdueRows.length,
          draftInvoiceCount,
          pendingExpenseCount,
          overdueInvoices: pickOverdueInvoices(overdueRows),
          pendingExpenses: pendingExpenses.map((e) => ({
            id: e.id,
            description: e.title || e.description,
            category: e.category,
            amount: Number(e.amount),
            currency: e.currency,
            vendor: e.vendor,
          })),
        },
      };
    } catch {
      // Fallback
    }
  }

  // DevStore
  const activeStatuses: InvoiceStatus[] = [
    InvoiceStatus.ISSUED,
    InvoiceStatus.UNPAID,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
  ];

  const storeInvoices = devStore.invoices.filter(
    (i) => i.companyId === companyId && !i.isArchived && activeStatuses.includes(i.status)
  );

  const currencyMetrics: Record<string, {
    totalInvoiced: number;
    totalReceived: number;
    outstandingBalance: number;
    overdueAmount: number;
    totalExpenses: number;
  }> = {};

  const statusDistribution: Record<string, number> = {};
  const now = Date.now();
  const overdueRows: OverdueInvoiceRow[] = [];

  for (const inv of storeInvoices) {
    const cur = inv.currency || 'INR';
    if (!currencyMetrics[cur]) {
      currencyMetrics[cur] = { totalInvoiced: 0, totalReceived: 0, outstandingBalance: 0, overdueAmount: 0, totalExpenses: 0 };
    }
    const balance = Math.max(0, inv.total - inv.amountPaid);
    currencyMetrics[cur].totalInvoiced = roundMoney(currencyMetrics[cur].totalInvoiced + inv.total);
    currencyMetrics[cur].totalReceived = roundMoney(currencyMetrics[cur].totalReceived + inv.amountPaid);
    currencyMetrics[cur].outstandingBalance = roundMoney(currencyMetrics[cur].outstandingBalance + balance);

    if (inv.status === InvoiceStatus.OVERDUE || (inv.dueDate && inv.dueDate.getTime() < now && balance > 0)) {
      currencyMetrics[cur].overdueAmount = roundMoney(currencyMetrics[cur].overdueAmount + balance);
      overdueRows.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: devStore.customers.find((c) => c.id === inv.customerId)?.name ?? null,
        balance,
        currency: cur,
        dueDate: inv.dueDate,
      });
    }

    statusDistribution[inv.status] = (statusDistribution[inv.status] || 0) + 1;
  }

  const draftInvoiceCount = devStore.invoices.filter(
    (i) => i.companyId === companyId && !i.isArchived && i.status === InvoiceStatus.DRAFT
  ).length;
  const pendingStoreExpenses = devStore.expenses.filter((e) => e.companyId === companyId && e.approvalStatus === 'PENDING');

  const storeExpenses = devStore.expenses.filter((e) => e.companyId === companyId && e.approvalStatus === 'APPROVED');
  const expenseByCategory: Record<string, { totalAmount: number; count: number }> = {};

  for (const exp of storeExpenses) {
    const cur = exp.currency || 'INR';
    if (!currencyMetrics[cur]) {
      currencyMetrics[cur] = { totalInvoiced: 0, totalReceived: 0, outstandingBalance: 0, overdueAmount: 0, totalExpenses: 0 };
    }
    currencyMetrics[cur].totalExpenses = roundMoney(currencyMetrics[cur].totalExpenses + exp.amount);

    if (!expenseByCategory[exp.category]) {
      expenseByCategory[exp.category] = { totalAmount: 0, count: 0 };
    }
    expenseByCategory[exp.category].totalAmount = roundMoney(expenseByCategory[exp.category].totalAmount + exp.amount);
    expenseByCategory[exp.category].count += 1;
  }

  const recentPayments = devStore.payments
    .filter((p) => {
      const inv = devStore.invoices.find((i) => i.id === p.invoiceId);
      return inv && inv.companyId === companyId && !p.isReversed;
    })
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 10)
    .map((p) => {
      const inv = devStore.invoices.find((i) => i.id === p.invoiceId);
      const customer = inv ? devStore.customers.find((c) => c.id === inv.customerId) : null;
      return {
        ...p,
        invoice: inv ? { invoiceNumber: inv.invoiceNumber, customer: customer ? { name: customer.name } : null } : null,
      };
    });

  const expiringContracts = devStore.contracts
    .filter((c) => c.companyId === companyId && !c.isArchived)
    .map((c) => {
      const customer = devStore.customers.find((cust) => cust.id === c.customerId);
      return {
        ...c,
        calculatedStatus: evaluateContractStatus(c.status, c.endDate),
        customer: customer ? { name: customer.name } : null,
      };
    })
    .filter((c) => c.calculatedStatus === ContractStatus.EXPIRING || c.calculatedStatus === ContractStatus.EXPIRED)
    .slice(0, 5);

  return {
    currencyMetrics,
    statusDistribution,
    expenseByCategory: Object.entries(expenseByCategory).map(([category, d]) => ({
      category,
      totalAmount: d.totalAmount,
      count: d.count,
    })),
    recentPayments,
    expiringContracts,
    actionNeeded: {
      overdueInvoiceCount: overdueRows.length,
      draftInvoiceCount,
      pendingExpenseCount: pendingStoreExpenses.length,
      overdueInvoices: pickOverdueInvoices(overdueRows),
      pendingExpenses: pendingStoreExpenses
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, ACTION_LIST_LIMIT)
        .map((e) => ({
          id: e.id,
          description: e.title || e.description,
          category: e.category,
          amount: e.amount,
          currency: e.currency,
          vendor: e.vendor,
        })),
    },
  };
}
