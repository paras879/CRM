import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevRecurringInvoice } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../utils/logger.js';
import { recordAuditLog } from '../audit/audit.service.js';
import * as invoicesService from '../invoices/invoices.service.js';
import {
  CreateRecurringInvoiceInput,
  UpdateRecurringInvoiceInput,
  Frequency,
} from './recurring-invoices.schema.js';

type TemplateItem = DevRecurringInvoice['items'][number];

/** Max invoices generated for one template in a single run, so a long outage cannot flood a customer. */
const MAX_CATCH_UP_RUNS = 12;

/**
 * The date of the nth occurrence (0-based) counted from the start date. Counting from the start
 * date, rather than from the previous run, keeps month-end schedules from drifting (31 Jan -> 28 Feb -> 31 Mar).
 */
export function occurrenceDate(startDate: Date, frequency: Frequency, intervalCount: number, index: number): Date {
  const steps = index * intervalCount;
  const d = new Date(startDate.getTime());

  if (frequency === 'WEEKLY') {
    d.setUTCDate(d.getUTCDate() + steps * 7);
    return d;
  }

  const months = frequency === 'MONTHLY' ? steps : frequency === 'QUARTERLY' ? steps * 3 : steps * 12;
  const day = startDate.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function normalize(row: any): DevRecurringInvoice {
  return {
    ...row,
    discount: Number(row.discount),
    items: (row.items as TemplateItem[]) ?? [],
  };
}

async function assertRefs(companyId: string, customerId: string, projectId?: string | null) {
  if (isDatabaseConnected) {
    const cust = await prisma.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true } });
    if (!cust) throw new AppError(400, 'INVALID_CUSTOMER', 'Customer does not exist or belong to this organization');
    if (projectId) {
      const proj = await prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
      if (!proj) throw new AppError(400, 'INVALID_PROJECT', 'Project does not exist or belong to this organization');
    }
    return;
  }
  if (!devStore.customers.some((c) => c.id === customerId && c.companyId === companyId)) {
    throw new AppError(400, 'INVALID_CUSTOMER', 'Customer does not exist or belong to this organization');
  }
  if (projectId && !devStore.projects.some((p) => p.id === projectId && p.companyId === companyId)) {
    throw new AppError(400, 'INVALID_PROJECT', 'Project does not exist or belong to this organization');
  }
}

export async function listRecurringInvoices(companyId: string) {
  if (!isDatabaseConnected) {
    return devStore.recurringInvoices
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => a.nextRunDate.getTime() - b.nextRunDate.getTime())
      .map((r) => ({ ...r, customer: devStore.customers.find((c) => c.id === r.customerId)?.name ?? null }));
  }
  const rows = await prisma.recurringInvoice.findMany({
    where: { companyId },
    orderBy: { nextRunDate: 'asc' },
    include: { customer: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...normalize(r), customer: r.customer.name }));
}

async function findOwned(companyId: string, id: string): Promise<DevRecurringInvoice> {
  const row = !isDatabaseConnected
    ? devStore.recurringInvoices.find((r) => r.id === id && r.companyId === companyId)
    : await prisma.recurringInvoice.findFirst({ where: { id, companyId } });
  if (!row) throw new AppError(404, 'RECURRING_INVOICE_NOT_FOUND', 'Recurring invoice not found.');
  return normalize(row);
}

export async function getRecurringInvoice(companyId: string, id: string) {
  return findOwned(companyId, id);
}

export async function createRecurringInvoice(companyId: string, actorId: string, input: CreateRecurringInvoiceInput) {
  await assertRefs(companyId, input.customerId, input.projectId);
  if (input.endDate && input.endDate < input.startDate) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'The end date must be on or after the start date.');
  }

  const now = new Date();
  const base = {
    companyId,
    customerId: input.customerId,
    projectId: input.projectId ?? null,
    title: input.title,
    currency: input.currency,
    discount: input.discount,
    frequency: input.frequency,
    intervalCount: input.intervalCount,
    startDate: input.startDate,
    nextRunDate: input.startDate,
    endDate: input.endDate ?? null,
    dueInDays: input.dueInDays,
    autoIssue: input.autoIssue,
    isActive: true,
    items: input.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
    })),
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    createdById: actorId,
  };

  let created: DevRecurringInvoice;
  if (!isDatabaseConnected) {
    created = {
      id: crypto.randomUUID(),
      ...base,
      lastRunAt: null,
      generatedCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    devStore.recurringInvoices.push(created);
  } else {
    created = normalize(await prisma.recurringInvoice.create({ data: { ...base, items: base.items as unknown as Prisma.InputJsonValue } }));
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'RECURRING_INVOICE_CREATED',
    entityType: 'RecurringInvoice',
    entityId: created.id,
    metadata: { title: created.title, frequency: created.frequency },
  });
  return created;
}

