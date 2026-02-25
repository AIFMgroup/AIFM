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
  { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 100, severity: 'medium' },
  { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
  { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
  { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
];

// ════════════════════════════════════════════════════════════
// ARTIKEL 8 – Främjar miljörelaterade/sociala egenskaper
// ════════════════════════════════════════════════════════════

const AUAG_COMMON_PAI = {
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
};

const AUAG_PROMOTED = [
  'Högre standard inom miljö, sociala frågor och bolagsstyrning',
  'Investeringar i bolag som är ledande inom hållbar utvinning, bearbetning och/eller teknologi',
];

const AUAG_GOLD_RUSH_CONFIG: ESGFundConfig = {
  fundId: 'auag-gold-rush', fundName: 'AuAg Gold Rush', namePattern: 'Gold Rush', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: AUAG_COMMON_PAI,
  promotedCharacteristics: AUAG_PROMOTED,
};

const AUAG_ESSENTIAL_METALS_CONFIG: ESGFundConfig = {
  fundId: 'auag-essential-metals', fundName: 'AuAg Essential Metals', namePattern: 'Essential Metals', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: AUAG_COMMON_PAI,
  promotedCharacteristics: AUAG_PROMOTED,
};

const AUAG_PRECIOUS_GREEN_CONFIG: ESGFundConfig = {
  fundId: 'auag-precious-green', fundName: 'AuAg Precious Green', namePattern: 'Precious Green', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: AUAG_COMMON_PAI,
  promotedCharacteristics: AUAG_PROMOTED,
};

const AUAG_SILVER_BULLET_CONFIG: ESGFundConfig = {
  fundId: 'auag-silver-bullet', fundName: 'AuAg Silver Bullet', namePattern: 'Silver Bullet', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: AUAG_COMMON_PAI,
  promotedCharacteristics: AUAG_PROMOTED,
};

const SENSUM_CONFIG: ESGFundConfig = {
  fundId: 'sensum-strategy-global', fundName: 'Sensum Strategy Global', namePattern: 'Sensum', article: '8',
  exclusions: [
    { category: 'clusterMines', label: 'Klusterbomber och personminor', threshold: 5, severity: 'high' },
    { category: 'chemicalBiological', label: 'Kemiska och biologiska vapen', threshold: 5, severity: 'high' },
    { category: 'nuclearWeapons', label: 'Kärnvapen', threshold: 5, severity: 'high' },
    { category: 'weapons', label: 'Vapen och/eller krigsmateriel', threshold: 5, severity: 'high' },
    { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 100, severity: 'medium' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
    { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: ['GHG-utsläpp Scope 1–3', 'Koldioxidavtryck', 'GHG-intensitet', 'Fossilbränsleexponering', 'Icke-förnybar energi', 'Biodiversitet', 'Utsläpp till vatten', 'Farligt avfall'],
    social: ['Brott mot UNGC/OECD', 'Lönegap', 'Könsfördelning styrelse', 'Kontroversiella vapen'],
  },
  promotedCharacteristics: ['Bidrag till Parisavtalet och Agenda 2030', 'Högre standarder inom E, S och G'],
};

const VINGA_CONFIG: ESGFundConfig = {
  fundId: 'vinga-corporate-bond', fundName: 'Vinga Corporate Bond', namePattern: 'Vinga', article: '8',
  exclusions: [
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 5, severity: 'medium' },
    { category: 'sanctionedCountries', label: 'Sanktionerade länder', threshold: 0, severity: 'high' },
    { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 5, severity: 'high' },
    { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 100, severity: 'medium' },
    { category: 'smsLoans', label: 'SMS-lån', threshold: 5, severity: 'high' },
    { category: 'gambling', label: 'Spel', threshold: 5, severity: 'medium' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
    { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: ['GHG-utsläpp (Scope 1, 2, 3)', 'GHG-intensitet', 'Fossil energi-exponering', 'Avfall / farligt avfall', 'Vattenutsläpp'],
    social: ['Brott mot UNGC/OECD', 'Olycksfrekvens', 'Könsfördelning styrelse', 'Kontroversiella vapen', 'Leverantörskedjerisk'],
  },
  promotedCharacteristics: ['Minskad ESG-risk i portföljen', 'Aktiv påverkan på bolag med svag hållbarhetsrating', 'Exkludering av riskfyllda / oetiska verksamheter'],
  engagementProcess: { riskThreshold: 30, timelineMonths: 6, divestmentDays: 30 },
};

const PLAIN_CAPITAL_PAI = {
  environmental: ['GHG-utsläpp (Scope 1, 2, 3)', 'GHG-intensitet', 'Fossilbränsleexponering', 'Biodiversitet', 'Utsläpp till vatten', 'Farligt avfall'],
  social: ['Brott mot UNGC/OECD', 'Könsfördelning styrelse', 'Lönegap', 'Kontroversiella vapen'],
};

const PLAIN_CAPITAL_EXCLUSIONS: ESGExclusionItem[] = [
  { category: 'weapons', label: 'Vapen & krigsmateriel', threshold: 5, severity: 'high' },
  { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 0, severity: 'high' },
  { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 100, severity: 'medium' },
  { category: 'tobacco', label: 'Tobak', threshold: 5, severity: 'high' },
  { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
  { category: 'adultContent', label: 'Pornografi', threshold: 5, severity: 'high' },
  { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 5, severity: 'medium' },
  { category: 'gambling', label: 'Spel & hasardspel', threshold: 5, severity: 'medium' },
];
const PLAIN_CAPITAL_PROMOTED = ['Lägre koldioxidintensitet än jämförelseindex', 'Uteslutning av kontroversiella sektorer', 'God bolagsstyrning'];

const PLAIN_CAPITAL_BRONX_CONFIG: ESGFundConfig = {
  fundId: 'plain-capital-bronx', fundName: 'Plain Capital BronX', namePattern: 'BronX', article: '8',
  exclusions: [...PLAIN_CAPITAL_EXCLUSIONS], normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: PLAIN_CAPITAL_PAI, promotedCharacteristics: PLAIN_CAPITAL_PROMOTED,
};

const PLAIN_CAPITAL_LUNATIX_CONFIG: ESGFundConfig = {
  fundId: 'plain-capital-lunatix', fundName: 'Plain Capital LunatiX', namePattern: 'LunatiX', article: '8',
  exclusions: [...PLAIN_CAPITAL_EXCLUSIONS], normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: PLAIN_CAPITAL_PAI, promotedCharacteristics: PLAIN_CAPITAL_PROMOTED,
};

const PLAIN_CAPITAL_STYX_CONFIG: ESGFundConfig = {
  fundId: 'plain-capital-styx', fundName: 'Plain Capital StyX', namePattern: 'StyX', article: '8',
  exclusions: [...PLAIN_CAPITAL_EXCLUSIONS], normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: PLAIN_CAPITAL_PAI, promotedCharacteristics: PLAIN_CAPITAL_PROMOTED,
};

const METASPACE_CONFIG: ESGFundConfig = {
  fundId: 'metaspace-fund', fundName: 'MetaSpace Fund', namePattern: 'MetaSpace', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: { environmental: ['GHG-utsläpp', 'GHG-intensitet', 'Fossilbränsleexponering', 'Biodiversitet'], social: ['Brott mot UNGC/OECD', 'Könsfördelning styrelse', 'Kontroversiella vapen'] },
  promotedCharacteristics: ['Hållbar teknologiomställning', 'Uteslutning av kontroversiella sektorer'],
};

const LUCY_GLOBAL_CONFIG: ESGFundConfig = {
  fundId: 'lucy-global-fund', fundName: 'Lucy Global Fund', namePattern: 'Lucy', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: { environmental: ['GHG-utsläpp', 'GHG-intensitet', 'Fossilbränsleexponering'], social: ['Brott mot UNGC/OECD', 'Könsfördelning styrelse', 'Kontroversiella vapen'] },
  promotedCharacteristics: ['Främjande av miljörelaterade och sociala egenskaper', 'Uteslutning av kontroversiella verksamheter'],
};

const ARTE_COLLECTUM_II_CONFIG: ESGFundConfig = {
  fundId: 'arte-collectum-ii', fundName: 'Arte Collectum II AB', namePattern: 'Arte Collectum II', article: '8',
  exclusions: [...COMMON_EXCLUSIONS_5PCT],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: { environmental: ['GHG-utsläpp', 'GHG-intensitet', 'Biodiversitet'], social: ['Brott mot UNGC/OECD', 'Kontroversiella vapen'] },
  promotedCharacteristics: ['Främjande av hållbar konst- och kulturinvestering', 'ESG-integrerad förvaltning'],
};

// ════════════════════════════════════════════════════════════
// ARTIKEL 9 – Hållbar investering som mål
// ════════════════════════════════════════════════════════════

const PROETHOS_CONFIG: ESGFundConfig = {
  fundId: 'proethos-fond', fundName: 'Proethos Fond', namePattern: 'Proethos', article: '9',
  exclusions: [
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 0, severity: 'high' },
    { category: 'nuclear', label: 'Kärnkraft', threshold: 0, severity: 'medium' },
    { category: 'weapons', label: 'Vapen', threshold: 0, severity: 'high' },
    { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 5, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 0, severity: 'high' },
    { category: 'alcohol', label: 'Alkohol', threshold: 0, severity: 'high' },
    { category: 'gambling', label: 'Spel', threshold: 0, severity: 'high' },
    { category: 'adultContent', label: 'Pornografi', threshold: 0, severity: 'high' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: {
    environmental: ['GHG-intensitet (tCO₂e/M€)', 'SBTi-mål', 'Fossilexponering', 'Vattenrisk', 'Biodiversitet/markpåverkan', 'Avfall/farligt utsläpp'],
    social: ['Brott mot UNGC/OECD', 'Arbetsrätt/mänskliga rättigheter'],
  },
  sustainableGoalCategories: ['Förnybar energi', 'Energieffektivisering', 'Hållbara transporter', 'Hållbar livsstil'],
  taxonomyRequired: true,
  allocationControlRequired: true,
};

const ARTE_COLLECTUM_I_CONFIG: ESGFundConfig = {
  fundId: 'arte-collectum-i', fundName: 'Arte Collectum I AB', namePattern: 'Arte Collectum I', article: '9',
  exclusions: [
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 0, severity: 'high' },
    { category: 'weapons', label: 'Vapen', threshold: 0, severity: 'high' },
    { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 5, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 0, severity: 'high' },
    { category: 'gambling', label: 'Spel', threshold: 0, severity: 'high' },
    { category: 'adultContent', label: 'Pornografi', threshold: 0, severity: 'high' },
  ],
  normScreening: DEFAULT_NORM_SCREENING,
  paiIndicators: { environmental: ['GHG-utsläpp', 'GHG-intensitet', 'Biodiversitet'], social: ['Brott mot UNGC/OECD', 'Kontroversiella vapen'] },
  sustainableGoalCategories: ['Hållbar konst och kultur', 'Cirkulär ekonomi'],
  taxonomyRequired: true,
  allocationControlRequired: true,
};

const SAM_AKTIV_RANTA_CONFIG: ESGFundConfig = {
  fundId: 'sam-aktiv-ranta', fundName: 'SAM Aktiv Ränta', namePattern: 'SAM Aktiv', article: '8',
  exclusions: [
    { category: 'weapons', label: 'Vapen & krigsmateriel', threshold: 0, severity: 'high' },
    { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 0, severity: 'high' },
    { category: 'nuclearWeapons', label: 'Kärnvapen', threshold: 0, severity: 'high' },
    { category: 'defense', label: 'Försvarsrelaterad verksamhet (bred)', threshold: 100, severity: 'medium' },
    { category: 'tobacco', label: 'Tobak', threshold: 0, severity: 'high' },
    { category: 'alcohol', label: 'Alkohol', threshold: 5, severity: 'medium' },
    { category: 'adultContent', label: 'Pornografi', threshold: 0, severity: 'high' },
    { category: 'fossilFuels', label: 'Fossila bränslen', threshold: 0, severity: 'high' },
    { category: 'gambling', label: 'Spel & hasardspel', threshold: 5, severity: 'medium' },
  ],
  normScreening: { ...DEFAULT_NORM_SCREENING, controversyAutoReject: 3 },
  paiIndicators: {
    environmental: ['GHG-utsläpp', 'GHG-intensitet', 'SBTi-mål', 'Fossilbränsleexponering', 'Förnybar energi', 'Biodiversitet', 'Vattenutsläpp', 'Farligt avfall'],
    social: ['Brott mot UNGC/OECD', 'Arbetsrätt/mänskliga rättigheter', 'Könsfördelning styrelse'],
  },
  promotedCharacteristics: ['Hållbara ränteplaceringar', 'Klimatanpassad kreditportfölj'],
  engagementProcess: { riskThreshold: 3, timelineMonths: 12, divestmentDays: 90 },
};

// ════════════════════════════════════════════════════════════
// ARTIKEL 6 – Hållbarhetsrisker integreras i investeringsbeslut
// ════════════════════════════════════════════════════════════

const ARTICLE_6_DEFAULTS: Pick<ESGFundConfig, 'exclusions' | 'normScreening' | 'paiIndicators'> = {
  exclusions: [
    { category: 'controversialWeapons', label: 'Kontroversiella vapen', threshold: 0, severity: 'high' },
    { category: 'sanctionedCountries', label: 'Sanktionerade länder', threshold: 0, severity: 'high' },
  ],
  normScreening: { ungc: true, oecd: true, humanRights: true, antiCorruption: true, controversyAutoReject: 5 },
  paiIndicators: { environmental: ['GHG-utsläpp', 'GHG-intensitet'], social: ['Brott mot UNGC/OECD', 'Kontroversiella vapen'] },
};

const GO_BLOCKCHAIN_CONFIG: ESGFundConfig = {
  fundId: 'go-blockchain-fund', fundName: 'Go Blockchain Fund', namePattern: 'Go Blockchain', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

const EPOQUE_CONFIG: ESGFundConfig = {
  fundId: 'epoque', fundName: 'EPOQUE', namePattern: 'Epoque', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

const ARDEN_CONFIG: ESGFundConfig = {
  fundId: 'arden-xfund', fundName: 'Arden xFund', namePattern: 'Arden', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

const SOIC_CONFIG: ESGFundConfig = {
  fundId: 'soic-dynamic-china', fundName: 'SOIC Dynamic China', namePattern: 'SOIC', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

const SBP_KREDIT_CONFIG: ESGFundConfig = {
  fundId: 'sbp-kredit', fundName: 'SBP Kredit', namePattern: 'SBP', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

const ESTEA_CONFIG: ESGFundConfig = {
  fundId: 'estea-omsorgsfastigheter', fundName: 'Estea Omsorgsfastigheter', namePattern: 'Estea', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

const SSID_CONFIG: ESGFundConfig = {
  fundId: 'ssid-co-invest-fund', fundName: 'SSID Co-Invest Fund', namePattern: 'SSID', article: '6',
  ...ARTICLE_6_DEFAULTS,
};

// ════════════════════════════════════════════════════════════

const ALL_CONFIGS: ESGFundConfig[] = [
  // Artikel 8
  AUAG_GOLD_RUSH_CONFIG,
  AUAG_ESSENTIAL_METALS_CONFIG,
  AUAG_PRECIOUS_GREEN_CONFIG,
  AUAG_SILVER_BULLET_CONFIG,
  SENSUM_CONFIG,
  VINGA_CONFIG,
  PLAIN_CAPITAL_BRONX_CONFIG,
  PLAIN_CAPITAL_LUNATIX_CONFIG,
  PLAIN_CAPITAL_STYX_CONFIG,
  METASPACE_CONFIG,
  LUCY_GLOBAL_CONFIG,
  ARTE_COLLECTUM_II_CONFIG,
  SAM_AKTIV_RANTA_CONFIG,
  // Artikel 9
  PROETHOS_CONFIG,
  ARTE_COLLECTUM_I_CONFIG,
  // Artikel 6
  GO_BLOCKCHAIN_CONFIG,
  EPOQUE_CONFIG,
  ARDEN_CONFIG,
  SOIC_CONFIG,
  SBP_KREDIT_CONFIG,
  ESTEA_CONFIG,
  SSID_CONFIG,
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
