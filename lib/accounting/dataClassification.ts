/**
 * Data Classification & Retention Policy
 * 
 * Definierar dataklasser, lagringstider, PII-märkning och export/radering-regler
 * enligt Bokföringslagen, GDPR och intern policy.
 */

// ============ Data Categories ============

export type DataCategory = 
  | 'ACCOUNTING_MATERIAL'    // Räkenskapsmaterial (fakturor, kvitton, verifikationer)
  | 'AUDIT_LOG'              // Revisionsloggar (vem gjorde vad när)
  | 'AI_FEEDBACK'            // AI-feedback & korrigeringar
  | 'AI_LEARNING'            // AI-lärdomar & regler
  | 'USER_PROFILE'           // Användarprofiler
  | 'OPERATIONAL'            // Driftdata (notiser, cache, etc.)
  | 'ANALYTICS'              // Analysdata & statistik
  | 'TEMPORARY';             // Temporär data (sessioner, etc.)

export type PIILevel = 
  | 'NONE'                   // Ingen persondata
  | 'INDIRECT'               // Indirekt persondata (t.ex. leverantörsnamn)
  | 'DIRECT'                 // Direkt persondata (e-post, namn)
  | 'SENSITIVE';             // Känslig persondata (personnummer, hälsa)

export type LegalBasis = 
  | 'CONTRACT'               // Avtal med kund
  | 'LEGAL_OBLIGATION'       // Lagkrav (Bokföringslagen)
  | 'LEGITIMATE_INTEREST'    // Berättigat intresse
  | 'CONSENT';               // Samtycke

// ============ Data Classification Definitions ============

export interface DataClassification {
  category: DataCategory;
  description: string;
  piiLevel: PIILevel;
  legalBasis: LegalBasis;
  retentionYears: number;
  retentionReason: string;
  canExport: boolean;
  canDelete: boolean;
  deleteRequiresApproval: boolean;
  encryptionRequired: boolean;
  accessLogRequired: boolean;
}

export const DATA_CLASSIFICATIONS: Record<DataCategory, DataClassification> = {
  ACCOUNTING_MATERIAL: {
    category: 'ACCOUNTING_MATERIAL',
    description: 'Fakturor, kvitton, verifikationer och bokföringsunderlag',
    piiLevel: 'INDIRECT',
    legalBasis: 'LEGAL_OBLIGATION',
    retentionYears: 7,
    retentionReason: 'Bokföringslagen 7 kap. 2§ - räkenskapsinformation ska bevaras i 7 år',
    canExport: true,
    canDelete: false, // Kan ej raderas under lagringstiden
    deleteRequiresApproval: true,
    encryptionRequired: true,
    accessLogRequired: true,
  },
  
  AUDIT_LOG: {
    category: 'AUDIT_LOG',
    description: 'Revisionsloggar för spårbarhet och compliance',
    piiLevel: 'DIRECT',
    legalBasis: 'LEGAL_OBLIGATION',
    retentionYears: 7,
    retentionReason: 'Ska följa räkenskapsmaterialets lagringstid för fullständig spårbarhet',
    canExport: true,
    canDelete: false, // Revisionsloggar får aldrig raderas
    deleteRequiresApproval: true,
    encryptionRequired: true,
    accessLogRequired: false, // Är redan en logg
  },
  
  AI_FEEDBACK: {
    category: 'AI_FEEDBACK',
    description: 'Användarfeedback och korrigeringar till AI-klassificeringar',
    piiLevel: 'INDIRECT',
    legalBasis: 'LEGITIMATE_INTEREST',
    retentionYears: 7,
    retentionReason: 'Kopplat till räkenskapsmaterial för att förklara AI-beslut',
    canExport: true,
    canDelete: true, // Kan raderas på begäran efter lagringstid
    deleteRequiresApproval: false,
    encryptionRequired: false,
    accessLogRequired: false,
  },
  
  AI_LEARNING: {
    category: 'AI_LEARNING',
    description: 'AI-lärdomar, leverantörsprofiler och klassificeringsregler',
    piiLevel: 'NONE',
    legalBasis: 'LEGITIMATE_INTEREST',
    retentionYears: -1, // Permanent (ingen TTL)
    retentionReason: 'Aggregerad kunskap utan personkoppling, förbättrar tjänsten',
    canExport: true,
    canDelete: true,
    deleteRequiresApproval: false,
    encryptionRequired: false,
    accessLogRequired: false,
  },
  
  USER_PROFILE: {
    category: 'USER_PROFILE',
    description: 'Användaruppgifter och inställningar',
    piiLevel: 'DIRECT',
    legalBasis: 'CONTRACT',
    retentionYears: 0, // Så länge kontot är aktivt + 1 år
    retentionReason: 'Nödvändigt för att leverera tjänsten',
    canExport: true,
    canDelete: true, // GDPR: rätt till radering
    deleteRequiresApproval: false,
    encryptionRequired: true,
    accessLogRequired: true,
  },
  
  OPERATIONAL: {
    category: 'OPERATIONAL',
    description: 'Notiser, valutakurser och annan driftdata',
    piiLevel: 'NONE',
    legalBasis: 'LEGITIMATE_INTEREST',
    retentionYears: 0.08, // ~30 dagar
    retentionReason: 'Kortvarig driftdata utan bevarandekrav',
    canExport: false,
    canDelete: true,
    deleteRequiresApproval: false,
    encryptionRequired: false,
    accessLogRequired: false,
  },
  
  ANALYTICS: {
    category: 'ANALYTICS',
    description: 'Aggregerad statistik och analysdata',
    piiLevel: 'NONE',
    legalBasis: 'LEGITIMATE_INTEREST',
    retentionYears: 3,
    retentionReason: 'Trendanalys och tjänsteförbättring',
    canExport: true,
    canDelete: true,
    deleteRequiresApproval: false,
    encryptionRequired: false,
    accessLogRequired: false,
  },
  
  TEMPORARY: {
    category: 'TEMPORARY',
    description: 'Sessioner, cache och temporär data',
    piiLevel: 'INDIRECT',
    legalBasis: 'LEGITIMATE_INTEREST',
    retentionYears: 0.003, // ~1 dag
    retentionReason: 'Kortlivad data som rensas automatiskt',
    canExport: false,
    canDelete: true,
    deleteRequiresApproval: false,
    encryptionRequired: false,
    accessLogRequired: false,
  },
};

