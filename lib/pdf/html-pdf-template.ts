/**
 * Shared HTML PDF template engine for all AIFM analysis reports.
 * Premium, print-ready HTML with AIFM branding.
 */

export interface PDFSection {
  title: string;
  content: string;
}

export interface PDFKeyValue {
  label: string;
  value: string;
  status?: 'ok' | 'warn' | 'fail' | 'neutral';
}

export interface PDFCheckItem {
  label: string;
  checked: boolean;
}

export interface PDFBulletGroup {
  title: string;
  items: string[];
  color?: 'green' | 'red' | 'default';
}

export interface HTMLPDFOptions {
  reportType: string;
  title: string;
  subtitle?: string;
  date: string;
  badges?: Array<{ label: string; value: string; color?: 'green' | 'red' | 'gold' | 'gray' }>;
  bodyHtml: string;
  disclaimerText?: string;
  footerText?: string;
}

const DISCLAIMER_DEFAULT =
  'Denna analys är framtagen med AI-stöd och utgör inte investeringsrådgivning. Innehållet är endast informativt och ska inte ses som rekommendation att köpa eller sälja värdepapper. AIFM Capital AB ansvarar inte för beslut som fattas utifrån denna rapport.';

export function generateHTMLPDF(opts: HTMLPDFOptions): string {
  const disclaimer = opts.disclaimerText ?? DISCLAIMER_DEFAULT;
  const footer = opts.footerText ?? `AIFM Capital AB | Konfidentiellt | ${opts.reportType}`;
  const badgesHtml = (opts.badges ?? [])
    .map((b) => {
      const colors: Record<string, string> = {
        green: 'background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0',
        red: 'background:#fef2f2;color:#991b1b;border:1px solid #fecaca',
        gold: 'background:#fffbeb;color:#92400e;border:1px solid #fde68a',
        gray: 'background:#f9fafb;color:#374151;border:1px solid #e5e7eb',
      };
      const style = colors[b.color || 'gray'] || colors.gray;
      return `<span class="badge" style="${style}">${esc(b.label)}: <strong>${esc(b.value)}</strong></span>`;
    })
    .join('');

  const genDate = new Date().toLocaleString('sv-SE');

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>${esc(opts.title)} – AIFM Capital AB</title>
<style>
@page {
  size: A4;
  margin: 0;
}
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 9.5pt;
  line-height: 1.65;
  color: #1f2937;
  padding: 18mm 16mm 20mm 16mm;
  max-width: 210mm;
  -webkit-font-smoothing: antialiased;
  overflow-wrap: break-word;
  word-break: break-word;
}

/* ─── Header ─── */
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 14px;
  margin-bottom: 20px;
  border-bottom: 3px solid #1f2937;
}
.doc-header::after {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
}
.brand {
  display: flex;
  flex-direction: column;
}
.brand-logo {
  font-size: 26pt;
  font-weight: 800;
  color: #1f2937;
  letter-spacing: -0.5px;
  line-height: 1;
}
.brand-logo em {
  font-style: normal;
  color: #b8965a;
}
.brand-type {
  font-size: 7.5pt;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  margin-top: 5px;
}
.header-meta {
  text-align: right;
  font-size: 8pt;
  color: #6b7280;
  line-height: 1.5;
}
.header-meta strong {
  color: #1f2937;
  font-size: 8.5pt;
}

/* ─── Title block ─── */
.title-block {
  margin-bottom: 20px;
}
.title-block h1 {
  font-size: 22pt;
  font-weight: 800;
  color: #1f2937;
  line-height: 1.15;
  letter-spacing: -0.3px;
  margin-bottom: 4px;
}
.title-block .subtitle {
  font-size: 10.5pt;
  color: #6b7280;
  font-weight: 400;
  margin-bottom: 10px;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 8.5pt;
  font-weight: 500;
  letter-spacing: 0.2px;
}

