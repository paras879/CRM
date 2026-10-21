import { renderDocumentPdf, DocumentPdfData, DocumentPdfCompany } from '../../utils/document-pdf.js';

export type InvoicePdfData = DocumentPdfData;
export type InvoicePdfCompany = DocumentPdfCompany;

export function renderInvoicePdf(invoice: InvoicePdfData, company: InvoicePdfCompany) {
  return renderDocumentPdf({ ...invoice, documentType: 'INVOICE' }, company);
}
