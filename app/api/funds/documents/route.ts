import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  getFundDocuments,
  getFundDocument,
  deleteFundDocument,
} from '@/lib/fund-documents/fund-document-store';

const region = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.FUND_DOCUMENTS_BUCKET || process.env.COMPLIANCE_S3_BUCKET || 'aifm-documents';
const s3 = new S3Client({ region });

/**
 * GET /api/funds/documents?fundId=xxx
 * List all documents for a fund.
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get('x-aifm-role') || 'customer';

  if (!['admin', 'forvaltare', 'operation', 'executive'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fundId = request.nextUrl.searchParams.get('fundId');
  if (!fundId) {
    return NextResponse.json(
      { error: 'fundId krävs' },
      { status: 400 },
    );
  }

  try {
    const docs = await getFundDocuments(fundId);
    const sanitized = docs.map(({ textContent, ...rest }) => rest);
    return NextResponse.json({ documents: sanitized });
  } catch (error) {
    console.error('[FundDoc] List failed:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta dokument' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/funds/documents?fundId=xxx&documentId=yyy
 * Delete a single document (S3 + DynamoDB).
 */
export async function DELETE(request: NextRequest) {
  const role = request.headers.get('x-aifm-role') || 'customer';

  if (role !== 'admin' && role !== 'forvaltare') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fundId = request.nextUrl.searchParams.get('fundId');
  const documentId = request.nextUrl.searchParams.get('documentId');

  if (!fundId || !documentId) {
    return NextResponse.json(
      { error: 'fundId och documentId krävs' },
      { status: 400 },
    );
  }

  try {
    const doc = await getFundDocument(fundId, documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Dokument ej funnet' }, { status: 404 });
    }

    if (doc.s3Key) {
      try {
        await s3.send(
          new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
        );
      } catch (err) {
        console.warn('[FundDoc] S3 delete failed (non-fatal):', err);
      }
    }

    await deleteFundDocument(fundId, documentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FundDoc] Delete failed:', error);
    return NextResponse.json(
      { error: 'Kunde inte ta bort dokument' },
      { status: 500 },
    );
  }
}
