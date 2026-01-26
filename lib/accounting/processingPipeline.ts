/**
 * Document Processing Pipeline
 * Orchestrates: Upload → Duplicate Check → S3 → Textract → Multi-Agent AI → Auto-Approve → Ready
 * 
 * Steg:
 * 0. Duplikatkontroll
 * 1. Upload till S3
 * 2. Bildförbehandling (valfritt)
 * 3. OCR med Textract
 * 4. Multi-Agent AI (3 agenter)
 * 5. Förbättrad radextraktion
 * 6. Smart kontomappning
 * 7. Validering
 * 8. Leverantörsminne & Auto-approve regler
 * 9. Valuta & Periodisering
 */

import { jobStore, documentStore, AccountingJob, Classification, LineItem } from './jobStore';
import { analyzeExpense } from './textractService';
import { runMultiAgentPipeline, MultiAgentResult } from './agents';
import { 
  checkForDuplicate, 
  registerFingerprint, 
  calculateFileHash,
  DocumentFingerprint 
} from './services/duplicateDetector';
import { 
  suggestAccountFromHistory, 
  recordTransaction 
} from './services/supplierMemory';
import { 
  evaluateRules, 
  createDefaultRules,
  RuleEvaluationResult 
} from './services/autoApproveRules';

// Nya förbättrade tjänster
import { validateClassification, validateFortnoxMapping, autoCorrect } from './services/validationService';
import { findOrCreateSupplier } from './services/supplierSync';
import { calculateCompleteVat, VatCalculation } from './services/vatCalculator';
import { preprocessImage, analyzeImageQuality } from './services/imagePreprocessor';
import { predictAccount, learnFromApproval } from './services/smartAccountMapper';
import { convertCurrency, Currency, roundToOre } from './services/currencyService';
import { detectPeriodizationNeed, PeriodizationDetection } from './services/periodizationService';
import { extractLineItems, validateAndCorrectLines } from './services/lineItemExtractor';
import { applyFxConversionToClassification } from './services/fxConversion';

// Anomalidetektion, notifikationer och godkännandeflöde
import { detectAnomalies, AnomalyDetectionResult } from './services/anomalyDetector';
import { sendAnomalyNotification, sendBatchCompleteNotification } from './services/notificationService';
import { evaluateApprovalRules, createApprovalRequest } from './services/approvalWorkflow';
import { getSupplierProfile } from './services/supplierMemory';
import { auditLog } from './auditLogger';
import { evaluateAccountingPolicyForCompany } from './services/accountingPolicyEngine';
import { safeLog, logAudit } from '../logging';

// Multi-receipt separation
import { 
  analyzeAndSeparateReceipts, 
  createJobsForSeparatedReceipts,
  ReceiptDetectionResult 
} from './services/receiptSeparator';

/**
 * Process document with full automation pipeline
 */
