/**
 * Fondspecifik ESG-konfiguration för pre-trade-analys
 * Baserat på fondavtal (AuAg, Sensum, Vinga, Proethos) och SFDR Artikel 6/8/9
 */

export interface ESGExclusionItem {
  category: string;
  label: string;
  threshold: number;
  severity: 'high' | 'medium';
}

export interface ESGFundConfig {
  fundId: string;
  fundName: string;
  /** Display / match name - used to match API funds by name substring */
  namePattern: string;
  article: '6' | '8' | '9';
  exclusions: ESGExclusionItem[];
  normScreening: {
    ungc: boolean;
    oecd: boolean;
    humanRights: boolean;
    antiCorruption: boolean;
    controversyAutoReject: number;
  };
  paiIndicators: {
    environmental: string[];
    social: string[];
  };
  promotedCharacteristics?: string[];
  sustainableGoalCategories?: string[];
  taxonomyRequired?: boolean;
  allocationControlRequired?: boolean;
  engagementProcess?: {
    riskThreshold: number;
    timelineMonths: number;
    divestmentDays?: number;
  };
}

const DEFAULT_NORM_SCREENING = {
  ungc: true,
  oecd: true,
  humanRights: true,
  antiCorruption: true,
  controversyAutoReject: 4,
};

const COMMON_EXCLUSIONS_5PCT: ESGExclusionItem[] = [
  { category: 'weapons', label: 'Vapen & krigsmateriel', threshold: 5, severity: 'high' },
  { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 5, severity: 'high' },
  { category: 'nuclearWeapons', label: 'Kärnvapen', threshold: 5, severity: 'high' },
  { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
  { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
  { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
];

/** AuAg – Artikel 8 (Silver Bullet, Essential Metals, Precious Green, Gold Rush) */
const AUAG_CONFIG: ESGFundConfig = {
  fundId: 'auag',
  fundName: 'AuAg-fonder',
  namePattern: 'AuAg',
  article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: [
      'GHG-utsläpp (Scope 1, 2, 3)',
      'GHG-intensitet',
      'Andel energi fossilt/förnybart',
      'Exponering biodiversitetskänsliga områden',
      'Utsläpp till vatten',
      'Farligt avfall',
    ],
    social: [
      'Brott mot UNGC/OECD',
      'Olycksfrekvens',
      'Könsfördelning styrelse',
      'Lönegap',
      'Kontroversiella vapen',
    ],
  },
  promotedCharacteristics: [
    'Högre standard inom miljö, sociala frågor och bolagsstyrning',
    'Investeringar i bolag som är ledande inom hållbar utvinning, bearbetning och/eller teknologi',
  ],
};

/** Sensum Strategy Global – Artikel 8 */
const SENSUM_CONFIG: ESGFundConfig = {
  fundId: 'sensum',
  fundName: 'Sensum Strategy Global',
  namePattern: 'Sensum',
  article: '8',
  exclusions: [
    { category: 'clusterMines', label: 'Klusterbomber och personminor', threshold: 5, severity: 'high' },
    { category: 'chemicalBiological', label: 'Kemiska och biologiska vapen', threshold: 5, severity: 'high' },
    { category: 'nuclearWeapons', label: 'Kärnvapen', threshold: 5, severity: 'high' },
    { category: 'weapons', label: 'Vapen och/eller krigsmateriel', threshold: 5, severity: 'high' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
    { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: [
      'GHG-utsläpp Scope 1, 2, 3',
      'Totala GHG-utsläpp',
      'Koldioxidavtryck',
      'GHG-intensitet',
      'Fossilbränsleexponering',
      'Andel icke-förnybar energi',
      'Energianvändning per sektor',
      'Exponering mot biodiversitetskänsliga områden',
      'Utsläpp till vatten',
      'Farligt avfall',
    ],
    social: [
      'Brott mot UNGC/OECD',
      'Lönegap',
      'Könsfördelning i styrelse',
      'Kontroversiella vapen',
      'Avsaknad av UNGC/OECD-kontrollmekanismer',
    ],
  },
  promotedCharacteristics: [
    'Bidrag till Parisavtalet och Agenda 2030',
    'Högre standarder inom E, S och G',
  ],
};

/** Vinga Corporate Bond – Artikel 8 (engagemangsprocess vid ESG-rating < 30) */
const VINGA_CONFIG: ESGFundConfig = {
  fundId: 'vinga',
  fundName: 'Vinga Corporate Bond',
  namePattern: 'Vinga',
  article: '8',
  exclusions: [
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 5, severity: 'medium' },
    { category: 'sanctionedCountries', label: 'Sanktionerade länder', threshold: 0, severity: 'high' },
    { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 5, severity: 'high' },
    { category: 'smsLoans', label: 'SMS-lån', threshold: 5, severity: 'high' },
    { category: 'gambling', label: 'Spel', threshold: 5, severity: 'medium' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
    { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
  ],
  normScreening: { ...DEFAULT_NORM_SCREENING },
  paiIndicators: {
    environmental: [
      'GHG-utsläpp (Scope 1, 2, 3)',
      'GHG-intensitet',
      'Fossil energi-exponering',
      'Avfall / farligt avfall',
      'Vattenutsläpp',
    ],
    social: [
      'Brott mot UNGC/OECD',
      'Olycksfrekvens',
      'Könsfördelning styrelse',
      'Kontroversiella vapen',
      'Leverantörskedjerisk',
    ],
  },
  promotedCharacteristics: [
    'Minskad ESG-risk i portföljen',
    'Aktiv påverkan på bolag med svag hållbarhetsrating',
    'Exkludering av riskfyllda / oetiska verksamheter',
    'Förbättrad rapportering och transparens hos emittenter',
  ],
  engagementProcess: {
    riskThreshold: 30,
    timelineMonths: 6,
    divestmentDays: 30,
  },
};

/** Proethos – Artikel 9 (hållbarhetsmål, DNSH, Taxonomi, allokering) */
const PROETHOS_CONFIG: ESGFundConfig = {
  fundId: 'proethos',
  fundName: 'Proethos Fond',
  namePattern: 'Proethos',
  article: '9',
  exclusions: [
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 0, severity: 'high' },
    { category: 'nuclear', label: 'Kärnkraft', threshold: 0, severity: 'medium' },
    { category: 'weapons', label: 'Vapen', threshold: 0, severity: 'high' },
    { category: 'tobacco', label: 'Tobak, alkohol, spel, porr', threshold: 0, severity: 'high' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: [
      'GHG-intensitet (tCO₂e/M€)',
      'SBTi-mål',
      'Fossilexponering',
      'Vattenrisk',
      'Biodiversitet/markpåverkan',
      'Avfall/farligt utsläpp',
    ],
    social: [
      'Brott mot UNGC/OECD',
      'Arbetsrätt/mänskliga rättigheter',
    ],
  },
  sustainableGoalCategories: [
    'Förnybar energi',
    'Energieffektivisering',
    'Hållbara transporter',
    'Hållbar livsstil',
  ],
  taxonomyRequired: true,
  allocationControlRequired: true,
};

/** AIFM Testfond ESG – Artikel 8 (för test av ESG Pre-Trade) */
const TEST_ESG_CONFIG: ESGFundConfig = {
  fundId: 'fund-test-8',
  fundName: 'AIFM Testfond ESG',
  namePattern: 'Testfond ESG',
  article: '8',
  exclusions: [
    { category: 'weapons', label: 'Vapen & krigsmateriel', threshold: 5, severity: 'high' },
    { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 0, severity: 'high' },
    { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 5, severity: 'medium' },
    { category: 'gambling', label: 'Spel & hasardspel', threshold: 5, severity: 'medium' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: [
      'GHG-utsläpp (Scope 1, 2, 3)',
      'GHG-intensitet',
      'Fossilbränsleexponering',
      'Biodiversitet',
      'Utsläpp till vatten',
      'Farligt avfall',
    ],
    social: [
      'Brott mot UNGC/OECD',
      'Könsfördelning styrelse',
      'Lönegap',
      'Kontroversiella vapen',
    ],
  },
  promotedCharacteristics: [
    'Lägre koldioxidintensitet än jämförelseindex',
    'Uteslutning av kontroversiella sektorer',
    'God bolagsstyrning',
  ],
};

/** AIFM Testfond Hållbar – Artikel 9 (för test av ESG Pre-Trade) */
const TEST_HALLBAR_CONFIG: ESGFundConfig = {
  fundId: 'fund-test-9',
  fundName: 'AIFM Testfond Hållbar',
  namePattern: 'Testfond Hållbar',
  article: '9',
  exclusions: [
    { category: 'weapons', label: 'Vapen & krigsmateriel', threshold: 0, severity: 'high' },
    { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 0, severity: 'high' },
    { category: 'nuclearWeapons', label: 'Kärnvapen', threshold: 0, severity: 'high' },
    { category: 'tobacco', label: 'Tobak', threshold: 0, severity: 'high' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'adultContent', label: 'Pornografi', threshold: 0, severity: 'high' },
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 0, severity: 'high' },
    { category: 'gambling', label: 'Spel & hasardspel', threshold: 5, severity: 'medium' },
  ],
  normScreening: {
    ungc: true,
    oecd: true,
    humanRights: true,
    antiCorruption: true,
    controversyAutoReject: 3,
  },
  paiIndicators: {
    environmental: [
      'GHG-utsläpp (Scope 1, 2, 3)',
      'GHG-intensitet',
      'SBTi-mål',
      'Fossilbränsleexponering',
      'Andel förnybar energi',
      'Biodiversitet',
      'Utsläpp till vatten',
      'Farligt avfall',
    ],
    social: [
      'Brott mot UNGC/OECD',
      'Arbetsrätt/mänskliga rättigheter',
      'Könsfördelning styrelse',
      'Lönegap',
    ],
  },
  sustainableGoalCategories: [
    'Klimatanpassning',
    'Förnybar energi',
    'Cirkulär ekonomi',
    'Hållbar vattenförvaltning',
  ],
  taxonomyRequired: true,
  allocationControlRequired: true,
  engagementProcess: {
    riskThreshold: 3,
    timelineMonths: 12,
    divestmentDays: 90,
  },
};

const ALL_CONFIGS: ESGFundConfig[] = [
  AUAG_CONFIG,
  SENSUM_CONFIG,
  VINGA_CONFIG,
  PROETHOS_CONFIG,
  TEST_ESG_CONFIG,
  TEST_HALLBAR_CONFIG,
];

/**
 * Returnerar ESG-konfiguration för en fond baserat på fundId eller fundName.
 * Matchar på namePattern (substring, case-insensitive). Om ingen träff: Artikel 6-default.
 */
export function getESGFundConfig(
  fundId: string,
  fundName: string
): ESGFundConfig | null {
  const name = (fundName || '').toLowerCase();
  const found = ALL_CONFIGS.find(
    (c) => name.includes(c.namePattern.toLowerCase())
  );
  return found ?? null;
}

/**
 * Returnerar artikelklassificering för en fond (6, 8 eller 9).
 * Om ingen config träffas returneras '6'.
 */
export function getFundArticle(
  fundId: string,
  fundName: string
): '6' | '8' | '9' {
  const config = getESGFundConfig(fundId, fundName);
  return config ? config.article : '6';
}

export { ALL_CONFIGS };