// ============ TTL Calculation ============

/**
 * Beräkna TTL (Unix timestamp) för en datakategori
 */
export function calculateTTL(category: DataCategory): number | null {
  const classification = DATA_CLASSIFICATIONS[category];
  
  if (classification.retentionYears < 0) {
    return null; // Permanent lagring
  }
  
  if (classification.retentionYears === 0) {
    return null; // Ingen automatisk radering, hanteras vid kontoborttagning
  }
  
  const seconds = classification.retentionYears * 365 * 24 * 60 * 60;
  return Math.floor(Date.now() / 1000) + seconds;
}

/**
 * Beräkna retentionsdatum som ISO-sträng
 */
export function calculateRetentionDate(category: DataCategory): string | null {
  const classification = DATA_CLASSIFICATIONS[category];
  
  if (classification.retentionYears <= 0) {
    return null;
  }
  
  const date = new Date();
  date.setFullYear(date.getFullYear() + classification.retentionYears);
  return date.toISOString();
}

// ============ Data Mapping ============

/**
 * Mappa DynamoDB-tabeller/prefix till datakategorier
 */
export const TABLE_CATEGORY_MAPPING: Record<string, DataCategory> = {
  // aifm-accounting-jobs table prefixes
  'JOB#': 'ACCOUNTING_MATERIAL',
  'DOCUMENT#': 'ACCOUNTING_MATERIAL',
  'FINGERPRINT#': 'ACCOUNTING_MATERIAL',
  'HASH#': 'ACCOUNTING_MATERIAL',
  'FEEDBACK#': 'AI_FEEDBACK',
  'SUPPLIER#': 'AI_LEARNING',
  'RULE#': 'AI_LEARNING',
  'NOTIFICATION#': 'OPERATIONAL',
  'CURRENCY#': 'OPERATIONAL',
  
  // aifm-audit-logs table
  'AUDIT#': 'AUDIT_LOG',
  
  // User data
  'USER#': 'USER_PROFILE',
  'SESSION#': 'TEMPORARY',
};

/**
 * Hämta datakategori för en DynamoDB-nyckel
 */
export function getCategoryForKey(pk: string): DataCategory {
  for (const [prefix, category] of Object.entries(TABLE_CATEGORY_MAPPING)) {
    if (pk.startsWith(prefix) || pk.includes(`#${prefix}`)) {
      return category;
    }
  }
  return 'OPERATIONAL'; // Default
}

// ============ Export & Delete Validation ============

export interface DataOperation {
  operation: 'export' | 'delete' | 'access';
  category: DataCategory;
  companyId: string;
  userId: string;
  reason?: string;
}

export interface OperationResult {
  allowed: boolean;
  reason: string;
  requiresApproval?: boolean;
  retentionInfo?: {
    expiresAt: string | null;
    yearsRemaining: number | null;
  };
}

/**
 * Validera om en dataoperation är tillåten
 */
