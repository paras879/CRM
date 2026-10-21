import { describe, it, expect, beforeEach } from 'vitest';
import * as settings from '../src/modules/settings/settings.service.js';
import { devStore } from '../src/config/dev-store.js';
import { CreateTaxRateSchema, CreateCurrencySchema } from '../src/modules/settings/settings.schema.js';

describe('Settings Service', () => {
  const companyId = devStore.company.id;
  const adminId = devStore.users[0].id;

  beforeEach(() => {
    devStore.taxRates = [];
    devStore.currencies = [];
  });

  it('updates company profile fields', async () => {
    const original = devStore.company.name;
    const updated = await settings.updateCompany(companyId, adminId, { name: 'Renamed Co', phone: null });
    expect(updated.name).toBe('Renamed Co');
    expect(updated.phone).toBeNull();
    await settings.updateCompany(companyId, adminId, { name: original });
  });

  it('creates tax rates, enforces unique names and a single default', async () => {
    const gst = await settings.createTaxRate(companyId, adminId, { name: 'GST 18%', rate: 18, isDefault: true });
    expect(gst.rate).toBe(18);
    expect(gst.isDefault).toBe(true);

    await expect(
      settings.createTaxRate(companyId, adminId, { name: 'gst 18%', rate: 18, isDefault: false })
    ).rejects.toMatchObject({ code: 'TAX_RATE_EXISTS' });

    const vat = await settings.createTaxRate(companyId, adminId, { name: 'VAT 5%', rate: 5, isDefault: true });
    const list = await settings.listTaxRates(companyId);
    expect(list.filter((t) => t.isDefault).map((t) => t.id)).toEqual([vat.id]);
  });

  it('updates and deletes tax rates', async () => {
    const t = await settings.createTaxRate(companyId, adminId, { name: 'Service', rate: 12, isDefault: false });
    const updated = await settings.updateTaxRate(companyId, adminId, t.id, { rate: 10 });
    expect(updated.rate).toBe(10);

    await settings.deleteTaxRate(companyId, adminId, t.id);
    await expect(settings.deleteTaxRate(companyId, adminId, t.id)).rejects.toMatchObject({ code: 'TAX_RATE_NOT_FOUND' });
  });

  it('keeps tax rates isolated per company', async () => {
    const t = await settings.createTaxRate(companyId, adminId, { name: 'Isolated', rate: 1, isDefault: false });
    await expect(
      settings.updateTaxRate('00000000-0000-0000-0000-00000000ffff', adminId, t.id, { rate: 2 })
    ).rejects.toMatchObject({ code: 'TAX_RATE_NOT_FOUND' });
  });

  it('makes the first currency default and syncs the company currency', async () => {
    const original = devStore.company.currency;
    const usd = await settings.createCurrency(companyId, adminId, { code: 'USD', symbol: '$', isDefault: false });
    expect(usd.isDefault).toBe(true);
    expect(devStore.company.currency).toBe('USD');

    const eur = await settings.createCurrency(companyId, adminId, { code: 'EUR', symbol: '€', isDefault: false });
    expect(eur.isDefault).toBe(false);

    await expect(
      settings.createCurrency(companyId, adminId, { code: 'USD', symbol: '$', isDefault: false })
    ).rejects.toMatchObject({ code: 'CURRENCY_EXISTS' });

    await expect(settings.deleteCurrency(companyId, adminId, usd.id)).rejects.toMatchObject({ code: 'CURRENCY_IS_DEFAULT' });

    await settings.setDefaultCurrency(companyId, adminId, eur.id);
    expect(devStore.company.currency).toBe('EUR');
    await settings.deleteCurrency(companyId, adminId, usd.id);
    expect((await settings.listCurrencies(companyId)).map((c) => c.code)).toEqual(['EUR']);

    devStore.company.currency = original;
  });

  it('validates input', () => {
    expect(CreateTaxRateSchema.safeParse({ name: 'x', rate: 101 }).success).toBe(false);
    expect(CreateTaxRateSchema.safeParse({ name: 'x', rate: -1 }).success).toBe(false);
    expect(CreateCurrencySchema.safeParse({ code: 'US', symbol: '$' }).success).toBe(false);
    expect(CreateCurrencySchema.parse({ code: 'inr', symbol: '₹' }).code).toBe('INR');
  });
});
