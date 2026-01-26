/**
 * Watermark Service
 * Generates dynamic watermarks for documents with user info and timestamps
 */

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export interface WatermarkOptions {
  userName: string;
  userEmail: string;
  companyName?: string;
  accessTimestamp: Date;
  roomName?: string;
  documentId: string;
  opacity?: number;
  fontSize?: number;
  rotation?: number;
  pattern?: 'diagonal' | 'center' | 'footer' | 'grid';
}

export interface WatermarkInfo {
  id: string;
  documentId: string;
  appliedBy: string;
  appliedAt: Date;
  watermarkText: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Formats date for watermark display
 */
function formatWatermarkDate(date: Date): string {
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Generates watermark text with user info
 */
export function generateWatermarkText(options: WatermarkOptions): string {
  const lines = [
    `${options.userName}`,
    `${options.userEmail}`,
    formatWatermarkDate(options.accessTimestamp),
  ];
  
  if (options.companyName) {
    lines.splice(1, 0, options.companyName);
  }
  
  return lines.join(' | ');
}

/**
 * Generates a short hash for document tracking
 */
export function generateTrackingCode(options: WatermarkOptions): string {
  const data = `${options.userEmail}-${options.documentId}-${options.accessTimestamp.getTime()}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 8);
}

/**
 * Applies watermark to PDF document
 */
export async function applyPdfWatermark(
  pdfBytes: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const watermarkText = generateWatermarkText(options);
  const trackingCode = `REF: ${generateTrackingCode(options)}`;
  const fontSize = options.fontSize || 10;
  const opacity = options.opacity || 0.15;
  const pattern = options.pattern || 'diagonal';
  
  for (const page of pages) {
    const { width, height } = page.getSize();
    
    switch (pattern) {
      case 'diagonal':
        // Diagonal watermarks across the page
        for (let y = -height; y < height * 2; y += 150) {
          for (let x = -width; x < width * 2; x += 400) {
            page.drawText(watermarkText, {
              x: x,
              y: y,
              size: fontSize,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity,
              rotate: degrees(-45),
            });
          }
        }
        break;
        
      case 'center':
        // Large centered watermark
        const centerText = `KONFIDENTIELLT\n${watermarkText}`;
        page.drawText(centerText, {
          x: width / 2 - 200,
          y: height / 2,
          size: fontSize * 2,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: opacity * 1.5,
          rotate: degrees(-30),
        });
        break;
        
      case 'grid':
        // Grid pattern
        for (let y = 50; y < height - 50; y += 200) {
          for (let x = 50; x < width - 50; x += 250) {
            page.drawText(watermarkText, {
              x,
              y,
              size: fontSize * 0.8,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity: opacity * 0.8,
            });
          }
        }
        break;
        
      case 'footer':
      default:
        // Footer watermark on each page
        page.drawText(watermarkText, {
          x: 30,
          y: 20,
          size: fontSize * 0.9,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity: opacity * 2,
        });
        
        // Tracking code in corner
        page.drawText(trackingCode, {
          x: width - 100,
          y: 20,
          size: fontSize * 0.8,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity: opacity * 2,
        });
        break;
    }
  }
  
  return pdfDoc.save();
}

/**
 * Generates HTML watermark overlay for in-browser viewing
 */
export function generateHtmlWatermarkOverlay(options: WatermarkOptions): string {
  const watermarkText = generateWatermarkText(options);
  const trackingCode = generateTrackingCode(options);
  
  return `
    <style>
      .watermark-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
      }
      .watermark-text {
        position: absolute;
        color: rgba(128, 128, 128, 0.15);
        font-family: Arial, sans-serif;
        font-size: 14px;
        white-space: nowrap;
        transform: rotate(-45deg);
        user-select: none;
      }
      .watermark-footer {
        position: fixed;
        bottom: 10px;
        left: 10px;
        right: 10px;
        color: rgba(128, 128, 128, 0.3);
        font-family: Arial, sans-serif;
        font-size: 10px;
        text-align: center;
        pointer-events: none;
        z-index: 10000;
      }
    </style>
    <div class="watermark-overlay">
      ${Array.from({ length: 20 }, (_, i) => 
        Array.from({ length: 10 }, (_, j) => 
          `<span class="watermark-text" style="top: ${i * 150 - 100}px; left: ${j * 350 - 200}px;">${watermarkText}</span>`
        ).join('')
      ).join('')}
    </div>
    <div class="watermark-footer">
      ${watermarkText} | REF: ${trackingCode}
    </div>
  `;
}

/**
 * Generates image watermark (for image files)
 */
export interface ImageWatermarkConfig {
  text: string;
  trackingCode: string;
  fontSize: number;
  opacity: number;
  color: string;
  position: 'center' | 'corners' | 'diagonal';
}

export function getImageWatermarkConfig(options: WatermarkOptions): ImageWatermarkConfig {
  return {
    text: generateWatermarkText(options),
    trackingCode: generateTrackingCode(options),
    fontSize: options.fontSize || 16,
    opacity: options.opacity || 0.3,
    color: '#808080',
    position: 'diagonal',
  };
}

/**
 * Watermark Service class for managing watermarks
 */
class WatermarkService {
  private watermarkLog: Map<string, WatermarkInfo[]> = new Map();
  
  /**
   * Logs watermark application for audit trail
   */
  logWatermark(
    documentId: string,
    userName: string,
    watermarkText: string,
    ipAddress?: string,
    userAgent?: string
  ): WatermarkInfo {
    const info: WatermarkInfo = {
      id: `wm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      documentId,
      appliedBy: userName,
      appliedAt: new Date(),
      watermarkText,
      ipAddress,
      userAgent,
    };
    
    const logs = this.watermarkLog.get(documentId) || [];
    logs.push(info);
    this.watermarkLog.set(documentId, logs);
    
    return info;
  }
  
  /**
   * Gets watermark history for a document
   */
  getWatermarkHistory(documentId: string): WatermarkInfo[] {
    return this.watermarkLog.get(documentId) || [];
  }
  
  /**
   * Creates watermarked version of a document
   */
  async createWatermarkedDocument(
    originalBytes: Uint8Array,
    fileType: string,
    options: WatermarkOptions,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ bytes: Uint8Array; trackingCode: string }> {
    const trackingCode = generateTrackingCode(options);
    const watermarkText = generateWatermarkText(options);
    
    // Log the watermark application
    this.logWatermark(
      options.documentId,
      options.userName,
      watermarkText,
      ipAddress,
      userAgent
    );
    
    // Apply watermark based on file type
    if (fileType.includes('pdf')) {
      const watermarkedBytes = await applyPdfWatermark(originalBytes, options);
      return { bytes: watermarkedBytes, trackingCode };
    }
    
    // For non-PDF files, return original with tracking info
    // Image watermarking would require a separate image processing library
    return { bytes: originalBytes, trackingCode };
  }
  
  /**
   * Verifies if a tracking code is valid
   */
  verifyTrackingCode(trackingCode: string, documentId: string): WatermarkInfo | null {
    const logs = this.watermarkLog.get(documentId) || [];
    for (const log of logs) {
      const logTrackingCode = `REF: ${generateTrackingCode({
        userName: log.appliedBy,
        userEmail: log.appliedBy,
        accessTimestamp: log.appliedAt,
        documentId: log.documentId,
      })}`;
      if (logTrackingCode.includes(trackingCode)) {
        return log;
      }
    }
    return null;
  }
}

export const watermarkService = new WatermarkService();

