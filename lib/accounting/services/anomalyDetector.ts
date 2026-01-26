/**
 * Anomaly Detection Service
 * 
 * Identifierar ovanliga fakturor/kvitton som behöver extra granskning.
 * Flaggar avvikelser baserat på historik och mönster.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export type AnomalyType = 
  | 'HIGH_AMOUNT'           // Belopp betydligt högre än vanligt
  | 'LOW_AMOUNT'            // Belopp betydligt lägre än vanligt
  | 'NEW_SUPPLIER'          // Ny/okänd leverantör
  | 'UNUSUAL_ACCOUNT'       // Ovanligt konto för leverantören
  | 'UNUSUAL_VAT'           // Ovanlig momssats
  | 'WEEKEND_INVOICE'       // Faktura daterad helg
  | 'FUTURE_DATE'           // Framtida datum
  | 'OLD_INVOICE'           // Gammal faktura (>60 dagar)
  | 'ROUND_AMOUNT'          // Jämnt belopp (kan tyda på uppskattning)
  | 'DUPLICATE_AMOUNT'      // Samma belopp som annan faktura nyligen
  | 'UNUSUAL_TIME'          // Ovanlig tid (t.ex. mitt i natten)
  | 'SUSPICIOUS_SUPPLIER'   // Leverantör med varningsflagg
  | 'MISSING_DATA'          // Saknar viktig information
  | 'LOW_CONFIDENCE'        // Låg AI-säkerhet
  | 'RAPID_INVOICING';      // Flera fakturor från samma leverantör kort tid

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  details: Record<string, any>;
  suggestedAction: string;
}

export interface AnomalyReport {
  jobId: string;
  hasAnomalies: boolean;
  anomalyCount: number;
  highestSeverity: AnomalySeverity | null;
  anomalies: Anomaly[];
  riskScore: number; // 0-100
  recommendation: 'AUTO_APPROVE' | 'MANUAL_REVIEW' | 'ESCALATE' | 'REJECT';
  createdAt: string;
  blockedAutoApprove?: boolean;
}

// Type alias for backwards compatibility with processingPipeline
export type AnomalyDetectionResult = AnomalyReport;

interface SupplierHistory {
  totalInvoices: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  stdDeviation: number;
  typicalAccounts: string[];
  lastInvoiceDate: string;
  invoiceDates: string[];
}

interface DocumentContext {
  companyId: string;
  jobId: string;
  supplier: string;
  amount: number;
  vatAmount: number;
  vatRate: number;
  docType: string;
  invoiceDate: string;
  dueDate: string;
  invoiceNumber: string;
  suggestedAccount: string;
  confidence: number;
  createdAt: string;
  supplierHistory: SupplierHistory | null;
}

// ============ Anomaly Detectors ============

function detectHighAmount(ctx: DocumentContext): Anomaly | null {
  if (!ctx.supplierHistory || ctx.supplierHistory.totalInvoices < 3) return null;
  
  const avgAmount = ctx.supplierHistory.averageAmount;
  const threshold = avgAmount * 2; // 100% över snittet
  
  if (ctx.amount > threshold) {
    const percentOver = ((ctx.amount - avgAmount) / avgAmount) * 100;
    return {
      type: 'HIGH_AMOUNT',
      severity: percentOver > 200 ? 'HIGH' : 'MEDIUM',
      title: 'Ovanligt högt belopp',
      description: `Beloppet ${ctx.amount.toFixed(0)} kr är ${percentOver.toFixed(0)}% högre än genomsnittet (${avgAmount.toFixed(0)} kr) för ${ctx.supplier}`,
      details: {
        amount: ctx.amount,
        averageAmount: avgAmount,
        percentageOver: percentOver,
        historicalMax: ctx.supplierHistory.maxAmount,
      },
      suggestedAction: 'Verifiera beloppet mot fakturan och jämför med tidigare fakturor',
    };
  }
  return null;
}

function detectLowAmount(ctx: DocumentContext): Anomaly | null {
  if (!ctx.supplierHistory || ctx.supplierHistory.totalInvoices < 3) return null;
  
  const avgAmount = ctx.supplierHistory.averageAmount;
  const threshold = avgAmount * 0.3; // 70% under snittet
  
  if (ctx.amount < threshold && ctx.amount > 0) {
    const percentUnder = ((avgAmount - ctx.amount) / avgAmount) * 100;
    return {
      type: 'LOW_AMOUNT',
      severity: 'LOW',
      title: 'Ovanligt lågt belopp',
      description: `Beloppet ${ctx.amount.toFixed(0)} kr är ${percentUnder.toFixed(0)}% lägre än genomsnittet (${avgAmount.toFixed(0)} kr)`,
      details: {
        amount: ctx.amount,
        averageAmount: avgAmount,
        percentageUnder: percentUnder,
      },
      suggestedAction: 'Kontrollera att alla rader har extraherats korrekt',
    };
  }
  return null;
}

function detectNewSupplier(ctx: DocumentContext): Anomaly | null {
  if (!ctx.supplierHistory || ctx.supplierHistory.totalInvoices === 0) {
    return {
      type: 'NEW_SUPPLIER',
      severity: ctx.amount > 10000 ? 'MEDIUM' : 'LOW',
      title: 'Ny leverantör',
      description: `Första fakturan från "${ctx.supplier}"`,
      details: {
        supplier: ctx.supplier,
        amount: ctx.amount,
      },
      suggestedAction: 'Verifiera att leverantören är godkänd och korrekt registrerad',
    };
  }
  return null;
}

function detectUnusualAccount(ctx: DocumentContext): Anomaly | null {
  if (!ctx.supplierHistory || ctx.supplierHistory.typicalAccounts.length === 0) return null;
  
  if (!ctx.supplierHistory.typicalAccounts.includes(ctx.suggestedAccount)) {
    return {
      type: 'UNUSUAL_ACCOUNT',
      severity: 'LOW',
      title: 'Ovanligt konto',
      description: `Konto ${ctx.suggestedAccount} används normalt inte för ${ctx.supplier}`,
      details: {
        suggestedAccount: ctx.suggestedAccount,
        typicalAccounts: ctx.supplierHistory.typicalAccounts,
      },
      suggestedAction: 'Kontrollera att rätt konto har valts',
    };
  }
  return null;
}

function detectUnusualVAT(ctx: DocumentContext): Anomaly | null {
  const validVATRates = [0, 6, 12, 25]; // Svenska momssatser
  const tolerance = 0.5; // Tillåt små avrundningsfel
  
  const isValidRate = validVATRates.some(rate => 
    Math.abs(ctx.vatRate - rate) <= tolerance
  );
  
  if (!isValidRate && ctx.vatRate > 0) {
    return {
      type: 'UNUSUAL_VAT',
      severity: 'MEDIUM',
      title: 'Ovanlig momssats',
      description: `Momssatsen ${ctx.vatRate.toFixed(1)}% är inte en standard svensk momssats`,
      details: {
        vatRate: ctx.vatRate,
        vatAmount: ctx.vatAmount,
        validRates: validVATRates,
      },
      suggestedAction: 'Kontrollera momsen på fakturan - giltiga satser är 0%, 6%, 12% eller 25%',
    };
  }
  return null;
}

function detectWeekendInvoice(ctx: DocumentContext): Anomaly | null {
  if (!ctx.invoiceDate) return null;
  
  const date = new Date(ctx.invoiceDate);
  const dayOfWeek = date.getDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      type: 'WEEKEND_INVOICE',
      severity: 'LOW',
      title: 'Fakturadatum på helg',
      description: `Fakturan är daterad ${dayOfWeek === 0 ? 'söndag' : 'lördag'} (${ctx.invoiceDate})`,
      details: {
        invoiceDate: ctx.invoiceDate,
        dayOfWeek: dayOfWeek === 0 ? 'Söndag' : 'Lördag',
      },
      suggestedAction: 'Ovanligt men inte nödvändigtvis fel - verifiera vid behov',
    };
  }
  return null;
}

function detectFutureDate(ctx: DocumentContext): Anomaly | null {
  if (!ctx.invoiceDate) return null;
  
  const invoiceDate = new Date(ctx.invoiceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (invoiceDate > today) {
    const daysInFuture = Math.ceil((invoiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      type: 'FUTURE_DATE',
      severity: daysInFuture > 7 ? 'HIGH' : 'MEDIUM',
      title: 'Framtida fakturadatum',
      description: `Fakturadatum ${ctx.invoiceDate} är ${daysInFuture} dagar framåt i tiden`,
      details: {
        invoiceDate: ctx.invoiceDate,
        daysInFuture,
      },
      suggestedAction: 'Kontrollera att datumet är korrekt extraherat',
    };
  }
  return null;
}

function detectOldInvoice(ctx: DocumentContext): Anomaly | null {
  if (!ctx.invoiceDate) return null;
  
  const invoiceDate = new Date(ctx.invoiceDate);
  const today = new Date();
  const daysSinceInvoice = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceInvoice > 60) {
    return {
      type: 'OLD_INVOICE',
      severity: daysSinceInvoice > 180 ? 'HIGH' : 'MEDIUM',
      title: 'Gammal faktura',
      description: `Fakturan är ${daysSinceInvoice} dagar gammal (daterad ${ctx.invoiceDate})`,
      details: {
        invoiceDate: ctx.invoiceDate,
        daysSinceInvoice,
      },
      suggestedAction: 'Kontrollera om fakturan redan är bokförd eller betald',
    };
  }
  return null;
}

function detectRoundAmount(ctx: DocumentContext): Anomaly | null {
  // Jämna tusental över 5000 kr kan tyda på uppskattning
  if (ctx.amount >= 5000 && ctx.amount % 1000 === 0) {
    return {
      type: 'ROUND_AMOUNT',
      severity: 'LOW',
      title: 'Jämnt belopp',
      description: `Beloppet ${ctx.amount.toFixed(0)} kr är ett jämnt tusental`,
      details: {
        amount: ctx.amount,
      },
      suggestedAction: 'Jämna belopp kan vara korrekta men verifiera vid behov',
    };
  }
  return null;
}

function detectLowConfidence(ctx: DocumentContext): Anomaly | null {
  if (ctx.confidence < 0.7) {
    return {
      type: 'LOW_CONFIDENCE',
      severity: ctx.confidence < 0.5 ? 'HIGH' : 'MEDIUM',
      title: 'Låg AI-säkerhet',
      description: `AI:ns säkerhet är endast ${(ctx.confidence * 100).toFixed(0)}%`,
      details: {
        confidence: ctx.confidence,
      },
      suggestedAction: 'Granska dokumentet manuellt - AI var osäker på klassificeringen',
    };
  }
  return null;
}

function detectMissingData(ctx: DocumentContext): Anomaly | null {
  const missing: string[] = [];
  
  if (!ctx.supplier || ctx.supplier === 'Okänd') missing.push('leverantör');
  if (!ctx.amount || ctx.amount === 0) missing.push('belopp');
  if (!ctx.invoiceDate) missing.push('fakturadatum');
  if (ctx.docType === 'INVOICE' && !ctx.invoiceNumber) missing.push('fakturanummer');
  
  if (missing.length > 0) {
    return {
      type: 'MISSING_DATA',
      severity: missing.length > 2 ? 'HIGH' : 'MEDIUM',
      title: 'Saknar information',
      description: `Följande data saknas: ${missing.join(', ')}`,
      details: {
        missingFields: missing,
      },
      suggestedAction: 'Komplettera saknad information manuellt',
    };
  }
  return null;
}

function detectRapidInvoicing(ctx: DocumentContext): Anomaly | null {
  if (!ctx.supplierHistory || ctx.supplierHistory.invoiceDates.length < 2) return null;
  
  const recentDates = ctx.supplierHistory.invoiceDates
    .slice(-5)
    .map(d => new Date(d).getTime())
    .sort((a, b) => b - a);
  
  if (recentDates.length >= 2) {
    const daysBetween = (recentDates[0] - recentDates[1]) / (1000 * 60 * 60 * 24);
    
    if (daysBetween < 3) {
      return {
        type: 'RAPID_INVOICING',
        severity: 'LOW',
        title: 'Flera fakturor på kort tid',
        description: `Flera fakturor från ${ctx.supplier} inom ${daysBetween.toFixed(0)} dagar`,
        details: {
          daysBetween,
          recentInvoiceCount: recentDates.length,
        },
        suggestedAction: 'Kontrollera att det inte är dubbletter',
      };
    }
  }
  return null;
}

// ============ Main Detection Function ============

export async function detectAnomalies(
  companyId: string,
  job: {
    id: string;
    classification: {
      docType: string;
      supplier: string;
      totalAmount: number;
      vatAmount: number;
      invoiceDate: string;
      dueDate: string;
      invoiceNumber: string;
      overallConfidence: number;
      lineItems: { suggestedAccount: string }[];
    };
    createdAt: string;
  }
): Promise<AnomalyReport> {
  // Hämta leverantörshistorik
  const supplierHistory = await getSupplierHistory(companyId, job.classification.supplier);

  // Beräkna momssats
  const vatRate = job.classification.totalAmount > 0 
    ? (job.classification.vatAmount / (job.classification.totalAmount - job.classification.vatAmount)) * 100
    : 0;

  const ctx: DocumentContext = {
    companyId,
    jobId: job.id,
    supplier: job.classification.supplier,
    amount: job.classification.totalAmount,
    vatAmount: job.classification.vatAmount,
    vatRate,
    docType: job.classification.docType,
    invoiceDate: job.classification.invoiceDate,
    dueDate: job.classification.dueDate,
    invoiceNumber: job.classification.invoiceNumber,
    suggestedAccount: job.classification.lineItems[0]?.suggestedAccount || '',
    confidence: job.classification.overallConfidence,
    createdAt: job.createdAt,
    supplierHistory,
  };

  // Kör alla detektorer
  const detectors = [
    detectHighAmount,
    detectLowAmount,
    detectNewSupplier,
    detectUnusualAccount,
    detectUnusualVAT,
    detectWeekendInvoice,
    detectFutureDate,
    detectOldInvoice,
    detectRoundAmount,
    detectLowConfidence,
    detectMissingData,
    detectRapidInvoicing,
  ];

  const anomalies: Anomaly[] = [];
  for (const detector of detectors) {
    const anomaly = detector(ctx);
    if (anomaly) {
      anomalies.push(anomaly);
    }
  }

  // Beräkna riskpoäng
  const severityScores: Record<AnomalySeverity, number> = {
    LOW: 5,
    MEDIUM: 15,
    HIGH: 30,
    CRITICAL: 50,
  };

  const riskScore = Math.min(100, anomalies.reduce((sum, a) => sum + severityScores[a.severity], 0));

  // Bestäm högsta allvarlighetsgrad
  const severityOrder: AnomalySeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const highestSeverity = anomalies.length > 0
    ? severityOrder.find(s => anomalies.some(a => a.severity === s)) || null
    : null;

  // Bestäm rekommendation
  let recommendation: AnomalyReport['recommendation'] = 'AUTO_APPROVE';
  if (riskScore >= 60) {
    recommendation = 'ESCALATE';
  } else if (riskScore >= 30 || highestSeverity === 'HIGH') {
    recommendation = 'MANUAL_REVIEW';
  } else if (riskScore >= 10) {
    recommendation = 'MANUAL_REVIEW';
  }

  // Avgör om auto-approve ska blockeras
  const blockedAutoApprove = riskScore >= 30 || 
    highestSeverity === 'HIGH' || 
    highestSeverity === 'CRITICAL';

  const report: AnomalyReport = {
    jobId: job.id,
    hasAnomalies: anomalies.length > 0,
    anomalyCount: anomalies.length,
    highestSeverity,
    anomalies,
    riskScore,
    recommendation,
    blockedAutoApprove,
    createdAt: new Date().toISOString(),
  };

  // Spara rapporten
  await saveAnomalyReport(companyId, report);

  return report;
}

async function getSupplierHistory(companyId: string, supplier: string): Promise<SupplierHistory | null> {
  const normalizedSupplier = supplier.toLowerCase().replace(/[^a-zåäö0-9]/g, '');
  
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUPPLIER_STATS#${companyId}#${normalizedSupplier}`,
      },
      Limit: 1,
    }));

    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      return {
        totalInvoices: item.totalApprovals || 0,
        averageAmount: item.averageAmount || 0,
        minAmount: item.minAmount || 0,
        maxAmount: item.maxAmount || 0,
        stdDeviation: item.stdDeviation || 0,
        typicalAccounts: item.typicalAccounts || [],
        lastInvoiceDate: item.lastApprovalDate || '',
        invoiceDates: item.invoiceDates || [],
      };
    }
    return null;
  } catch (error) {
    console.error('[AnomalyDetector] Failed to get supplier history:', error);
    return null;
  }
}

async function saveAnomalyReport(companyId: string, report: AnomalyReport): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `ANOMALY#${companyId}`,
        sk: `${report.createdAt}#${report.jobId}`,
        ...report,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 dagar
      },
    }));
  } catch (error) {
    console.error('[AnomalyDetector] Failed to save report:', error);
  }
}

// ============ Get Recent Anomalies (for Dashboard) ============

export async function getRecentAnomalies(
  companyId: string,
  limit: number = 20
): Promise<AnomalyReport[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `ANOMALY#${companyId}`,
      },
      ScanIndexForward: false,
      Limit: limit,
    }));

    return (result.Items || []) as AnomalyReport[];
  } catch (error) {
    console.error('[AnomalyDetector] Failed to get recent anomalies:', error);
    return [];
  }
}
