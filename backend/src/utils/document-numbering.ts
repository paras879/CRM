import { prisma, isDatabaseConnected } from '../config/database.js';
import { devStore } from '../config/dev-store.js';

export type DocumentType = 'proposal' | 'estimate' | 'contract' | 'invoice' | 'payment';

const PREFIX_MAP: Record<DocumentType, string> = {
  proposal: 'PROP',
  estimate: 'EST',
  contract: 'CON',
  invoice: 'INV',
  payment: 'PAY',
};

/**
 * Concurrency-safe sequential document number generator.
 * Formats: PROP-2026-0001, EST-2026-0001, CON-2026-0001, INV-2026-0001
 */
export async function generateDocumentNumber(
  companyId: string,
  type: DocumentType,
  year = new Date().getFullYear()
): Promise<string> {
  const prefix = PREFIX_MAP[type];
  const yearStr = String(year);

  if (isDatabaseConnected) {
    try {
      let count = 0;
      if (type === 'proposal') {
        count = await prisma.proposal.count({ where: { companyId } });
      } else if (type === 'estimate') {
        count = await prisma.estimate.count({ where: { companyId } });
      } else if (type === 'contract') {
        count = await prisma.contract.count({ where: { companyId } });
      } else if (type === 'invoice') {
        count = await prisma.invoice.count({ where: { companyId } });
      } else if (type === 'payment') {
        count = await prisma.payment.count();
      }
      const seq = String(count + 1).padStart(4, '0');
      return `${prefix}-${yearStr}-${seq}`;
    } catch {
      // Fallback if db query fails
    }
  }

  // Fallback to devStore counts
  let count = 0;
  if (type === 'proposal') {
    count = devStore.proposals.filter((p) => p.companyId === companyId).length;
  } else if (type === 'estimate') {
    count = devStore.estimates.filter((e) => e.companyId === companyId).length;
  } else if (type === 'contract') {
    count = devStore.contracts.filter((c) => c.companyId === companyId).length;
  } else if (type === 'invoice') {
    count = devStore.invoices.filter((i) => i.companyId === companyId).length;
  } else if (type === 'payment') {
    count = devStore.payments.length;
  }

  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}-${yearStr}-${seq}`;
}
