/**
 * CRM Types
 * Core data models for the CRM system
 */

// ============ Base Types ============
export type CrmEntityType = 'contact' | 'company' | 'deal' | 'task' | 'activity';

export interface CrmAuditInfo {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// ============ Contacts ============
export interface Contact extends CrmAuditInfo {
  id: string;
  companyId?: string; // Optional - for backwards compatibility
  crmCompanyId?: string; // Linked CRM company (organization)
  
  // Linked managed companies (Bolag) - global CRM connects to multiple
  linkedManagedCompanyIds?: string[];
  linkedManagedCompanyNames?: string[];
  
  // Basic info
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  
  // Position
  title?: string;
  department?: string;
  
  // Social
  linkedIn?: string;
  
  // Address
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Status
  status: 'active' | 'inactive' | 'archived';
  
  // Tags and notes
  tags?: string[];
  notes?: string;
  
  // Photo
  avatarUrl?: string;
  
  // Owner
  ownerId?: string;
  ownerName?: string;
}

// ============ CRM Companies (Accounts) ============
export type CompanyStatus = 'lead' | 'prospect' | 'customer' | 'partner' | 'inactive';

export interface CrmCompany extends CrmAuditInfo {
  id: string;
  companyId?: string; // Optional - for backwards compatibility
  
  // Linked managed companies (Bolag) - can invest in or relate to multiple
  linkedManagedCompanyIds?: string[];
  linkedManagedCompanyNames?: string[];
  
  // Basic info
  name: string;
  customerNumber?: string; // Unikt kundnummer
  orgNumber?: string;
  website?: string;
  industry?: string;
  
  // Contact info
  email?: string;
  phone?: string;
  
  // Address
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Business info
  employeeCount?: number;
  annualRevenue?: number;
  description?: string;
  
  // Status
  status: CompanyStatus;
  
  // Tags
  tags?: string[];
  
  // Owner (Ansvarig AIFM)
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  
  // Logo
  logoUrl?: string;
  
  // Linked Fortnox
  fortnoxSupplierId?: string;
  fortnoxCustomerId?: string;
  
  // Linked Dataroom
  dataroomId?: string;
  dataroomName?: string;
  
  // Revenue tracking
  currentMRR?: number; // Monthly Recurring Revenue
  currentARR?: number; // Annual Recurring Revenue
  currency?: string;
  revenueSource?: 'manual' | 'fortnox' | 'calculated';
  
  // KYC Status
  kycStatus?: KycStatus;
  kycCompletedAt?: string;
  kycNextReviewAt?: string;
  kycRiskLevel?: 'low' | 'medium' | 'high';
  
  // Primary contact
  primaryContactId?: string;
  primaryContactName?: string;
}

// ============ KYC Types ============
export type KycStatus = 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'expired';

export interface KycChecklistItem {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  documentId?: string; // Linked document in dataroom
  notes?: string;
}

export interface KycRecord extends CrmAuditInfo {
  id: string;
  companyId: string; // AIFM tenant
  crmCompanyId: string; // Customer being KYC'd
  
  status: KycStatus;
  riskLevel: 'low' | 'medium' | 'high';
  
  // Checklist
  checklist: KycChecklistItem[];
  
  // Dates
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  expiresAt?: string;
  nextReviewAt?: string;
  
  // Documents
  documentIds?: string[];
  
  // Notes and history
  notes?: string;
  reviewHistory?: Array<{
    date: string;
    action: 'started' | 'updated' | 'approved' | 'rejected' | 'expired';
    userId: string;
    userName: string;
    notes?: string;
  }>;
}

// ============ Revenue Types ============
export interface RevenueEntry {
  id: string;
  companyId: string; // AIFM tenant
  crmCompanyId: string;
  
  // Period
  year: number;
  month: number;
  
  // Amounts
  amount: number;
  currency: string;
  type: 'actual' | 'forecast';
  
  // Source
  source: 'manual' | 'fortnox' | 'invoice' | 'contract';
  sourceId?: string; // Reference to source document/invoice
  
  // Metadata
  description?: string;
  createdAt: string;
  createdBy: string;
}

export interface RevenueForecast {
  crmCompanyId: string;
  
