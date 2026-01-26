/**
 * Export Utilities
 * Functions for exporting data to CSV and Excel formats
 */

// ============================================================================
// Types
// ============================================================================

export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  formatter?: (value: any, row: T) => string;
  width?: number;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  includeTimestamp?: boolean;
}

// ============================================================================
// CSV Export
// ============================================================================

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Build CSV content
  const headers = columns.map(col => `"${col.header}"`).join(',');
  
  const rows = data.map(row => {
    return columns.map(col => {
      const value = getNestedValue(row, col.key as string);
      const formatted = col.formatter ? col.formatter(value, row) : value;
      // Escape quotes and wrap in quotes
      const escaped = String(formatted ?? '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');

  // Add BOM for Excel compatibility with Swedish characters
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Generate filename
  const timestamp = options.includeTimestamp 
    ? `_${new Date().toISOString().split('T')[0]}` 
    : '';
  const filename = `${options.filename}${timestamp}.csv`;

  // Trigger download
  downloadBlob(blob, filename);
}

// ============================================================================
// Excel Export (using XLSX-style format)
// ============================================================================

export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): Promise<void> {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // For now, we'll create a simple Excel-compatible HTML table
  // In production, you'd use a library like xlsx or exceljs
  
  const tableRows = data.map(row => {
    return columns.map(col => {
      const value = getNestedValue(row, col.key as string);
      const formatted = col.formatter ? col.formatter(value, row) : value;
      return `<td>${escapeHtml(String(formatted ?? ''))}</td>`;
    }).join('');
  });

  const headerRow = columns.map(col => 
    `<th style="background:#f3f4f6;font-weight:bold;padding:8px;border:1px solid #e5e7eb;">${escapeHtml(col.header)}</th>`
  ).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${options.sheetName || 'Data'}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; }
        td, th { padding: 8px; border: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>
          ${tableRows.map(row => `<tr>${row}</tr>`).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });

  // Generate filename
  const timestamp = options.includeTimestamp 
    ? `_${new Date().toISOString().split('T')[0]}` 
    : '';
  const filename = `${options.filename}${timestamp}.xls`;

  downloadBlob(blob, filename);
}

// ============================================================================
// JSON Export
// ============================================================================

export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  options: ExportOptions
): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });

  const timestamp = options.includeTimestamp 
    ? `_${new Date().toISOString().split('T')[0]}` 
    : '';
  const filename = `${options.filename}${timestamp}.json`;

  downloadBlob(blob, filename);
}

// ============================================================================
// Helper Functions
// ============================================================================

function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Pre-configured Export Functions
// ============================================================================

// Contacts Export
export function exportContacts(contacts: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'firstName', header: 'Förnamn' },
    { key: 'lastName', header: 'Efternamn' },
    { key: 'email', header: 'E-post' },
    { key: 'phone', header: 'Telefon' },
    { key: 'mobile', header: 'Mobil' },
    { key: 'title', header: 'Titel' },
    { key: 'status', header: 'Status' },
    { key: 'tags', header: 'Taggar', formatter: (v) => Array.isArray(v) ? v.join(', ') : '' },
    { key: 'createdAt', header: 'Skapad', formatter: (v) => formatDate(v) },
  ];

  exportToCSV(contacts, columns, {
    filename: 'kontakter',
    includeTimestamp: true,
  });
}

// Companies Export
export function exportCompanies(companies: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'name', header: 'Företagsnamn' },
    { key: 'orgNumber', header: 'Org.nummer' },
    { key: 'customerNumber', header: 'Kundnummer' },
    { key: 'status', header: 'Status' },
    { key: 'industry', header: 'Bransch' },
    { key: 'email', header: 'E-post' },
    { key: 'phone', header: 'Telefon' },
    { key: 'address.city', header: 'Stad' },
    { key: 'currentARR', header: 'ARR', formatter: (v) => formatCurrency(v) },
    { key: 'ownerName', header: 'Ansvarig' },
    { key: 'createdAt', header: 'Skapad', formatter: (v) => formatDate(v) },
  ];

  exportToCSV(companies, columns, {
    filename: 'foretag',
    includeTimestamp: true,
  });
}

