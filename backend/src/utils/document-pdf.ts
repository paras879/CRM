import PDFDocument from 'pdfkit';

export interface DocumentPdfData {
  /** Heading printed top-left, e.g. INVOICE, ESTIMATE, PROPOSAL */
  documentType?: string;
  invoiceNumber: string;
  validUntil?: Date | string | null;
  title?: string | null;
  status: string;
  currency: string;
  issuedAt?: Date | string | null;
  dueDate?: Date | string | null;
  subtotal: number;
  discount: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  /** Payment rows are printed only when both are provided (invoices). */
  amountPaid?: number;
  balanceDue?: number;
  notes?: string | null;
  terms?: string | null;
  customer?: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zipCode?: string | null;
    taxId?: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    lineTotal: number;
  }>;
}

export interface DocumentPdfCompany {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

const MARGIN = 48;
const PRIMARY = '#2563EB';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';

function money(currency: string, value: number) {
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10);
}

function percent(fraction: number) {
  return `${Math.round(fraction * 10000) / 100}%`;
}

export function renderDocumentPdf(invoice: DocumentPdfData, company: DocumentPdfCompany): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const docType = invoice.documentType ?? 'INVOICE';
    const docLabel = docType.charAt(0) + docType.slice(1).toLowerCase();
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: `${docType} ${invoice.invoiceNumber}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - MARGIN * 2;
    const right = doc.page.width - MARGIN;

    // Header
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(22).text(docType, MARGIN, MARGIN);
    doc.fillColor('#0F172A').fontSize(11).text(invoice.invoiceNumber, MARGIN, doc.y + 2);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Status: ${invoice.status}`);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(company.name, MARGIN, MARGIN, { width: pageWidth, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    [company.address, company.email, company.phone]
      .filter(Boolean)
      .forEach((line) => doc.text(line as string, { width: pageWidth, align: 'right' }));

    doc.moveDown(2);
    let y = Math.max(doc.y, 140);

    // Bill to + dates
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('BILL TO', MARGIN, y);
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text(invoice.customer?.name ?? '-', MARGIN, doc.y + 2);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    const c = invoice.customer;
    if (c) {
      if (c.companyName) doc.text(c.companyName);
      const cityLine = [c.city, c.state, c.zipCode].filter(Boolean).join(', ');
      [c.address, cityLine, c.country, c.email, c.phone, c.taxId ? `Tax ID: ${c.taxId}` : null]
        .filter(Boolean)
        .forEach((line) => doc.text(line as string));
    }
    const leftEnd = doc.y;

    doc.fillColor(MUTED).font('Helvetica').fontSize(9);
    doc.text(`Issued: ${formatDate(invoice.issuedAt)}`, MARGIN, y, { width: pageWidth, align: 'right' });
    if (invoice.dueDate !== undefined) doc.text(`Due: ${formatDate(invoice.dueDate)}`, { width: pageWidth, align: 'right' });
    if (invoice.validUntil !== undefined) doc.text(`Valid until: ${formatDate(invoice.validUntil)}`, { width: pageWidth, align: 'right' });
    if (invoice.title) doc.text(invoice.title, { width: pageWidth, align: 'right' });

    y = Math.max(leftEnd, doc.y) + 24;

    // Items table
    const cols = {
      description: { x: MARGIN, w: pageWidth - 300 },
      qty: { x: MARGIN + pageWidth - 300, w: 45 },
      price: { x: MARGIN + pageWidth - 255, w: 85 },
      tax: { x: MARGIN + pageWidth - 170, w: 40 },
      total: { x: MARGIN + pageWidth - 130, w: 130 },
    };

    const drawHeader = (top: number) => {
      doc.rect(MARGIN, top, pageWidth, 20).fill('#F1F5F9');
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8);
      doc.text('DESCRIPTION', cols.description.x + 6, top + 6, { width: cols.description.w - 6 });
      doc.text('QTY', cols.qty.x, top + 6, { width: cols.qty.w, align: 'right' });
      doc.text('UNIT PRICE', cols.price.x, top + 6, { width: cols.price.w, align: 'right' });
      doc.text('TAX', cols.tax.x, top + 6, { width: cols.tax.w, align: 'right' });
      doc.text('AMOUNT', cols.total.x, top + 6, { width: cols.total.w - 6, align: 'right' });
      return top + 20;
    };

    y = drawHeader(y);
    doc.font('Helvetica').fontSize(9);

    for (const item of invoice.items) {
      const descHeight = doc.heightOfString(item.description, { width: cols.description.w - 6 });
      const discountLine = item.discount > 0 ? 11 : 0;
      const rowHeight = Math.max(descHeight, 11) + discountLine + 12;

      if (y + rowHeight > doc.page.height - MARGIN - 120) {
        doc.addPage();
        y = drawHeader(MARGIN);
        doc.font('Helvetica').fontSize(9);
      }

      doc.fillColor('#0F172A').text(item.description, cols.description.x + 6, y + 6, { width: cols.description.w - 6 });
      if (item.discount > 0) {
        doc.fillColor(MUTED).fontSize(8).text(`Discount: -${money(invoice.currency, item.discount)}`, cols.description.x + 6, y + 6 + descHeight, {
          width: cols.description.w - 6,
        });
        doc.fontSize(9);
      }
      doc.fillColor('#0F172A');
      doc.text(String(item.quantity), cols.qty.x, y + 6, { width: cols.qty.w, align: 'right' });
      doc.text(money(invoice.currency, item.unitPrice), cols.price.x, y + 6, { width: cols.price.w, align: 'right' });
      doc.text(percent(item.taxRate), cols.tax.x, y + 6, { width: cols.tax.w, align: 'right' });
      doc.text(money(invoice.currency, item.lineTotal), cols.total.x, y + 6, { width: cols.total.w - 6, align: 'right' });

      y += rowHeight;
      doc.moveTo(MARGIN, y).lineTo(right, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    }

    // Totals
    const totalsHeight = 6 * 16 + 12;
    if (y + totalsHeight > doc.page.height - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    y += 14;
    const labelX = MARGIN + pageWidth - 230;
    const row = (label: string, value: string, bold = false) => {
      doc.fillColor(bold ? '#0F172A' : MUTED).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
      doc.text(label, labelX, y, { width: 100 });
      doc.text(value, labelX + 100, y, { width: 130, align: 'right' });
      y += 16;
    };
    row('Subtotal', money(invoice.currency, invoice.subtotal));
    if (invoice.discountTotal > 0) row('Discount', `-${money(invoice.currency, invoice.discountTotal)}`);
    row('Tax', money(invoice.currency, invoice.taxTotal));
    row('Total', money(invoice.currency, invoice.total), true);
    if (invoice.amountPaid !== undefined && invoice.balanceDue !== undefined) {
      row('Paid', money(invoice.currency, invoice.amountPaid));
      row('Balance due', money(invoice.currency, invoice.balanceDue), true);
    }

    // Notes & terms
    const extras: Array<[string, string | null | undefined]> = [
      ['Notes', invoice.notes],
      ['Terms', invoice.terms],
    ];
    for (const [label, text] of extras) {
      if (!text) continue;
      const height = doc.heightOfString(text, { width: pageWidth }) + 24;
      if (y + height > doc.page.height - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      y += 12;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), MARGIN, y);
      doc.fillColor('#0F172A').font('Helvetica').fontSize(9).text(text, MARGIN, doc.y + 2, { width: pageWidth });
      y = doc.y;
    }

    doc.end();
  });
}