  // Pipeline-based
  pipelineValue: number;
  weightedPipelineValue: number;
  
  // Forecast scenarios
  committed: number; // Won deals + existing contracts
  bestCase: number; // Committed + high probability deals
  worstCase: number; // Only committed
  
  // Time horizon
  periodStart: string;
  periodEnd: string;
  
  // By stage
  byStage: Array<{
    stage: DealStage;
    value: number;
    count: number;
  }>;
}

// ============ Contract Types ============
export type ContractStatus = 'draft' | 'sent' | 'negotiating' | 'signed' | 'active' | 'expired' | 'terminated';
export type ContractType = 'service' | 'license' | 'subscription' | 'nda' | 'partnership' | 'other';

export interface Contract extends CrmAuditInfo {
  id: string;
  companyId: string; // AIFM tenant
  dataroomId: string;
  
  // Basic info
  name: string;
  contractNumber?: string;
  type: ContractType;
  description?: string;
  
  // Linked entities
  crmCompanyId?: string;
  crmCompanyName?: string;
  dealId?: string;
  dealName?: string;
  
  // Status
  status: ContractStatus;
  
  // Dates
  startDate?: string;
  endDate?: string;
  signedAt?: string;
  
  // Value
  value?: number;
  currency?: string;
  billingFrequency?: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  
  // Renewal
  autoRenewal?: boolean;
  renewalReminderDays?: number;
  renewalDate?: string;
  
  // Signatories
  signatories?: Array<{
    name: string;
    email: string;
    role: string;
    signedAt?: string;
    signatureId?: string;
  }>;
  
  // Document
  documentId?: string;
  documentKey?: string; // S3 key
  
  // Versions
  version: number;
  previousVersionId?: string;
  
  // Tags
  tags?: string[];
}

// ============ Quote Types ============
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // percentage
  total: number;
  productId?: string;
}

export interface Quote extends CrmAuditInfo {
  id: string;
  companyId: string; // AIFM tenant
  dataroomId?: string;
  
  // Basic info
  quoteNumber: string;
  name: string;
  description?: string;
  
  // Linked entities
  crmCompanyId?: string;
  crmCompanyName?: string;
  contactId?: string;
  contactName?: string;
  dealId?: string;
  dealName?: string;
  
  // Status
  status: QuoteStatus;
  
  // Dates
  validFrom: string;
  validUntil: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  
  // Line items
  lineItems: QuoteLineItem[];
  
  // Totals
  subtotal: number;
  discount?: number;
  tax?: number;
  taxRate?: number;
  total: number;
  currency: string;
  
  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  
  // Document
  documentId?: string;
  documentKey?: string;
  
  // Versions
  version: number;
  previousVersionId?: string;
  
  // Convert to contract
  contractId?: string;
  
  // Tags
  tags?: string[];
}

// ============ Deals (Pipeline) ============
export type DealStage = 
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Deal extends CrmAuditInfo {
  id: string;
  companyId: string; // AIFM company (tenant)
  
  // Basic info
  name: string;
  description?: string;
  
  // Linked entities
  crmCompanyId?: string;
  crmCompanyName?: string;
  contactIds?: string[];
  primaryContactId?: string;
  primaryContactName?: string;
  
  // Pipeline
  stage: DealStage;
  probability?: number; // 0-100
  
  // Value
  value?: number;
  currency?: string;
  
  // Dates
  expectedCloseDate?: string;
  actualCloseDate?: string;
  
  // Status
  status: 'open' | 'won' | 'lost';
  lostReason?: string;
  
  // Tags
  tags?: string[];
  
  // Owner
  ownerId?: string;
  ownerName?: string;
  
  // Priority
  priority?: 'low' | 'medium' | 'high';
}

// ============ Tasks ============
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';

export interface Task extends CrmAuditInfo {
  id: string;
  companyId: string; // AIFM company (tenant)
  
  // Basic info
  title: string;
  description?: string;
  
  // Status
  status: TaskStatus;
  priority: TaskPriority;
  
  // Dates
  dueDate?: string;
  dueTime?: string;
  completedAt?: string;
  
  // Linked entities
  contactId?: string;
  contactName?: string;
  crmCompanyId?: string;
  crmCompanyName?: string;
  dealId?: string;
  dealName?: string;
  activityId?: string;
  
