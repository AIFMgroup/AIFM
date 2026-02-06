/**
 * Document Generator Service
 * 
 * Generates documents from templates:
 * - Subscription agreements
 * - KID documents
 * - Board protocols
 * - Compliance reports
 * - Custom documents via AI
 */

// ============================================================================
// Types
// ============================================================================

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'legal' | 'compliance' | 'investor' | 'internal' | 'regulatory';
  fields: TemplateField[];
  content: string; // Markdown template with {{placeholders}}
}

export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiline';
  required: boolean;
  defaultValue?: string;
  options?: string[]; // For select type
  placeholder?: string;
}

export interface GeneratedDocument {
  id: string;
  templateId: string;
  title: string;
  content: string;
  format: 'markdown' | 'html' | 'pdf';
  createdAt: string;
  createdBy: string;
  metadata: Record<string, any>;
}

// ============================================================================
// Document Templates
// ============================================================================

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'subscription-agreement',
    name: 'Teckningsavtal',
    description: 'Standardavtal för teckning av fondandelar',
    category: 'investor',
    fields: [
      { id: 'investorName', label: 'Investerarens namn', type: 'text', required: true },
      { id: 'investorId', label: 'Personnummer/Org.nr', type: 'text', required: true },
      { id: 'investorAddress', label: 'Adress', type: 'multiline', required: true },
      { id: 'fundName', label: 'Fondnamn', type: 'select', required: true, options: ['AuAg Silver Bullet A', 'AuAg Silver Bullet B', 'AuAg Gold Mining A'] },
      { id: 'amount', label: 'Teckningsbelopp (SEK)', type: 'number', required: true },
      { id: 'date', label: 'Datum', type: 'date', required: true },
      { id: 'bankAccount', label: 'Bankkonto för utbetalning', type: 'text', required: false },
    ],
    content: `# Teckningsavtal

## Parter

**Investerare:**
{{investorName}}
{{investorId}}
{{investorAddress}}

**Fondbolag:**
AIFM Group AB
Org.nr: 559179-8160
Grev Turegatan 14A, 114 46 Stockholm

## Teckning

Undertecknad tecknar härmed andelar i **{{fundName}}** för ett belopp om **{{amount}} SEK**.

## Villkor

1. Teckningen sker i enlighet med fondens informationsbroschyr och fondbestämmelser.
2. Investeraren bekräftar att ha tagit del av fondens KID-dokument.
3. Insättning ska ske till fondens teckningskonto inom 5 bankdagar.

## Bekräftelse

Investeraren bekräftar att:
- [ ] Tagit del av fondbestämmelserna
- [ ] Läst KID-dokumentet
- [ ] Förstår riskerna med investeringen
- [ ] Uppgifterna ovan är korrekta

## Underskrift

Datum: {{date}}

_________________________
{{investorName}}

## Bankkontouppgifter för eventuell utbetalning

{{bankAccount}}

---
*Detta dokument är genererat av AIFM Groups fondadministrationssystem.*
`,
  },
  {
    id: 'board-protocol',
    name: 'Styrelseprotokoll',
    description: 'Mall för styrelseprotokoll',
    category: 'internal',
    fields: [
      { id: 'meetingNumber', label: 'Protokollnummer', type: 'text', required: true, placeholder: 'Ex: 2026-03' },
      { id: 'meetingDate', label: 'Mötesdatum', type: 'date', required: true },
      { id: 'location', label: 'Plats', type: 'text', required: true, defaultValue: 'Grev Turegatan 14A, Stockholm' },
      { id: 'attendees', label: 'Närvarande', type: 'multiline', required: true },
      { id: 'chairman', label: 'Ordförande', type: 'text', required: true },
      { id: 'secretary', label: 'Sekreterare', type: 'text', required: true },
      { id: 'agenda', label: 'Dagordning', type: 'multiline', required: true },
      { id: 'decisions', label: 'Beslut', type: 'multiline', required: true },
    ],
    content: `# Styrelseprotokoll {{meetingNumber}}

**AIFM Group AB**
Org.nr: 559179-8160

## Mötesinformation

| | |
|---|---|
| **Datum** | {{meetingDate}} |
| **Plats** | {{location}} |
| **Ordförande** | {{chairman}} |
| **Sekreterare** | {{secretary}} |

## Närvarande

{{attendees}}

## Dagordning

{{agenda}}

## Beslut

{{decisions}}

## Justering

Protokollet justeras av ordföranden.

_________________________
{{chairman}}, Ordförande

_________________________
{{secretary}}, Sekreterare

---
*Protokoll fört av {{secretary}}*
`,
  },
  {
    id: 'compliance-report',
    name: 'Compliance-rapport',
    description: 'Periodisk compliance-rapport',
    category: 'compliance',
    fields: [
      { id: 'period', label: 'Rapportperiod', type: 'text', required: true, placeholder: 'Q1 2026' },
      { id: 'reportDate', label: 'Rapportdatum', type: 'date', required: true },
      { id: 'preparedBy', label: 'Upprättad av', type: 'text', required: true },
      { id: 'summary', label: 'Sammanfattning', type: 'multiline', required: true },
      { id: 'incidents', label: 'Incidenter under perioden', type: 'multiline', required: false },
      { id: 'recommendations', label: 'Rekommendationer', type: 'multiline', required: false },
    ],
    content: `# Compliance-rapport

**Period:** {{period}}
**Rapportdatum:** {{reportDate}}
**Upprättad av:** {{preparedBy}}

## Sammanfattning

{{summary}}

## Regelefterlevnad

### Kontrollerade områden

- [ ] NAV-beräkning och publicering
- [ ] Investerargränser
- [ ] Likviditetshantering
- [ ] Rapportering till FI
- [ ] AML/KYC-kontroller
- [ ] Intressekonflikter

## Incidenter

{{incidents}}

## Rekommendationer

{{recommendations}}

## Nästa steg

- Uppföljning av identifierade brister
- Planerade kontroller nästa period
- Utbildningsbehov

---
*Rapporten är konfidentiell och avsedd endast för styrelsens användning.*
`,
  },
  {
    id: 'investor-report',
    name: 'Investerarrapport',
    description: 'Periodisk rapport till investerare',
    category: 'investor',
    fields: [
      { id: 'fundName', label: 'Fondnamn', type: 'select', required: true, options: ['AuAg Silver Bullet A', 'AuAg Silver Bullet B', 'AuAg Gold Mining A'] },
      { id: 'period', label: 'Period', type: 'text', required: true, placeholder: 'Januari 2026' },
      { id: 'nav', label: 'NAV vid periodens slut', type: 'number', required: true },
      { id: 'navChange', label: 'NAV-förändring (%)', type: 'number', required: true },
      { id: 'aum', label: 'Förvaltat kapital (MSEK)', type: 'number', required: true },
      { id: 'commentary', label: 'Förvaltarkommentar', type: 'multiline', required: true },
    ],
    content: `# Månadsrapport - {{fundName}}

**Period:** {{period}}

## Nyckeltal

| Mått | Värde |
|------|-------|
| NAV per andel | {{nav}} SEK |
| Förändring under perioden | {{navChange}}% |
| Förvaltat kapital | {{aum}} MSEK |

## Förvaltarkommentar

{{commentary}}

## Viktiga händelser

*[Lägg till relevanta händelser under perioden]*

## Marknadskommentar

*[Lägg till marknadsanalys]*

---

**Kontakt:**
AIFM Group AB
Tel: 08-XXX XX XX
E-post: info@aifm.se

*Historisk avkastning är ingen garanti för framtida avkastning. Värdet på fondandelar kan både öka och minska.*
`,
  },
  {
    id: 'power-of-attorney',
    name: 'Fullmakt',
    description: 'Fullmakt för representation',
    category: 'legal',
    fields: [
      { id: 'grantor', label: 'Fullmaktsgivare', type: 'text', required: true },
      { id: 'grantorId', label: 'Personnummer/Org.nr', type: 'text', required: true },
      { id: 'attorney', label: 'Fullmäktig', type: 'text', required: true },
      { id: 'attorneyId', label: 'Personnummer fullmäktig', type: 'text', required: true },
      { id: 'scope', label: 'Fullmaktens omfattning', type: 'multiline', required: true },
      { id: 'validFrom', label: 'Giltig från', type: 'date', required: true },
      { id: 'validTo', label: 'Giltig till', type: 'date', required: false },
    ],
    content: `# Fullmakt

## Fullmaktsgivare

**{{grantor}}**
{{grantorId}}

## Fullmäktig

**{{attorney}}**
{{attorneyId}}

## Omfattning

Undertecknad ger härmed {{attorney}} fullmakt att för min räkning:

{{scope}}

## Giltighetstid

Denna fullmakt gäller från {{validFrom}}{{#validTo}} till och med {{validTo}}{{/validTo}}.

## Underskrift

Datum: {{validFrom}}

_________________________
{{grantor}}

---
*Fullmakten ska uppvisas i original vid användning.*
`,
  },
];

