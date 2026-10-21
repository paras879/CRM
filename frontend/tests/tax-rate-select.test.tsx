import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaxRateSelect, TaxRateHint, SavedTaxRate } from '@/components/ui/tax-rate-select';

const rates: SavedTaxRate[] = [
  { id: '1', name: 'GST', rate: 18, isDefault: true },
  { id: '2', name: 'Reduced', rate: 5, isDefault: false },
];

describe('TaxRateSelect', () => {
  it('lists No tax plus every saved rate', () => {
    render(<TaxRateSelect value={0} rates={rates} onChange={() => {}} />);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['No tax', 'GST (18%)', 'Reduced (5%)']);
  });

  it('reports the selection as a fraction, the format the API expects', async () => {
    const onChange = vi.fn();
    render(<TaxRateSelect value={0} rates={rates} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'GST (18%)');
    expect(onChange).toHaveBeenCalledWith(0.18);
  });

  it('keeps a stored rate that is no longer saved visible as custom', () => {
    render(<TaxRateSelect value={0.12} rates={rates} onChange={() => {}} />);
    expect(screen.getByRole('option', { name: '12% (custom)' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('0.12');
  });

  it('converts fractional percentages without float noise', async () => {
    const onChange = vi.fn();
    render(<TaxRateSelect value={0} rates={[{ id: '3', name: 'Half', rate: 12.5, isDefault: false }]} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'Half (12.5%)');
    expect(onChange).toHaveBeenCalledWith(0.125);
  });
});

describe('TaxRateHint', () => {
  it('points to Company Settings when no rates are saved', () => {
    render(<TaxRateHint rates={[]} loaded />);
    expect(screen.getByRole('link', { name: /company settings/i })).toHaveAttribute('href', '/admin/settings');
  });

  it('stays hidden while loading or when rates exist', () => {
    const { container, rerender } = render(<TaxRateHint rates={[]} loaded={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TaxRateHint rates={rates} loaded />);
    expect(container).toBeEmptyDOMElement();
  });
});
