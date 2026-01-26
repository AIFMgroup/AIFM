/**
 * Process Playbook & Checklist Service
 * 
 * Standardiserade checklistor för återkommande processer:
 * - NAV-beräkning (månad/kvartal)
 * - Rapportering (FI, investerare)
 * - Årsbokslut
 * - Compliance-åtgärder
 * 
 * Varje playbook har:
 * - Ägare (person/roll)
 * - Deadline
 * - Beroenden mellan steg
 * - Automatiska påminnelser
 * - Eskaleringsregler
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.PLAYBOOKS_TABLE_NAME || 'aifm-playbooks';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// Types
// ============================================================================

export type PlaybookCategory = 
  | 'NAV_CALCULATION'
  | 'QUARTERLY_REPORTING'
  | 'ANNUAL_CLOSING'
  | 'COMPLIANCE'
  | 'CLIENT_ONBOARDING'
  | 'AUDIT_PREPARATION'
  | 'TAX_DECLARATION'
  | 'FUND_LAUNCH'
  | 'CUSTOM';

export type RecurrencePattern = 
  | 'ONCE'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'ANNUAL';

export type StepStatus = 
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'PENDING_APPROVAL'
  | 'COMPLETED'
  | 'SKIPPED';

export type AssigneeType = 'user' | 'role' | 'team';

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  category: PlaybookCategory;
  version: number;
  isDefault: boolean;
  
  // Struktur
  steps: PlaybookStepTemplate[];
  
  // Tidsinställningar
  defaultDueDays: number; // Dagar från start till deadline
  reminderDays: number[]; // Dagar innan deadline att skicka påminnelse
  escalationDays: number; // Dagar efter deadline innan eskalering
  
  // Behörigheter
  requiredRole: string;
  approverRole?: string;
  
  // Recurrence
  recurrence: RecurrencePattern;
  recurrenceDay?: number; // Dag i månaden/veckan
  
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookStepTemplate {
  id: string;
  order: number;
  name: string;
  description: string;
  instructions?: string;
  
  // Tilldelning
  assigneeType: AssigneeType;
  defaultAssignee: string; // User ID, role name, or team ID
  
  // Tidsuppskattning
  estimatedMinutes: number;
  dueDaysOffset: number; // Dagar från playbook-start
  
  // Beroenden
  dependsOn: string[]; // Step IDs som måste vara klara
  blockedByApproval: boolean;
  
  // Godkännande
  requiresApproval: boolean;
  approverRole?: string;
  requiresDualApproval?: boolean;
  
  // Automation
  automationTrigger?: {
    type: 'on_complete' | 'on_skip' | 'on_approval';
    action: 'notify' | 'create_task' | 'api_call' | 'webhook';
    config: Record<string, unknown>;
  };
  
  // Dokumentation
  attachmentRequired: boolean;
  documentTemplateId?: string;
  checklistItems?: string[];
  
  // Standard comments
  standardComments?: string[];
}

export interface PlaybookInstance {
  id: string;
  templateId: string;
  templateName: string;
  category: PlaybookCategory;
  
  tenantId: string;
  companyId: string;
  fundId?: string;
  
  // Status
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  progress: number; // 0-100
  
  // Tid
  startDate: string;
  dueDate: string;
  completedAt?: string;
  
  // Ansvarig
  ownerId: string;
  ownerName: string;
  
  // Steg
  steps: PlaybookStepInstance[];
  
  // Kontext
  context?: Record<string, unknown>; // Period, rapport, etc.
  tags?: string[];
  notes?: string;
  
  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface PlaybookStepInstance {
  id: string;
  stepTemplateId: string;
  order: number;
  name: string;
  
  // Status
  status: StepStatus;
  
  // Tilldelning
  assigneeId: string;
  assigneeName: string;
  
  // Tid
  dueDate: string;
  startedAt?: string;
  completedAt?: string;
  
  // Godkännande
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  approvalComment?: string;
  
  // Dokumentation
  attachments?: { id: string; name: string; url: string }[];
  completionComment?: string;
  checklistProgress?: { item: string; completed: boolean }[];
  
  // Tidsåtgång
  actualMinutes?: number;
  
  // Blockering
  blockedReason?: string;
  blockedSince?: string;
}

// ============================================================================
// Default Playbook Templates
// ============================================================================

const DEFAULT_PLAYBOOK_TEMPLATES: Omit<PlaybookTemplate, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'template-nav-monthly',
    name: 'Månatlig NAV-beräkning',
    description: 'Standardprocess för beräkning och verifiering av NAV vid månadsskifte',
    category: 'NAV_CALCULATION',
    version: 1,
    isDefault: true,
    steps: [
      {
        id: 'nav-1',
        order: 1,
        name: 'Samla in positionsdata',
        description: 'Hämta senaste positioner från förvaringsbank och prime broker',
        assigneeType: 'role',
        defaultAssignee: 'fund_accountant',
        estimatedMinutes: 30,
        dueDaysOffset: -3,
        dependsOn: [],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Hämtat positioner från förvaringsbank',
          'Hämtat positioner från prime broker',
          'Kontrollerat mot förra månadens positioner',
        ],
      },
      {
        id: 'nav-2',
        order: 2,
        name: 'Prissättning av tillgångar',
        description: 'Hämta och validera priser för alla tillgångar',
        assigneeType: 'role',
        defaultAssignee: 'fund_accountant',
        estimatedMinutes: 60,
        dueDaysOffset: -2,
        dependsOn: ['nav-1'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Hämtat marknadspriser för likvida tillgångar',
          'Inhämtat värderingar för illikvida tillgångar',
          'Dokumenterat prisavvikelser >5%',
          'Godkänt värderingspolicy efterföljs',
        ],
      },
      {
        id: 'nav-3',
        order: 3,
        name: 'Beräkna skulder och avgifter',
        description: 'Beräkna upplupna avgifter, management fee, performance fee',
        assigneeType: 'role',
        defaultAssignee: 'fund_accountant',
        estimatedMinutes: 45,
        dueDaysOffset: -2,
        dependsOn: ['nav-2'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Beräknat management fee',
          'Beräknat performance fee (om tillämpligt)',
          'Beräknat övriga upplupna kostnader',
          'Kontrollerat mot budget',
        ],
      },
      {
        id: 'nav-4',
        order: 4,
        name: 'Preliminär NAV-beräkning',
        description: 'Sammanställ och beräkna preliminärt NAV',
        assigneeType: 'role',
        defaultAssignee: 'fund_accountant',
        estimatedMinutes: 30,
        dueDaysOffset: -1,
        dependsOn: ['nav-2', 'nav-3'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Summa tillgångar stämmer',
          'Summa skulder stämmer',
          'NAV per andel beräknad',
          'Jämfört med föregående NAV',
        ],
      },
      {
        id: 'nav-5',
        order: 5,
        name: 'Oberoende verifiering',
        description: 'Oberoende kontroll av NAV-beräkningen',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 45,
        dueDaysOffset: 0,
        dependsOn: ['nav-4'],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'manager',
        attachmentRequired: false,
        checklistItems: [
          'Kontrollerat matematiska beräkningar',
          'Stickprov på prissättning',
          'Kontrollerat avgiftsberäkningar',
          'Dokumenterat avvikelser',
        ],
        standardComments: [
          'NAV verifierat utan anmärkning',
          'NAV verifierat med mindre kommentarer (se bilaga)',
          'NAV kräver justering - se kommentar',
        ],
      },
      {
        id: 'nav-6',
        order: 6,
        name: 'Slutgodkännande',
        description: 'CFO/VD godkänner slutligt NAV',
        assigneeType: 'role',
        defaultAssignee: 'executive',
        estimatedMinutes: 15,
        dueDaysOffset: 0,
        dependsOn: ['nav-5'],
        blockedByApproval: true,
        requiresApproval: true,
        approverRole: 'executive',
        requiresDualApproval: false,
        attachmentRequired: false,
        automationTrigger: {
          type: 'on_approval',
          action: 'notify',
          config: { channels: ['email', 'slack'], recipients: ['investors'] },
        },
      },
      {
        id: 'nav-7',
        order: 7,
        name: 'Publicera NAV',
        description: 'Publicera NAV till investerare och databaser',
        assigneeType: 'role',
        defaultAssignee: 'fund_accountant',
        estimatedMinutes: 20,
        dueDaysOffset: 1,
        dependsOn: ['nav-6'],
        blockedByApproval: true,
        requiresApproval: false,
        attachmentRequired: false,
        checklistItems: [
          'NAV publicerat till Bloomberg',
          'NAV skickat till förvaringsbank',
          'NAV publicerat i investerarportal',
          'Bekräftelse mottagen',
        ],
      },
    ],
    defaultDueDays: 5,
    reminderDays: [3, 1],
    escalationDays: 2,
    requiredRole: 'fund_accountant',
    approverRole: 'manager',
    recurrence: 'MONTHLY',
    recurrenceDay: 5, // 5:e varje månad
  },
  {
    id: 'template-quarterly-fi-report',
    name: 'Kvartalsrapport till FI',
    description: 'Standardprocess för kvartalsrapportering till Finansinspektionen',
    category: 'QUARTERLY_REPORTING',
    version: 1,
    isDefault: true,
    steps: [
      {
        id: 'fi-1',
        order: 1,
        name: 'Samla in underlagsdata',
        description: 'Hämta alla underlag för rapporteringsperioden',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 120,
        dueDaysOffset: -14,
        dependsOn: [],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'AUM per dag/vecka samlat',
          'Likviditet per fond dokumenterad',
          'Riskmått beräknade',
          'Hävstång dokumenterad',
          'Motpartsexponeringar listade',
        ],
      },
      {
        id: 'fi-2',
        order: 2,
        name: 'Fyll i AIFMD-rapporten',
        description: 'Populera AIFMD-rapportmallen med data',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 180,
        dueDaysOffset: -10,
        dependsOn: ['fi-1'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        documentTemplateId: 'template-aifmd-report',
        checklistItems: [
          'Sektion 1: AIF-identifiering',
          'Sektion 2: Huvudsakliga exponeringar',
          'Sektion 3: Riskprofil',
          'Sektion 4: Likviditetsrisk',
          'Sektion 5: Hävstång',
        ],
      },
      {
        id: 'fi-3',
        order: 3,
        name: 'Intern granskning',
        description: 'Compliance granskar rapporten',
        assigneeType: 'role',
        defaultAssignee: 'compliance_manager',
        estimatedMinutes: 90,
        dueDaysOffset: -7,
        dependsOn: ['fi-2'],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'compliance_manager',
        attachmentRequired: false,
        checklistItems: [
          'Data verifierat mot källa',
          'Beräkningar kontrollerade',
          'Jämförelse mot föregående kvartal',
          'Rimlighetsbedömning OK',
        ],
      },
      {
        id: 'fi-4',
        order: 4,
        name: 'Ledningsgodkännande',
        description: 'VD/CFO godkänner inrapportering',
        assigneeType: 'role',
        defaultAssignee: 'executive',
        estimatedMinutes: 30,
        dueDaysOffset: -5,
        dependsOn: ['fi-3'],
        blockedByApproval: true,
        requiresApproval: true,
        approverRole: 'executive',
        requiresDualApproval: true,
        attachmentRequired: false,
        standardComments: [
          'Godkänt för inrapportering',
          'Godkänt med förbehåll - se kommentar',
          'Avvisas - kräver korrigering',
        ],
      },
      {
        id: 'fi-5',
        order: 5,
        name: 'Skicka till FI',
        description: 'Ladda upp rapport via FI:s rapporteringsportal',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 30,
        dueDaysOffset: -3,
        dependsOn: ['fi-4'],
        blockedByApproval: true,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Rapport validerad i FI-portalen',
          'Rapport inskickad',
          'Bekräftelse mottagen',
          'Arkiverat i dokumenthantering',
        ],
        automationTrigger: {
          type: 'on_complete',
          action: 'notify',
          config: { channels: ['email'], recipients: ['compliance_team', 'executive'] },
        },
      },
    ],
    defaultDueDays: 45, // 45 dagar efter kvartalsslut
    reminderDays: [14, 7, 3],
    escalationDays: 1,
    requiredRole: 'compliance_officer',
    approverRole: 'executive',
    recurrence: 'QUARTERLY',
    recurrenceDay: 45, // Dag 45 efter kvartalsskifte
  },
  {
    id: 'template-annual-closing',
    name: 'Årsbokslut',
    description: 'Komplett checklista för årsbokslut',
    category: 'ANNUAL_CLOSING',
    version: 1,
    isDefault: true,
    steps: [
      {
        id: 'ac-1',
        order: 1,
        name: 'Preliminär balansräkning',
        description: 'Sammanställ preliminär balansräkning per 31/12',
        assigneeType: 'role',
        defaultAssignee: 'accountant',
        estimatedMinutes: 180,
        dueDaysOffset: -30,
        dependsOn: [],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Alla konton avstämda',
          'Periodiseringar bokförda',
          'Upplupna kostnader/intäkter',
          'Balansräkning i balans',
        ],
      },
      {
        id: 'ac-2',
        order: 2,
        name: 'Inventering av tillgångar',
        description: 'Fysisk/digital inventering av anläggningstillgångar',
        assigneeType: 'role',
        defaultAssignee: 'accountant',
        estimatedMinutes: 240,
        dueDaysOffset: -25,
        dependsOn: [],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Inventering genomförd',
          'Differenser utredda',
          'Avskrivningar korrekta',
          'Register uppdaterat',
        ],
      },
      {
        id: 'ac-3',
        order: 3,
        name: 'Skatteberäkning',
        description: 'Beräkna aktuell och uppskjuten skatt',
        assigneeType: 'role',
        defaultAssignee: 'accountant',
        estimatedMinutes: 120,
        dueDaysOffset: -20,
        dependsOn: ['ac-1'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Skattemässiga justeringar',
          'Uppskjuten skatt beräknad',
          'Aktuell skatt bokförd',
          'Deklarationsunderlag klart',
        ],
      },
      {
        id: 'ac-4',
        order: 4,
        name: 'Förvaltningsberättelse',
        description: 'Upprätta förvaltningsberättelse',
        assigneeType: 'role',
        defaultAssignee: 'manager',
        estimatedMinutes: 240,
        dueDaysOffset: -15,
        dependsOn: ['ac-1', 'ac-3'],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'executive',
        attachmentRequired: true,
        documentTemplateId: 'template-forvaltningsberattelse',
        checklistItems: [
          'Väsentliga händelser beskrivna',
          'Framtidsutsikter formulerade',
          'Risker och osäkerheter',
          'Nyckeltal korrekta',
        ],
      },
      {
        id: 'ac-5',
        order: 5,
        name: 'Noter till årsredovisning',
        description: 'Upprätta samtliga noter',
        assigneeType: 'role',
        defaultAssignee: 'accountant',
        estimatedMinutes: 300,
        dueDaysOffset: -12,
        dependsOn: ['ac-1', 'ac-2', 'ac-3'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Not 1: Redovisningsprinciper',
          'Not 2: Anställda och löner',
          'Not 3: Anläggningstillgångar',
          'Not 4: Eget kapital',
          'Not 5: Skulder och avsättningar',
          'Not 6: Eventualförpliktelser',
        ],
      },
      {
        id: 'ac-6',
        order: 6,
        name: 'Sammanställ årsredovisning',
        description: 'Färdigställ komplett årsredovisning',
        assigneeType: 'role',
        defaultAssignee: 'accountant',
        estimatedMinutes: 120,
        dueDaysOffset: -8,
        dependsOn: ['ac-4', 'ac-5'],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'manager',
        attachmentRequired: true,
      },
      {
        id: 'ac-7',
        order: 7,
        name: 'Revisorsgenomgång',
        description: 'Lämna underlag till revisor och hantera frågor',
        assigneeType: 'role',
        defaultAssignee: 'accountant',
        estimatedMinutes: 480,
        dueDaysOffset: -5,
        dependsOn: ['ac-6'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Revisionsunderlag levererat',
          'Revisorsfrågor besvarade',
          'Korrigeringar genomförda',
          'Revisionsberättelse mottagen',
        ],
      },
      {
        id: 'ac-8',
        order: 8,
        name: 'Styrelsegodkännande',
        description: 'Styrelsen godkänner årsredovisning',
        assigneeType: 'role',
        defaultAssignee: 'executive',
        estimatedMinutes: 60,
        dueDaysOffset: 0,
        dependsOn: ['ac-7'],
        blockedByApproval: true,
        requiresApproval: true,
        approverRole: 'board',
        requiresDualApproval: true,
        attachmentRequired: true,
        standardComments: [
          'Årsredovisningen fastställs',
          'Årsredovisningen fastställs med kommentar',
        ],
        automationTrigger: {
          type: 'on_approval',
          action: 'notify',
          config: { channels: ['email', 'slack'], recipients: ['all_stakeholders'] },
        },
      },
    ],
    defaultDueDays: 120, // Senast 4 månader efter räkenskapsårets slut
    reminderDays: [30, 14, 7, 3],
    escalationDays: 1,
    requiredRole: 'accountant',
    approverRole: 'executive',
    recurrence: 'ANNUAL',
    recurrenceDay: 120, // Dag 120 efter årsskiftet
  },
  {
    id: 'template-compliance-review',
    name: 'Årlig compliancegranskning',
    description: 'Årlig intern compliancegranskning enligt AIFMD',
    category: 'COMPLIANCE',
    version: 1,
    isDefault: true,
    steps: [
      {
        id: 'comp-1',
        order: 1,
        name: 'Planera granskning',
        description: 'Definiera scope och tidsplan för årets granskning',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 120,
        dueDaysOffset: -60,
        dependsOn: [],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'compliance_manager',
        attachmentRequired: true,
        checklistItems: [
          'Riskområden identifierade',
          'Granskningsplan upprättad',
          'Resurser allokerade',
          'Tidsplan godkänd',
        ],
      },
      {
        id: 'comp-2',
        order: 2,
        name: 'Granska policies och procedurer',
        description: 'Verifiera att alla policies är uppdaterade och implementerade',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 480,
        dueDaysOffset: -45,
        dependsOn: ['comp-1'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Riskhanteringspolicy granskad',
          'Intressekonflikter policy granskad',
          'Värderingspolicy granskad',
          'AML/KYC policy granskad',
          'Best execution policy granskad',
          'Klagomålshantering granskad',
        ],
      },
      {
        id: 'comp-3',
        order: 3,
        name: 'Stickprovskontroller',
        description: 'Genomför stickprov på efterlevnad',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 600,
        dueDaysOffset: -30,
        dependsOn: ['comp-2'],
        blockedByApproval: false,
        requiresApproval: false,
        attachmentRequired: true,
        checklistItems: [
          'Handelsövervakning',
          'NAV-beräkningar',
          'Investor complaints',
          'Rapportering till FI',
          'KYC-dokumentation',
        ],
      },
      {
        id: 'comp-4',
        order: 4,
        name: 'Åtgärdsplan',
        description: 'Dokumentera avvikelser och upprätta åtgärdsplan',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 240,
        dueDaysOffset: -20,
        dependsOn: ['comp-3'],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'compliance_manager',
        attachmentRequired: true,
        documentTemplateId: 'template-atgardsplan',
      },
      {
        id: 'comp-5',
        order: 5,
        name: 'Compliancerapport',
        description: 'Upprätta årlig compliancerapport till styrelsen',
        assigneeType: 'role',
        defaultAssignee: 'compliance_officer',
        estimatedMinutes: 360,
        dueDaysOffset: -10,
        dependsOn: ['comp-4'],
        blockedByApproval: false,
        requiresApproval: true,
        approverRole: 'executive',
        attachmentRequired: true,
        documentTemplateId: 'template-compliance-report',
      },
      {
        id: 'comp-6',
        order: 6,
        name: 'Presentation för styrelse',
        description: 'Presentera compliancerapport på styrelsemöte',
        assigneeType: 'role',
        defaultAssignee: 'compliance_manager',
        estimatedMinutes: 60,
        dueDaysOffset: 0,
        dependsOn: ['comp-5'],
        blockedByApproval: true,
        requiresApproval: true,
        approverRole: 'board',
        attachmentRequired: true,
        automationTrigger: {
          type: 'on_approval',
          action: 'notify',
          config: { channels: ['email'], recipients: ['fi_contact'] },
        },
      },
    ],
    defaultDueDays: 90,
    reminderDays: [30, 14, 7],
    escalationDays: 3,
    requiredRole: 'compliance_officer',
    approverRole: 'board',
    recurrence: 'ANNUAL',
    recurrenceDay: 60, // Q1
  },
];

// ============================================================================
// Playbook Service
// ============================================================================

export const playbookService = {
  // ========== Templates ==========

  async getTemplates(category?: PlaybookCategory): Promise<PlaybookTemplate[]> {
    const templates = DEFAULT_PLAYBOOK_TEMPLATES.map(t => ({
      ...t,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    if (category) {
      return templates.filter(t => t.category === category);
    }

    return templates;
  },

  async getTemplate(templateId: string): Promise<PlaybookTemplate | null> {
    const templates = await this.getTemplates();
    return templates.find(t => t.id === templateId) || null;
  },

  // ========== Instances ==========

  async createInstance(params: {
    templateId: string;
    tenantId: string;
    companyId: string;
    fundId?: string;
    ownerId: string;
    ownerName: string;
    startDate?: string;
    dueDate?: string;
    context?: Record<string, unknown>;
    createdBy: string;
  }): Promise<PlaybookInstance> {
    const template = await this.getTemplate(params.templateId);
    if (!template) {
      throw new Error(`Template ${params.templateId} not found`);
    }

    const now = new Date();
    const startDate = params.startDate ? new Date(params.startDate) : now;
    const dueDate = params.dueDate 
      ? new Date(params.dueDate)
      : new Date(startDate.getTime() + template.defaultDueDays * 24 * 60 * 60 * 1000);

    const instanceId = `playbook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Skapa step instances
    const steps: PlaybookStepInstance[] = template.steps.map(stepTemplate => {
      const stepDueDate = new Date(startDate.getTime() + stepTemplate.dueDaysOffset * 24 * 60 * 60 * 1000);
      
      return {
        id: `step-${instanceId}-${stepTemplate.id}`,
        stepTemplateId: stepTemplate.id,
        order: stepTemplate.order,
        name: stepTemplate.name,
        status: 'NOT_STARTED',
        assigneeId: stepTemplate.defaultAssignee,
        assigneeName: stepTemplate.defaultAssignee, // Would resolve from user service
        dueDate: stepDueDate.toISOString(),
        checklistProgress: stepTemplate.checklistItems?.map(item => ({ item, completed: false })),
      };
    });

    const instance: PlaybookInstance = {
      id: instanceId,
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      tenantId: params.tenantId,
      companyId: params.companyId,
      fundId: params.fundId,
      status: 'DRAFT',
      progress: 0,
      startDate: startDate.toISOString(),
      dueDate: dueDate.toISOString(),
      ownerId: params.ownerId,
      ownerName: params.ownerName,
      steps,
      context: params.context,
      createdBy: params.createdBy,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `PLAYBOOK#${instanceId}`,
        gsi1pk: `COMPANY#${params.companyId}`,
        gsi1sk: `PLAYBOOK#${instance.status}#${instance.dueDate}`,
        gsi2pk: `OWNER#${params.ownerId}`,
        gsi2sk: `PLAYBOOK#${instance.status}#${instance.dueDate}`,
        ...instance,
      },
    }));

    console.log(`[PlaybookService] Created playbook instance ${instanceId} from template ${template.id}`);

    return instance;
  },

  async getInstance(tenantId: string, instanceId: string): Promise<PlaybookInstance | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `PLAYBOOK#${instanceId}`,
        },
      }));

      return result.Item as PlaybookInstance | null;
    } catch (error) {
      console.error('[PlaybookService] Error getting instance:', error);
      return null;
    }
  },

  async getInstances(params: {
    tenantId: string;
    companyId?: string;
    ownerId?: string;
    status?: PlaybookInstance['status'];
    category?: PlaybookCategory;
  }): Promise<PlaybookInstance[]> {
    let queryParams: Record<string, unknown>;

    if (params.ownerId) {
      queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'gsi2',
        KeyConditionExpression: 'gsi2pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `OWNER#${params.ownerId}`,
        },
      };
    } else if (params.companyId) {
      queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `COMPANY#${params.companyId}`,
        },
      };
    } else {
      queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${params.tenantId}`,
          ':sk': 'PLAYBOOK#',
        },
      };
    }

    // Add filters
    const filters: string[] = [];
    const exprValues = queryParams.ExpressionAttributeValues as Record<string, unknown>;

    if (params.status) {
      filters.push('#status = :status');
      exprValues[':status'] = params.status;
    }

    if (params.category) {
      filters.push('category = :category');
      exprValues[':category'] = params.category;
    }

    if (filters.length > 0) {
      queryParams.FilterExpression = filters.join(' AND ');
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
    }

    try {
      const result = await docClient.send(new QueryCommand(queryParams as any));
      return (result.Items || []) as PlaybookInstance[];
    } catch (error) {
      console.error('[PlaybookService] Error getting instances:', error);
      return [];
    }
  },

  async updateStepStatus(params: {
    tenantId: string;
    instanceId: string;
    stepId: string;
    status: StepStatus;
    completionComment?: string;
    actualMinutes?: number;
    userId: string;
  }): Promise<PlaybookInstance | null> {
    const instance = await this.getInstance(params.tenantId, params.instanceId);
    if (!instance) return null;

    const now = new Date().toISOString();
    const stepIndex = instance.steps.findIndex(s => s.id === params.stepId);
    
    if (stepIndex === -1) return null;

    // Check dependencies
    const step = instance.steps[stepIndex];
    const template = await this.getTemplate(instance.templateId);
    const stepTemplate = template?.steps.find(s => s.id === step.stepTemplateId);

    if (stepTemplate?.dependsOn && params.status === 'IN_PROGRESS') {
      const blockedByDeps = stepTemplate.dependsOn.some(depId => {
        const depStep = instance.steps.find(s => s.stepTemplateId === depId);
        return depStep && depStep.status !== 'COMPLETED' && depStep.status !== 'SKIPPED';
      });

      if (blockedByDeps) {
        throw new Error('Cannot start step - dependencies not completed');
      }
    }

    // Update step
    instance.steps[stepIndex] = {
      ...step,
      status: params.status,
      ...(params.status === 'IN_PROGRESS' && { startedAt: now }),
      ...(params.status === 'COMPLETED' && { 
        completedAt: now,
        completionComment: params.completionComment,
        actualMinutes: params.actualMinutes,
      }),
    };

    // Recalculate progress
    const completedSteps = instance.steps.filter(s => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
    instance.progress = Math.round((completedSteps / instance.steps.length) * 100);

    // Check if all steps are done
    if (instance.progress === 100) {
      instance.status = 'COMPLETED';
      instance.completedAt = now;
    } else if (instance.status === 'DRAFT' && params.status === 'IN_PROGRESS') {
      instance.status = 'ACTIVE';
    }

    instance.updatedAt = now;
    instance.lastActivityAt = now;

    // Save
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `PLAYBOOK#${params.instanceId}`,
        gsi1pk: `COMPANY#${instance.companyId}`,
        gsi1sk: `PLAYBOOK#${instance.status}#${instance.dueDate}`,
        gsi2pk: `OWNER#${instance.ownerId}`,
        gsi2sk: `PLAYBOOK#${instance.status}#${instance.dueDate}`,
        ...instance,
      },
    }));

    return instance;
  },

  async approveStep(params: {
    tenantId: string;
    instanceId: string;
    stepId: string;
    approved: boolean;
    comment?: string;
    approverId: string;
    approverName: string;
  }): Promise<PlaybookInstance | null> {
    const instance = await this.getInstance(params.tenantId, params.instanceId);
    if (!instance) return null;

    const now = new Date().toISOString();
    const stepIndex = instance.steps.findIndex(s => s.id === params.stepId);
    
    if (stepIndex === -1) return null;

    const step = instance.steps[stepIndex];

    if (step.status !== 'PENDING_APPROVAL') {
      throw new Error('Step is not pending approval');
    }

    instance.steps[stepIndex] = {
      ...step,
      status: params.approved ? 'COMPLETED' : 'IN_PROGRESS',
      approvalStatus: params.approved ? 'APPROVED' : 'REJECTED',
      approvedBy: `${params.approverName} (${params.approverId})`,
      approvedAt: now,
      approvalComment: params.comment,
      ...(params.approved && { completedAt: now }),
    };

    // Recalculate progress
    const completedSteps = instance.steps.filter(s => s.status === 'COMPLETED' || s.status === 'SKIPPED').length;
    instance.progress = Math.round((completedSteps / instance.steps.length) * 100);

    if (instance.progress === 100) {
      instance.status = 'COMPLETED';
      instance.completedAt = now;
    }

    instance.updatedAt = now;
    instance.lastActivityAt = now;

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `PLAYBOOK#${params.instanceId}`,
        gsi1pk: `COMPANY#${instance.companyId}`,
        gsi1sk: `PLAYBOOK#${instance.status}#${instance.dueDate}`,
        gsi2pk: `OWNER#${instance.ownerId}`,
        gsi2sk: `PLAYBOOK#${instance.status}#${instance.dueDate}`,
        ...instance,
      },
    }));

    return instance;
  },

  // ========== Scheduling & Reminders ==========

  async getOverduePlaybooks(tenantId: string): Promise<PlaybookInstance[]> {
    const now = new Date().toISOString();

    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        FilterExpression: '#status = :active AND dueDate < :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sk': 'PLAYBOOK#',
          ':active': 'ACTIVE',
          ':now': now,
        },
      }));

      return (result.Items || []) as PlaybookInstance[];
    } catch (error) {
      console.error('[PlaybookService] Error getting overdue playbooks:', error);
      return [];
    }
  },

  async getUpcomingDeadlines(tenantId: string, daysAhead: number = 7): Promise<PlaybookStepInstance[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const instances = await this.getInstances({ tenantId, status: 'ACTIVE' });
    
    const upcomingSteps: (PlaybookStepInstance & { playbookName: string })[] = [];

    for (const instance of instances) {
      for (const step of instance.steps) {
        if (step.status === 'NOT_STARTED' || step.status === 'IN_PROGRESS') {
          const stepDueDate = new Date(step.dueDate);
          if (stepDueDate <= futureDate && stepDueDate >= now) {
            upcomingSteps.push({
              ...step,
              playbookName: instance.templateName,
            });
          }
        }
      }
    }

    return upcomingSteps.sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  },
};

export default playbookService;