// ============================================================================
// Document Generator Service
// ============================================================================

export class DocumentGenerator {
  /**
   * Get all available templates
   */
  getTemplates(category?: string): DocumentTemplate[] {
    if (category) {
      return DOCUMENT_TEMPLATES.filter(t => t.category === category);
    }
    return DOCUMENT_TEMPLATES;
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): DocumentTemplate | null {
    return DOCUMENT_TEMPLATES.find(t => t.id === templateId) || null;
  }

  /**
   * Generate document from template
   */
  generateDocument(
    templateId: string,
    data: Record<string, any>,
    createdBy: string
  ): GeneratedDocument {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate required fields
    for (const field of template.fields) {
      if (field.required && !data[field.id]) {
        throw new Error(`Required field "${field.label}" is missing`);
      }
    }

    // Replace placeholders in template
    let content = template.content;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(placeholder, String(value ?? ''));
    }

    // Handle conditional sections (simple implementation)
    content = content.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, innerContent) => {
      return data[key] ? innerContent : '';
    });

    // Generate document
    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      title: `${template.name} - ${new Date().toLocaleDateString('sv-SE')}`,
      content,
      format: 'markdown',
      createdAt: new Date().toISOString(),
      createdBy,
      metadata: data,
    };
  }

  /**
   * Generate custom document using AI
   */
  async generateCustomDocument(
    prompt: string,
    context?: string
  ): Promise<string> {
    // This would call the AI service to generate a document
    // For now, return a template
    return `# Genererat dokument

Baserat på: ${prompt}

${context ? `\n## Kontext\n${context}\n` : ''}

---
*Dokumentet genererades automatiskt och bör granskas innan användning.*
`;
  }

  /**
   * Convert markdown to HTML
   */
  markdownToHtml(markdown: string): string {
    // Simple markdown to HTML conversion
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
      // Tables (simplified)
      .replace(/\|/g, '</td><td>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    return `<div class="document">${html}</div>`;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let documentGeneratorInstance: DocumentGenerator | null = null;

export function getDocumentGenerator(): DocumentGenerator {
  if (!documentGeneratorInstance) {
    documentGeneratorInstance = new DocumentGenerator();
  }
  return documentGeneratorInstance;
}
