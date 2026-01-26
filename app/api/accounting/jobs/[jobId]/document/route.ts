import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore, documentStore } from '@/lib/accounting/jobStore';

/**
 * GET /api/accounting/jobs/[jobId]/document
 * Get a signed URL to view the document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    // Get the job
    const job = await jobStore.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if job has an s3Key
    if (!job.s3Key) {
      return NextResponse.json({ error: 'No document associated with this job' }, { status: 404 });
    }

    // Generate a signed URL valid for 1 hour
    const signedUrl = await documentStore.getSignedUrl(job.s3Key, 3600);

    return NextResponse.json({
      url: signedUrl,
      fileName: job.fileName,
      fileType: job.fileType,
    });

  } catch (error) {
    console.error('Get document URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}




