/**
 * API: Swedbank Email Webhook
 * 
 * Tar emot inkommande emails via AWS SES och:
 * 1. Identifierar emails från Swedbank
 * 2. Extraherar PDF-bilagor
 * 3. Processar PDF:er automatiskt
 * 4. Lagrar resultaten och notifierar
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { processSwedBankPDF, saveProcessedReport } from '@/lib/integrations/bank/swedbank-pdf-processor';

// SES SNS notification format
interface SESNotification {
  Type: 'Notification';
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string; // JSON string containing SESMessage
  Timestamp: string;
}

interface SESMessage {
  notificationType: 'Received';
  mail: {
    timestamp: string;
    source: string;
    messageId: string;
    destination: string[];
    commonHeaders: {
      from: string[];
      to: string[];
      subject: string;
      date: string;
    };
  };
  receipt: {
    timestamp: string;
    processingTimeMillis: number;
    action: {
      type: 'S3';
      bucketName: string;
      objectKey: string;
    };
  };
}

// Godkända avsändare för Swedbank-rapporter
const SWEDBANK_ALLOWED_SENDERS = [
  '@swedbank.se',
  '@swedbank.com',
  'custody@swedbank.se',
  'reports@swedbank.se',
  'fondadmin@swedbank.se',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Hantera SNS subscription confirmation
    if (body.Type === 'SubscriptionConfirmation') {
      console.log('[SwedBank Webhook] SNS Subscription confirmation received');
      // Auto-confirm behöver göras via URL
      return NextResponse.json({ 
        message: 'Please confirm subscription via SubscribeURL',
        subscribeURL: body.SubscribeURL,
      });
    }
    
    // Hantera SES notification
    if (body.Type === 'Notification') {
      const notification = body as SESNotification;
      const sesMessage: SESMessage = JSON.parse(notification.Message);
      
      console.log('[SwedBank Webhook] Email received:', {
        from: sesMessage.mail.source,
        subject: sesMessage.mail.commonHeaders.subject,
        messageId: sesMessage.mail.messageId,
      });
      
      // Verifiera avsändare
      const fromAddress = sesMessage.mail.source.toLowerCase();
      const isSwedbank = SWEDBANK_ALLOWED_SENDERS.some(
        allowed => fromAddress.includes(allowed.toLowerCase())
      );
      
      if (!isSwedbank) {
        console.log('[SwedBank Webhook] Ignoring email from non-Swedbank sender:', fromAddress);
        return NextResponse.json({ 
          message: 'Email ignored - not from Swedbank',
          from: fromAddress,
        });
      }
      
      // Hämta email från S3 (SES sparar där)
      const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-north-1' });
      const bucket = sesMessage.receipt.action.bucketName;
      const key = sesMessage.receipt.action.objectKey;
      
      console.log('[SwedBank Webhook] Fetching email from S3:', { bucket, key });
      
      const emailResponse = await s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }));
      
      const emailContent = await emailResponse.Body?.transformToString() || '';
      
      // Extrahera PDF-bilagor från email (MIME parsing)
      const pdfAttachments = extractPDFAttachments(emailContent);
      
      if (pdfAttachments.length === 0) {
        console.log('[SwedBank Webhook] No PDF attachments found');
        return NextResponse.json({ 
          message: 'No PDF attachments found in email',
          subject: sesMessage.mail.commonHeaders.subject,
        });
      }
      
      console.log('[SwedBank Webhook] Found', pdfAttachments.length, 'PDF attachment(s)');
      
      // Processa varje PDF
      const results = [];
      for (const pdf of pdfAttachments) {
        console.log('[SwedBank Webhook] Processing PDF:', pdf.filename);
        
        const result = await processSwedBankPDF(pdf.data);
        
        if (result.success && result.report && result.excelBuffer) {
          // Spara processad rapport
          const saved = await saveProcessedReport(
            result.report,
            result.excelBuffer,
            process.env.DATA_BUCKET || 'aifm-data'
          );
          
          results.push({
            filename: pdf.filename,
            success: true,
            reportDate: result.report.reportDate,
            positions: result.report.positions.length,
            savedFiles: saved,
          });
          
          // TODO: Skicka notifikation om lyckad processing
          // await sendProcessingNotification(result.report);
        } else {
          results.push({
            filename: pdf.filename,
            success: false,
            errors: result.errors,
          });
        }
      }
      
      // Logga till audit
      await logEmailProcessing({
        messageId: sesMessage.mail.messageId,
        from: sesMessage.mail.source,
        subject: sesMessage.mail.commonHeaders.subject,
        timestamp: sesMessage.mail.timestamp,
        attachments: pdfAttachments.length,
        results,
      });
      
      return NextResponse.json({
        message: 'Email processed',
        results,
      });
    }
    
    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
    
  } catch (error) {
    console.error('[SwedBank Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Extraherar PDF-bilagor från en MIME-formaterad email
 */
function extractPDFAttachments(emailContent: string): { filename: string; data: Buffer }[] {
  const attachments: { filename: string; data: Buffer }[] = [];
  
  // Hitta boundary
  const boundaryMatch = emailContent.match(/boundary="?([^"\r\n]+)"?/i);
  if (!boundaryMatch) {
    // Försök direkt base64-extraktion för enklare format
    return attachments;
  }
  
  const boundary = boundaryMatch[1];
  const parts = emailContent.split(`--${boundary}`);
  
  for (const part of parts) {
    // Kolla om denna del är en PDF
    if (!part.includes('application/pdf') && !part.includes('.pdf')) {
      continue;
    }
    
    // Extrahera filnamn
    const filenameMatch = part.match(/filename="?([^"\r\n]+\.pdf)"?/i);
    const filename = filenameMatch ? filenameMatch[1] : `attachment-${Date.now()}.pdf`;
    
    // Extrahera base64-innehåll
    const contentMatch = part.match(/Content-Transfer-Encoding:\s*base64[\r\n]+([A-Za-z0-9+/=\r\n]+)/i);
    if (contentMatch) {
      const base64Data = contentMatch[1].replace(/[\r\n]/g, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Verifiera att det är en PDF
      if (buffer.slice(0, 4).toString() === '%PDF') {
        attachments.push({ filename, data: buffer });
      }
    }
  }
  
  return attachments;
}

/**
 * Loggar email-processing till audit
 */
async function logEmailProcessing(data: {
  messageId: string;
  from: string;
  subject: string;
  timestamp: string;
  attachments: number;
  results: unknown[];
}) {
  // Spara till S3 för audit trail
  try {
    const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-north-1' });
    const key = `swedbank/audit/${new Date().toISOString().split('T')[0]}/${data.messageId}.json`;
    
    await s3.send(new PutObjectCommand({
      Bucket: process.env.DATA_BUCKET || 'aifm-data',
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    }));
  } catch (error) {
    console.error('[SwedBank Webhook] Failed to save audit log:', error);
  }
}

/**
 * GET: Visa webhook-status
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    description: 'Swedbank Email Webhook',
    usage: {
      method: 'POST',
      format: 'AWS SNS/SES notification',
      allowedSenders: SWEDBANK_ALLOWED_SENDERS,
    },
    setup: {
      step1: 'Configure SES to receive emails',
      step2: 'Set up S3 action to store raw emails',
      step3: 'Create SNS topic for notifications',
      step4: 'Subscribe this webhook to the SNS topic',
    },
  });
}
