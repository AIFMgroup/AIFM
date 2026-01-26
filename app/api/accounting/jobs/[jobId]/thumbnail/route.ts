/**
 * Document Thumbnail API
 * 
 * Returnerar en presigned URL till dokumentets miniatyrbild
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobStore, documentStore } from '@/lib/accounting/jobStore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = await jobStore.get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Jobb hittades inte' },
        { status: 404 }
      );
    }

    if (!job.s3Key) {
      return NextResponse.json(
        { error: 'Inget dokument associerat med jobbet' },
        { status: 404 }
      );
    }

    // Generera presigned URL för dokumentet
    // För bilder kan vi returnera originalet med resize-parametrar
    // För PDFs behöver vi en separat thumbnail-generering
    
    const fileType = job.fileType.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType);

    if (isImage) {
      // För bilder, returnera presigned URL direkt
      const url = await documentStore.getSignedUrl(job.s3Key, 300); // 5 min
      return NextResponse.json({ 
        url,
        type: 'image',
        fileType,
      });
    } else if (fileType === 'pdf') {
      // För PDFs, kolla om vi har genererat en thumbnail
      const thumbnailKey = job.s3Key.replace(/\.pdf$/i, '-thumb.jpg');
      
      try {
        // Försök hämta thumbnail
        const url = await documentStore.getSignedUrl(thumbnailKey, 300);
        return NextResponse.json({ 
          url,
          type: 'thumbnail',
          fileType: 'jpg',
        });
      } catch {
        // Ingen thumbnail finns, returnera placeholder-info
        return NextResponse.json({ 
          url: null,
          type: 'pdf',
          fileType: 'pdf',
          placeholder: true,
        });
      }
    }

    // Fallback för andra filtyper
    return NextResponse.json({ 
      url: null,
      type: 'other',
      fileType,
      placeholder: true,
    });

  } catch (error) {
    console.error('[Thumbnail API] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta miniatyrbild' },
      { status: 500 }
    );
  }
}