export async function updateRecurringInvoice(
  companyId: string,
  actorId: string,
  id: string,
  input: UpdateRecurringInvoiceInput
) {
  const existing = await findOwned(companyId, id);
  const frequency = input.frequency ?? existing.frequency;
  const intervalCount = input.intervalCount ?? existing.intervalCount;
  const endDate = input.endDate === undefined ? existing.endDate : input.endDate;
  if (endDate && endDate < existing.startDate) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'The end date must be on or after the start date.');
  }

  const patch: Partial<DevRecurringInvoice> = { ...input, endDate } as Partial<DevRecurringInvoice>;
  if (input.items) {
    patch.items = input.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRate: i.taxRate,
    }));
  }

  // A changed cadence re-derives the next run from the schedule position already reached.
  if (input.frequency || input.intervalCount) {
    patch.nextRunDate = occurrenceDate(existing.startDate, frequency, intervalCount, existing.generatedCount);
  }
  // Re-activating a template whose end date has passed would immediately deactivate it again.
  if (input.isActive && endDate && (patch.nextRunDate ?? existing.nextRunDate) > endDate) {
    throw new AppError(400, 'SCHEDULE_ENDED', 'This schedule has reached its end date. Extend the end date to reactivate it.');
  }

  let updated: DevRecurringInvoice;
  if (!isDatabaseConnected) {
    const row = devStore.recurringInvoices.find((r) => r.id === id)!;
    Object.assign(row, patch, { updatedAt: new Date() });
    updated = row;
  } else {
    const { items, ...rest } = patch;
    updated = normalize(
      await prisma.recurringInvoice.update({
        where: { id },
        data: { ...rest, ...(items ? { items: items as unknown as Prisma.InputJsonValue } : {}) } as Prisma.RecurringInvoiceUpdateInput,
      })
    );
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'RECURRING_INVOICE_UPDATED',
    entityType: 'RecurringInvoice',
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });
  return updated;
}

export async function deleteRecurringInvoice(companyId: string, actorId: string, id: string) {
  await findOwned(companyId, id);
  if (!isDatabaseConnected) {
    devStore.recurringInvoices = devStore.recurringInvoices.filter((r) => r.id !== id);
    devStore.invoices.forEach((i) => {
      if (i.recurringInvoiceId === id) i.recurringInvoiceId = null;
    });
  } else {
    await prisma.recurringInvoice.delete({ where: { id } });
  }
  await recordAuditLog({ companyId, actorId, action: 'RECURRING_INVOICE_DELETED', entityType: 'RecurringInvoice', entityId: id });
}

/** Claims the next occurrence atomically: only one runner can advance a given schedule position. */
async function claimOccurrence(template: DevRecurringInvoice, runAt: Date) {
  const nextIndex = template.generatedCount + 1;
  const next = occurrenceDate(template.startDate, template.frequency, template.intervalCount, nextIndex);
  const ended = !!template.endDate && next > template.endDate;
  const patch = {
    generatedCount: nextIndex,
    lastRunAt: runAt,
    nextRunDate: next,
    isActive: !ended,
  };

  if (!isDatabaseConnected) {
    const row = devStore.recurringInvoices.find((r) => r.id === template.id);
    if (!row || row.generatedCount !== template.generatedCount) return null;
    Object.assign(row, patch, { updatedAt: new Date() });
    return normalize(row);
  }

  const result = await prisma.recurringInvoice.updateMany({
    where: { id: template.id, generatedCount: template.generatedCount },
    data: patch,
  });
  if (result.count === 0) return null;
  return { ...template, ...patch };
}

