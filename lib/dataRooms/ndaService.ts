/**
 * NDA (Non-Disclosure Agreement) Service
 * Manages NDA templates, signatures, and access control
 */

import crypto from 'crypto';

// Types
export interface NdaTemplate {
  id: string;
  roomId: string;
  name: string;
  version: string;
  content: string; // HTML content of the NDA
  contentPlainText: string; // Plain text version
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  
  // Configuration
  isActive: boolean;
  requireSignature: boolean; // Drawn signature
  requireInitials: boolean; // Initials on each page
  requireFullName: boolean;
  requireEmail: boolean;
  requireCompany: boolean;
  requireTitle: boolean;
  
  // Fields
  customFields?: NdaCustomField[];
}

export interface NdaCustomField {
  id: string;
  label: string;
  type: 'text' | 'checkbox' | 'select';
  required: boolean;
  options?: string[]; // For select type
}

export interface NdaSignature {
  id: string;
  templateId: string;
  templateVersion: string;
  roomId: string;
  
  // Signer info
  signerName: string;
  signerEmail: string;
  signerCompany?: string;
  signerTitle?: string;
  
  // Signature data
  signatureImage?: string; // Base64 encoded signature image
  initials?: string;
  signedAt: Date;
  
  // Verification
  ipAddress: string;
  userAgent: string;
  
  // Custom field values
  customFieldValues?: Record<string, string | boolean>;
  
  // Document hash for integrity
  documentHash: string;
  signatureHash: string;
  
  // Status
  status: 'valid' | 'revoked' | 'expired';
  revokedAt?: Date;
  revokedReason?: string;
  expiresAt?: Date;
}

export interface NdaAccessGrant {
  id: string;
  signatureId: string;
  roomId: string;
  userEmail: string;
  
  // Access details
  grantedAt: Date;
  expiresAt?: Date;
  
  // Scope
  accessScope: 'full_room' | 'specific_documents' | 'specific_folders';
  allowedDocumentIds?: string[];
  allowedFolderIds?: string[];
  
  // Status
  isActive: boolean;
  revokedAt?: Date;
}

export interface SignNdaParams {
  templateId: string;
  roomId: string;
  
  // Signer info
  signerName: string;
  signerEmail: string;
  signerCompany?: string;
  signerTitle?: string;
  
  // Signature
  signatureImage?: string;
  initials?: string;
  
  // Context
  ipAddress: string;
  userAgent: string;
  
  // Custom fields
  customFieldValues?: Record<string, string | boolean>;
  
  // Access options
  accessScope?: 'full_room' | 'specific_documents' | 'specific_folders';
  accessExpiresIn?: number; // Days
}

export interface NdaVerificationResult {
  valid: boolean;
  signature?: NdaSignature;
  accessGrant?: NdaAccessGrant;
  template?: NdaTemplate;
  error?: 'no_signature' | 'expired' | 'revoked' | 'template_outdated' | 'access_denied';
}

// Default NDA template
const DEFAULT_NDA_TEMPLATE = `
<div class="nda-document">
  <h1>Sekretessavtal (NDA)</h1>
  
  <p class="intro">
    Detta sekretessavtal ("Avtalet") ingås mellan den undertecknande parten ("Mottagaren") 
    och AIFM AB ("Bolaget") avseende tillgång till konfidentiell information i datarummet.
  </p>
  
  <h2>1. Definitioner</h2>
  <p>
    "Konfidentiell Information" avser all icke-offentlig information, oavsett form, 
    som Mottagaren erhåller tillgång till genom datarummet, inklusive men inte begränsat till:
  </p>
  <ul>
    <li>Finansiell information och rapporter</li>
    <li>Affärsplaner och strategier</li>
    <li>Kunddata och kundinformation</li>
    <li>Teknisk information och knowhow</li>
    <li>Avtal och juridiska dokument</li>
  </ul>
  
  <h2>2. Åtaganden</h2>
  <p>Mottagaren åtar sig att:</p>
  <ul>
    <li>Behandla all Konfidentiell Information strikt konfidentiellt</li>
    <li>Inte avslöja Konfidentiell Information för tredje part utan skriftligt samtycke</li>
    <li>Endast använda Konfidentiell Information för det avsedda ändamålet</li>
    <li>Vidta lämpliga säkerhetsåtgärder för att skydda Konfidentiell Information</li>
    <li>Omedelbart meddela Bolaget vid misstänkt eller faktisk obehörig användning</li>
  </ul>
  
  <h2>3. Undantag</h2>
  <p>Sekretessåtagandet gäller inte information som:</p>
  <ul>
    <li>Är eller blir allmänt känd utan brott mot detta Avtal</li>
    <li>Mottagaren redan hade tillgång till innan mottagandet</li>
    <li>Mottagaren erhåller från tredje part utan sekretessåtagande</li>
    <li>Måste lämnas ut enligt lag eller domstolsbeslut</li>
  </ul>
  
  <h2>4. Giltighetstid</h2>
  <p>
    Detta Avtal gäller från undertecknandet och sekretessåtagandet kvarstår i tre (3) år 
    efter det att tillgången till datarummet upphör.
  </p>
  
  <h2>5. Ansvar</h2>
  <p>
    Vid brott mot detta Avtal kan Mottagaren bli skadeståndsskyldig för den skada 
    som Bolaget lider. Bolaget har rätt att omedelbart återkalla Mottagarens tillgång 
    till datarummet vid misstanke om brott mot Avtalet.
  </p>
  
  <h2>6. Lagval och tvister</h2>
  <p>
    Svensk lag ska tillämpas på detta Avtal. Tvister ska avgöras av svensk allmän domstol.
  </p>
  
  <div class="signature-section">
    <h3>Undertecknande</h3>
    <p>
      Genom att underteckna detta avtal bekräftar jag att jag har läst, förstått och 
      accepterar villkoren ovan.
    </p>
  </div>
</div>
`;

