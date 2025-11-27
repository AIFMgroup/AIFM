/**
 * Client Companies Mock Data
 * 5 companies with full bookkeeping agent functionality
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Client {
  id: string;
  name: string;
  orgNumber: string;
  industry: string;
  type: 'AB' | 'HB' | 'KB' | 'EF';
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  bankAccount: string;
  bankName: string;
  vatNumber: string;
  fiscalYearEnd: string;
  accountingMethod: 'ACCRUAL' | 'CASH';
  status: 'ACTIVE' | 'INACTIVE' | 'ONBOARDING';
  createdAt: Date;
  lastActivity: Date;
  assignedAgent: string;
  monthlyDocuments: number;
  pendingDocuments: number;
  balance: number;
}

export interface UploadedDocument {
  id: string;
  clientId: string;
  fileName: string;
  fileType: 'PDF' | 'EXCEL' | 'WORD' | 'IMAGE' | 'OTHER';
  fileSize: number;
  uploadedAt: Date;
  status: 'PENDING' | 'PROCESSING' | 'CLASSIFIED' | 'BOOKED' | 'NEEDS_REVIEW' | 'REJECTED';
  documentType?: DocumentType;
  extractedData?: ExtractedData;
  confidence?: number;
  bookingEntry?: BookingEntry;
  reviewNote?: string;
  processedAt?: Date;
  processedBy?: string;
}

export type DocumentType = 
  | 'INVOICE_INCOMING' 
  | 'INVOICE_OUTGOING'
  | 'RECEIPT'
  | 'BANK_STATEMENT'
  | 'SALARY_SLIP'
  | 'TAX_DOCUMENT'
  | 'CONTRACT'
  | 'ANNUAL_REPORT'
  | 'VAT_REPORT'
  | 'OTHER';

export interface ExtractedData {
  vendor?: string;
  customer?: string;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  amount?: number;
  vat?: number;
  vatRate?: number;
  currency?: string;
  description?: string;
  category?: string;
  paymentReference?: string;
  bankAccount?: string;
  lineItems?: LineItem[];
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vat: number;
  account?: string;
}

export interface BookingEntry {
  id: string;
  documentId: string;
  clientId: string;
  date: Date;
  description: string;
  entries: JournalLine[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED';
  createdBy: 'AI_AGENT' | 'USER';
  approvedBy?: string;
  approvedAt?: Date;
}

export interface JournalLine {
  account: string;
  accountName: string;
  debit: number;
  credit: number;
  vatCode?: string;
}

export interface Account {
  number: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balance: number;
  category: string;
}

export interface Transaction {
  id: string;
  clientId: string;
  date: Date;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  category: string;
  account: string;
  reference?: string;
  documentId?: string;
  reconciled: boolean;
}

export interface AIProcessingLog {
  id: string;
  documentId: string;
  timestamp: Date;
  action: string;
  details: string;
  confidence: number;
  model: string;
}

// ============================================================================
// MOCK DATA - 5 CLIENT COMPANIES
// ============================================================================

export const mockClients: Client[] = [
  {
    id: 'client-1',
    name: 'TechStart AB',
    orgNumber: '559123-4567',
    industry: 'Software Development',
    type: 'AB',
    email: 'ekonomi@techstart.se',
    phone: '+46 8 123 45 67',
    address: 'Storgatan 12',
    city: 'Stockholm',
    postalCode: '111 23',
    country: 'Sweden',
    bankAccount: 'SE45 5000 0000 0520 1123 4567',
    bankName: 'SEB',
    vatNumber: 'SE559123456701',
    fiscalYearEnd: '12-31',
    accountingMethod: 'ACCRUAL',
    status: 'ACTIVE',
    createdAt: new Date('2023-01-15'),
    lastActivity: new Date(),
    assignedAgent: 'AI Bokföringsagent',
    monthlyDocuments: 45,
    pendingDocuments: 3,
    balance: 2450000,
  },
  {
    id: 'client-2',
    name: 'Nordic Consulting Group AB',
    orgNumber: '556789-0123',
    industry: 'Management Consulting',
    type: 'AB',
    email: 'finance@nordicconsulting.se',
    phone: '+46 8 987 65 43',
    address: 'Kungsgatan 44',
    city: 'Stockholm',
    postalCode: '111 35',
    country: 'Sweden',
    bankAccount: 'SE35 8000 0800 1123 4567 8901',
    bankName: 'Swedbank',
    vatNumber: 'SE556789012301',
    fiscalYearEnd: '06-30',
    accountingMethod: 'ACCRUAL',
    status: 'ACTIVE',
    createdAt: new Date('2022-06-01'),
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
    assignedAgent: 'AI Bokföringsagent',
    monthlyDocuments: 78,
    pendingDocuments: 7,
    balance: 5680000,
  },
  {
    id: 'client-3',
    name: 'Green Energy Solutions AB',
    orgNumber: '559456-7890',
    industry: 'Renewable Energy',
    type: 'AB',
    email: 'accounting@greenenergy.se',
    phone: '+46 31 234 56 78',
    address: 'Avenyn 15',
    city: 'Göteborg',
    postalCode: '411 36',
    country: 'Sweden',
    bankAccount: 'SE21 1234 5678 9012 34',
    bankName: 'Nordea',
    vatNumber: 'SE559456789001',
    fiscalYearEnd: '12-31',
    accountingMethod: 'ACCRUAL',
    status: 'ACTIVE',
    createdAt: new Date('2023-03-20'),
    lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000),
    assignedAgent: 'AI Bokföringsagent',
    monthlyDocuments: 92,
    pendingDocuments: 12,
    balance: 8920000,
  },
  {
    id: 'client-4',
    name: 'Malmö Fastigheter AB',
    orgNumber: '556234-5678',
    industry: 'Real Estate',
    type: 'AB',
    email: 'ekonomi@malmofastigheter.se',
    phone: '+46 40 345 67 89',
    address: 'Stortorget 8',
    city: 'Malmö',
    postalCode: '211 22',
    country: 'Sweden',
    bankAccount: 'SE50 3520 1234 5678 90',
    bankName: 'Danske Bank',
    vatNumber: 'SE556234567801',
    fiscalYearEnd: '12-31',
    accountingMethod: 'ACCRUAL',
    status: 'ACTIVE',
    createdAt: new Date('2021-09-10'),
    lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000),
    assignedAgent: 'AI Bokföringsagent',
    monthlyDocuments: 156,
    pendingDocuments: 5,
    balance: 45600000,
  },
  {
    id: 'client-5',
    name: 'Uppsala Innovation HB',
    orgNumber: '969789-0123',
    industry: 'Research & Development',
    type: 'HB',
    email: 'admin@uppsalainnovation.se',
    phone: '+46 18 456 78 90',
    address: 'Akademigatan 3',
    city: 'Uppsala',
    postalCode: '753 10',
    country: 'Sweden',
    bankAccount: 'SE67 6000 0000 0001 2345 6789',
    bankName: 'Handelsbanken',
    vatNumber: 'SE969789012301',
    fiscalYearEnd: '12-31',
    accountingMethod: 'CASH',
    status: 'ONBOARDING',
    createdAt: new Date('2024-10-01'),
    lastActivity: new Date(Date.now() - 30 * 60 * 1000),
    assignedAgent: 'AI Bokföringsagent',
    monthlyDocuments: 23,
    pendingDocuments: 18,
    balance: 890000,
  },
];

// ============================================================================
// MOCK DOCUMENTS - Various document types per client
// ============================================================================

export const mockDocuments: UploadedDocument[] = [
  // TechStart AB documents
  {
    id: 'doc-1',
    clientId: 'client-1',
    fileName: 'Faktura_AWS_Nov2024.pdf',
    fileType: 'PDF',
    fileSize: 245000,
    uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'BOOKED',
    documentType: 'INVOICE_INCOMING',
    confidence: 0.95,
    extractedData: {
      vendor: 'Amazon Web Services EMEA SARL',
      invoiceNumber: 'INV-2024-1234567',
      date: '2024-11-15',
      dueDate: '2024-12-15',
      amount: 45680,
      vat: 11420,
      vatRate: 25,
      currency: 'SEK',
      description: 'Cloud hosting services - November 2024',
      category: 'IT & Software',
    },
    bookingEntry: {
      id: 'be-1',
      documentId: 'doc-1',
      clientId: 'client-1',
      date: new Date('2024-11-15'),
      description: 'AWS Cloud Services Nov 2024',
      entries: [
        { account: '6540', accountName: 'IT-tjänster', debit: 45680, credit: 0, vatCode: 'I25' },
        { account: '2640', accountName: 'Ingående moms', debit: 11420, credit: 0 },
        { account: '2440', accountName: 'Leverantörsskulder', debit: 0, credit: 57100 },
      ],
      status: 'POSTED',
      createdBy: 'AI_AGENT',
      approvedBy: 'Anna Svensson',
      approvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
    processedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    processedBy: 'AI_AGENT',
  },
  {
    id: 'doc-2',
    clientId: 'client-1',
    fileName: 'Kvitto_Kontor_Material.jpg',
    fileType: 'IMAGE',
    fileSize: 1200000,
    uploadedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    status: 'BOOKED',
    documentType: 'RECEIPT',
    confidence: 0.88,
    extractedData: {
      vendor: 'Staples Sweden AB',
      date: '2024-11-20',
      amount: 2340,
      vat: 468,
      vatRate: 25,
      currency: 'SEK',
      description: 'Kontorsmaterial - papper, pennor, mappar',
      category: 'Kontorsmaterial',
    },
    bookingEntry: {
      id: 'be-2',
      documentId: 'doc-2',
      clientId: 'client-1',
      date: new Date('2024-11-20'),
      description: 'Kontorsmaterial Staples',
      entries: [
        { account: '6110', accountName: 'Kontorsmaterial', debit: 2340, credit: 0, vatCode: 'I25' },
        { account: '2640', accountName: 'Ingående moms', debit: 468, credit: 0 },
        { account: '1910', accountName: 'Kassa', debit: 0, credit: 2808 },
      ],
      status: 'POSTED',
      createdBy: 'AI_AGENT',
    },
    processedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    processedBy: 'AI_AGENT',
  },
  {
    id: 'doc-3',
    clientId: 'client-1',
    fileName: 'Kundfaktura_2024-156.pdf',
    fileType: 'PDF',
    fileSize: 189000,
    uploadedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'PROCESSING',
    documentType: 'INVOICE_OUTGOING',
    confidence: 0.92,
    extractedData: {
      customer: 'Volvo Cars AB',
      invoiceNumber: '2024-156',
      date: '2024-11-25',
      dueDate: '2024-12-25',
      amount: 125000,
      vat: 31250,
      vatRate: 25,
      currency: 'SEK',
      description: 'Konsulttjänster - systemutveckling oktober',
      category: 'Consulting Services',
    },
  },
  {
    id: 'doc-4',
    clientId: 'client-1',
    fileName: 'Bank_Statement_Oct2024.xlsx',
    fileType: 'EXCEL',
    fileSize: 567000,
    uploadedAt: new Date(Date.now() - 30 * 60 * 1000),
    status: 'PENDING',
    documentType: 'BANK_STATEMENT',
  },
  // Nordic Consulting documents
  {
    id: 'doc-5',
    clientId: 'client-2',
    fileName: 'Hyresfaktura_Q4_2024.pdf',
    fileType: 'PDF',
    fileSize: 156000,
    uploadedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    status: 'NEEDS_REVIEW',
    documentType: 'INVOICE_INCOMING',
    confidence: 0.72,
    extractedData: {
      vendor: 'Vasakronan AB',
      invoiceNumber: 'HYR-2024-Q4-4521',
      date: '2024-10-01',
      dueDate: '2024-10-31',
      amount: 185000,
      vat: 0,
      vatRate: 0,
      currency: 'SEK',
      description: 'Kontorshyra Q4 2024 - Kungsgatan 44',
      category: 'Lokalkostnader',
    },
    reviewNote: 'AI kunde inte avgöra om detta är momsfri hyra eller fastighetsförvaltning. Vänligen verifiera.',
  },
  {
    id: 'doc-6',
    clientId: 'client-2',
    fileName: 'Konsultarvode_Eriksson.docx',
    fileType: 'WORD',
    fileSize: 234000,
    uploadedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: 'CLASSIFIED',
    documentType: 'CONTRACT',
    confidence: 0.85,
    extractedData: {
      vendor: 'Erik Eriksson Consulting',
      date: '2024-11-01',
      amount: 75000,
      currency: 'SEK',
      description: 'Konsultavtal - strategisk rådgivning',
    },
  },
  // Green Energy Solutions documents
  {
    id: 'doc-7',
    clientId: 'client-3',
    fileName: 'Solpanel_Installation_Faktura.pdf',
    fileType: 'PDF',
    fileSize: 890000,
    uploadedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    status: 'BOOKED',
    documentType: 'INVOICE_INCOMING',
    confidence: 0.94,
    extractedData: {
      vendor: 'SolarTech Nordic AB',
      invoiceNumber: 'ST-2024-8890',
      date: '2024-11-10',
      dueDate: '2024-12-10',
      amount: 2450000,
      vat: 612500,
      vatRate: 25,
      currency: 'SEK',
      description: 'Installation av solpaneler - Projekt Göteborg Hamn',
      category: 'Maskiner och inventarier',
      lineItems: [
        { description: 'Solpaneler 450W x 500st', quantity: 500, unitPrice: 3500, amount: 1750000, vat: 437500 },
        { description: 'Installation och montage', quantity: 1, unitPrice: 500000, amount: 500000, vat: 125000 },
        { description: 'Projektering', quantity: 1, unitPrice: 200000, amount: 200000, vat: 50000 },
      ],
    },
    bookingEntry: {
      id: 'be-7',
      documentId: 'doc-7',
      clientId: 'client-3',
      date: new Date('2024-11-10'),
      description: 'Investering solpaneler - Göteborg Hamn',
      entries: [
        { account: '1220', accountName: 'Inventarier och verktyg', debit: 2450000, credit: 0 },
        { account: '2640', accountName: 'Ingående moms', debit: 612500, credit: 0 },
        { account: '2440', accountName: 'Leverantörsskulder', debit: 0, credit: 3062500 },
      ],
      status: 'POSTED',
      createdBy: 'AI_AGENT',
      approvedBy: 'Maria Lindgren',
      approvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    processedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    processedBy: 'AI_AGENT',
  },
  // Malmö Fastigheter documents
  {
    id: 'doc-8',
    clientId: 'client-4',
    fileName: 'Hyresintakter_Nov2024.xlsx',
    fileType: 'EXCEL',
    fileSize: 1234000,
    uploadedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    status: 'BOOKED',
    documentType: 'OTHER',
    confidence: 0.91,
    extractedData: {
      date: '2024-11-01',
      amount: 3450000,
      currency: 'SEK',
      description: 'Sammanställning hyresintäkter november 2024',
      category: 'Hyresintäkter',
    },
    bookingEntry: {
      id: 'be-8',
      documentId: 'doc-8',
      clientId: 'client-4',
      date: new Date('2024-11-01'),
      description: 'Hyresintäkter nov 2024',
      entries: [
        { account: '1510', accountName: 'Kundfordringar', debit: 3450000, credit: 0 },
        { account: '3010', accountName: 'Hyresintäkter lokaler', debit: 0, credit: 3450000 },
      ],
      status: 'POSTED',
      createdBy: 'AI_AGENT',
    },
    processedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    processedBy: 'AI_AGENT',
  },
  {
    id: 'doc-9',
    clientId: 'client-4',
    fileName: 'Fastighetsskatt_2024.pdf',
    fileType: 'PDF',
    fileSize: 345000,
    uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: 'BOOKED',
    documentType: 'TAX_DOCUMENT',
    confidence: 0.97,
    extractedData: {
      vendor: 'Skatteverket',
      date: '2024-11-15',
      dueDate: '2024-12-12',
      amount: 234000,
      currency: 'SEK',
      description: 'Fastighetsskatt 2024 - samtliga fastigheter',
      category: 'Skatter och avgifter',
    },
    bookingEntry: {
      id: 'be-9',
      documentId: 'doc-9',
      clientId: 'client-4',
      date: new Date('2024-11-15'),
      description: 'Fastighetsskatt 2024',
      entries: [
        { account: '7510', accountName: 'Fastighetsskatt', debit: 234000, credit: 0 },
        { account: '2510', accountName: 'Skatteskulder', debit: 0, credit: 234000 },
      ],
      status: 'POSTED',
      createdBy: 'AI_AGENT',
    },
    processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    processedBy: 'AI_AGENT',
  },
  // Uppsala Innovation documents
  {
    id: 'doc-10',
    clientId: 'client-5',
    fileName: 'Forskningsbidrag_Vinnova.pdf',
    fileType: 'PDF',
    fileSize: 567000,
    uploadedAt: new Date(Date.now() - 15 * 60 * 1000),
    status: 'PENDING',
    documentType: undefined,
  },
  {
    id: 'doc-11',
    clientId: 'client-5',
    fileName: 'Labbmaterial_Sigma_Aldrich.pdf',
    fileType: 'PDF',
    fileSize: 234000,
    uploadedAt: new Date(Date.now() - 45 * 60 * 1000),
    status: 'PROCESSING',
    documentType: 'INVOICE_INCOMING',
    confidence: 0.89,
    extractedData: {
      vendor: 'Sigma-Aldrich Sweden AB',
      invoiceNumber: 'SA-2024-56789',
      date: '2024-11-22',
      dueDate: '2024-12-22',
      amount: 45670,
      vat: 11418,
      vatRate: 25,
      currency: 'SEK',
      description: 'Laboratoriekemikalier och förbrukningsmaterial',
      category: 'Forskningsmaterial',
    },
  },
];

// ============================================================================
// STANDARD SWEDISH CHART OF ACCOUNTS (BAS-konton)
// ============================================================================

export const chartOfAccounts: Account[] = [
  // Tillgångar (1xxx)
  { number: '1510', name: 'Kundfordringar', type: 'ASSET', balance: 0, category: 'Kortfristiga fordringar' },
  { number: '1910', name: 'Kassa', type: 'ASSET', balance: 0, category: 'Kassa och bank' },
  { number: '1920', name: 'PlusGiro', type: 'ASSET', balance: 0, category: 'Kassa och bank' },
  { number: '1930', name: 'Företagskonto', type: 'ASSET', balance: 0, category: 'Kassa och bank' },
  { number: '1220', name: 'Inventarier och verktyg', type: 'ASSET', balance: 0, category: 'Anläggningstillgångar' },
  // Skulder (2xxx)
  { number: '2440', name: 'Leverantörsskulder', type: 'LIABILITY', balance: 0, category: 'Kortfristiga skulder' },
  { number: '2510', name: 'Skatteskulder', type: 'LIABILITY', balance: 0, category: 'Kortfristiga skulder' },
  { number: '2640', name: 'Ingående moms', type: 'LIABILITY', balance: 0, category: 'Moms' },
  { number: '2650', name: 'Utgående moms', type: 'LIABILITY', balance: 0, category: 'Moms' },
  { number: '2710', name: 'Personalens källskatt', type: 'LIABILITY', balance: 0, category: 'Personalrelaterade skulder' },
  // Intäkter (3xxx)
  { number: '3010', name: 'Försäljning varor', type: 'REVENUE', balance: 0, category: 'Försäljning' },
  { number: '3040', name: 'Försäljning tjänster', type: 'REVENUE', balance: 0, category: 'Försäljning' },
  // Kostnader (4xxx-7xxx)
  { number: '4010', name: 'Inköp varor', type: 'EXPENSE', balance: 0, category: 'Varuinköp' },
  { number: '5010', name: 'Lokalhyra', type: 'EXPENSE', balance: 0, category: 'Lokalkostnader' },
  { number: '6110', name: 'Kontorsmaterial', type: 'EXPENSE', balance: 0, category: 'Övriga kostnader' },
  { number: '6211', name: 'Telefon', type: 'EXPENSE', balance: 0, category: 'Övriga kostnader' },
  { number: '6540', name: 'IT-tjänster', type: 'EXPENSE', balance: 0, category: 'Övriga kostnader' },
  { number: '7010', name: 'Löner till kollektivanställda', type: 'EXPENSE', balance: 0, category: 'Personal' },
  { number: '7210', name: 'Löner till tjänstemän', type: 'EXPENSE', balance: 0, category: 'Personal' },
  { number: '7510', name: 'Fastighetsskatt', type: 'EXPENSE', balance: 0, category: 'Skatter' },
];

// ============================================================================
// AI PROCESSING LOGS
// ============================================================================

export const mockAILogs: AIProcessingLog[] = [
  {
    id: 'log-1',
    documentId: 'doc-1',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    action: 'DOCUMENT_CLASSIFIED',
    details: 'Dokument identifierat som leverantörsfaktura från AWS. Extraherade fakturanummer, belopp och förfallodag.',
    confidence: 0.95,
    model: 'gpt-4-vision',
  },
  {
    id: 'log-2',
    documentId: 'doc-1',
    timestamp: new Date(Date.now() - 1.9 * 60 * 60 * 1000),
    action: 'BOOKING_SUGGESTED',
    details: 'Föreslagen kontering: Debet 6540 IT-tjänster, Kredit 2440 Leverantörsskulder. Moms 25% identifierad.',
    confidence: 0.95,
    model: 'gpt-4-turbo',
  },
  {
    id: 'log-3',
    documentId: 'doc-2',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    action: 'OCR_PROCESSED',
    details: 'OCR genomförd på kvittobild. Leverantör Staples identifierad. Totalbelopp 2808 SEK extraherat.',
    confidence: 0.88,
    model: 'gpt-4-vision',
  },
  {
    id: 'log-4',
    documentId: 'doc-5',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    action: 'NEEDS_REVIEW',
    details: 'Osäkerhet gällande momshantering på hyresfaktura. Markerad för manuell granskning.',
    confidence: 0.72,
    model: 'gpt-4-turbo',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getClientById(id: string): Client | undefined {
  return mockClients.find(c => c.id === id);
}

export function getDocumentsByClient(clientId: string): UploadedDocument[] {
  return mockDocuments.filter(d => d.clientId === clientId);
}

export function getPendingDocuments(): UploadedDocument[] {
  return mockDocuments.filter(d => d.status === 'PENDING' || d.status === 'PROCESSING');
}

export function getDocumentsNeedingReview(): UploadedDocument[] {
  return mockDocuments.filter(d => d.status === 'NEEDS_REVIEW');
}

export function getBookedDocuments(): UploadedDocument[] {
  return mockDocuments.filter(d => d.status === 'BOOKED');
}

export function getAILogsByDocument(documentId: string): AIProcessingLog[] {
  return mockAILogs.filter(l => l.documentId === documentId);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function getDocumentTypeLabel(type: DocumentType | undefined): string {
  const labels: Record<DocumentType, string> = {
    'INVOICE_INCOMING': 'Leverantörsfaktura',
    'INVOICE_OUTGOING': 'Kundfaktura',
    'RECEIPT': 'Kvitto',
    'BANK_STATEMENT': 'Kontoutdrag',
    'SALARY_SLIP': 'Lönespecifikation',
    'TAX_DOCUMENT': 'Skattedokument',
    'CONTRACT': 'Avtal',
    'ANNUAL_REPORT': 'Årsredovisning',
    'VAT_REPORT': 'Momsrapport',
    'OTHER': 'Övrigt',
  };
  return type ? labels[type] : 'Oklassificerat';
}

export function getStatusColor(status: UploadedDocument['status']): string {
  const colors: Record<UploadedDocument['status'], string> = {
    'PENDING': 'bg-gray-100 text-gray-700',
    'PROCESSING': 'bg-blue-100 text-blue-700',
    'CLASSIFIED': 'bg-purple-100 text-purple-700',
    'BOOKED': 'bg-green-100 text-green-700',
    'NEEDS_REVIEW': 'bg-amber-100 text-amber-700',
    'REJECTED': 'bg-red-100 text-red-700',
  };
  return colors[status];
}

export function getStatusLabel(status: UploadedDocument['status']): string {
  const labels: Record<UploadedDocument['status'], string> = {
    'PENDING': 'Väntar',
    'PROCESSING': 'Bearbetas',
    'CLASSIFIED': 'Klassificerat',
    'BOOKED': 'Bokfört',
    'NEEDS_REVIEW': 'Kräver granskning',
    'REJECTED': 'Avvisat',
  };
  return labels[status];
}

// Statistics
export function getClientStats(clientId: string) {
  const docs = getDocumentsByClient(clientId);
  return {
    total: docs.length,
    pending: docs.filter(d => d.status === 'PENDING').length,
    processing: docs.filter(d => d.status === 'PROCESSING').length,
    booked: docs.filter(d => d.status === 'BOOKED').length,
    needsReview: docs.filter(d => d.status === 'NEEDS_REVIEW').length,
    avgConfidence: docs.filter(d => d.confidence).reduce((acc, d) => acc + (d.confidence || 0), 0) / 
                   docs.filter(d => d.confidence).length || 0,
  };
}

export function getOverallStats() {
  return {
    totalClients: mockClients.length,
    activeClients: mockClients.filter(c => c.status === 'ACTIVE').length,
    totalDocuments: mockDocuments.length,
    pendingDocuments: getPendingDocuments().length,
    needsReview: getDocumentsNeedingReview().length,
    bookedDocuments: getBookedDocuments().length,
    avgConfidence: mockDocuments.filter(d => d.confidence).reduce((acc, d) => acc + (d.confidence || 0), 0) / 
                   mockDocuments.filter(d => d.confidence).length || 0,
  };
}