async function revertClaim(before: DevRecurringInvoice) {
  const patch = {
    generatedCount: before.generatedCount,
    lastRunAt: before.lastRunAt,
    nextRunDate: before.nextRunDate,
    isActive: before.isActive,
  };
  if (!isDatabaseConnected) {
    const row = devStore.recurringInvoices.find((r) => r.id === before.id);
    if (row) Object.assign(row, patch);
    return;
  }
  await prisma.recurringInvoice.update({ where: { id: before.id }, data: patch });
}

async function generateOne(template: DevRecurringInvoice, actorId: string | null, runAt: Date) {
  const claimed = await claimOccurrence(template, runAt);
  if (!claimed) return null;

  try {
    const dueDate = new Date(runAt.getTime() + template.dueInDays * 86400000);
    const invoice = await invoicesService.createInvoice(template.companyId, actorId ?? template.createdById ?? '', {
      customerId: template.customerId,
      projectId: template.projectId,
      title: template.title,
      currency: template.currency,
      discount: template.discount,
      issuedAt: template.autoIssue ? runAt.toISOString() : null,
      dueDate: dueDate.toISOString(),
      notes: template.notes,
      terms: template.terms,
      status: template.autoIssue ? 'UNPAID' : 'DRAFT',
      items: template.items,
    } as any);

    if (!isDatabaseConnected) {
      const stored = devStore.invoices.find((i) => i.id === invoice.id);
      if (stored) stored.recurringInvoiceId = template.id;
    } else {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { recurringInvoiceId: template.id } });
    }

    await recordAuditLog({
      companyId: template.companyId,
      actorId,
      action: 'RECURRING_INVOICE_GENERATED',
      entityType: 'RecurringInvoice',
      entityId: template.id,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    });
    return invoice;
  } catch (err) {
    await revertClaim(template);
    throw err;
  }
}

/** Generates the next occurrence right now, ahead of its scheduled date. */
export async function generateNow(companyId: string, actorId: string, id: string) {
  const template = await findOwned(companyId, id);
  if (!template.isActive) {
    throw new AppError(400, 'RECURRING_INVOICE_INACTIVE', 'This schedule is paused or has ended.');
  }
  const invoice = await generateOne(template, actorId, new Date());
  if (!invoice) throw new AppError(409, 'RUN_IN_PROGRESS', 'Another run just advanced this schedule. Refresh and try again.');
  return invoice;
}

export interface RunDueResult {
  generated: Array<{ recurringInvoiceId: string; invoiceId: string; invoiceNumber: string }>;
  failed: Array<{ recurringInvoiceId: string; error: string }>;
}

/** Generates every invoice whose scheduled date has arrived. Safe to call repeatedly and from several instances. */
export async function runDueRecurringInvoices(options: { companyId?: string; actorId?: string; now?: Date } = {}): Promise<RunDueResult> {
  const now = options.now ?? new Date();
  const result: RunDueResult = { generated: [], failed: [] };

  const candidates: DevRecurringInvoice[] = !isDatabaseConnected
    ? devStore.recurringInvoices.filter(
        (r) => r.isActive && r.nextRunDate <= now && (!options.companyId || r.companyId === options.companyId)
      )
    : (
        await prisma.recurringInvoice.findMany({
          where: { isActive: true, nextRunDate: { lte: now }, ...(options.companyId ? { companyId: options.companyId } : {}) },
        })
      ).map(normalize);

  for (const candidate of candidates) {
    let template: DevRecurringInvoice | null = candidate;
    for (let run = 0; run < MAX_CATCH_UP_RUNS && template && template.isActive && template.nextRunDate <= now; run++) {
      try {
        const scheduledFor = template.nextRunDate;
        const invoice = await generateOne(template, options.actorId ?? null, scheduledFor > now ? now : scheduledFor);
        if (!invoice) break;
        result.generated.push({
          recurringInvoiceId: template.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });
        template = await findOwned(template.companyId, template.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Recurring invoice ${template.id} failed: ${message}`);
        result.failed.push({ recurringInvoiceId: template.id, error: message });
        break;
      }
    }
  }

  return result;
}