/**
 * Generate document hash for integrity verification
 */
function generateDocumentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate signature hash
 */
function generateSignatureHash(params: {
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  documentHash: string;
}): string {
  const data = `${params.signerName}|${params.signerEmail}|${params.signedAt.toISOString()}|${params.documentHash}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * NDA Service class
 */
class NdaService {
  private templates: Map<string, NdaTemplate> = new Map();
  private signatures: Map<string, NdaSignature> = new Map();
  private accessGrants: Map<string, NdaAccessGrant> = new Map();
  private signaturesByEmail: Map<string, string[]> = new Map(); // email -> signature IDs
  
  constructor() {
    // Initialize with default template
    this.createDefaultTemplate('default-room');
  }
  
  /**
   * Create default template for a room
   */
  private createDefaultTemplate(roomId: string): NdaTemplate {
    const template: NdaTemplate = {
      id: `nda-template-${crypto.randomUUID()}`,
      roomId,
      name: 'Standard Sekretessavtal',
      version: '1.0',
      content: DEFAULT_NDA_TEMPLATE,
      contentPlainText: DEFAULT_NDA_TEMPLATE.replace(/<[^>]*>/g, ''),
      createdAt: new Date(),
      createdBy: 'System',
      updatedAt: new Date(),
      isActive: true,
      requireSignature: true,
      requireInitials: false,
      requireFullName: true,
      requireEmail: true,
      requireCompany: true,
      requireTitle: false,
    };
    
    this.templates.set(template.id, template);
    return template;
  }
  
  /**
   * Create a new NDA template
   */
  createTemplate(params: {
    roomId: string;
    name: string;
    content: string;
    createdBy: string;
    requireSignature?: boolean;
    requireInitials?: boolean;
    requireFullName?: boolean;
    requireEmail?: boolean;
    requireCompany?: boolean;
    requireTitle?: boolean;
    customFields?: NdaCustomField[];
  }): NdaTemplate {
    const template: NdaTemplate = {
      id: `nda-template-${crypto.randomUUID()}`,
      roomId: params.roomId,
      name: params.name,
      version: '1.0',
      content: params.content,
      contentPlainText: params.content.replace(/<[^>]*>/g, ''),
      createdAt: new Date(),
      createdBy: params.createdBy,
      updatedAt: new Date(),
      isActive: true,
      requireSignature: params.requireSignature ?? true,
      requireInitials: params.requireInitials ?? false,
      requireFullName: params.requireFullName ?? true,
      requireEmail: params.requireEmail ?? true,
      requireCompany: params.requireCompany ?? false,
      requireTitle: params.requireTitle ?? false,
      customFields: params.customFields,
    };
    
    this.templates.set(template.id, template);
    return template;
  }
  
  /**
   * Update an existing template (creates new version)
   */
  updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      content?: string;
      updatedBy: string;
      requireSignature?: boolean;
      requireInitials?: boolean;
      requireFullName?: boolean;
      requireEmail?: boolean;
      requireCompany?: boolean;
      requireTitle?: boolean;
      customFields?: NdaCustomField[];
    }
  ): NdaTemplate | null {
    const existing = this.templates.get(templateId);
    if (!existing) return null;
    
    // Increment version
    const versionParts = existing.version.split('.');
    const newVersion = `${versionParts[0]}.${parseInt(versionParts[1] || '0') + 1}`;
    
    const updated: NdaTemplate = {
      ...existing,
      name: updates.name ?? existing.name,
      content: updates.content ?? existing.content,
      contentPlainText: updates.content 
        ? updates.content.replace(/<[^>]*>/g, '') 
        : existing.contentPlainText,
      version: newVersion,
      updatedAt: new Date(),
      requireSignature: updates.requireSignature ?? existing.requireSignature,
      requireInitials: updates.requireInitials ?? existing.requireInitials,
      requireFullName: updates.requireFullName ?? existing.requireFullName,
      requireEmail: updates.requireEmail ?? existing.requireEmail,
      requireCompany: updates.requireCompany ?? existing.requireCompany,
      requireTitle: updates.requireTitle ?? existing.requireTitle,
      customFields: updates.customFields ?? existing.customFields,
    };
    
    this.templates.set(templateId, updated);
    return updated;
  }
  
  /**
   * Get template by ID
   */
  getTemplateById(templateId: string): NdaTemplate | null {
    return this.templates.get(templateId) || null;
  }
  
  /**
   * Get active template for a room
   */
  getActiveTemplateForRoom(roomId: string): NdaTemplate | null {
    for (const template of this.templates.values()) {
      if (template.roomId === roomId && template.isActive) {
        return template;
      }
    }
    // Create default if none exists
    return this.createDefaultTemplate(roomId);
  }
  
  /**
   * Get all templates for a room
   */
  getTemplatesByRoom(roomId: string): NdaTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.roomId === roomId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  /**
   * Sign an NDA
   */
  signNda(params: SignNdaParams): {
    signature: NdaSignature;
    accessGrant: NdaAccessGrant;
  } {
    const template = this.templates.get(params.templateId);
    if (!template) {
      throw new Error('Template not found');
    }
    
    const documentHash = generateDocumentHash(template.content);
    const signedAt = new Date();
    
    const signature: NdaSignature = {
      id: `nda-sig-${crypto.randomUUID()}`,
      templateId: params.templateId,
      templateVersion: template.version,
      roomId: params.roomId,
      signerName: params.signerName,
      signerEmail: params.signerEmail.toLowerCase(),
      signerCompany: params.signerCompany,
      signerTitle: params.signerTitle,
      signatureImage: params.signatureImage,
      initials: params.initials,
      signedAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      customFieldValues: params.customFieldValues,
      documentHash,
      signatureHash: generateSignatureHash({
        signerName: params.signerName,
        signerEmail: params.signerEmail,
        signedAt,
        documentHash,
      }),
      status: 'valid',
      expiresAt: params.accessExpiresIn 
        ? new Date(Date.now() + params.accessExpiresIn * 24 * 60 * 60 * 1000)
        : undefined,
    };
    
    this.signatures.set(signature.id, signature);
    
    // Update email index
    const emailSigs = this.signaturesByEmail.get(signature.signerEmail) || [];
    emailSigs.push(signature.id);
    this.signaturesByEmail.set(signature.signerEmail, emailSigs);
    
    // Create access grant
    const accessGrant: NdaAccessGrant = {
      id: `nda-access-${crypto.randomUUID()}`,
      signatureId: signature.id,
      roomId: params.roomId,
      userEmail: signature.signerEmail,
      grantedAt: new Date(),
      expiresAt: signature.expiresAt,
      accessScope: params.accessScope || 'full_room',
      isActive: true,
    };
    
    this.accessGrants.set(accessGrant.id, accessGrant);
    
    return { signature, accessGrant };
  }
  
  /**
   * Verify if a user has signed NDA for a room
   */
  verifyNdaAccess(roomId: string, userEmail: string): NdaVerificationResult {
    const email = userEmail.toLowerCase();
    const sigIds = this.signaturesByEmail.get(email) || [];
    
    // Find valid signature for this room
    for (const sigId of sigIds) {
      const signature = this.signatures.get(sigId);
      if (!signature || signature.roomId !== roomId) continue;
      
      // Check signature status
      if (signature.status === 'revoked') {
        return { valid: false, error: 'revoked', signature };
      }
      
      // Check expiration
      if (signature.expiresAt && new Date() > signature.expiresAt) {
        return { valid: false, error: 'expired', signature };
      }
      
      // Check if template has been updated
      const currentTemplate = this.getActiveTemplateForRoom(roomId);
      if (currentTemplate && currentTemplate.version !== signature.templateVersion) {
        // Template has been updated - may require re-signing
        // For now, we allow access but flag the outdated template
        return { 
          valid: true, 
          signature, 
          template: currentTemplate,
          error: 'template_outdated'
        };
      }
      
      // Find access grant
      const accessGrant = Array.from(this.accessGrants.values())
        .find(ag => ag.signatureId === signature.id && ag.isActive);
      
      if (!accessGrant) {
        return { valid: false, error: 'access_denied', signature };
      }
      
      if (accessGrant.expiresAt && new Date() > accessGrant.expiresAt) {
        return { valid: false, error: 'expired', signature, accessGrant };
      }
      
      return { 
        valid: true, 
        signature, 
        accessGrant,
        template: currentTemplate || undefined
      };
    }
    
    return { valid: false, error: 'no_signature' };
  }
  
  /**
   * Get signature by ID
   */
  getSignatureById(signatureId: string): NdaSignature | null {
    return this.signatures.get(signatureId) || null;
  }
  
  /**
   * Get all signatures for a room
   */
  getSignaturesByRoom(roomId: string): NdaSignature[] {
    return Array.from(this.signatures.values())
      .filter(s => s.roomId === roomId)
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());
  }
  
  /**
   * Get signatures by user email
   */
  getSignaturesByEmail(email: string): NdaSignature[] {
    const sigIds = this.signaturesByEmail.get(email.toLowerCase()) || [];
    return sigIds
      .map(id => this.signatures.get(id))
      .filter((s): s is NdaSignature => s !== undefined)
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());
  }
  
  /**
   * Revoke a signature
   */
  revokeSignature(signatureId: string, reason: string): boolean {
    const signature = this.signatures.get(signatureId);
    if (!signature) return false;
    
    signature.status = 'revoked';
    signature.revokedAt = new Date();
    signature.revokedReason = reason;
    
    this.signatures.set(signatureId, signature);
    
    // Revoke associated access grants
    for (const [id, grant] of this.accessGrants) {
      if (grant.signatureId === signatureId) {
        grant.isActive = false;
        grant.revokedAt = new Date();
        this.accessGrants.set(id, grant);
      }
    }
    
    return true;
  }
  
  /**
   * Generate PDF of signed NDA
   */
  generateSignedNdaPdf(signatureId: string): {
    filename: string;
    content: string;
  } | null {
    const signature = this.signatures.get(signatureId);
    if (!signature) return null;
    
    const template = this.templates.get(signature.templateId);
    if (!template) return null;
    
    // Generate HTML with signature info
    const signedContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Signerat Sekretessavtal - ${signature.signerName}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1 { color: #333; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          .signature-box { 
            border: 1px solid #ccc; 
            padding: 20px; 
            margin-top: 30px; 
            background: #f9f9f9; 
          }
          .signature-image { max-width: 300px; margin: 10px 0; }
          .verification { font-size: 10px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        ${template.content}
        
        <div class="signature-box">
          <h3>Undertecknare</h3>
          <p><strong>Namn:</strong> ${signature.signerName}</p>
          <p><strong>E-post:</strong> ${signature.signerEmail}</p>
          ${signature.signerCompany ? `<p><strong>Företag:</strong> ${signature.signerCompany}</p>` : ''}
          ${signature.signerTitle ? `<p><strong>Titel:</strong> ${signature.signerTitle}</p>` : ''}
          <p><strong>Signerat:</strong> ${signature.signedAt.toLocaleString('sv-SE')}</p>
          
          ${signature.signatureImage ? `
            <p><strong>Signatur:</strong></p>
            <img src="${signature.signatureImage}" class="signature-image" alt="Signatur" />
          ` : ''}
        </div>
        
        <div class="verification">
          <p><strong>Verifieringsinformation</strong></p>
          <p>Dokument-ID: ${signature.id}</p>
          <p>Signatur-hash: ${signature.signatureHash}</p>
          <p>Dokument-hash: ${signature.documentHash}</p>
          <p>IP-adress: ${signature.ipAddress}</p>
          <p>Tidsstämpel: ${signature.signedAt.toISOString()}</p>
        </div>
      </body>
      </html>
    `;
    
    return {
      filename: `NDA_${signature.signerName.replace(/\s+/g, '_')}_${signature.signedAt.toISOString().split('T')[0]}.html`,
      content: signedContent,
    };
  }
  
  /**
   * Get NDA statistics for a room
   */
  getRoomNdaStats(roomId: string): {
    totalSignatures: number;
    activeSignatures: number;
    expiredSignatures: number;
    revokedSignatures: number;
    recentSignatures: NdaSignature[];
  } {
    const signatures = this.getSignaturesByRoom(roomId);
    const now = new Date();
    
    return {
      totalSignatures: signatures.length,
      activeSignatures: signatures.filter(s => 
        s.status === 'valid' && (!s.expiresAt || s.expiresAt > now)
      ).length,
      expiredSignatures: signatures.filter(s => 
        s.expiresAt && s.expiresAt <= now
      ).length,
      revokedSignatures: signatures.filter(s => 
        s.status === 'revoked'
      ).length,
      recentSignatures: signatures.slice(0, 10),
    };
  }
}

export const ndaService = new NdaService();







