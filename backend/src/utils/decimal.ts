/**
 * Precise financial calculation utilities
 * Avoids binary floating point representation errors
 */

export function roundToCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  taxRate?: number; // e.g. 18 for 18%
}

export interface CalculatedLineItem {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  lineTotal: number;
}

export interface DocumentTotals {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  items: CalculatedLineItem[];
}

export function calculateDocumentTotals(
  items: LineItemInput[],
  discountAmount = 0
): DocumentTotals {
  let subtotal = 0;
  let taxTotal = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    const qty = Math.max(0, item.quantity);
    const price = Math.max(0, item.unitPrice);
    const rate = Math.max(0, item.taxRate || 0);

    const itemSubtotal = roundToCurrency(qty * price);
    const itemTax = roundToCurrency(itemSubtotal * (rate / 100));
    const itemTotal = roundToCurrency(itemSubtotal + itemTax);

    subtotal = roundToCurrency(subtotal + itemSubtotal);
    taxTotal = roundToCurrency(taxTotal + itemTax);

    return {
      quantity: qty,
      unitPrice: price,
      taxRate: rate,
      subtotal: itemSubtotal,
      taxAmount: itemTax,
      lineTotal: itemTotal,
    };
  });

  const safeDiscount = Math.min(subtotal + taxTotal, Math.max(0, discountAmount));
  const total = roundToCurrency(subtotal + taxTotal - safeDiscount);

  return {
    subtotal,
    taxTotal,
    discountTotal: safeDiscount,
    total,
    items: calculatedItems,
  };
}

export function calculateRemainingBalance(total: number, paymentsTotal: number): number {
  return Math.max(0, roundToCurrency(total - paymentsTotal));
}
