import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBase } from '@/lib/compliance/knowledge-base';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';

const region = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.COMPLIANCE_S3_BUCKET || 'aifm-compliance-documents';

const s3Client = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

const textractClient = new TextractClient({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

/**
 * Extract text from PDF using AWS Textract
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const command = new DetectDocumentTextCommand({
    Document: {
      Bytes: buffer,
    },
  });

  const response = await textractClient.send(command);
  
  // Combine all detected text blocks
  const lines = response.Blocks
    ?.filter(block => block.BlockType === 'LINE')
    ?.map(block => block.Text)
    ?.filter(Boolean) || [];

  return lines.join('\n');
}

/**
 * Extract text from various document types
 */
async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  // For PDFs, use Textract
  if (mimeType === 'application/pdf') {
    return extractTextFromPDF(buffer);
  }
  
  // For Word documents (.docx), we'd need a library like mammoth
  // For now, return a placeholder
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword') {
    // In production, use mammoth or similar library
    return `[Word document: ${filename} - text extraction pending]`;
  }
  
  // For text files
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  
  throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * POST /api/compliance/documents/upload
 * Upload a PDF or Word document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const documentNumber = formData.get('documentNumber') as string | null;
    const authority = formData.get('authority') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const mimeType = file.type;

    // Upload original file to S3
    const s3Key = `documents/${Date.now()}-${filename}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
      },
    }));

    const s3Url = `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;

    // Extract text from document
    let content: string;
    try {
      content = await extractText(buffer, mimeType, filename);
    } catch (extractError) {
      console.error('Text extraction failed:', extractError);
      content = `[Failed to extract text from ${filename}]`;
    }

    // Determine source type
    const sourceType = mimeType === 'application/pdf' ? 'pdf' : 
                       mimeType.includes('word') ? 'docx' : 'text';

    // Add to knowledge base
    const document = await knowledgeBase.addDocument({
      title: title || filename.replace(/\.[^/.]+$/, ''),
      source: s3Url,
      sourceType,
      content,
      metadata: {
        documentNumber: documentNumber || undefined,
        authority: authority || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      document,
      s3Url,
      extractedTextLength: content.length,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
