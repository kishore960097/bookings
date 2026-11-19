import * as XLSX from 'xlsx';

/**
 * Sanitizes spreadsheet cell strings against formula injection (CSV/Excel injection).
 * Characters =, +, -, @, tab, or carriage return at the start of a cell are prefixed with '.
 */
export function sanitizeCellValue(val: unknown): unknown {
  if (typeof val === 'string') {
    if (/^[=+\-@\t\r]/.test(val)) {
      return `'${val}`;
    }
    return val;
  }
  return val;
}

export function sanitizeRow<T extends Record<string, any>>(row: T): T {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      // Flatten or stringify nested objects for readable table export
      clean[k] = sanitizeCellValue(JSON.stringify(v));
    } else if (Array.isArray(v)) {
      clean[k] = sanitizeCellValue(v.join('; '));
    } else {
      clean[k] = sanitizeCellValue(v);
    }
  }
  return clean as T;
}

/**
 * Exports a single table of rows to an Excel (.xlsx) file.
 */
export function exportTableToExcel(filename: string, sheetName: string, rows: Record<string, any>[]): void {
  const cleanRows = rows.map(sanitizeRow);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(cleanRows.length > 0 ? cleanRows : [{ info: 'No records found' }]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalName);
}

/**
 * Exports a single table of rows to a CSV (.csv) file.
 */
export function exportTableToCsv(filename: string, rows: Record<string, any>[]): void {
  const cleanRows = rows.map(sanitizeRow);
  const ws = XLSX.utils.json_to_sheet(cleanRows.length > 0 ? cleanRows : [{ info: 'No records found' }]);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const finalName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', finalName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a complete multi-sheet Master Workbook (.xlsx) with separate sheets.
 * Example sheets: Overview_KPIs, Bookings, Payments_Ledger, Owners, Customers, Audit_Logs
 */
export function exportMasterWorkbook(
  filename: string,
  sheets: Record<string, Record<string, any>[]>
): void {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const cleanRows = rows.map(sanitizeRow);
    const ws = XLSX.utils.json_to_sheet(cleanRows.length > 0 ? cleanRows : [{ info: 'No records found' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalName);
}

export interface PaymentsAndProfitExportData {
  qgoSummary: Record<string, any>[];
  shopSettlements: Record<string, any>[];
  itemizedTransactions: Record<string, any>[];
}

/**
 * Generates an end-to-end 3-Sheet Financial Excel (.xlsx) Report:
 * Sheet 1: QGo Profit & Summary
 * Sheet 2: Shop Settlements
 * Sheet 3: Itemized Transactions
 */
export function exportPaymentsAndProfitExcel(
  filename: string,
  data: PaymentsAndProfitExportData
): void {
  const wb = XLSX.utils.book_new();

  const sheets: Record<string, Record<string, any>[]> = {
    'QGo Profit & Summary': data.qgoSummary,
    'Shop Settlements': data.shopSettlements,
    'Itemized Transactions': data.itemizedTransactions,
  };

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const cleanRows = rows.map(sanitizeRow);
    const ws = XLSX.utils.json_to_sheet(cleanRows.length > 0 ? cleanRows : [{ info: 'No records found' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }

  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalName);
}
