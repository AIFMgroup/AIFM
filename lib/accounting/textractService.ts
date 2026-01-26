/**
 * AWS Textract Service for OCR
 * Note: Textract is NOT available in eu-north-1, so we use eu-west-1
 * Documents are sent as bytes since S3 bucket is in eu-north-1
 */

import { TextractClient, AnalyzeExpenseCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { documentStore } from './jobStore';

// Textract is NOT available in eu-north-1, using eu-west-1 instead
const TEXTRACT_REGION = 'eu-west-1';

const textractClient = new TextractClient({ region: TEXTRACT_REGION });

export interface TextractResult {
  rawText: string;
  expenses?: {
    vendorName?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    total?: number;
    tax?: number;
    currency?: string;
    lineItems: {
      description: string;
      amount: number;
    }[];
  };
}

/**
 * Analyze a document using Textract AnalyzeExpense (for invoices/receipts)
 * Uses bytes instead of S3 reference since Textract (eu-west-1) can't access S3 (eu-north-1) directly
 */
export async function analyzeExpense(s3Key: string): Promise<TextractResult> {
  try {
    // Fetch document from S3 (eu-north-1) and send bytes to Textract (eu-west-1)
    const documentBytes = await documentStore.getBuffer(s3Key);
    
    const response = await textractClient.send(new AnalyzeExpenseCommand({
      Document: {
        Bytes: documentBytes
      }
    }));

    const result: TextractResult = {
      rawText: '',
      expenses: {
        lineItems: [],
      }
    };

    // Extract summary fields
    for (const doc of response.ExpenseDocuments || []) {
      for (const field of doc.SummaryFields || []) {
        const type = field.Type?.Text?.toUpperCase();
        const value = field.ValueDetection?.Text;

        if (!type || !value) continue;

        switch (type) {
          case 'VENDOR_NAME':
            result.expenses!.vendorName = value;
            break;
          case 'INVOICE_RECEIPT_ID':
            result.expenses!.invoiceNumber = value;
            break;
          case 'INVOICE_RECEIPT_DATE':
            result.expenses!.invoiceDate = value;
            break;
          case 'DUE_DATE':
            result.expenses!.dueDate = value;
            break;
          case 'TOTAL':
            result.expenses!.total = parseAmount(value);
            break;
          case 'TAX':
            result.expenses!.tax = parseAmount(value);
            break;
        }
      }

      // Extract line items
      for (const lineItem of doc.LineItemGroups || []) {
        for (const item of lineItem.LineItems || []) {
          const lineItemData: { description: string; amount: number } = {
            description: '',
            amount: 0,
          };

          for (const field of item.LineItemExpenseFields || []) {
            const type = field.Type?.Text?.toUpperCase();
            const value = field.ValueDetection?.Text;

            if (!type || !value) continue;

            switch (type) {
              case 'ITEM':
              case 'PRODUCT_CODE':
                lineItemData.description = value;
                break;
              case 'PRICE':
              case 'UNIT_PRICE':
                lineItemData.amount = parseAmount(value);
                break;
            }
          }

          if (lineItemData.description || lineItemData.amount) {
            result.expenses!.lineItems.push(lineItemData);
          }
        }
      }
    }

    // Build raw text
    result.rawText = buildRawText(result.expenses);

    return result;

  } catch (error) {
    console.error('Textract AnalyzeExpense error:', error);
    
    // Fallback to basic text detection
    return analyzeDocument(s3Key);
  }
}

/**
 * Analyze a document using basic text detection (fallback)
 * Uses bytes instead of S3 reference since Textract (eu-west-1) can't access S3 (eu-north-1) directly
 */
export async function analyzeDocument(s3Key: string): Promise<TextractResult> {
  try {
    // Fetch document from S3 (eu-north-1) and send bytes to Textract (eu-west-1)
    const documentBytes = await documentStore.getBuffer(s3Key);
    
    const response = await textractClient.send(new AnalyzeDocumentCommand({
      Document: {
        Bytes: documentBytes
      },
      FeatureTypes: ['TABLES', 'FORMS']
    }));

    let rawText = '';
    
    for (const block of response.Blocks || []) {
      if (block.BlockType === 'LINE' && block.Text) {
        rawText += block.Text + '\n';
      }
    }

    return { rawText };

  } catch (error) {
    console.error('Textract AnalyzeDocument error:', error);
    throw error;
  }
}

// ============ Helpers ============

function parseAmount(value: string): number {
  // Remove currency symbols and spaces, handle Swedish format (1 234,56)
  const cleaned = value
    .replace(/[^\d,.\-]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}

function buildRawText(expenses?: TextractResult['expenses']): string {
  if (!expenses) return '';

  const lines: string[] = [];
  
  if (expenses.vendorName) lines.push(`Leverantör: ${expenses.vendorName}`);
  if (expenses.invoiceNumber) lines.push(`Fakturanummer: ${expenses.invoiceNumber}`);
  if (expenses.invoiceDate) lines.push(`Fakturadatum: ${expenses.invoiceDate}`);
  if (expenses.dueDate) lines.push(`Förfallodatum: ${expenses.dueDate}`);
  if (expenses.total) lines.push(`Totalt: ${expenses.total.toLocaleString('sv-SE')} ${expenses.currency || 'SEK'}`);
  if (expenses.tax) lines.push(`Moms: ${expenses.tax.toLocaleString('sv-SE')} ${expenses.currency || 'SEK'}`);
  
  if (expenses.lineItems.length > 0) {
    lines.push('');
    lines.push('Rader:');
    for (const item of expenses.lineItems) {
      lines.push(`- ${item.description}: ${item.amount.toLocaleString('sv-SE')}`);
    }
  }

  return lines.join('\n');
}


