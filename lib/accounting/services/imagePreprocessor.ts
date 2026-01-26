/**
 * Image Preprocessor Service
 * 
 * Förbehandlar bilder innan OCR för att förbättra resultat.
 * Inkluderar rotation, deskew, kontrast och brusreducering.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createRequire } from 'module';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const s3Client = new S3Client({ region: REGION });

export interface PreprocessingOptions {
  autoRotate?: boolean;
  deskew?: boolean;
  enhanceContrast?: boolean;
  removeNoise?: boolean;
  cropWhitespace?: boolean;
  targetDPI?: number;
  outputFormat?: 'png' | 'jpeg' | 'webp';
}

export interface PreprocessingResult {
  success: boolean;
  processedKey?: string;
  originalSize: number;
  processedSize?: number;
  operations: string[];
  errors?: string[];
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  orientation?: number;
  dpi?: number;
}

/**
 * Förbehandla en bild från S3
 */
export async function preprocessImage(
  bucket: string,
  key: string,
  options: PreprocessingOptions = {}
): Promise<PreprocessingResult> {
  const operations: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Hämta originalbilden från S3
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(getCommand);
    
    if (!response.Body) {
      return { success: false, originalSize: 0, operations: [], errors: ['No image data'] };
    }

    const originalBuffer = await streamToBuffer(response.Body);
    const originalSize = originalBuffer.length;

    // 2. Analysera bilden (använd sharp dynamiskt om installerat)
    let sharp;
    try {
      sharp = (await import('sharp')).default;
    } catch (e) {
      // Sharp inte installerat - returnera originalbilden
      console.warn('[ImagePreprocessor] sharp not installed, skipping preprocessing');
      return {
        success: true,
        processedKey: key,
        originalSize,
        processedSize: originalSize,
        operations: ['No preprocessing (sharp not available)'],
      };
    }

    let image = sharp(originalBuffer);
    const metadata = await image.metadata();

    // 3. Auto-rotera baserat på EXIF
    if (options.autoRotate !== false) {
      image = image.rotate(); // Använder EXIF-orientering
      operations.push('Auto-rotated based on EXIF');
    }

    // 4. Deskew (räta upp sneda skanningar) - grundläggande via normalize
    if (options.deskew) {
      // Sharp har inte inbyggd deskew, men vi kan använda affine transform
      // För nu använder vi normalise som hjälper lite
      image = image.normalise();
      operations.push('Applied normalisation (basic deskew)');
    }

    // 5. Förbättra kontrast
    if (options.enhanceContrast !== false) {
      image = image.modulate({
        brightness: 1.05,  // Lite ljusare
      }).sharpen({
        sigma: 0.5,  // Lite skärpa
      }).linear(1.2, -(128 * 0.2)); // Öka kontrast
      operations.push('Enhanced contrast');
    }

    // 6. Brusreducering
    if (options.removeNoise) {
      image = image.median(3); // Median filter tar bort salt-and-pepper brus
      operations.push('Applied noise reduction');
    }

    // 7. Beskär vita marginaler
    if (options.cropWhitespace) {
      image = image.trim({
        threshold: 40, // Känslighetströskel
      });
      operations.push('Cropped whitespace');
    }

    // 8. Konvertera till gråskala för OCR (bättre resultat)
    image = image.grayscale();
    operations.push('Converted to grayscale');

    // 9. Säkerställ minst 300 DPI för OCR
    const targetDPI = options.targetDPI || 300;
    if (metadata.density && metadata.density < targetDPI) {
      const scale = targetDPI / metadata.density;
      image = image.resize({
        width: Math.round((metadata.width || 1000) * scale),
        fit: 'inside',
        withoutEnlargement: false,
      });
      operations.push(`Upscaled to ${targetDPI} DPI`);
    }

    // 10. Spara till buffer
    const format = options.outputFormat || 'png';
    let outputBuffer: Buffer;
    
    if (format === 'png') {
      outputBuffer = await image.png({ compressionLevel: 6 }).toBuffer();
    } else if (format === 'jpeg') {
      outputBuffer = await image.jpeg({ quality: 95 }).toBuffer();
    } else {
      outputBuffer = await image.webp({ quality: 95 }).toBuffer();
    }

    // 11. Ladda upp förbehandlad bild till S3
    const processedKey = key.replace(/\.[^.]+$/, `-processed.${format}`);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: processedKey,
      Body: outputBuffer,
      ContentType: `image/${format}`,
      Metadata: {
        'original-key': key,
        'preprocessing-operations': operations.join(', '),
      },
    }));

    return {
      success: true,
      processedKey,
      originalSize,
      processedSize: outputBuffer.length,
      operations,
    };

  } catch (error) {
    console.error('[ImagePreprocessor] Error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    
    return {
      success: false,
      originalSize: 0,
      operations,
      errors,
    };
  }
}

/**
 * Extrahera PDF-sidor som bilder
 */
