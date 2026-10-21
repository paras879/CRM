import crypto from 'node:crypto';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevTaxRate, DevCurrency } from '../../config/dev-store.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  UpdateCompanyInput,
  CreateTaxRateInput,
  UpdateTaxRateInput,
  CreateCurrencyInput,
  UpdateCurrencyInput,
} from './settings.schema.js';

type TaxRateView = { id: string; name: string; rate: number; isDefault: boolean; createdAt: Date; updatedAt: Date };
type CurrencyView = { id: string; code: string; symbol: string; isDefault: boolean; createdAt: Date; updatedAt: Date };

function taxView(t: { id: string; name: string; rate: unknown; isDefault: boolean; createdAt: Date; updatedAt: Date }): TaxRateView {
  return { id: t.id, name: t.name, rate: Number(t.rate), isDefault: t.isDefault, createdAt: t.createdAt, updatedAt: t.updatedAt };
}

function currencyView(c: CurrencyView): CurrencyView {
  return { id: c.id, code: c.code, symbol: c.symbol, isDefault: c.isDefault, createdAt: c.createdAt, updatedAt: c.updatedAt };
}

// ---------------------------------------------------------------- Company

export async function getCompany(companyId: string) {
  if (!isDatabaseConnected) {
    return { ...devStore.company };
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw AppError.notFound('Company not found.', 'COMPANY_NOT_FOUND');
  return company;
}

export async function updateCompany(companyId: string, actorId: string, input: UpdateCompanyInput) {
  let updated;
  if (!isDatabaseConnected) {
    Object.assign(devStore.company, input, { updatedAt: new Date() });
    updated = { ...devStore.company };
  } else {
    updated = await prisma.company.update({ where: { id: companyId }, data: input });
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'COMPANY_UPDATED',
    entityType: 'company',
    entityId: companyId,
    metadata: { fields: Object.keys(input) },
  });
  return updated;
}

// ---------------------------------------------------------------- Tax rates

export async function listTaxRates(companyId: string): Promise<TaxRateView[]> {
  if (!isDatabaseConnected) {
    return devStore.taxRates
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(taxView);
  }
  const rows = await prisma.taxRate.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  return rows.map(taxView);
}

export async function createTaxRate(companyId: string, actorId: string, input: CreateTaxRateInput) {
  let created: TaxRateView;

  if (!isDatabaseConnected) {
    if (devStore.taxRates.some((t) => t.companyId === companyId && t.name.toLowerCase() === input.name.toLowerCase())) {
      throw AppError.conflict('A tax rate with this name already exists.', 'TAX_RATE_EXISTS');
    }
    if (input.isDefault) {
      devStore.taxRates.forEach((t) => {
        if (t.companyId === companyId) t.isDefault = false;
      });
    }
    const now = new Date();
    const row: DevTaxRate = {
      id: crypto.randomUUID(),
      companyId,
      name: input.name,
      rate: input.rate,
      isDefault: input.isDefault,
      createdAt: now,
      updatedAt: now,
    };
    devStore.taxRates.push(row);
    created = taxView(row);
  } else {
    const dup = await prisma.taxRate.findFirst({
      where: { companyId, name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (dup) throw AppError.conflict('A tax rate with this name already exists.', 'TAX_RATE_EXISTS');

    const row = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRate.updateMany({ where: { companyId }, data: { isDefault: false } });
      }
      return tx.taxRate.create({
        data: { companyId, name: input.name, rate: input.rate, isDefault: input.isDefault },
      });
    });
    created = taxView(row);
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'TAX_RATE_CREATED',
    entityType: 'tax_rate',
    entityId: created.id,
    metadata: { name: created.name, rate: created.rate },
  });
  return created;
}