async function processDocumentWithAutomation(
  jobId: string,
  companyId: string,
  fileBuffer: Buffer, 
  fileName: string, 
  contentType: string,
  fileType: string,
  fileHash: string
): Promise<void> {
  const now = () => new Date().toISOString();
  const processingMetrics: Record<string, number> = {};
  const startTime = Date.now();
  
  try {
    // Stage 1: Upload to S3
    await jobStore.update(jobId, { status: 'uploading', updatedAt: now() });
    
    const s3Key = await documentStore.upload(jobId, fileName, fileBuffer, contentType);
    await jobStore.update(jobId, { s3Key, status: 'scanning', updatedAt: now() });
    
    safeLog('info', `[Pipeline] ${jobId}: Uploaded to S3: ${s3Key}`);
    processingMetrics.upload = Date.now() - startTime;

    // Stage 2: Multi-receipt detection (för bilder)
    let processedS3Key = s3Key;
    if (isImageFile(fileType)) {
      try {
        const multiReceiptStart = Date.now();
        
        // Detektera om bilden innehåller flera kvitton
        const receiptAnalysis = await analyzeAndSeparateReceipts(s3Key, companyId);
        
        if (receiptAnalysis.needsSeparation && receiptAnalysis.separatedKeys.length > 1) {
          safeLog('info', `[Pipeline] ${jobId}: Detected ${receiptAnalysis.separatedKeys.length} receipts in image - creating separate jobs`);
          
          // Markera ursprungsjobbet som "split"
          await jobStore.update(jobId, { 
            status: 'split',
            splitInfo: {
              receiptCount: receiptAnalysis.separatedKeys.length,
              childJobIds: [],
              detection: receiptAnalysis.detection,
            },
            updatedAt: now() 
          });
          
          // Skapa nya jobb för varje separerat kvitto
          const childJobIds: string[] = [];
          for (let i = 0; i < receiptAnalysis.receipts.length; i++) {
            const receipt = receiptAnalysis.receipts[i];
            const receiptFileName = `${fileName.replace(/\.[^.]+$/, '')}_kvitto${i + 1}${fileName.match(/\.[^.]+$/)?.[0] || ''}`;
            
            // Skapa nytt jobb för detta kvitto
            const childJobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            await jobStore.set({
              id: childJobId,
              companyId,
              fileName: receiptFileName,
              fileType: fileType,
              fileSize: 0,
              s3Key: receipt.separatedImageKey,
              fileKey: receipt.separatedImageKey,
              status: 'queued',
              createdAt: now(),
              updatedAt: now(),
              metadata: {
                isFromMultiReceiptImage: true,
                parentJobId: jobId,
                receiptIndex: i,
                estimatedSupplier: receipt.boundingBox.estimatedSupplier,
                estimatedAmount: receipt.boundingBox.estimatedAmount,
                boundingBox: receipt.boundingBox,
              },
            });
            
            childJobIds.push(childJobId);
            console.log(`[Pipeline] ${jobId}: Created child job ${childJobId} for receipt ${i + 1}`);
          }
          
          // Uppdatera parent med child job IDs
          await jobStore.update(jobId, {
            splitInfo: {
              receiptCount: receiptAnalysis.separatedKeys.length,
              childJobIds,
              detection: receiptAnalysis.detection,
            },
          });
          
          // Starta processering av child jobs i bakgrunden
          for (const childJobId of childJobIds) {
            // Trigga processering av varje child job
            processChildJob(childJobId, companyId).catch(err => {
              console.error(`[Pipeline] Error processing child job ${childJobId}:`, err);
            });
          }
          
          processingMetrics.multiReceiptDetection = Date.now() - multiReceiptStart;
          
          // Avsluta parent job - children hanteras separat
          await jobStore.update(jobId, { 
            status: 'completed',
            message: `Bilden innehöll ${childJobIds.length} kvitton som nu processeras separat`,
            processingMetrics,
            updatedAt: now() 
          });
          
          return; // Avsluta parent job processing
        }
        
        processingMetrics.multiReceiptDetection = Date.now() - multiReceiptStart;
      } catch (multiReceiptError) {
        console.warn(`[Pipeline] ${jobId}: Multi-receipt detection failed, continuing with single:`, multiReceiptError);
      }
      
      // Stage 2b: Image preprocessing
      try {
        const preprocessStart = Date.now();
        const bucket = process.env.S3_BUCKET || 'aifm-accounting-docs';
        
        // Analysera bildkvalitet
        const quality = await analyzeImageQuality(fileBuffer);
        console.log(`[Pipeline] ${jobId}: Image quality: ${quality.quality} (${quality.score}/100)`);
        
        if (quality.quality !== 'excellent') {
          // Förbehandla bilden
          const preprocessed = await preprocessImage(bucket, s3Key, {
            autoRotate: true,
            enhanceContrast: true,
            removeNoise: quality.quality === 'poor',
          });
          
          if (preprocessed.success && preprocessed.processedKey) {
            processedS3Key = preprocessed.processedKey;
            console.log(`[Pipeline] ${jobId}: Preprocessed image: ${preprocessed.operations.join(', ')}`);
          }
        }
        processingMetrics.preprocessing = Date.now() - preprocessStart;
      } catch (preprocessError) {
        console.warn(`[Pipeline] ${jobId}: Preprocessing failed, using original:`, preprocessError);
      }
    }

    // Stage 3: OCR with Textract
    await jobStore.update(jobId, { status: 'ocr', updatedAt: now() });
    const ocrStart = Date.now();
    
    const textractResult = await analyzeExpense(processedS3Key);
    await jobStore.update(jobId, { ocrText: textractResult.rawText, status: 'analyzing', updatedAt: now() });
    
    console.log(`[Pipeline] ${jobId}: OCR complete, ${textractResult.rawText.length} chars`);
    processingMetrics.ocr = Date.now() - ocrStart;

    // Stage 4: Multi-Agent AI Processing
    const aiStart = Date.now();
    console.log(`[Pipeline] ${jobId}: Starting multi-agent processing...`);
    
    const multiAgentResult = await runMultiAgentPipeline(processedS3Key, textractResult.rawText, fileType);
    
    // Konvertera multi-agent resultat till Classification format
    let classification = convertToClassification(multiAgentResult);
    processingMetrics.aiProcessing = Date.now() - aiStart;
    
    // Logga agent-steg
    for (const step of multiAgentResult.agentSteps) {
      console.log(`[Pipeline] ${jobId}: Agent "${step.agent}" - ${step.status} (${step.duration}ms): ${step.message}`);
    }

    // Stage 5: Förbättrad radextraktion
    const lineExtractionStart = Date.now();
    try {
      const lineResult = await extractLineItems(
        textractResult.rawText, 
        classification.totalAmount,
        classification.currency
      );
      
      if (lineResult.success && lineResult.lineItems.length > 0) {
        // Uppdatera line items med bättre data
        const { corrected } = validateAndCorrectLines(lineResult.lineItems, classification.totalAmount);
        
        classification.lineItems = corrected.map((item, i) => ({
          id: `li-${jobId}-${i}`,
          description: item.description,
          netAmount: item.netAmount,
          vatAmount: item.vatAmount,
          suggestedAccount: item.suggestedAccount,
          suggestedCostCenter: null,
          confidence: item.confidence,
        }));
        
        console.log(`[Pipeline] ${jobId}: Extracted ${lineResult.lineItems.length} line items`);
      }
    } catch (lineError) {
      console.warn(`[Pipeline] ${jobId}: Line extraction failed:`, lineError);
    }
    processingMetrics.lineExtraction = Date.now() - lineExtractionStart;

    // Stage 6: Smart kontomappning
    const accountStart = Date.now();
    for (const lineItem of classification.lineItems) {
      const prediction = await predictAccount(companyId, {
        supplier: classification.supplier,
        description: lineItem.description,
        amount: lineItem.netAmount,
        date: classification.invoiceDate,
      });
      
      // Uppdatera om AI har högre confidence
      if (prediction.confidence > lineItem.confidence) {
        lineItem.suggestedAccount = prediction.account;
        lineItem.confidence = prediction.confidence;
        lineItem.suggestionSource = prediction.source;
        lineItem.suggestionReasoning = prediction.reasoning;
        lineItem.suggestionAlternatives = prediction.alternatives?.map(a => ({
          account: a.account,
          accountName: a.accountName,
          confidence: a.confidence,
          source: a.source,
        }));
        console.log(`[Pipeline] ${jobId}: Smart mapping → ${prediction.account} (${prediction.source}, ${(prediction.confidence * 100).toFixed(0)}%)`);
      }
    }
    processingMetrics.accountMapping = Date.now() - accountStart;

    // Stage 7: Leverantörsminne (legacy support)
    const supplierSuggestion = await suggestAccountFromHistory(companyId, classification.supplier);
    if (supplierSuggestion && classification.lineItems[0] && supplierSuggestion.confidence > classification.lineItems[0].confidence) {
      classification.lineItems[0].suggestedAccount = supplierSuggestion.account;
      classification.lineItems[0].confidence = supplierSuggestion.confidence;
      classification.lineItems[0].suggestionSource = 'supplier_history';
      classification.lineItems[0].suggestionReasoning = `Baserat på tidigare bokningar för ${classification.supplier}`;
    }

    // Stage 8: Bokföringspolicy (per kund) - guardrails & overrides
    const policyResult = await evaluateAccountingPolicyForCompany(companyId, classification);
    classification = policyResult.evaluation.classification;
    const policyBlocked = policyResult.evaluation.violations.some(v => v.severity === 'error') || policyResult.evaluation.reject;
    const policyRequiresApproval = policyResult.evaluation.requiresApproval;

    // Stage 9: Valutakonvertering (på riktigt)
    // - Use ONE deterministic rate-of-date
    // - Convert ALL amounts (total + line items) to SEK
    // - Store FX metadata for audit/replay
    if (classification.currency && classification.currency !== 'SEK') {
      const currencyStart = Date.now();
      try {
        const originalTotal = classification.totalAmount;
        const originalCurrency = classification.currency as Currency;

        const conversion = await convertCurrency(
          originalTotal,
          originalCurrency,
          'SEK',
          classification.invoiceDate
        );

        classification = applyFxConversionToClassification(classification, conversion);
        
        console.log(`[Pipeline] ${jobId}: FX ${originalCurrency} → SEK @ ${conversion.exchangeRate} (${conversion.rateDate}, ${conversion.rateSource})`);
      } catch (currencyError) {
        console.warn(`[Pipeline] ${jobId}: Currency conversion failed:`, currencyError);
      }
      processingMetrics.currency = Date.now() - currencyStart;
    }

    // Stage 10: Periodiseringskontroll
    const periodizationStart = Date.now();
    const periodizationNeed = detectPeriodizationNeed(
      classification.lineItems[0]?.description || '',
      classification.totalAmount,
      classification.invoiceDate,
      classification.dueDate,
      classification.supplier
    );
    
    if (periodizationNeed.shouldPeriodize) {
      (classification as any).periodization = {
        detected: true,
        type: periodizationNeed.type,
        account: periodizationNeed.periodizationAccount,
        period: periodizationNeed.suggestedPeriod,
        confidence: periodizationNeed.confidence,
      };
      console.log(`[Pipeline] ${jobId}: Periodization detected (${periodizationNeed.reason})`);
    }
    processingMetrics.periodization = Date.now() - periodizationStart;

    // Stage 11: Validering
    const validationStart = Date.now();
    const validation = validateClassification(classification);
    
    if (!validation.isValid) {
      console.warn(`[Pipeline] ${jobId}: Validation errors:`, validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.log(`[Pipeline] ${jobId}: Validation warnings:`, validation.warnings.map(w => w.message));
    }
    processingMetrics.validation = Date.now() - validationStart;

    // Stage 11: Duplikatkontroll med full data
    const duplicateCheck = await checkForDuplicate({
      companyId,
      supplier: classification.supplier,
      invoiceNumber: classification.invoiceNumber,
      totalAmount: classification.totalAmount,
      invoiceDate: classification.invoiceDate,
      fileHash,
    });
    
    if (duplicateCheck.isDuplicate) {
      console.log(`[Pipeline] ${jobId}: DUPLICATE DETECTED - ${duplicateCheck.reason}`);
      await jobStore.update(jobId, { 
        status: 'error',
        error: `Duplikat: ${duplicateCheck.reason}`,
        updatedAt: now() 
      });
      return;
    }
    
    // Registrera fingerprint för framtida duplikatkontroll
    await registerFingerprint(jobId, {
      companyId,
      supplier: classification.supplier,
      invoiceNumber: classification.invoiceNumber,
      totalAmount: classification.totalAmount,
      invoiceDate: classification.invoiceDate,
      fileHash,
    });

    // Stage 12: Anomalidetektion
    const anomalyStart = Date.now();
    const isNewSupplier = !await getSupplierProfile(companyId, classification.supplier);
    const anomalyResult = await detectAnomalies(companyId, {
      id: jobId,
      classification: {
        docType: classification.docType,
        supplier: classification.supplier,
        totalAmount: classification.totalAmount,
        vatAmount: classification.vatAmount,
        invoiceDate: classification.invoiceDate,
        dueDate: classification.dueDate,
        invoiceNumber: classification.invoiceNumber,
        overallConfidence: classification.overallConfidence,
        lineItems: classification.lineItems,
      },
      createdAt: now(),
    });
    processingMetrics.anomalyDetection = Date.now() - anomalyStart;
    
    if (anomalyResult.hasAnomalies) {
      console.log(`[Pipeline] ${jobId}: Anomalies detected (${anomalyResult.anomalyCount}): Risk score ${anomalyResult.riskScore}`);
      (classification as any).anomalies = {
        detected: true,
        count: anomalyResult.anomalyCount,
        riskScore: anomalyResult.riskScore,
        highestSeverity: anomalyResult.highestSeverity,
        items: anomalyResult.anomalies.map(a => ({
          type: a.type,
          severity: a.severity,
          message: a.description,
        })),
      };
      
      // Skicka notifikation för allvarliga anomalier
      if (anomalyResult.highestSeverity === 'HIGH' || anomalyResult.highestSeverity === 'CRITICAL') {
        await sendAnomalyNotification(companyId, jobId, anomalyResult.anomalies.map(a => ({
          type: a.type,
          message: a.description,
          severity: a.severity,
        })));
      }
    }

    // Stage 13: Auto-approve regler
    const ruleResult = await evaluateRules(companyId, classification, classification.overallConfidence);
    console.log(`[Pipeline] ${jobId}: Auto-approve: ${ruleResult.summary}`);
    
    // Stage 14: Flernivågodkännande
    const approvalEval = await evaluateApprovalRules(
      companyId, 
      jobId, 
      classification, 
      anomalyResult,
      isNewSupplier
    );
    
    // Bestäm slutstatus baserat på validering, regler och godkännandeflöde
    let finalStatus: AccountingJob['status'] = 'ready';
    let requiresApproval = false;
    
    if (policyResult.evaluation.reject) {
      finalStatus = 'ready';
      requiresApproval = true;
      console.log(`[Pipeline] ${jobId}: Blocked by policy (reject): ${policyResult.evaluation.summary}`);
    } else if (policyBlocked) {
      finalStatus = 'ready';
      requiresApproval = true;
      console.log(`[Pipeline] ${jobId}: Blocked by policy: ${policyResult.evaluation.summary}`);
    } else if (policyRequiresApproval) {
      finalStatus = 'ready';
      requiresApproval = true;
      console.log(`[Pipeline] ${jobId}: Policy requires approval: ${policyResult.evaluation.summary}`);
      await createApprovalRequest(companyId, {
        id: jobId,
        classification: {
          supplier: classification.supplier,
          totalAmount: classification.totalAmount,
          invoiceNumber: classification.invoiceNumber,
        },
      }, 'system');
    } else if (!validation.isValid) {
      finalStatus = 'ready'; // Kräver manuell granskning
      console.log(`[Pipeline] ${jobId}: Validation failed, requires review`);
    } else if (anomalyResult.blockedAutoApprove) {
      finalStatus = 'ready';
      console.log(`[Pipeline] ${jobId}: Auto-approve blocked by anomalies (risk: ${anomalyResult.riskScore})`);
    } else if (approvalEval.requiresApproval) {
      finalStatus = 'ready';
      requiresApproval = true;
      console.log(`[Pipeline] ${jobId}: Requires ${approvalEval.requiredLevel} approval`);
      
      // Skapa godkännandebegäran
      await createApprovalRequest(companyId, {
        id: jobId,
        classification: {
          supplier: classification.supplier,
          totalAmount: classification.totalAmount,
          invoiceNumber: classification.invoiceNumber,
        },
      }, 'system');
    } else if (ruleResult.shouldAutoApprove && validation.warnings.length === 0) {
      finalStatus = 'approved';
      console.log(`[Pipeline] ${jobId}: AUTO-APPROVED by rules`);
    }
    
    // Stage 15: Automatisk leverantörshantering i Fortnox
    try {
      const supplierResult = await findOrCreateSupplier(
        companyId,
        classification.supplier,
        classification.invoiceNumber?.includes('-') ? undefined : undefined, // org.nr om tillgängligt
        {
          bankgiro: (classification as any).bankgiro,
          plusgiro: (classification as any).plusgiro,
        }
      );
      
      if (supplierResult.found) {
        (classification as any).fortnoxSupplierNumber = supplierResult.supplierNumber;
        console.log(`[Pipeline] ${jobId}: Fortnox supplier: ${supplierResult.supplierNumber} (${supplierResult.matchType})`);
      }
    } catch (supplierError) {
      console.warn(`[Pipeline] ${jobId}: Supplier sync failed:`, supplierError);
    }
    
    // Spara till DynamoDB
    await jobStore.update(jobId, { 
      classification, 
      status: finalStatus, 
      updatedAt: now() 
    });

    // Audit: store a compact "why" summary (no OCR text)
    try {
      const first = classification.lineItems?.[0];
      await auditLog.classificationCompleted(companyId, jobId, {
        docType: classification.docType,
        supplier: classification.supplier,
        totalAmount: classification.totalAmount,
        currency: classification.currency,
        confidence: classification.overallConfidence,
        policySummary: classification.policy?.summary,
        topSuggestion: first ? {
          account: first.suggestedAccount,
          costCenter: first.suggestedCostCenter,
          source: first.suggestionSource,
          confidence: first.confidence,
        } : undefined,
      });
    } catch (e) {
      // Never fail pipeline on audit issues
      console.warn('[Pipeline] Audit classificationCompleted failed:', e);
    }
    
    // Logga sammanfattning
    const totalTime = Date.now() - startTime;
    console.log(`[Pipeline] ${jobId}: Complete in ${totalTime}ms - ${classification.docType} - ${classification.supplier} - ${classification.totalAmount} SEK - Status: ${finalStatus}`);
    console.log(`[Pipeline] ${jobId}: Metrics:`, processingMetrics);

  } catch (error) {
    console.error(`[Pipeline] ${jobId}: Error:`, error);
    
    await jobStore.update(jobId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: now() 
    });
  }
}