export async function extractPdfPages(
  bucket: string,
  key: string
): Promise<{ success: boolean; pageKeys: string[]; errors?: string[] }> {
  const errors: string[] = [];
  const pageKeys: string[] = [];

  try {
    // Hämta PDF från S3
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(getCommand);
    
    if (!response.Body) {
      return { success: false, pageKeys: [], errors: ['No PDF data'] };
    }

    const pdfBuffer = await streamToBuffer(response.Body);

    // Försök använda pdf-to-img (valfritt paket) - poppler krävs på servern
    let pdfToImages: ((buffer: Buffer, options?: { scale?: number }) => AsyncIterable<Buffer>) | undefined;
    try {
      // Avoid build-time resolution errors: load dynamically at runtime only if installed.
      const req = createRequire(import.meta.url);
      // Important: avoid a static string literal so bundlers don't try to resolve at build time.
      const modName = ['pdf', 'to', 'img'].join('-');
      const pdfModule = req(modName) as any;
      pdfToImages = pdfModule?.pdf;
    } catch (e) {
      console.warn('[ImagePreprocessor] pdf-to-img not available');
      // Fallback: returnera original-PDF:en som enda "sida"
      return {
        success: true,
        pageKeys: [key],
        errors: ['PDF extraction not available, using original'],
      };
    }

    // Konvertera PDF-sidor till bilder
    if (!pdfToImages) {
      return { success: false, pageKeys: [], errors: ['PDF extraction function not available'] };
    }
    
    let pageNumber = 0;
    const document = await pdfToImages(pdfBuffer, { scale: 2 }); // 2x scale för bättre kvalitet
    
    for await (const page of document) {
      pageNumber++;
      const pageKey = key.replace('.pdf', `-page-${pageNumber}.png`);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: pageKey,
        Body: page,
        ContentType: 'image/png',
        Metadata: {
          'original-pdf': key,
          'page-number': pageNumber.toString(),
        },
      }));
      
      pageKeys.push(pageKey);
    }

    return { success: true, pageKeys };

  } catch (error) {
    console.error('[ImagePreprocessor] PDF extraction error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { success: false, pageKeys, errors };
  }
}

/**
 * Analysera bildkvalitet och ge rekommendationer
 */
export async function analyzeImageQuality(
  buffer: Buffer
): Promise<{
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  score: number;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // Kontrollera upplösning
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    if (width < 500 || height < 500) {
      issues.push('Low resolution');
      recommendations.push('Use higher resolution image (minimum 1000x1000 pixels)');
      score -= 30;
    } else if (width < 1000 || height < 1000) {
      issues.push('Medium resolution');
      recommendations.push('Higher resolution would improve OCR accuracy');
      score -= 10;
    }

    // Kontrollera kontrast via standardavvikelse
    const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
    if (avgStdDev < 30) {
      issues.push('Low contrast');
      recommendations.push('Increase lighting or scan with higher contrast settings');
      score -= 20;
    }

    // Kontrollera om bilden är för mörk eller ljus
    const avgMean = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    if (avgMean < 50) {
      issues.push('Image too dark');
      recommendations.push('Use better lighting when capturing');
      score -= 15;
    } else if (avgMean > 220) {
      issues.push('Image too bright/washed out');
      recommendations.push('Reduce exposure or brightness');
      score -= 15;
    }

    // Kontrollera format
    if (metadata.format === 'jpeg' && (metadata as any).quality && (metadata as any).quality < 70) {
      issues.push('High JPEG compression');
      recommendations.push('Use PNG or higher quality JPEG');
      score -= 10;
    }

    // Bestäm övergripande kvalitet
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 90) quality = 'excellent';
    else if (score >= 70) quality = 'good';
    else if (score >= 50) quality = 'fair';
    else quality = 'poor';

    return { quality, score: Math.max(0, score), issues, recommendations };

  } catch (error) {
    console.error('[ImagePreprocessor] Quality analysis error:', error);
    return {
      quality: 'fair',
      score: 60,
      issues: ['Could not analyze image'],
      recommendations: ['Ensure image is valid and not corrupted'],
    };
  }
}

/**
 * Detektera och korrigera bildorientering
 */
export async function detectAndCorrectOrientation(
  buffer: Buffer
): Promise<{ corrected: Buffer; rotationApplied: number }> {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Rotera baserat på EXIF-orientering
    const corrected = await image.rotate().toBuffer();
    const rotationApplied = metadata.orientation ? (metadata.orientation - 1) * 90 : 0;

    return { corrected, rotationApplied };

  } catch (error) {
    console.error('[ImagePreprocessor] Orientation correction error:', error);
    return { corrected: buffer, rotationApplied: 0 };
  }
}

// ============ Hjälpfunktioner ============

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  
  // Handle different stream types
  if (stream.transformToByteArray) {
    // AWS SDK v3 stream
    return Buffer.from(await stream.transformToByteArray());
  }
  
  // Node.js readable stream
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  
  return Buffer.concat(chunks);
}

/**
 * Optimera bild för snabbare OCR utan kvalitetsförlust
 */
export async function optimizeForOCR(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    
    return await sharp(buffer)
      .grayscale()
      .normalise()
      .sharpen({ sigma: 0.5 })
      .png({ compressionLevel: 6 })
      .toBuffer();
      
  } catch (error) {
    console.error('[ImagePreprocessor] OCR optimization error:', error);
    return buffer; // Returnera original vid fel
  }
}