export async function updateTaxRate(companyId: string, actorId: string, id: string, input: UpdateTaxRateInput) {
  let updated: TaxRateView;

  if (!isDatabaseConnected) {
    const row = devStore.taxRates.find((t) => t.id === id && t.companyId === companyId);
    if (!row) throw AppError.notFound('Tax rate not found.', 'TAX_RATE_NOT_FOUND');
    if (
      input.name &&
      devStore.taxRates.some((t) => t.companyId === companyId && t.id !== id && t.name.toLowerCase() === input.name!.toLowerCase())
    ) {
      throw AppError.conflict('A tax rate with this name already exists.', 'TAX_RATE_EXISTS');
    }
    if (input.isDefault) {
      devStore.taxRates.forEach((t) => {
        if (t.companyId === companyId) t.isDefault = false;
      });
    }
    Object.assign(row, input, { updatedAt: new Date() });
    updated = taxView(row);
  } else {
    const existing = await prisma.taxRate.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!existing) throw AppError.notFound('Tax rate not found.', 'TAX_RATE_NOT_FOUND');
    if (input.name) {
      const dup = await prisma.taxRate.findFirst({
        where: { companyId, id: { not: id }, name: { equals: input.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (dup) throw AppError.conflict('A tax rate with this name already exists.', 'TAX_RATE_EXISTS');
    }
    const row = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRate.updateMany({ where: { companyId }, data: { isDefault: false } });
      }
      return tx.taxRate.update({ where: { id }, data: input });
    });
    updated = taxView(row);
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'TAX_RATE_UPDATED',
    entityType: 'tax_rate',
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });
  return updated;
}

export async function deleteTaxRate(companyId: string, actorId: string, id: string) {
  if (!isDatabaseConnected) {
    const exists = devStore.taxRates.some((t) => t.id === id && t.companyId === companyId);
    if (!exists) throw AppError.notFound('Tax rate not found.', 'TAX_RATE_NOT_FOUND');
    devStore.taxRates = devStore.taxRates.filter((t) => t.id !== id);
  } else {
    const result = await prisma.taxRate.deleteMany({ where: { id, companyId } });
    if (result.count === 0) throw AppError.notFound('Tax rate not found.', 'TAX_RATE_NOT_FOUND');
  }

  await recordAuditLog({ companyId, actorId, action: 'TAX_RATE_DELETED', entityType: 'tax_rate', entityId: id });
}

// ---------------------------------------------------------------- Currencies

export async function listCurrencies(companyId: string): Promise<CurrencyView[]> {
  if (!isDatabaseConnected) {
    return devStore.currencies
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(currencyView);
  }
  const rows = await prisma.currency.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
  return rows.map(currencyView);
}

export async function createCurrency(companyId: string, actorId: string, input: CreateCurrencyInput) {
  let created: CurrencyView;

  if (!isDatabaseConnected) {
    if (devStore.currencies.some((c) => c.companyId === companyId && c.code === input.code)) {
      throw AppError.conflict('This currency is already added.', 'CURRENCY_EXISTS');
    }
    const first = !devStore.currencies.some((c) => c.companyId === companyId);
    const makeDefault = input.isDefault || first;
    if (makeDefault) {
      devStore.currencies.forEach((c) => {
        if (c.companyId === companyId) c.isDefault = false;
      });
      devStore.company.currency = input.code;
    }
    const now = new Date();
    const row: DevCurrency = {
      id: crypto.randomUUID(),
      companyId,
      code: input.code,
      symbol: input.symbol,
      isDefault: makeDefault,
      createdAt: now,
      updatedAt: now,
    };
    devStore.currencies.push(row);
    created = currencyView(row);
  } else {
    const dup = await prisma.currency.findUnique({ where: { companyId_code: { companyId, code: input.code } } });
    if (dup) throw AppError.conflict('This currency is already added.', 'CURRENCY_EXISTS');

    const row = await prisma.$transaction(async (tx) => {
      const first = (await tx.currency.count({ where: { companyId } })) === 0;
      const makeDefault = input.isDefault || first;
      if (makeDefault) {
        await tx.currency.updateMany({ where: { companyId }, data: { isDefault: false } });
        await tx.company.update({ where: { id: companyId }, data: { currency: input.code } });
      }
      return tx.currency.create({
        data: { companyId, code: input.code, symbol: input.symbol, isDefault: makeDefault },
      });
    });
    created = currencyView(row);
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CURRENCY_CREATED',
    entityType: 'currency',
    entityId: created.id,
    metadata: { code: created.code },
  });
  return created;
}