export function validateDataOperation(operation: DataOperation): OperationResult {
  const classification = DATA_CLASSIFICATIONS[operation.category];
  
  if (operation.operation === 'access') {
    return {
      allowed: true,
      reason: 'Åtkomst tillåten',
      retentionInfo: {
        expiresAt: calculateRetentionDate(operation.category),
        yearsRemaining: classification.retentionYears > 0 ? classification.retentionYears : null,
      },
    };
  }
  
  if (operation.operation === 'export') {
    if (!classification.canExport) {
      return {
        allowed: false,
        reason: `Export ej tillåten för ${classification.description}`,
      };
    }
    return {
      allowed: true,
      reason: 'Export tillåten',
    };
  }
  
  if (operation.operation === 'delete') {
    if (!classification.canDelete) {
      return {
        allowed: false,
        reason: `Radering ej tillåten: ${classification.retentionReason}`,
        retentionInfo: {
          expiresAt: calculateRetentionDate(operation.category),
          yearsRemaining: classification.retentionYears,
        },
      };
    }
    
    if (classification.deleteRequiresApproval) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: 'Radering kräver godkännande från administratör',
      };
    }
    
    return {
      allowed: true,
      reason: 'Radering tillåten',
    };
  }
  
  return {
    allowed: false,
    reason: 'Okänd operation',
  };
}

// ============ PII Detection ============

/**
 * Fält som innehåller PII
 */
export const PII_FIELDS: Record<PIILevel, string[]> = {
  NONE: [],
  INDIRECT: [
    'supplier',
    'supplierName',
    'companyName',
    'ipAddress',
  ],
  DIRECT: [
    'email',
    'userEmail',
    'userName',
    'name',
    'phone',
    'address',
  ],
  SENSITIVE: [
    'personnummer',
    'socialSecurityNumber',
    'bankAccount',
    'creditCard',
  ],
};

/**
 * Kontrollera PII-nivå för ett objekt
 */
export function detectPIILevel(obj: Record<string, unknown>): PIILevel {
  const keys = Object.keys(obj);
  
  for (const field of PII_FIELDS.SENSITIVE) {
    if (keys.some(k => k.toLowerCase().includes(field.toLowerCase()))) {
      return 'SENSITIVE';
    }
  }
  
  for (const field of PII_FIELDS.DIRECT) {
    if (keys.some(k => k.toLowerCase().includes(field.toLowerCase()))) {
      return 'DIRECT';
    }
  }
  
  for (const field of PII_FIELDS.INDIRECT) {
    if (keys.some(k => k.toLowerCase().includes(field.toLowerCase()))) {
      return 'INDIRECT';
    }
  }
  
  return 'NONE';
}

/**
 * Maskera PII-fält för loggning
 */
export function maskPII(obj: Record<string, unknown>, level: PIILevel = 'DIRECT'): Record<string, unknown> {
  const masked = { ...obj };
  const fieldsToMask = [
    ...PII_FIELDS.SENSITIVE,
    ...(level === 'SENSITIVE' ? [] : PII_FIELDS.DIRECT),
  ];
  
  for (const key of Object.keys(masked)) {
    if (fieldsToMask.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      const value = masked[key];
      if (typeof value === 'string' && value.length > 4) {
        masked[key] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
      } else {
        masked[key] = '***';
      }
    }
  }
  
  return masked;
}

// ============ Compliance Report ============

export interface ComplianceReport {
  generatedAt: string;
  companyId: string;
  dataCategories: {
    category: DataCategory;
    classification: DataClassification;
    estimatedRecords?: number;
    oldestRecord?: string;
    newestRecord?: string;
  }[];
  piiSummary: {
    level: PIILevel;
    fieldCount: number;
  }[];
  retentionSummary: {
    expiringWithin30Days: number;
    expiringWithin1Year: number;
    permanent: number;
  };
}

/**
 * Generera compliance-rapport för ett bolag
 */
export function generateComplianceReport(companyId: string): ComplianceReport {
  return {
    generatedAt: new Date().toISOString(),
    companyId,
    dataCategories: Object.values(DATA_CLASSIFICATIONS).map(c => ({
      category: c.category,
      classification: c,
    })),
    piiSummary: [
      { level: 'NONE', fieldCount: PII_FIELDS.NONE.length },
      { level: 'INDIRECT', fieldCount: PII_FIELDS.INDIRECT.length },
      { level: 'DIRECT', fieldCount: PII_FIELDS.DIRECT.length },
      { level: 'SENSITIVE', fieldCount: PII_FIELDS.SENSITIVE.length },
    ],
    retentionSummary: {
      expiringWithin30Days: 0, // Would be populated from actual data
      expiringWithin1Year: 0,
      permanent: 0,
    },
  };
}

