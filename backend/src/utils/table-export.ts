import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { buildCsv } from './csv.js';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

export type ExportCell = string | number | null | undefined;

export interface ExportTable {
  title: string;
  headers: string[];
  rows: ExportCell[][];
  /** Zero-based indexes of money/quantity columns: right-aligned in the PDF and stored as numbers in Excel. */
  numericColumns?: number[];
}

export interface ExportContext {
  companyName?: string;
  generatedAt?: Date;
}

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && (EXPORT_FORMATS as string[]).includes(value);
}

function toNumber(cell: ExportCell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell === 'string' && cell.trim() !== '' && Number.isFinite(Number(cell))) return Number(cell);
  return null;
}

function cellText(cell: ExportCell): string {
  return cell === null || cell === undefined ? '' : String(cell);
}

export function renderTableCsv(table: ExportTable): string {
  return buildCsv(table.headers, table.rows);
}

export async function renderTableXlsx(table: ExportTable, context: ExportContext = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.companyName ?? 'Business CRM';
  workbook.created = context.generatedAt ?? new Date();

  const sheet = workbook.addWorksheet(table.title.slice(0, 31).replace(/[\\/*?:[\]]/g, ' '));
  const numeric = new Set(table.numericColumns ?? []);

  const headerRow = sheet.addRow(table.headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 22;
  headerRow.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    if (numeric.has(col - 1)) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  for (const row of table.rows) {
    const values = row.map((cell, index) => {
      if (numeric.has(index)) return toNumber(cell) ?? cellText(cell);
      // Excel treats text starting with = + - @ as a formula, so keep it as inert text.
      const text = cellText(cell);
      return /^[=+\-@]/.test(text) ? `'${text}` : text;
    });
    const added = sheet.addRow(values);
    added.eachCell((cell, col) => {
      if (numeric.has(col - 1) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  table.headers.forEach((header, index) => {
    const longest = Math.max(header.length, ...table.rows.slice(0, 200).map((r) => cellText(r[index]).length));
    sheet.getColumn(index + 1).width = Math.min(48, Math.max(10, longest + 3));
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (table.headers.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.headers.length } };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const PAGE_MARGIN = 36;
const ROW_PADDING = 5;
const FONT_SIZE = 8;

/** Column widths that share the page in proportion to content length, within sensible bounds. */
function pdfColumnWidths(table: ExportTable, available: number): number[] {
  const weights = table.headers.map((header, index) => {
    const longest = Math.max(header.length, ...table.rows.slice(0, 100).map((r) => cellText(r[index]).length));
    return Math.min(32, Math.max(6, longest));
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => (w / total) * available);
}

export function renderTablePdf(table: ExportTable, context: ExportContext = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedAt = context.generatedAt ?? new Date();
    const numeric = new Set(table.numericColumns ?? []);
    const left = PAGE_MARGIN;
    const available = doc.page.width - PAGE_MARGIN * 2;
    const widths = pdfColumnWidths(table, available);
    const bottomLimit = () => doc.page.height - PAGE_MARGIN - 18;

    const drawRow = (cells: string[], y: number, opts: { header?: boolean; shaded?: boolean }) => {
      doc.font(opts.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);
      const height =
        Math.max(
          ...cells.map((text, i) => doc.heightOfString(text, { width: widths[i] - 8, align: numeric.has(i) ? 'right' : 'left' }))
        ) +
        ROW_PADDING * 2;

      if (opts.header) {
        doc.rect(left, y, available, height).fill('#4F46E5');
      } else if (opts.shaded) {
        doc.rect(left, y, available, height).fill('#F5F7FB');
      }
      doc.fillColor(opts.header ? '#FFFFFF' : '#111827');

      let x = left;
      cells.forEach((text, i) => {
        doc.text(text, x + 4, y + ROW_PADDING, { width: widths[i] - 8, align: numeric.has(i) ? 'right' : 'left' });
        x += widths[i];
      });
      return height;
    };

    const drawHeading = () => {
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(16).text(table.title, left, PAGE_MARGIN);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748B')
        .text(
          `${context.companyName ? `${context.companyName}  |  ` : ''}Generated ${generatedAt.toLocaleString('en-IN')}  |  ${table.rows.length} row${table.rows.length === 1 ? '' : 's'}`,
          left,
          doc.y + 2
        );
      return doc.y + 12;
    };

    let y = drawHeading();
    y += drawRow(table.headers, y, { header: true });

    if (table.rows.length === 0) {
      doc.fillColor('#64748B').font('Helvetica').fontSize(10).text('No records to show.', left, y + 14);
    }

    table.rows.forEach((row, index) => {
      const cells = table.headers.map((_, i) => cellText(row[i]));
      const probe =
        Math.max(...cells.map((text, i) => doc.heightOfString(text, { width: widths[i] - 8 }))) + ROW_PADDING * 2;
      if (y + probe > bottomLimit()) {
        doc.addPage();
        y = PAGE_MARGIN;
        y += drawRow(table.headers, y, { header: true });
      }
      y += drawRow(cells, y, { shaded: index % 2 === 1 });
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748B')
        .text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - PAGE_MARGIN - 4, {
          width: available,
          align: 'right',
          lineBreak: false,
        });
    }

    doc.end();
  });
}

export async function renderTable(
  format: ExportFormat,
  table: ExportTable,
  context: ExportContext = {}
): Promise<Buffer> {
  if (format === 'xlsx') return renderTableXlsx(table, context);
  if (format === 'pdf') return renderTablePdf(table, context);
  return Buffer.from(`﻿${renderTableCsv(table)}`, 'utf-8');
}