/**
 * Kontrollera om filen är en bild
 */
function isImageFile(fileType: string): boolean {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];
  return imageTypes.includes(fileType.toLowerCase()) || 
         /\.(jpg|jpeg|png|webp|gif|tiff?)$/i.test(fileType);
}

/**
 * Process a child job (separated receipt from multi-receipt image)
 */
async function processChildJob(childJobId: string, companyId: string): Promise<void> {
  const now = () => new Date().toISOString();
  
  try {
    // Hämta child job info
    const childJob = await jobStore.get(childJobId);
    if (!childJob) {
      console.error(`[Pipeline] Child job ${childJobId} not found`);
      return;
    }
    
    // Hämta filen från S3
    const fileBuffer = await documentStore.getBuffer(childJob.fileKey || childJob.s3Key || '');
    if (!fileBuffer) {
      await jobStore.update(childJobId, { 
        status: 'error', 
        error: 'Could not download separated receipt image',
        updatedAt: now() 
      });
      return;
    }
    
    // Bestäm filtyp
    const fileType = childJob.fileName?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const fileHash = calculateFileHash(fileBuffer);
    
    // Kör full processing pipeline på det separerade kvittot
    await processDocumentWithAutomation(
      childJobId,
      companyId,
      fileBuffer,
      childJob.fileName || `receipt_${childJobId}`,
      fileType,
      fileType,
      fileHash
    );
    
    console.log(`[Pipeline] Child job ${childJobId} processing complete`);
    
  } catch (error) {
    console.error(`[Pipeline] Error processing child job ${childJobId}:`, error);
    await jobStore.update(childJobId, { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: now() 
    });
  }
}

