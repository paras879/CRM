'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export interface SavedTaxRate {
  id: string;
  name: string;
  /** Percentage, e.g. 18 for 18% */
  rate: number;
  isDefault: boolean;
}

/** Loads the company's saved tax rates (Company Settings). */
export function useTaxRates() {
  const [rates, setRates] = useState<SavedTaxRate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: SavedTaxRate[] }>('/settings/tax-rates')
      .then((res) => {
        if (!cancelled) setRates(res.data);
      })
      .catch(() => {
        // Users without company.view simply get the "No tax" option.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultFraction = (rates.find((r) => r.isDefault)?.rate ?? 0) / 100;
  return { rates, loaded, defaultFraction };
}

interface TaxRateSelectProps {
  /** Tax as a fraction between 0 and 1 (0.18 = 18%), the format the API expects. */
  value: number;
  rates: SavedTaxRate[];
  onChange: (fraction: number) => void;
  className?: string;
}

const toFraction = (percent: number) => Math.round(percent * 100) / 10000;

export function TaxRateSelect({ value, rates, onChange, className }: TaxRateSelectProps) {
  const matchesSaved = value === 0 || rates.some((r) => toFraction(r.rate) === value);

  return (
    <select
      value={String(value)}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      aria-label="Tax rate"
      className={
        className ??
        'w-full h-8 rounded-md bg-secondary/40 border border-border px-2 text-xs text-foreground'
      }
    >
      <option value="0">No tax</option>
      {rates.map((r) => (
        <option key={r.id} value={String(toFraction(r.rate))}>
          {r.name} ({r.rate}%)
        </option>
      ))}
      {!matchesSaved && <option value={String(value)}>{Math.round(value * 10000) / 100}% (custom)</option>}
    </select>
  );
}

export function TaxRateHint({ rates, loaded }: { rates: SavedTaxRate[]; loaded: boolean }) {
  if (!loaded || rates.length > 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      No saved tax rates yet.{' '}
      <Link href="/admin/settings" className="text-primary underline underline-offset-2">
        Add tax rates in Company Settings
      </Link>
      .
    </p>
  );
}
