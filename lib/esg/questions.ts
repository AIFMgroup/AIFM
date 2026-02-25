/**
 * ESG-rapport – frågebatteri för drag-and-drop analys av bolagens ESG-rapporter.
 * Strukturerat enligt: normscreening, exkludering, governance, risk, PAI, taxonomi, sammanfattning.
 */

export type ESGQuestionType = 'text' | 'yesno' | 'yesno_with_detail' | 'select' | 'number';

export interface ESGQuestionOption {
  value: string;
  label: string;
}

export interface ESGQuestion {
  id: string;
  number: string;
  text: string;
  description?: string;
  type: ESGQuestionType;
  options?: ESGQuestionOption[];
  subQuestions?: ESGQuestion[];
}

export interface ESGSection {
  id: string;
  title: string;
  description?: string;
  questions: ESGQuestion[];
  /** Sub-sections rendered as separate cards in the UI */
  subSections?: ESGSubSection[];
}

export interface ESGSubSection {
  id: string;
  title: string;
  description: string;
  questions: ESGQuestion[];
}

/** All sections for the ESG form (steps 2–8). Step 1 is document upload. */
export const ESG_SECTIONS: ESGSection[] = [
  {
    id: 'norm',
    title: 'Normbaserad screening',
    questions: [
      { id: 'normScreeningUNGC', number: '1', text: 'FN Global Compact – efterlevnad', type: 'yesno' },
      { id: 'normScreeningOECD', number: '2', text: 'OECD-riktlinjer – efterlevnad', type: 'yesno' },
      { id: 'normScreeningHumanRights', number: '3', text: 'Mänskliga rättigheter', type: 'yesno' },
      { id: 'normScreeningAntiCorruption', number: '4', text: 'Antikorruption', type: 'yesno' },
      {
        id: 'normScreeningControversy',
        number: '5',
        text: 'Allvarliga kontroverser (nivå 4–5 = avslag)',
        type: 'yesno',
      },
      { id: 'controversyLevel', number: '6', text: 'Kontroversnivå (0–5)', type: 'number' },
      { id: 'normScreeningComment', number: '7', text: 'Kommentar normscreening', type: 'text' },
    ],
  },
  {
    id: 'exclusion',
    title: 'Exkluderingskontroll',
    questions: [
      { id: 'exclusionWeapons', number: '8', text: 'Vapen & krigsmateriel – exponering / godkänd', type: 'yesno_with_detail' },
      { id: 'exclusionControversialWeapons', number: '9', text: 'Kontroversiella vapen', type: 'yesno_with_detail' },
      { id: 'exclusionNuclear', number: '10', text: 'Kärnvapen', type: 'yesno_with_detail' },
      { id: 'exclusionAlcohol', number: '11', text: 'Alkohol', type: 'yesno_with_detail' },
      { id: 'exclusionTobacco', number: '12', text: 'Tobak', type: 'yesno_with_detail' },
      { id: 'exclusionFossilFuels', number: '13', text: 'Fossila bränslen', type: 'yesno_with_detail' },
      { id: 'exclusionSummaryComment', number: '14', text: 'Samlad motivering exkludering', type: 'text' },
    ],
  },
  {
    id: 'governance',
    title: 'Good Governance',
    questions: [
      { id: 'governanceStructure', number: '15', text: 'Styrelsestruktur', type: 'yesno' },
      { id: 'compensationSystem', number: '16', text: 'Ersättningssystem', type: 'yesno' },
      { id: 'taxCompliance', number: '17', text: 'Skatteefterlevnad', type: 'yesno' },
      { id: 'antiCorruption', number: '18', text: 'Antikorruption', type: 'yesno' },
      { id: 'transparencyReporting', number: '19', text: 'Transparens & rapportering', type: 'yesno' },
      { id: 'governanceControversies', number: '20', text: 'Styrningskontroverser', type: 'yesno' },
      { id: 'governanceComment', number: '21', text: 'Kommentar governance', type: 'text' },
    ],
  },
  {
    id: 'risk',
    title: 'ESG-riskanalys',
    questions: [
      {
        id: 'envRiskLevel',
        number: '22',
        text: 'Miljörisker (E)',
        type: 'select',
        options: [
          { value: 'low', label: 'Låg' },
          { value: 'medium', label: 'Medel' },
          { value: 'high', label: 'Hög' },
        ],
      },
      {
        id: 'socialRiskLevel',
        number: '23',
        text: 'Sociala risker (S)',
        type: 'select',
        options: [
          { value: 'low', label: 'Låg' },
          { value: 'medium', label: 'Medel' },
          { value: 'high', label: 'Hög' },
        ],
      },
      {
        id: 'govRiskLevel',
        number: '24',
        text: 'Styrningsrisker (G)',
        type: 'select',
        options: [
          { value: 'low', label: 'Låg' },
          { value: 'medium', label: 'Medel' },
          { value: 'high', label: 'Hög' },
        ],
      },
      { id: 'envRiskMotivation', number: '25', text: 'Motivering miljö', type: 'text' },
      { id: 'socialRiskMotivation', number: '26', text: 'Motivering socialt', type: 'text' },
      { id: 'govRiskMotivation', number: '27', text: 'Motivering styrning', type: 'text' },
      { id: 'ghgData', number: '28', text: 'GHG-data (Scope 1/2/3, intensitet)', type: 'text' },
      { id: 'sbtiTarget', number: '29', text: 'SBTi-mål', type: 'yesno' },
      { id: 'fossilExposurePercent', number: '30', text: 'Fossilexponering (%)', type: 'number' },
    ],
  },
  {
    id: 'pai',
    title: 'PAI-indikatorer',
    description: 'Principal Adverse Impact – växthusgasutsläpp (GHG) uppdelat per scope enligt GHG Protocol.',
    questions: [
      { id: 'paiCarbonIntensity', number: '34', text: 'Koldioxidintensitet', description: 'Totala utsläpp i förhållande till omsättning (tCO2e/M€ revenue).', type: 'text' },
      { id: 'paiFossilExposure', number: '35', text: 'Fossilexponering', type: 'text' },
      { id: 'paiBiodiversity', number: '36', text: 'Biodiversitet', type: 'text' },
      { id: 'paiWaterDischarge', number: '37', text: 'Vattenutsläpp', type: 'text' },
      { id: 'paiHazardousWaste', number: '38', text: 'Farligt avfall', type: 'text' },
      { id: 'paiWageGap', number: '39', text: 'Lönegap', type: 'text' },
      { id: 'paiBoardDiversity', number: '40', text: 'Styrelsediversitet', type: 'text' },
      { id: 'paiControversialWeapons', number: '41', text: 'Kontroversiella vapen', type: 'yesno' },
      { id: 'paiSummaryComment', number: '42', text: 'Sammanfattning PAI', type: 'text' },
    ],
    subSections: [
      {
        id: 'scope1',
        title: 'Scope 1 – Direkta utsläpp',
        description: 'Mäter företagets direkta utsläpp av växthusgaser från egna källor, t.ex. förbränning av fossila bränslen i egna anläggningar och fordon.',
        questions: [
          { id: 'paiGhgScope1', number: '31a', text: 'GHG Scope 1 – utsläpp (ton CO₂e)', type: 'text' },
          { id: 'paiScope1Details', number: '31b', text: 'Beskrivning av Scope 1-källor', description: 'T.ex. egna fabriker, tjänstebilar, uppvärmning.', type: 'text' },
          { id: 'paiScope1Trend', number: '31c', text: 'Trend jämfört med föregående år', type: 'select', options: [
            { value: '', label: '–' },
            { value: 'decreasing', label: 'Minskande' },
            { value: 'stable', label: 'Stabil' },
            { value: 'increasing', label: 'Ökande' },
            { value: 'not_available', label: 'Data saknas' },
          ]},
        ],
      },
      {
        id: 'scope2',
        title: 'Scope 2 – Indirekta utsläpp (energi)',
        description: 'Mäter indirekta utsläpp från inköpt energi, t.ex. el, fjärrvärme och fjärrkyla som företaget köper in men inte själv producerar.',
        questions: [
          { id: 'paiGhgScope2', number: '32a', text: 'GHG Scope 2 – utsläpp (ton CO₂e)', type: 'text' },
          { id: 'paiScope2Details', number: '32b', text: 'Beskrivning av Scope 2-källor', description: 'T.ex. inköpt el, fjärrvärme, fjärrkyla.', type: 'text' },
          { id: 'paiScope2Trend', number: '32c', text: 'Trend jämfört med föregående år', type: 'select', options: [
            { value: '', label: '–' },
            { value: 'decreasing', label: 'Minskande' },
            { value: 'stable', label: 'Stabil' },
            { value: 'increasing', label: 'Ökande' },
            { value: 'not_available', label: 'Data saknas' },
          ]},
        ],
      },
      {
        id: 'scope3',
        title: 'Scope 3 – Övriga indirekta utsläpp',
        description: 'Mäter alla övriga indirekta utsläpp i hela värdekedjan, t.ex. från leverantörer, transporter, affärsresor, kunders användning av produkter och avfallshantering.',
        questions: [
          { id: 'paiGhgScope3', number: '33a', text: 'GHG Scope 3 – utsläpp (ton CO₂e)', type: 'text' },
          { id: 'paiScope3Details', number: '33b', text: 'Beskrivning av Scope 3-kategorier', description: 'T.ex. leverantörskedja, transporter, resor, kundanvändning, avfall.', type: 'text' },
          { id: 'paiScope3Trend', number: '33c', text: 'Trend jämfört med föregående år', type: 'select', options: [
            { value: '', label: '–' },
            { value: 'decreasing', label: 'Minskande' },
            { value: 'stable', label: 'Stabil' },
            { value: 'increasing', label: 'Ökande' },
            { value: 'not_available', label: 'Data saknas' },
          ]},
        ],
      },
    ],
  },
  {
    id: 'taxonomy',
    title: 'EU Taxonomi',
    questions: [
      { id: 'taxonomyAlignedPercent', number: '43', text: 'Taxonomianpassning (%)', type: 'number' },
      { id: 'taxonomyDnsh', number: '44', text: 'DNSH-bedömning (Do No Significant Harm)', type: 'text' },
      { id: 'taxonomyComment', number: '45', text: 'Kommentar taxonomi', type: 'text' },
    ],
  },
  {
    id: 'summary',
    title: 'Sammanfattning',
    questions: [
      {
        id: 'esgSummaryNormScreening',
        number: '46',
        text: 'Normbaserad screening – sammanfattning',
        type: 'select',
        options: [
          { value: '', label: '–' },
          { value: 'approved', label: 'Godkänd' },
          { value: 'rejected', label: 'Ej godkänd' },
        ],
      },
      {
        id: 'esgSummaryExclusion',
        number: '47',
        text: 'Exkluderingspolicy – sammanfattning',
        type: 'select',
        options: [
          { value: '', label: '–' },
          { value: 'approved', label: 'Godkänd' },
          { value: 'rejected', label: 'Ej godkänd' },
        ],
      },
      {
        id: 'esgSummaryGovernance',
        number: '48',
        text: 'Good Governance – sammanfattning',
        type: 'select',
        options: [
          { value: '', label: '–' },
          { value: 'meets', label: 'Uppfyller' },
          { value: 'does_not_meet', label: 'Uppfyller inte' },
        ],
      },
      {
        id: 'esgSummaryRisk',
        number: '49',
        text: 'ESG-risk – sammanfattning',
        type: 'select',
        options: [
          { value: '', label: '–' },
          { value: 'low', label: 'Låg' },
          { value: 'medium', label: 'Medel' },
          { value: 'high', label: 'Hög' },
        ],
      },
      {
        id: 'esgSummaryPAI',
        number: '50',
        text: 'PAI-påverkan – sammanfattning',
        type: 'select',
        options: [
          { value: '', label: '–' },
          { value: 'low', label: 'Låg' },
          { value: 'medium', label: 'Medel' },
          { value: 'high', label: 'Hög' },
        ],
      },
      { id: 'dataQualityComment', number: '51', text: 'Datakvalitet & begränsningar', type: 'text' },
      {
        id: 'esgDecision',
        number: '52',
        text: 'Slutgiltigt investeringsbeslut',
        type: 'select',
        options: [
          { value: '', label: '–' },
          { value: 'approved', label: 'Godkänns' },
          { value: 'rejected', label: 'Avslås' },
        ],
      },
      { id: 'esgDecisionMotivation', number: '53', text: 'Motivering beslut (obligatorisk)', type: 'text' },
    ],
  },
];