  // Assignment
  assigneeId?: string;
  assigneeName?: string;
  
  // Reminders
  reminderAt?: string;
  
  // Tags
  tags?: string[];
}

// ============ Activities (Meetings, Calls, Notes) ============
export type ActivityType = 'meeting' | 'call' | 'email' | 'note' | 'task_completed';

export interface Activity extends CrmAuditInfo {
  id: string;
  companyId: string; // AIFM company (tenant)
  
  // Type
  type: ActivityType;
  
  // Basic info
  title: string;
  description?: string;
  
  // For meetings/calls
  startTime?: string;
  endTime?: string;
  duration?: number; // minutes
  location?: string;
  isAllDay?: boolean;
  
  // Linked entities
  contactId?: string;
  contactName?: string;
  crmCompanyId?: string;
  crmCompanyName?: string;
  dealId?: string;
  dealName?: string;
  
  // Participants (for meetings)
  participants?: Array<{
    id: string;
    name: string;
    email?: string;
    type: 'contact' | 'user';
    status?: 'pending' | 'accepted' | 'declined' | 'tentative';
  }>;
  
  // Outcome
  outcome?: string;
  nextSteps?: string;
  
  // Status
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  
  // Tags
  tags?: string[];
  
  // Owner
  ownerId?: string;
  ownerName?: string;
  
  // Recurrence (for calendar events)
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
    exceptions?: string[];
  };
  
  // Color for calendar
  color?: string;
}

// ============ Calendar Event (normalized view for calendar) ============
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string;
  type: 'activity' | 'task';
  entityId: string;
  
  // Additional info for display
  description?: string;
  location?: string;
  contactName?: string;
  crmCompanyName?: string;
  dealName?: string;
  status?: string;
}

// ============ Pipeline Stage Config ============
export interface PipelineStageConfig {
  id: DealStage;
  name: string;
  color: string;
  probability: number;
  order: number;
}

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: 'lead', name: 'Lead', color: '#94a3b8', probability: 10, order: 0 },
  { id: 'qualified', name: 'Kvalificerad', color: '#60a5fa', probability: 25, order: 1 },
  { id: 'proposal', name: 'Offert', color: '#c084fc', probability: 50, order: 2 },
  { id: 'negotiation', name: 'Förhandling', color: '#f59e0b', probability: 75, order: 3 },
  { id: 'won', name: 'Vunnen', color: '#22c55e', probability: 100, order: 4 },
  { id: 'lost', name: 'Förlorad', color: '#ef4444', probability: 0, order: 5 },
];

// ============ Activity Stats ============
export interface CrmStats {
  totalContacts: number;
  totalCompanies: number;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalValue: number;
  wonValue: number;
  activitiesThisWeek: number;
  tasksOverdue: number;
  tasksDueToday: number;
}

// ============ Timeline Entry ============
export type TimelineEntryType = 
  | 'activity' 
  | 'task' 
  | 'task_completed' 
  | 'deal_created' 
  | 'deal_stage_change' 
  | 'note' 
  | 'email'
  | 'contract_created'
  | 'contract_signed'
  | 'contract_expired'
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'kyc_started'
  | 'kyc_completed'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'document_uploaded'
  | 'revenue_recorded';

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  title: string;
  description?: string;
  timestamp: string;
  entityType?: CrmEntityType | 'contract' | 'quote' | 'kyc' | 'document' | 'revenue';
  entityId?: string;
  metadata?: Record<string, unknown>;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  icon?: string;
  color?: string;
}

// ============ Customer 360 Stats ============
export interface Customer360Stats {
  // Deals
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalDealValue: number;
  wonDealValue: number;
  
  // Activities
  totalActivities: number;
  activitiesLast30Days: number;
  lastActivityDate?: string;
  
  // Tasks
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  
  // Revenue
  totalRevenue: number;
  revenueThisYear: number;
  revenueLastYear: number;
  mrr: number;
  arr: number;
  
  // Contracts
  activeContracts: number;
  contractsExpiringSoon: number;
  
  // Quotes
  openQuotes: number;
  pendingQuoteValue: number;
}

