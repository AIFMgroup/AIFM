/**
 * Document Classifier - DEMO MODE
 * Uses rule-based classification only (no AI)
 * Replace with OpenAI integration when going to production
 */

import { extractDocumentType, extractCategory, extractDates } from './document-parser';

export interface ClassificationResult {
  documentType: string | null;
  category: string | null;
  title: string | null;
  description: string | null;
  author: string | null;
  publishDate: Date | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  tags: string[];
  language: string;
  confidence: number;
}

/**
 * Classify document using rule-based analysis (DEMO MODE)
 * In production, this would use AI for more sophisticated classification
 */
export async function classifyDocument(
  fileName: string,
  text: string,
  metadata: any
): Promise<ClassificationResult> {
  // Use simple classification (no AI)
  return classifyDocumentSimple(fileName, text, metadata);
}

/**
 * Simple classification without AI
 */
export function classifyDocumentSimple(
  fileName: string,
  text: string,
  metadata: any
): ClassificationResult {
  const extractedType = extractDocumentType(fileName, text);
  const extractedCategory = extractCategory(text);
  const extractedDates = extractDates(text);

  // Generate tags based on content
  const tags: string[] = [];
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('compliance') || lowerText.includes('efterlevnad')) {
    tags.push('compliance');
  }
  if (lowerText.includes('risk')) {
    tags.push('risk');
  }
  if (lowerText.includes('fund') || lowerText.includes('fond')) {
    tags.push('fund');
  }
  if (lowerText.includes('kyc') || lowerText.includes('aml')) {
    tags.push('kyc');
  }
  if (lowerText.includes('report') || lowerText.includes('rapport')) {
    tags.push('report');
  }

  // Detect language
  const swedishWords = ['och', 'att', 'det', 'som', 'för', 'med'];
  const hasSwedish = swedishWords.some(word => lowerText.includes(` ${word} `));
  const language = hasSwedish ? 'sv' : 'en';

  // Generate description from first 200 chars
  const description = text.substring(0, 200).replace(/\s+/g, ' ').trim() + (text.length > 200 ? '...' : '');

  return {
    documentType: extractedType,
    category: extractedCategory,
    title: metadata?.title || fileName.replace(/\.[^/.]+$/, ''),
    description,
    author: metadata?.author || null,
    publishDate: extractedDates.publishDate || null,
    effectiveDate: extractedDates.effectiveDate || null,
    expiryDate: extractedDates.expiryDate || null,
    tags: tags.slice(0, 5),
    language,
    confidence: 0.6, // Lower confidence for rule-based classification
  };
}
