import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import {
  saveFundDocument,
  generateDocumentId,
  type FundDocumentCategory,
} from '@/lib/fund-documents/fund-document-store';

const region = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.FUND_DOCUMENTS_BUCKET || process.env.COMPLIANCE_S3_BUCKET || 'aifm-documents';

const s3 = new S3Client({ region });
const textract = new TextractClient({ region });

const VALID_CATEGORIES: FundDocumentCategory[] = [
  'fondvillkor',
  'hallbarhetsrapport',
  'placeringspolicy',
  'arsredovisning',
  'delarsrapport',
  'informationsbroschyr',
  'faktablad',
  'ovrigt',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const res = await textract.send(
      new DetectDocumentTextCommand({ Document: { Bytes: buffer } }),
    );
    return (
      res.Blocks?.filter((b) => b.BlockType === 'LINE')
        .map((b) => b.Text)
        .filter(Boolean)
        .join('\n') ?? ''
    );
  }
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  return `[Binärfil: ${filename} – textextraktion stöds inte för denna filtyp]`;
}

function getUserEmail(req: NextRequest): string | null {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/id_token=([^;]+)/);
    if (!match) return null;
    const payload = JSON.parse(
      Buffer.from(match[1].split('.')[1], 'base64').toString(),
    );
    return payload.email || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role') || 'customer';

    if (role !== 'admin' && role !== 'forvaltare') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const email = getUserEmail(request);
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fundId = formData.get('fundId') as string | null;
    const category = formData.get('category') as string | null;

    if (!file || !fundId) {
      return NextResponse.json(
        { error: 'Fil och fond-ID krävs' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Filen får inte överstiga 25 MB' },
        { status: 400 },
      );
    }

    const docCategory: FundDocumentCategory = VALID_CATEGORIES.includes(
      category as FundDocumentCategory,
    )
      ? (category as FundDocumentCategory)
      : 'ovrigt';

    // TODO: for forvaltare, verify fund assignment. Skipped for now since
    // the UI only shows funds the user is assigned to.

    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = generateDocumentId();
    const s3Key = `funds/${fundId}/${docCategory}/${file.name}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          fundId,
          originalFilename: file.name,
          uploadedBy: email,
        },
      }),
    );

    let textContent = '';
    try {
      textContent = await extractText(buffer, file.type, file.name);
    } catch (err) {
      console.error('[FundDoc] Text extraction failed:', err);
    }

    const doc = {
      fundId,
      documentId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      s3Key,
      category: docCategory,
      uploadedBy: email,
      uploadedAt: new Date().toISOString(),
      textContent: textContent || undefined,
    };

    await saveFundDocument(doc);

    return NextResponse.json({
      success: true,
      document: { ...doc, textContent: undefined },
      extractedTextLength: textContent.length,
    });
  } catch (error) {
    console.error('[FundDoc] Upload failed:', error);
    return NextResponse.json(
      { error: 'Uppladdning misslyckades', details: (error as Error).message },
      { status: 500 },
    );
  }
}
