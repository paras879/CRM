/**
 * Financial calculation and rounding utilities for Business CRM.
 * Rounding policy: Standard 2-decimal precision (half-up arithmetic rounding)
 * to avoid IEEE 754 floating point inaccuracies.
 */

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function roundRate(rate: number): number {
  return Math.round((rate + Number.EPSILON) * 10000) / 10000;
}

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  order: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  items: CalculatedLineItem[];
}

export function calculateDocumentTotals(
  rawItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
    order?: number;
  }>,
  docDiscount: number = 0
): DocumentTotals {
  let subtotal = 0;
  let itemsDiscountTotal = 0;
  let taxTotal = 0;

  const items: CalculatedLineItem[] = rawItems.map((item, index) => {
    const qty = Math.max(0, item.quantity || 1);
    const price = Math.max(0, item.unitPrice || 0);
    const lineDiscount = Math.max(0, Math.min(qty * price, item.discount || 0));
    const taxRate = Math.max(0, item.taxRate || 0);

    const grossLine = roundMoney(qty * price);
    const netLine = roundMoney(Math.max(0, grossLine - lineDiscount));
    const lineTax = roundMoney(netLine * taxRate);
    const lineTotal = roundMoney(netLine + lineTax);

    subtotal = roundMoney(subtotal + grossLine);
    itemsDiscountTotal = roundMoney(itemsDiscountTotal + lineDiscount);
    taxTotal = roundMoney(taxTotal + lineTax);

    return {
      description: item.description.trim(),
      quantity: qty,
      unitPrice: price,
      discount: lineDiscount,
      taxRate: roundRate(taxRate),
      taxAmount: lineTax,
      lineSubtotal: grossLine,
      lineTotal,
      order: item.order !== undefined ? item.order : index + 1,
    };
  });

  const validDocDiscount = Math.max(0, docDiscount || 0);
  const totalDiscount = roundMoney(itemsDiscountTotal + validDocDiscount);
  // Total cannot be negative
  const total = roundMoney(Math.max(0, subtotal - totalDiscount + taxTotal));

  return {
    subtotal,
    discountTotal: totalDiscount,
    taxTotal,
    total,
    items,
  };
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