// Deals Export
export function exportDeals(deals: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'name', header: 'Affärsnamn' },
    { key: 'crmCompanyName', header: 'Företag' },
    { key: 'stage', header: 'Fas' },
    { key: 'status', header: 'Status' },
    { key: 'value', header: 'Värde', formatter: (v) => formatCurrency(v) },
    { key: 'currency', header: 'Valuta' },
    { key: 'probability', header: 'Sannolikhet', formatter: (v) => v ? `${v}%` : '' },
    { key: 'expectedCloseDate', header: 'Förväntat avslut', formatter: (v) => formatDate(v) },
    { key: 'ownerName', header: 'Ansvarig' },
    { key: 'createdAt', header: 'Skapad', formatter: (v) => formatDate(v) },
  ];

  exportToCSV(deals, columns, {
    filename: 'affarer',
    includeTimestamp: true,
  });
}

// Tasks Export
export function exportTasks(tasks: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'title', header: 'Titel' },
    { key: 'description', header: 'Beskrivning' },
    { key: 'status', header: 'Status' },
    { key: 'priority', header: 'Prioritet' },
    { key: 'dueDate', header: 'Förfallodatum', formatter: (v) => formatDate(v) },
    { key: 'assigneeName', header: 'Tilldelad' },
    { key: 'contactName', header: 'Kontakt' },
    { key: 'crmCompanyName', header: 'Företag' },
    { key: 'completedAt', header: 'Avslutad', formatter: (v) => formatDate(v) },
    { key: 'createdAt', header: 'Skapad', formatter: (v) => formatDate(v) },
  ];

  exportToCSV(tasks, columns, {
    filename: 'uppgifter',
    includeTimestamp: true,
  });
}

// Activities Export
export function exportActivities(activities: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'title', header: 'Titel' },
    { key: 'type', header: 'Typ' },
    { key: 'status', header: 'Status' },
    { key: 'startTime', header: 'Starttid', formatter: (v) => formatDateTime(v) },
    { key: 'endTime', header: 'Sluttid', formatter: (v) => formatDateTime(v) },
    { key: 'contactName', header: 'Kontakt' },
    { key: 'crmCompanyName', header: 'Företag' },
    { key: 'outcome', header: 'Utfall' },
    { key: 'ownerName', header: 'Ansvarig' },
    { key: 'createdAt', header: 'Skapad', formatter: (v) => formatDate(v) },
  ];

  exportToCSV(activities, columns, {
    filename: 'aktiviteter',
    includeTimestamp: true,
  });
}

// KYC Export
export function exportKycRecords(records: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'crmCompanyId', header: 'Företags-ID' },
    { key: 'status', header: 'Status' },
    { key: 'riskLevel', header: 'Risknivå' },
    { key: 'startedAt', header: 'Påbörjad', formatter: (v) => formatDate(v) },
    { key: 'completedAt', header: 'Slutförd', formatter: (v) => formatDate(v) },
    { key: 'approvedAt', header: 'Godkänd', formatter: (v) => formatDate(v) },
    { key: 'expiresAt', header: 'Utgår', formatter: (v) => formatDate(v) },
    { key: 'checklist', header: 'Checklistepunkter', formatter: (v) => Array.isArray(v) ? `${v.filter((c: any) => c.completed).length}/${v.length}` : '' },
  ];

  exportToCSV(records, columns, {
    filename: 'kyc_granskningar',
    includeTimestamp: true,
  });
}

// Contracts Export
export function exportContracts(contracts: any[]): void {
  const columns: ExportColumn<any>[] = [
    { key: 'name', header: 'Avtalsnamn' },
    { key: 'contractNumber', header: 'Avtalsnummer' },
    { key: 'type', header: 'Typ' },
    { key: 'crmCompanyName', header: 'Företag' },
    { key: 'status', header: 'Status' },
    { key: 'value', header: 'Värde', formatter: (v) => formatCurrency(v) },
    { key: 'currency', header: 'Valuta' },
    { key: 'startDate', header: 'Startdatum', formatter: (v) => formatDate(v) },
    { key: 'endDate', header: 'Slutdatum', formatter: (v) => formatDate(v) },
    { key: 'signedAt', header: 'Signerat', formatter: (v) => formatDate(v) },
    { key: 'autoRenewal', header: 'Autoförnyelse', formatter: (v) => v ? 'Ja' : 'Nej' },
  ];

  exportToCSV(contracts, columns, {
    filename: 'avtal',
    includeTimestamp: true,
  });
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatDate(value: string | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('sv-SE');
  } catch {
    return value;
  }
}

function formatDateTime(value: string | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('sv-SE');
  } catch {
    return value;
  }
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat('sv-SE', { style: 'decimal' }).format(value);
}