export function flattenQuestions(section: ESGSection): ESGQuestion[] {
  const out: ESGQuestion[] = [];
  function walk(q: ESGQuestion) {
    out.push(q);
    q.subQuestions?.forEach(walk);
  }
  // Sub-section questions first (scope cards), then section-level questions
  section.subSections?.forEach((sub) => sub.questions.forEach(walk));
  section.questions.forEach(walk);
  return out;
}

/** All question IDs in order (for initial state and API response mapping). */
export function getOrderedQuestionIds(): string[] {
  const ids: string[] = [];
  for (const section of ESG_SECTIONS) {
    for (const q of flattenQuestions(section)) {
      ids.push(q.id);
    }
  }
  return ids;
}

/** Questions formatted for AI prompt (id, number, text). */
export function getQuestionsForPrompt(): Array<{ id: string; number: string; text: string }> {
  const out: Array<{ id: string; number: string; text: string }> = [];
  for (const section of ESG_SECTIONS) {
    for (const q of flattenQuestions(section)) {
      out.push({ id: q.id, number: q.number, text: q.text });
      if (q.options?.length) {
        out[out.length - 1].text += ` [Alternativ: ${q.options.map((o) => o.value || o.label).filter(Boolean).join(', ')}]`;
      }
    }
  }
  return out;
}
