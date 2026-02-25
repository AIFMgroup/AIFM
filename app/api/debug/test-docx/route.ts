import { NextRequest, NextResponse } from 'next/server';
import { DocxXmlEditor } from '@/lib/docx/docx-xml-editor';

/**
 * Debug endpoint: POST a .docx file, get back a modified .docx with a simple track change.
 * This bypasses SSE/base64 transport to isolate if the issue is in the XML editor or transport.
 *
 * Usage: POST /api/debug/test-docx with multipart form data containing a 'file' field.
 * Or: POST with JSON { "base64": "..." } containing the file as base64.
 */
export async function POST(request: NextRequest) {
  try {
    let buffer: Buffer;
    let fileName = 'test.docx';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
    } else {
      const body = await request.json();
      if (!body.base64) {
        return NextResponse.json({ error: 'No base64 provided' }, { status: 400 });
      }
      buffer = Buffer.from(body.base64, 'base64');
      fileName = body.fileName || 'test.docx';
    }

    console.log(`[Debug DOCX] Input: ${buffer.length} bytes, file: ${fileName}`);

    // Verify input is valid ZIP
    const JSZipLib = (await import('jszip')).default;
    const inputZip = await JSZipLib.loadAsync(buffer);
    const inputDocFile = inputZip.file('word/document.xml');
    if (!inputDocFile) {
      return NextResponse.json({ error: 'Not a valid DOCX (no word/document.xml)' }, { status: 400 });
    }

    // Load with our editor
    const editor = await DocxXmlEditor.load(buffer);
    const paragraphCount = editor.getParagraphCount();
    const paragraphTexts = editor.getParagraphTexts();

    console.log(`[Debug DOCX] Paragraphs: ${paragraphCount}`);
    paragraphTexts.slice(0, 5).forEach((t, i) => console.log(`  [${i}] ${t.slice(0, 80)}...`));

    // Apply a simple comment on the first non-empty paragraph
    const firstNonEmpty = paragraphTexts.findIndex(t => t.trim().length > 10);
    if (firstNonEmpty >= 0) {
      const targetText = paragraphTexts[firstNonEmpty].trim().slice(0, 30);
      editor.applyEdits({
        comments: [{
          paragraphIndex: firstNonEmpty,
          targetText,
          comment: 'Test comment from debug endpoint',
        }],
      });
      console.log(`[Debug DOCX] Applied comment on paragraph ${firstNonEmpty}: "${targetText}"`);
    }

    // Generate output
    const outputBuffer = await editor.toBuffer();
    console.log(`[Debug DOCX] Output: ${outputBuffer.length} bytes`);

    // Validate output
    const outputZip = await JSZipLib.loadAsync(outputBuffer);
    const outputDocFile = outputZip.file('word/document.xml');
    if (!outputDocFile) {
      return NextResponse.json({ error: 'Output validation failed: no word/document.xml' }, { status: 500 });
    }

    // Also test: return the ORIGINAL file unmodified to see if the issue is in transport
    // Toggle this by adding ?original=true to the URL
    const url = new URL(request.url);
    const returnOriginal = url.searchParams.get('original') === 'true';
    const finalBuffer = returnOriginal ? buffer : outputBuffer;
    const suffix = returnOriginal ? '_original' : '_reviewed';

    // Return as direct download
    return new NextResponse(finalBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName.replace('.docx', '')}${suffix}.docx"`,
        'Content-Length': String(finalBuffer.length),
      },
    });
  } catch (error) {
    console.error('[Debug DOCX] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