/**
 * Legacy function for backwards compatibility
 */
export async function processDocument(
  jobId: string, 
  fileBuffer: Buffer, 
  fileName: string, 
  contentType: string,
  fileType: string
): Promise<void> {
  const fileHash = calculateFileHash(fileBuffer);
  const job = await jobStore.get(jobId);
  const companyId = job?.companyId || 'unknown';
  
  return processDocumentWithAutomation(jobId, companyId, fileBuffer, fileName, contentType, fileType, fileHash);
}

export interface ProcessingResult {
  jobId: string;
  status: 'queued' | 'duplicate_warning' | 'duplicate_blocked';
  duplicateInfo?: {
    existingJobId: string;
    existingJobDate: string;
    reason: string;
    confidence: 'exact' | 'likely' | 'possible';
  };
}

/**
 * Start processing a new document
 */
export async function startProcessing(
  companyId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  fileBuffer: Buffer,
  contentType: string
): Promise<ProcessingResult> {
  const jobId = jobStore.generateId();
  const now = new Date().toISOString();
  const fileHash = calculateFileHash(fileBuffer);
  
  // Stage 0: Duplikatkontroll (preliminär - innan fullständig analys)
  const preliminaryDuplicateCheck = await checkForDuplicate({
    companyId,
    supplier: '', // Vet inte än
    totalAmount: 0,
    invoiceDate: now.split('T')[0],
    fileHash,
  });
  
  if (preliminaryDuplicateCheck.isDuplicate && preliminaryDuplicateCheck.confidence === 'exact') {
    console.log(`[Pipeline] DUPLICATE BLOCKED: Same file already uploaded (${preliminaryDuplicateCheck.existingJobId})`);
    return {
      jobId,
      status: 'duplicate_blocked',
      duplicateInfo: {
        existingJobId: preliminaryDuplicateCheck.existingJobId!,
        existingJobDate: preliminaryDuplicateCheck.existingJobDate!,
        reason: preliminaryDuplicateCheck.reason!,
        confidence: preliminaryDuplicateCheck.confidence,
      },
    };
  }
  
  // Create initial job record
  const job: AccountingJob = {
    id: jobId,
    companyId,
    fileName,
    fileType,
    fileSize,
    fileHash, // Store for duplicate detection cleanup
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  };
  
  await jobStore.set(job);
  
  // Start processing (don't await - run in background)
  processDocumentWithAutomation(jobId, companyId, fileBuffer, fileName, contentType, fileType, fileHash).catch(err => {
    console.error(`[Pipeline] Background processing error for ${jobId}:`, err);
  });
  
  return {
    jobId,
    status: preliminaryDuplicateCheck.confidence === 'possible' ? 'duplicate_warning' : 'queued',
    duplicateInfo: preliminaryDuplicateCheck.confidence === 'possible' ? {
      existingJobId: preliminaryDuplicateCheck.existingJobId!,
      existingJobDate: preliminaryDuplicateCheck.existingJobDate!,
      reason: preliminaryDuplicateCheck.reason!,
      confidence: preliminaryDuplicateCheck.confidence,
    } : undefined,
  };
}

