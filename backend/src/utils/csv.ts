export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // CSV Formula Injection Prevention:
  // Prepend single quote if value begins with spreadsheet command characters =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 Escaping: Wrap with double quotes if contains commas, quotes, or line breaks
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function buildCsv(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}
