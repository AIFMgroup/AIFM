// PDF Report Generator for Compliance and Financial Reports
// Uses browser-native APIs and server-side rendering for PDF generation

export interface ReportConfig {
  title: string;
  subtitle?: string;
  companyName: string;
  companyLogo?: string;
  generatedBy: string;
  generatedAt: Date;
  sections: ReportSection[];
  footer?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'text' | 'table' | 'chart' | 'list' | 'kpi' | 'timeline';
  content: any;
}

export interface TableSection {
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string | number }[];
}

export interface KPISection {
  kpis: {
    label: string;
    value: string | number;
    change?: number;
    status?: 'good' | 'warning' | 'bad';
  }[];
}

export interface TimelineSection {
  events: {
    date: string;
    title: string;
    description?: string;
    status?: string;
  }[];
}

// Generate HTML content for PDF
export function generateReportHTML(config: ReportConfig): string {
  const { title, subtitle, companyName, generatedBy, generatedAt, sections, footer } = config;
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const renderSection = (section: ReportSection): string => {
    switch (section.type) {
      case 'text':
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <div class="text-content">${section.content}</div>
          </div>
        `;
      
      case 'table':
        const table = section.content as TableSection;
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <table>
              <thead>
                <tr>
                  ${table.headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${table.rows.map(row => `
                  <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
              ${table.summary ? `
                <tfoot>
                  ${table.summary.map(s => `
                    <tr class="summary-row">
                      <td colspan="${table.headers.length - 1}">${s.label}</td>
                      <td><strong>${s.value}</strong></td>
                    </tr>
                  `).join('')}
                </tfoot>
              ` : ''}
            </table>
          </div>
        `;
      
      case 'kpi':
        const kpis = section.content as KPISection;
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <div class="kpi-grid">
              ${kpis.kpis.map(kpi => `
                <div class="kpi-card ${kpi.status || ''}">
                  <div class="kpi-value">${kpi.value}</div>
                  <div class="kpi-label">${kpi.label}</div>
                  ${kpi.change !== undefined ? `
                    <div class="kpi-change ${kpi.change >= 0 ? 'positive' : 'negative'}">
                      ${kpi.change >= 0 ? '↑' : '↓'} ${Math.abs(kpi.change)}%
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      
      case 'timeline':
        const timeline = section.content as TimelineSection;
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <div class="timeline">
              ${timeline.events.map(event => `
                <div class="timeline-item">
                  <div class="timeline-date">${event.date}</div>
                  <div class="timeline-content">
                    <div class="timeline-title">${event.title}</div>
                    ${event.description ? `<div class="timeline-desc">${event.description}</div>` : ''}
                    ${event.status ? `<span class="timeline-status">${event.status}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      
      case 'list':
        const items = section.content as string[];
        return `
          <div class="section">
            <h2>${section.title}</h2>
            <ul class="report-list">
              ${items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `;
      
      default:
        return '';
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4;
          margin: 2cm;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #1a1a1a;
          background: white;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 20px;
          border-bottom: 2px solid #c0a280;
          margin-bottom: 30px;
        }
        
        .header-left h1 {
          font-size: 24pt;
          font-weight: 600;
          color: #2d2a26;
          margin-bottom: 4px;
        }
        
        .header-left .subtitle {
          font-size: 12pt;
          color: #666;
        }
        
        .header-right {
          text-align: right;
          font-size: 9pt;
          color: #666;
        }
        
        .header-right .company-name {
          font-size: 11pt;
          font-weight: 600;
          color: #2d2a26;
          margin-bottom: 4px;
        }
        
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        
        .section h2 {
          font-size: 14pt;
          font-weight: 600;
          color: #2d2a26;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
        }
        
        .text-content {
          text-align: justify;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        
        th, td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        
        th {
          background: #f8f7f5;
          font-weight: 600;
          color: #2d2a26;
        }
        
        tr:nth-child(even) {
          background: #fafafa;
        }
        
        .summary-row {
          background: #f0efe9 !important;
          font-weight: 500;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        
        .kpi-card {
          background: #f8f7f5;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        
        .kpi-card.good { border-left: 4px solid #10b981; }
        .kpi-card.warning { border-left: 4px solid #f59e0b; }
        .kpi-card.bad { border-left: 4px solid #ef4444; }
        
        .kpi-value {
          font-size: 20pt;
          font-weight: 700;
          color: #2d2a26;
        }
        
        .kpi-label {
          font-size: 9pt;
          color: #666;
          margin-top: 4px;
        }
        
        .kpi-change {
          font-size: 9pt;
          margin-top: 8px;
        }
        
        .kpi-change.positive { color: #10b981; }
        .kpi-change.negative { color: #ef4444; }
        
        .timeline {
          position: relative;
          padding-left: 24px;
        }
        
        .timeline::before {
          content: '';
          position: absolute;
          left: 6px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #e5e5e5;
        }
        
        .timeline-item {
          position: relative;
          margin-bottom: 20px;
        }
        
        .timeline-item::before {
          content: '';
          position: absolute;
          left: -21px;
          top: 4px;
          width: 10px;
          height: 10px;
          background: #c0a280;
          border-radius: 50%;
        }
        
        .timeline-date {
          font-size: 9pt;
          color: #999;
          margin-bottom: 4px;
        }
        
        .timeline-title {
          font-weight: 600;
          color: #2d2a26;
        }
        
        .timeline-desc {
          font-size: 10pt;
          color: #666;
          margin-top: 4px;
        }
        
        .timeline-status {
          display: inline-block;
          font-size: 8pt;
          background: #f0efe9;
          color: #666;
          padding: 2px 8px;
          border-radius: 10px;
          margin-top: 8px;
        }
        
        .report-list {
          list-style: none;
        }
        
        .report-list li {
          padding: 8px 0;
          padding-left: 20px;
          position: relative;
        }
        
        .report-list li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #c0a280;
          font-weight: bold;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 9pt;
          color: #999;
          text-align: center;
        }
        
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>${title}</h1>
          ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        </div>
        <div class="header-right">
          <div class="company-name">${companyName}</div>
          <div>Genererad: ${formatDate(generatedAt)}</div>
          <div>Av: ${generatedBy}</div>
        </div>
      </div>
      
      ${sections.map(renderSection).join('')}
      
      ${footer ? `<div class="footer">${footer}</div>` : `
        <div class="footer">
          Denna rapport genererades automatiskt av AIFM Portal.<br>
          © ${generatedAt.getFullYear()} AIFM - Konfidentiellt
        </div>
      `}
    </body>
    </html>
  `;
}

// Generate and download PDF using print dialog
export async function downloadPDF(config: ReportConfig): Promise<void> {
  const html = generateReportHTML(config);
  
  // Create a new window with the report
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow popups.');
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

// Generate report via API (server-side PDF generation)
export async function generatePDFViaAPI(config: ReportConfig): Promise<Blob> {
  const response = await fetch('/api/reports/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate PDF');
  }
  
  return response.blob();
}

// Pre-built report templates
export const reportTemplates = {
  complianceOverview: (companyName: string, data: any): ReportConfig => ({
    title: 'Compliance Översikt',
    subtitle: 'Kvartalsrapport',
    companyName,
    generatedBy: 'AIFM Portal',
    generatedAt: new Date(),
    sections: [
      {
        id: 'summary',
        title: 'Sammanfattning',
        type: 'kpi',
        content: {
          kpis: [
            { label: 'Compliance Score', value: `${data.score}%`, status: data.score >= 90 ? 'good' : data.score >= 70 ? 'warning' : 'bad' },
            { label: 'Öppna ärenden', value: data.openIssues, status: data.openIssues === 0 ? 'good' : 'warning' },
            { label: 'Dokument granskade', value: data.documentsReviewed, change: data.documentsChange },
            { label: 'Dagar sedan senaste granskning', value: data.daysSinceReview, status: data.daysSinceReview <= 30 ? 'good' : 'bad' },
          ],
        } as KPISection,
      },
      {
        id: 'requirements',
        title: 'Regulatoriska Krav',
        type: 'table',
        content: {
          headers: ['Krav', 'Status', 'Deadline', 'Ansvarig'],
          rows: data.requirements.map((r: any) => [r.name, r.status, r.deadline, r.assignee]),
        } as TableSection,
      },
      {
        id: 'timeline',
        title: 'Senaste Aktiviteter',
        type: 'timeline',
        content: {
          events: data.activities.map((a: any) => ({
            date: a.date,
            title: a.title,
            description: a.description,
            status: a.status,
          })),
        } as TimelineSection,
      },
    ],
  }),

  financialSummary: (companyName: string, data: any): ReportConfig => ({
    title: 'Finansiell Sammanfattning',
    subtitle: data.period,
    companyName,
    generatedBy: 'AIFM Portal',
    generatedAt: new Date(),
    sections: [
      {
        id: 'kpis',
        title: 'Nyckeltal',
        type: 'kpi',
        content: {
          kpis: [
            { label: 'NAV', value: data.nav, change: data.navChange },
            { label: 'AUM', value: data.aum, change: data.aumChange },
            { label: 'Avkastning YTD', value: `${data.returnYTD}%`, status: data.returnYTD >= 0 ? 'good' : 'bad' },
            { label: 'Kostnadskvot', value: `${data.expenseRatio}%` },
          ],
        } as KPISection,
      },
      {
        id: 'transactions',
        title: 'Transaktioner',
        type: 'table',
        content: {
          headers: ['Datum', 'Typ', 'Belopp', 'Status'],
          rows: data.transactions.map((t: any) => [t.date, t.type, t.amount, t.status]),
          summary: [
            { label: 'Totalt inflöde', value: data.totalInflow },
            { label: 'Totalt utflöde', value: data.totalOutflow },
          ],
        } as TableSection,
      },
    ],
  }),
};