/**
 * Konverterar multi-agent resultat till Classification format
 * för backwards compatibility med befintlig UI
 */
function convertToClassification(result: MultiAgentResult): Classification {
  const { classification, extractedData, fortnoxMapping } = result;
  
  // Mappa DocumentType till Classification docType
  const docTypeMap: Record<string, Classification['docType']> = {
    'INVOICE': 'INVOICE',
    'RECEIPT': 'RECEIPT',
    'BANK_STATEMENT': 'BANK',
    'CREDIT_NOTE': 'CREDIT_NOTE',
    'REMINDER': 'INVOICE',
    'CONTRACT': 'OTHER',
    'OTHER': 'OTHER',
  };
  
  // Bygg line items från fortnox-mappningen, men försök ta moms per rad från extractor om möjligt
  const extractedLines = extractedData.lineItems || [];
  const lineItems: LineItem[] = fortnoxMapping.lineItemMappings.map((mapping, i) => {
    const extracted = extractedLines[i];
    const vatAmount = extracted?.vatAmount ?? 0;
    return {
    id: `li-${Date.now()}-${i}`,
    description: mapping.description,
    netAmount: mapping.amount,
      vatAmount,
    suggestedAccount: mapping.suggestedAccount.account,
    suggestedCostCenter: mapping.suggestedCostCenter || fortnoxMapping.suggestedCostCenter || null,
    confidence: mapping.suggestedAccount.confidence,
    };
  });
  
  // Fallback om inga line items
  if (lineItems.length === 0 && extractedData.totalAmount > 0) {
    const netAmount = extractedData.netAmount || Math.round(extractedData.totalAmount * 0.8);
    const vatAmount = extractedData.vatAmount || Math.round(extractedData.totalAmount * 0.2);
    
    lineItems.push({
      id: `li-${Date.now()}-0`,
      description: extractedData.rawTextSummary || 'Enligt underlag',
      netAmount,
      vatAmount,
      suggestedAccount: fortnoxMapping.lineItemMappings[0]?.suggestedAccount.account || '6550',
      suggestedCostCenter: fortnoxMapping.suggestedCostCenter || null,
      confidence: fortnoxMapping.overallConfidence,
    });
  }
  
  return {
    docType: docTypeMap[classification.documentType] || 'OTHER',
    supplier: extractedData.supplier,
    invoiceNumber: extractedData.documentNumber,
    invoiceDate: extractedData.documentDate,
    dueDate: extractedData.dueDate || addDays(extractedData.documentDate, 30),
    currency: extractedData.currency,
    totalAmount: extractedData.totalAmount,
    vatAmount: extractedData.vatAmount || 0,
    paymentReference: extractedData.paymentReference,
    supplierCountry: extractedData.supplierCountry,
    supplierVatId: extractedData.supplierVatId,
    lineItems,
    overallConfidence: fortnoxMapping.overallConfidence,
  };
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Delete a job and its associated S3 document
 */
export async function deleteJobAndDocument(jobId: string): Promise<boolean> {
  const job = await jobStore.get(jobId);
  
  if (!job) return false;
  
  // Delete S3 document if exists
  if (job.s3Key) {
    try {
      await documentStore.delete(job.s3Key);
    } catch (error) {
      console.error(`[Pipeline] Failed to delete S3 object: ${job.s3Key}`, error);
    }
  }
  
  // Remove duplicate detection fingerprint
  if (job.fileHash || job.classification) {
    try {
      const { removeFingerprint } = await import('./services/duplicateDetector');
      await removeFingerprint(
        job.companyId,
        job.fileHash || '',
        job.classification?.supplier,
        job.classification?.invoiceNumber
      );
      console.log(`[Pipeline] Removed fingerprint for job ${jobId}`);
    } catch (error) {
      console.error(`[Pipeline] Failed to remove fingerprint:`, error);
    }
  }
  
  // Delete DynamoDB record
  return await jobStore.delete(jobId);
}


