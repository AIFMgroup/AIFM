import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';
import { startProcessing, ProcessingResult } from '@/lib/accounting/processingPipeline';
import { auditLog, createAuditContext } from '@/lib/accounting/auditLogger';

interface IngestResponse {
  jobId: string;
  status: string;
  message: string;
  duplicate?: {
    existingJobId: string;
    existingJobDate: string;
    reason: string;
    confidence: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Handle multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const companyId = formData.get('companyId') as string | null;

    if (!file || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, companyId' },
        { status: 400 }
      );
    }

    // Get file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const fileType = fileName.split('.').pop() || 'unknown';
    const fileSize = file.size;
    const contentType = file.type || 'application/octet-stream';

    // Start processing pipeline (now returns ProcessingResult)
    const result: ProcessingResult = await startProcessing(
      companyId,
      fileName,
      fileType,
      fileSize,
      fileBuffer,
      contentType
    );

    // Handle duplicate detection
    if (result.status === 'duplicate_blocked') {
      return NextResponse.json({
        jobId: result.jobId,
        status: 'duplicate_blocked',
        message: `Dokument blockerat: ${result.duplicateInfo?.reason}`,
        duplicate: result.duplicateInfo,
      }, { status: 409 }); // Conflict
    }

    const response: IngestResponse = {
      jobId: result.jobId,
      status: result.status,
      message: result.status === 'duplicate_warning' 
        ? `Varning: Möjlig duplikat. ${result.duplicateInfo?.reason}`
        : 'Document queued for processing',
      duplicate: result.duplicateInfo,
    };

    // Log audit event
    const auditContext = createAuditContext(request);
    await auditLog.documentUploaded(companyId, result.jobId, fileName, {
      ...auditContext,
      details: { 
        fileName, 
        fileSize, 
        fileType,
        isDuplicate: result.status === 'duplicate_warning',
      },
    });

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Get all jobs for a company
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    const jobs = await jobStore.getByCompany(companyId);

    return NextResponse.json({ jobs });

  } catch (error) {
    console.error('Get jobs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
