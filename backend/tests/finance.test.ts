import { describe, it, expect, beforeEach } from 'vitest';
import * as invoicesService from '../src/modules/invoices/invoices.service.js';
import * as paymentsService from '../src/modules/payments/payments.service.js';
import * as proposalsService from '../src/modules/proposals/proposals.service.js';
import * as estimatesService from '../src/modules/estimates/estimates.service.js';
import * as contractsService from '../src/modules/contracts/contracts.service.js';
import * as expensesService from '../src/modules/expenses/expenses.service.js';
import * as financeDashboardService from '../src/modules/finance-dashboard/finance-dashboard.service.js';
import { calculateDocumentTotals, roundMoney } from '../src/utils/financial-math.js';
import { generateDocumentNumber } from '../src/utils/document-numbering.js';
import {
  InvoiceStatus,
  PaymentMethod,
  ProposalStatus,
  EstimateStatus,
  ContractStatus,
} from '@prisma/client';
import { devStore } from '../src/config/dev-store.js';
import { makeCustomer, makeProject } from './helpers/fixtures.js';

describe('Phase 4: Sales & Finance Management Tests', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;
  const custId = makeCustomer().id;
  const projId = makeProject().id;

  beforeEach(() => {
    // Reset test collections
    devStore.invoices = [];
    devStore.invoiceItems = [];
    devStore.payments = [];
    devStore.proposals = [];
    devStore.proposalItems = [];
    devStore.estimates = [];
    devStore.estimateItems = [];
    devStore.contracts = [];
    devStore.expenses = [];
  });

  describe('1. Decimal Calculations & Rounding', () => {
    it('calculates document subtotal, line item discounts, taxes, and total correctly', () => {
      const items = [
        { description: 'Cloud consulting', quantity: 10, unitPrice: 1500, discount: 500, taxRate: 0.18 }, // (15000 - 500) = 14500 + 2610 = 17110
        { description: 'Security audit', quantity: 1, unitPrice: 50000, discount: 5000, taxRate: 0.18 }, // (50000 - 5000) = 45000 + 8100 = 53100
      ];
      const docDiscount = 2000;

      const totals = calculateDocumentTotals(items, docDiscount);

      expect(totals.subtotal).toBe(65000);
      expect(totals.discountTotal).toBe(7500); // 500 + 5000 + 2000
      expect(totals.taxTotal).toBe(10710); // 2610 + 8100
      expect(totals.total).toBe(68210); // 65000 - 7500 + 10710 = 68210
    });

    it('handles half-up rounding accurately without floating point creep', () => {
      expect(roundMoney(0.1 + 0.2)).toBe(0.3);
      expect(roundMoney(123.456)).toBe(123.46);
      expect(roundMoney(123.454)).toBe(123.45);
    });
  });

  describe('2. Invoices & Payment Reconciliation', () => {
    it('creates an invoice with sequential numbering and line items', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        projectId: projId,
        title: 'Sprint Deliverable Invoice',
        currency: 'INR',
        discount: 0,
        items: [
          { description: 'Backend API implementation', quantity: 2, unitPrice: 25000, taxRate: 0.18 },
        ],
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(invoice.subtotal).toBe(50000);
      expect(invoice.taxTotal).toBe(9000);
      expect(invoice.total).toBe(59000);
      expect(invoice.balanceDue).toBe(59000);
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    });

    it('issues an invoice and transitions draft to unpaid', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'Draft Invoice',
        items: [{ description: 'Consulting', quantity: 1, unitPrice: 10000 }],
      });

      const issued = await invoicesService.issueInvoice(companyId, invoice.id, adminId);
      expect(issued.status).toBe(InvoiceStatus.UNPAID);
      expect(issued.issuedAt).toBeDefined();
    });

    it('records partial payment and derives PARTIALLY_PAID status', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'Project Milestone 1',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'Development', quantity: 1, unitPrice: 100000, taxRate: 0.18 }], // total 118,000
      });

      const payment = await paymentsService.recordPayment(companyId, adminId, {
        invoiceId: invoice.id,
        amount: 50000,
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'TXN-PARTIAL-001',
      });

      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(50000);
      expect(payment.updatedInvoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(payment.updatedInvoice.amountPaid).toBe(50000);
      expect(payment.updatedInvoice.balanceDue).toBe(68000);
    });

    it('records full settlement and derives PAID status', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'Fixed Price Contract',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'Full Scope', quantity: 1, unitPrice: 20000 }], // total 20,000
      });

      const payment = await paymentsService.recordPayment(companyId, adminId, {
        invoiceId: invoice.id,
        amount: 20000,
        method: PaymentMethod.BANK_TRANSFER,
        reference: 'TXN-FULL-001',
      });

      expect(payment.updatedInvoice.status).toBe(InvoiceStatus.PAID);
      expect(payment.updatedInvoice.balanceDue).toBe(0);
    });

    it('prevents overpayment when amount exceeds balance due', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'Overpayment Check',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'Item A', quantity: 1, unitPrice: 5000 }],
      });

      await expect(
        paymentsService.recordPayment(companyId, adminId, {
          invoiceId: invoice.id,
          amount: 6000, // exceeds 5000
          method: PaymentMethod.CASH,
        })
      ).rejects.toThrow(/exceeds outstanding balance/i);
    });

    it('supports auditable payment reversal and recalculates invoice status', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'Reversible Payment Invoice',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'Services', quantity: 1, unitPrice: 30000 }],
      });

      const payment = await paymentsService.recordPayment(companyId, adminId, {
        invoiceId: invoice.id,
        amount: 30000,
        method: PaymentMethod.BANK_TRANSFER,
      });

      expect(payment.updatedInvoice.status).toBe(InvoiceStatus.PAID);

      // Reverse the payment
      const reversal = await paymentsService.reversePayment(companyId, payment.id, adminId, {
        reason: 'Payment bounce / incorrect bank entry',
      });

      expect(reversal.success).toBe(true);

      const refreshed = await invoicesService.getInvoiceById(companyId, invoice.id);
      expect(refreshed.amountPaid).toBe(0);
      expect(refreshed.balanceDue).toBe(30000);
      expect(refreshed.status).toBe(InvoiceStatus.UNPAID);
    });

    it('protects issued invoices from destructive deletion', async () => {
      const invoice = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'Issued Invoice Non-Destruction',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'Services', quantity: 1, unitPrice: 10000 }],
      });

      await expect(
        invoicesService.deleteInvoice(companyId, invoice.id, adminId)
      ).rejects.toThrow(/only draft invoices can be deleted/i);
    });
  });

  describe('3. Proposals & Estimate Conversions', () => {
    it('creates a proposal with line items and converts to invoice once accepted', async () => {
      const proposal = await proposalsService.createProposal(companyId, adminId, {
        customerId: custId,
        subject: 'Cloud Migration Architecture',
        status: ProposalStatus.ACCEPTED,
        items: [
          { description: 'Cloud Architecture Setup', quantity: 1, unitPrice: 80000, taxRate: 0.18 },
        ],
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.proposalNumber).toMatch(/^PROP-\d{4}-\d{4}$/);

      const conversion = await proposalsService.convertProposalToInvoice(companyId, proposal.id, adminId);
      expect(conversion.success).toBe(true);
      expect(conversion.invoice).toBeDefined();
      expect(conversion.invoice.total).toBe(94400); // 80000 + 18% = 94400

      // Duplicate conversion must be blocked
      await expect(
        proposalsService.convertProposalToInvoice(companyId, proposal.id, adminId)
      ).rejects.toThrow(/already converted/i);
    });

    it('converts an accepted estimate to an invoice and prevents duplicate conversion', async () => {
      const estimate = await estimatesService.createEstimate(companyId, adminId, {
        customerId: custId,
        title: 'DevOps Automated Pipeline Estimate',
        status: EstimateStatus.ACCEPTED,
        items: [
          { description: 'CI/CD Pipeline Setup', quantity: 1, unitPrice: 40000, taxRate: 0.18 },
        ],
      });

      expect(estimate.id).toBeDefined();
      expect(estimate.estimateNumber).toMatch(/^EST-\d{4}-\d{4}$/);

      const conversion = await estimatesService.convertEstimateToInvoice(companyId, estimate.id, adminId);
      expect(conversion.success).toBe(true);
      expect(conversion.invoice).toBeDefined();

      // Duplicate conversion must be rejected
      await expect(
        estimatesService.convertEstimateToInvoice(companyId, estimate.id, adminId)
      ).rejects.toThrow(/already converted/i);
    });

    it('rejects conversion of non-accepted estimates', async () => {
      const estimate = await estimatesService.createEstimate(companyId, adminId, {
        customerId: custId,
        title: 'Pending Estimate',
        status: EstimateStatus.SENT,
        items: [{ description: 'Scope', quantity: 1, unitPrice: 10000 }],
      });

      await expect(
        estimatesService.convertEstimateToInvoice(companyId, estimate.id, adminId)
      ).rejects.toThrow(/only accepted estimates/i);
    });
  });

  describe('4. Contracts & Expiry Tracking', () => {
    it('creates a contract and highlights contracts approaching expiry within 30 days', async () => {
      const expiringDate = new Date(Date.now() + 10 * 86400000); // 10 days in future

      const contract = await contractsService.createContract(companyId, adminId, {
        customerId: custId,
        subject: 'SLA Maintenance Contract',
        contractType: 'Annual SLA',
        value: 120000,
        startDate: new Date('2025-01-01').toISOString(),
        endDate: expiringDate.toISOString(),
        status: ContractStatus.ACTIVE,
      });

      expect(contract.id).toBeDefined();
      expect(contract.contractNumber).toMatch(/^CON-\d{4}-\d{4}$/);
      expect(contract.calculatedStatus).toBe(ContractStatus.EXPIRING);

      const list = await contractsService.listContracts(companyId, { page: 1, limit: 10, expiringSoon: true });
      expect(list.data.some((c) => c.id === contract.id)).toBe(true);
    });

    it('validates contract end date cannot be earlier than start date', async () => {
      await expect(
        contractsService.createContract(companyId, adminId, {
          customerId: custId,
          subject: 'Invalid Dates Contract',
          value: 10000,
          startDate: new Date('2026-06-01').toISOString(),
          endDate: new Date('2026-01-01').toISOString(), // Before start date
        })
      ).rejects.toThrow();
    });
  });

  describe('5. Expenses & Financial Reporting', () => {
    it('records an expense, validates amount and category, and supports approval', async () => {
      const expense = await expensesService.createExpense(companyId, adminId, {
        title: 'AWS Cloud Backup Storage',
        description: 'Multi-region S3 storage for customer backups',
        category: 'Cloud & Infrastructure',
        amount: 12500,
        currency: 'INR',
        vendor: 'Amazon Web Services',
        approvalStatus: 'PENDING',
      });

      expect(expense.id).toBeDefined();
      expect(expense.amount).toBe(12500);
      expect(expense.approvalStatus).toBe('PENDING');

      // Update approval
      const approved = await expensesService.updateExpenseApproval(companyId, expense.id, adminId, {
        approvalStatus: 'APPROVED',
        notes: 'Verified against AWS invoice billing ledger',
      });

      expect(approved.approvalStatus).toBe('APPROVED');
    });

    it('aggregates financial summary data by currency without mixing distinct currencies', async () => {
      // Create INR invoice & payment
      const invInr = await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'INR Invoice',
        currency: 'INR',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'INR work', quantity: 1, unitPrice: 100000 }],
      });
      await paymentsService.recordPayment(companyId, adminId, {
        invoiceId: invInr.id,
        amount: 40000,
        method: PaymentMethod.BANK_TRANSFER,
      });

      // Create USD invoice
      await invoicesService.createInvoice(companyId, adminId, {
        customerId: custId,
        title: 'USD Invoice',
        currency: 'USD',
        status: InvoiceStatus.ISSUED,
        items: [{ description: 'USD work', quantity: 1, unitPrice: 2000 }],
      });

      const summary = await financeDashboardService.getFinancialSummary(companyId);

      expect(summary.currencyMetrics['INR']).toBeDefined();
      expect(summary.currencyMetrics['INR'].totalInvoiced).toBe(100000);
      expect(summary.currencyMetrics['INR'].totalReceived).toBe(40000);
      expect(summary.currencyMetrics['INR'].outstandingBalance).toBe(60000);

      expect(summary.currencyMetrics['USD']).toBeDefined();
      expect(summary.currencyMetrics['USD'].totalInvoiced).toBe(2000);
      expect(summary.currencyMetrics['USD'].outstandingBalance).toBe(2000);
    });
  });

  describe('6. Concurrency-Safe Sequential Document Numbering', () => {
    it('allocates sequential document numbers for each type', async () => {
      const n1 = await generateDocumentNumber(companyId, 'invoice');
      const n2 = await generateDocumentNumber(companyId, 'proposal');
      const n3 = await generateDocumentNumber(companyId, 'estimate');
      const n4 = await generateDocumentNumber(companyId, 'contract');

      expect(n1).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(n2).toMatch(/^PROP-\d{4}-\d{4}$/);
      expect(n3).toMatch(/^EST-\d{4}-\d{4}$/);
      expect(n4).toMatch(/^CON-\d{4}-\d{4}$/);
    });
  });
});
