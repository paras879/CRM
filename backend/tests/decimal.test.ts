import { describe, it, expect } from 'vitest';
import {
  calculateDocumentTotals,
  calculateRemainingBalance,
  roundToCurrency,
} from '../src/utils/decimal.js';

describe('Financial Decimal Calculations', () => {
  it('correctly rounds currency to 2 decimal places', () => {
    expect(roundToCurrency(10.256)).toBe(10.26);
    expect(roundToCurrency(10.254)).toBe(10.25);
    expect(roundToCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it('calculates document subtotal, taxes and totals precisely', () => {
    const items = [
      { quantity: 2, unitPrice: 1500, taxRate: 18 }, // Subtotal: 3000, Tax: 540, Line: 3540
      { quantity: 3, unitPrice: 200, taxRate: 5 },   // Subtotal: 600, Tax: 30, Line: 630
    ];

    const result = calculateDocumentTotals(items, 100);

    expect(result.subtotal).toBe(3600);
    expect(result.taxTotal).toBe(570);
    expect(result.discountTotal).toBe(100);
    expect(result.total).toBe(4070); // 3600 + 570 - 100

    expect(result.items[0].lineTotal).toBe(3540);
    expect(result.items[1].lineTotal).toBe(630);
  });

  it('clamps discount and handles negative inputs safely', () => {
    const items = [{ quantity: -1, unitPrice: -50, taxRate: 0 }];
    const result = calculateDocumentTotals(items, 500);

    expect(result.subtotal).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.discountTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it('calculates remaining balance correctly', () => {
    expect(calculateRemainingBalance(1000, 400)).toBe(600);
    expect(calculateRemainingBalance(1000, 1000)).toBe(0);
    expect(calculateRemainingBalance(1000, 1200)).toBe(0); // Cannot be negative
  });
});