export async function setDefaultCurrency(companyId: string, actorId: string, id: string) {
  let updated: CurrencyView;

  if (!isDatabaseConnected) {
    const row = devStore.currencies.find((c) => c.id === id && c.companyId === companyId);
    if (!row) throw AppError.notFound('Currency not found.', 'CURRENCY_NOT_FOUND');
    devStore.currencies.forEach((c) => {
      if (c.companyId === companyId) c.isDefault = c.id === id;
    });
    devStore.company.currency = row.code;
    updated = currencyView(row);
  } else {
    const existing = await prisma.currency.findFirst({ where: { id, companyId } });
    if (!existing) throw AppError.notFound('Currency not found.', 'CURRENCY_NOT_FOUND');
    const row = await prisma.$transaction(async (tx) => {
      await tx.currency.updateMany({ where: { companyId }, data: { isDefault: false } });
      await tx.company.update({ where: { id: companyId }, data: { currency: existing.code } });
      return tx.currency.update({ where: { id }, data: { isDefault: true } });
    });
    updated = currencyView(row);
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CURRENCY_DEFAULT_CHANGED',
    entityType: 'currency',
    entityId: id,
    metadata: { code: updated.code },
  });
  return updated;
}

export async function deleteCurrency(companyId: string, actorId: string, id: string) {
  if (!isDatabaseConnected) {
    const row = devStore.currencies.find((c) => c.id === id && c.companyId === companyId);
    if (!row) throw AppError.notFound('Currency not found.', 'CURRENCY_NOT_FOUND');
    const othersDev = devStore.currencies.filter((c) => c.companyId === companyId && c.id !== id).length;
    if (row.isDefault && othersDev > 0) {
      throw AppError.conflict('The default currency cannot be deleted. Make another currency the default first.', 'CURRENCY_IS_DEFAULT');
    }
    devStore.currencies = devStore.currencies.filter((c) => c.id !== id);
  } else {
    const row = await prisma.currency.findFirst({ where: { id, companyId } });
    if (!row) throw AppError.notFound('Currency not found.', 'CURRENCY_NOT_FOUND');
    const others = await prisma.currency.count({ where: { companyId, id: { not: id } } });
    if (row.isDefault && others > 0) {
      throw AppError.conflict('The default currency cannot be deleted. Make another currency the default first.', 'CURRENCY_IS_DEFAULT');
    }
    await prisma.currency.delete({ where: { id } });
  }

  await recordAuditLog({ companyId, actorId, action: 'CURRENCY_DELETED', entityType: 'currency', entityId: id });
}

/** Only the symbol can change: the code is stored on existing invoices, estimates and payments. */
export async function updateCurrency(companyId: string, actorId: string, id: string, input: UpdateCurrencyInput) {
  let updated: CurrencyView;

  if (!isDatabaseConnected) {
    const row = devStore.currencies.find((c) => c.id === id && c.companyId === companyId);
    if (!row) throw AppError.notFound('Currency not found.', 'CURRENCY_NOT_FOUND');
    row.symbol = input.symbol;
    row.updatedAt = new Date();
    updated = currencyView(row);
  } else {
    const existing = await prisma.currency.findFirst({ where: { id, companyId } });
    if (!existing) throw AppError.notFound('Currency not found.', 'CURRENCY_NOT_FOUND');
    updated = currencyView(await prisma.currency.update({ where: { id }, data: { symbol: input.symbol } }));
  }

  await recordAuditLog({
    companyId,
    actorId,
    action: 'CURRENCY_UPDATED',
    entityType: 'currency',
    entityId: id,
    metadata: { code: updated.code, symbol: updated.symbol },
  });
  return updated;
}