/* ─── Sections ─── */
.section {
  margin-bottom: 22px;
  overflow: hidden;
}
h2 {
  font-size: 11.5pt;
  font-weight: 700;
  color: #1f2937;
  margin: 24px 0 10px;
  padding: 8px 0 8px 14px;
  border-left: 4px solid #b8965a;
  background: linear-gradient(90deg, #faf8f5 0%, transparent 100%);
  letter-spacing: 0.1px;
}
h3 {
  font-size: 10pt;
  font-weight: 700;
  color: #374151;
  margin: 14px 0 6px;
}

/* ─── KV Grid ─── */
.kv-grid {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 0;
  margin: 8px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.kv-row {
  display: contents;
}
.kv-row:nth-child(odd) .kv-label,
.kv-row:nth-child(odd) .kv-value {
  background: #f9fafb;
}
.kv-label {
  font-size: 8pt;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 7px 12px;
  font-weight: 600;
  border-bottom: 1px solid #f3f4f6;
}
.kv-value {
  font-size: 9.5pt;
  color: #1f2937;
  font-weight: 500;
  padding: 7px 12px;
  border-bottom: 1px solid #f3f4f6;
  overflow-wrap: break-word;
  word-break: break-word;
}
.kv-value.ok { color: #065f46; font-weight: 600; }
.kv-value.warn { color: #92400e; font-weight: 600; }
.kv-value.fail { color: #991b1b; font-weight: 600; }

/* ─── Text blocks ─── */
.text-block {
  background: #fafaf9;
  padding: 14px 16px;
  border-radius: 8px;
  margin: 8px 0;
  border-left: 4px solid #d4c5a0;
  font-size: 9.5pt;
  line-height: 1.75;
  color: #374151;
  overflow: hidden;
  overflow-wrap: break-word;
  word-break: break-word;
}
.text-block p { margin-bottom: 10px; }
.text-block p:last-child { margin-bottom: 0; }

/* ─── Summary box ─── */
.summary-box {
  background: linear-gradient(135deg, #fdfcfb 0%, #f5f3ef 100%);
  border: 1px solid #e5e1d8;
  border-radius: 10px;
  padding: 18px 20px;
  margin: 10px 0;
  font-size: 10pt;
  line-height: 1.75;
  color: #1f2937;
  overflow: hidden;
  overflow-wrap: break-word;
  word-break: break-word;
  position: relative;
}
.summary-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #b8965a, #d4c5a0);
  border-radius: 10px 10px 0 0;
}
.summary-box p { margin-bottom: 10px; }
.summary-box p:last-child { margin-bottom: 0; }

/* ─── Decision box ─── */
.decision-box {
  padding: 16px 20px;
  border-radius: 10px;
  margin: 12px 0;
  font-weight: 600;
  font-size: 10pt;
  overflow: hidden;
  overflow-wrap: break-word;
  word-break: break-word;
  line-height: 1.6;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.decision-box .decision-icon {
  font-size: 18pt;
  line-height: 1;
  flex-shrink: 0;
}
.decision-box.approved {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #a7f3d0;
  color: #065f46;
}
.decision-box.rejected {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 1px solid #fecaca;
  color: #991b1b;
}

/* ─── Checklists ─── */
.check-list { margin: 8px 0; }
.check-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 6px 0;
  font-size: 9.5pt;
  line-height: 1.5;
}
.check-box {
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  font-size: 11px;
  font-weight: 700;
}
.check-box.checked {
  background: #065f46;
  border-color: #065f46;
  color: white;
}
.check-box.unchecked {
  background: #fff;
  border-color: #d1d5db;
}

/* ─── Bullet groups ─── */
.bullet-group { margin: 10px 0; }
.bullet-title {
  font-size: 10pt;
  font-weight: 700;
  margin-bottom: 6px;
  padding: 4px 0;
}
.bullet-title.green { color: #065f46; }
.bullet-title.red { color: #991b1b; }
ul.bullets {
  list-style: none;
  padding: 0;
  margin: 0;
}
ul.bullets li {
  position: relative;
  padding: 4px 0 4px 20px;
  margin: 2px 0;
  font-size: 9.5pt;
  line-height: 1.55;
  border-bottom: 1px solid #f9fafb;
}
ul.bullets li::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 11px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b8965a;
}
ul.bullets.green li::before { background: #065f46; }
ul.bullets.red li::before { background: #991b1b; }
ul.bullets.green li { color: #065f46; }
ul.bullets.red li { color: #991b1b; }

/* ─── Tables ─── */
table.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 10px 0;
  font-size: 8.5pt;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
table.data-table th {
  background: #f9fafb;
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
  padding: 8px 10px;
  text-align: left;
  font-weight: 700;
  border-bottom: 2px solid #e5e7eb;
}
table.data-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  overflow-wrap: break-word;
  word-break: break-word;
  vertical-align: top;
}
table.data-table tbody tr:last-child td {
  border-bottom: none;
}
table.data-table tbody tr:nth-child(even) {
  background: #fafafa;
}

/* ─── Signature ─── */
.signature-section {
  margin-top: 36px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
.signature-box {
  border-top: 2px solid #1f2937;
  padding-top: 10px;
}
.signature-label {
  font-size: 7.5pt;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}
.signature-value {
  font-size: 10pt;
  font-weight: 600;
  color: #1f2937;
  margin-top: 3px;
}

/* ─── Footer ─── */
.disclaimer {
  margin-top: 36px;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 7.5pt;
  color: #9ca3af;
  line-height: 1.5;
}
.doc-footer {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
  font-size: 7.5pt;
  color: #9ca3af;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.doc-footer .brand-mark {
  font-weight: 800;
  color: #d1d5db;
  font-size: 8pt;
  letter-spacing: -0.3px;
}

/* ─── Print ─── */
@media print {
  body { padding: 0; max-width: none; }
  .page-break { page-break-before: always; }
  h2 { page-break-after: avoid; }
  .section { page-break-inside: avoid; }
  .text-block, .summary-box, .decision-box, .kv-grid, table.data-table { page-break-inside: avoid; }
  .doc-header { position: running(header); }
}
</style>
</head>
<body>

<div class="doc-header">
  <div class="brand">
    <div class="brand-logo">AIFM<em>.</em></div>
    <div class="brand-type">${esc(opts.reportType)}</div>
  </div>
  <div class="header-meta">
    <strong>AIFM Capital AB</strong><br>
    ${esc(opts.date)}<br>
    <span style="font-size:7pt">Genererad ${genDate}</span>
  </div>
</div>

<div class="title-block">
  <h1>${esc(opts.title)}</h1>
  ${opts.subtitle ? `<div class="subtitle">${esc(opts.subtitle)}</div>` : ''}
  ${badgesHtml ? `<div class="badges">${badgesHtml}</div>` : ''}
</div>

${opts.bodyHtml}

<div class="disclaimer">${esc(disclaimer)}</div>
<div class="doc-footer">
  <span class="brand-mark">AIFM.</span>
  <span>${esc(footer)}</span>
  <span>${esc(opts.date)}</span>
</div>

</body>
</html>`;
}

// ────────────────────────────────────────
// Utilities
// ────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textToParagraphs(text: string): string {
  const escaped = esc(text);
  const paragraphs = escaped.split(/\n{2,}/);
  if (paragraphs.length > 1) {
    return paragraphs.map((p) => {
      const lines = p.split(/\n/).filter(Boolean);
      return `<p>${lines.join('<br>')}</p>`;
    }).join('');
  }
  const lines = escaped.split(/\n/).filter(Boolean);
  if (lines.length > 1) {
    return lines.map((l) => `<p>${l}</p>`).join('');
  }
  return `<p>${escaped}</p>`;
}

// ────────────────────────────────────────
// Builder helpers for creating body HTML
// ────────────────────────────────────────

export function htmlSection(title: string, content: string): string {
  return `<div class="section"><h2>${esc(title)}</h2>${content}</div>`;
}

export function htmlKVGrid(items: PDFKeyValue[]): string {
  return `<div class="kv-grid">${items.map((i) =>
    `<div class="kv-row"><div class="kv-label">${esc(i.label)}</div><div class="kv-value${i.status ? ' ' + i.status : ''}">${esc(i.value)}</div></div>`
  ).join('')}</div>`;
}

export function htmlTextBlock(text: string): string {
  if (!text) return '';
  return `<div class="text-block">${textToParagraphs(text)}</div>`;
}

export function htmlSummaryBox(text: string): string {
  if (!text) return '';
  return `<div class="summary-box">${textToParagraphs(text)}</div>`;
}

export function htmlDecisionBox(decision: 'approved' | 'rejected', text: string): string {
  const cls = decision === 'approved' ? 'approved' : 'rejected';
  const icon = decision === 'approved' ? '✓' : '✗';
  const label = decision === 'approved' ? 'GODKÄND' : 'UNDERKÄND';
  return `<div class="decision-box ${cls}"><span class="decision-icon">${icon}</span><div><strong>${label}</strong>${text ? '<br>' + textToParagraphs(text) : ''}</div></div>`;
}

export function htmlCheckList(items: PDFCheckItem[]): string {
  return `<div class="check-list">${items.map((i) =>
    `<div class="check-item"><div class="check-box ${i.checked ? 'checked' : 'unchecked'}">${i.checked ? '✓' : ''}</div><span>${esc(i.label)}</span></div>`
  ).join('')}</div>`;
}

export function htmlBulletGroup(group: PDFBulletGroup): string {
  const cls = group.color === 'green' ? ' green' : group.color === 'red' ? ' red' : '';
  return `<div class="bullet-group"><div class="bullet-title${cls}">${esc(group.title)}</div><ul class="bullets${cls}">${group.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
}

export function htmlTable(headers: string[], rows: string[][]): string {
  return `<table class="data-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function htmlSignature(sections: Array<{ label: string; name: string; detail?: string }>): string {
  return `<div class="signature-section">${sections.map((s) =>
    `<div class="signature-box"><div class="signature-label">${esc(s.label)}</div><div class="signature-value">${esc(s.name)}</div>${s.detail ? `<div style="font-size:8pt;color:#6b7280;margin-top:2px">${esc(s.detail)}</div>` : ''}</div>`
  ).join('')}</div>`;
}

export function htmlPageBreak(): string {
  return '<div class="page-break"></div>';
}
