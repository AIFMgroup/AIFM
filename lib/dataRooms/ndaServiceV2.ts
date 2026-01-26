/**
 * NDA Service (Persistent, V2)
 * DynamoDB-backed so templates/signatures/access grants survive deploy/restart.
 */

import crypto from 'crypto';
import { getItem, putItem, queryPk, requirePersistenceOrFallback } from './persistence';

// Types (subset used by API)
export interface NdaTemplate {
  id: string;
  roomId: string;
  name: string;
  version: string;
  content: string;
  contentPlainText: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  isActive: boolean;
  requireSignature: boolean;
  requireInitials: boolean;
  requireFullName: boolean;
  requireEmail: boolean;
  requireCompany: boolean;
  requireTitle: boolean;
  customFields?: Array<{
    id: string;
    label: string;
    type: 'text' | 'checkbox' | 'select';
    required: boolean;
    options?: string[];
  }>;
}

export interface NdaSignature {
  id: string;
  templateId: string;
  templateVersion: string;
  roomId: string;
  signerName: string;
  signerEmail: string;
  signerCompany?: string;
  signerTitle?: string;
  signatureImage?: string;
  initials?: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
  customFieldValues?: Record<string, string | boolean>;
  documentHash: string;
  signatureHash: string;
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
  grantedAt: Date;
  expiresAt?: Date;
  accessScope: 'full_room' | 'specific_documents' | 'specific_folders';
  allowedDocumentIds?: string[];
  allowedFolderIds?: string[];
  isActive: boolean;
  revokedAt?: Date;
}

export interface SignNdaParams {
  templateId: string;
  roomId: string;
  signerName: string;
  signerEmail: string;
  signerCompany?: string;
  signerTitle?: string;
  signatureImage?: string;
  initials?: string;
  ipAddress: string;
  userAgent: string;
  customFieldValues?: Record<string, string | boolean>;
  accessScope?: 'full_room' | 'specific_documents' | 'specific_folders';
  accessExpiresIn?: number;
}

export interface NdaVerificationResult {
  valid: boolean;
  signature?: NdaSignature;
  accessGrant?: NdaAccessGrant;
  template?: NdaTemplate;
  error?: 'no_signature' | 'expired' | 'revoked' | 'template_outdated' | 'access_denied';
}

type StoredTemplate = Omit<NdaTemplate, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
type StoredSignature = Omit<NdaSignature, 'signedAt' | 'revokedAt' | 'expiresAt'> & { signedAt: string; revokedAt?: string; expiresAt?: string };
type StoredGrant = Omit<NdaAccessGrant, 'grantedAt' | 'expiresAt' | 'revokedAt'> & { grantedAt: string; expiresAt?: string; revokedAt?: string };

function pkRoom(roomId: string) { return `ROOM#${roomId}`; }
function toTemplate(t: StoredTemplate): NdaTemplate {
  return { ...t, createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt) };
}
function toSignature(s: StoredSignature): NdaSignature {
  return {
    ...s,
    signedAt: new Date(s.signedAt),
    revokedAt: s.revokedAt ? new Date(s.revokedAt) : undefined,
    expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
  };
}
function toGrant(g: StoredGrant): NdaAccessGrant {
  return {
    ...g,
    grantedAt: new Date(g.grantedAt),
    expiresAt: g.expiresAt ? new Date(g.expiresAt) : undefined,
    revokedAt: g.revokedAt ? new Date(g.revokedAt) : undefined,
  };
}

const DEFAULT_NDA_TEMPLATE = `<div class="nda-document"><h1>Sekretessavtal (NDA)</h1><p>Standard NDA.</p></div>`;

function generateDocumentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
function generateSignatureHash(params: { signerName: string; signerEmail: string; signedAt: Date; documentHash: string }): string {
  const data = `${params.signerName}|${params.signerEmail}|${params.signedAt.toISOString()}|${params.documentHash}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

class NdaServiceV2 {
  private enabled = requirePersistenceOrFallback('ndaServiceV2');

  async getActiveTemplateForRoom(roomId: string): Promise<NdaTemplate | null> {
    if (!this.enabled) return null;
    const templates = await queryPk<StoredTemplate>(pkRoom(roomId), 'NDA_TEMPLATE#', 50, false);
    const active = templates.map(toTemplate).find(t => t.isActive);
    if (active) return active;
    // Seed default template if none exists
    const seeded = await this.createTemplate({
      roomId,
      name: 'Standard Sekretessavtal',
      content: DEFAULT_NDA_TEMPLATE,
      createdBy: 'System',
      requireSignature: true,
      requireInitials: false,
      requireFullName: true,
      requireEmail: true,
      requireCompany: true,
      requireTitle: false,
    });
    return seeded;
  }

  async getRoomNdaStats(roomId: string): Promise<{ totalSignatures: number; activeGrants: number; lastSignedAt?: Date }> {
    if (!this.enabled) return { totalSignatures: 0, activeGrants: 0 };
    const signatures = await queryPk<StoredSignature>(pkRoom(roomId), 'NDA_SIGNATURE#', 500, false);
    const grants = await queryPk<StoredGrant>(pkRoom(roomId), 'NDA_GRANT#', 500, false);
    const parsedS = signatures.map(toSignature);
    const last = parsedS.sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime())[0];
    return {
      totalSignatures: parsedS.length,
      activeGrants: grants.map(toGrant).filter(g => g.isActive).length,
      lastSignedAt: last?.signedAt,
    };
  }

  async createTemplate(params: {
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
    customFields?: NdaTemplate['customFields'];
  }): Promise<NdaTemplate> {
    if (!this.enabled) throw new Error('NDA persistence not configured');
    const now = new Date();
    const template: NdaTemplate = {
      id: `nda-template-${crypto.randomUUID()}`,
      roomId: params.roomId,
      name: params.name || 'NDA',
      version: '1.0',
      content: params.content,
      contentPlainText: params.content.replace(/<[^>]*>/g, ''),
      createdAt: now,
      createdBy: params.createdBy,
      updatedAt: now,
      isActive: true,
      requireSignature: params.requireSignature ?? true,
      requireInitials: params.requireInitials ?? false,
      requireFullName: params.requireFullName ?? true,
      requireEmail: params.requireEmail ?? true,
      requireCompany: params.requireCompany ?? true,
      requireTitle: params.requireTitle ?? false,
      customFields: params.customFields,
    };

    // Deactivate previous templates by simply leaving them as-is; active selection picks latest active.
    const stored: StoredTemplate = { ...(template as any), createdAt: now.toISOString(), updatedAt: now.toISOString() };
    await putItem({ pk: pkRoom(params.roomId), sk: `NDA_TEMPLATE#${stored.updatedAt}#${template.id}`, ...stored });
    return template;
  }

  async signNda(params: SignNdaParams): Promise<{ signature: NdaSignature; accessGrant: NdaAccessGrant }> {
    if (!this.enabled) throw new Error('NDA persistence not configured');
    const template = await this.getActiveTemplateForRoom(params.roomId);
    if (!template) throw new Error('No template');

    const signedAt = new Date();
    const docHash = generateDocumentHash(template.contentPlainText);
    const sigHash = generateSignatureHash({
      signerName: params.signerName,
      signerEmail: params.signerEmail.toLowerCase(),
      signedAt,
      documentHash: docHash,
    });

    const signature: NdaSignature = {
      id: `nda-signature-${crypto.randomUUID()}`,
      templateId: template.id,
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
      documentHash: docHash,
      signatureHash: sigHash,
      status: 'valid',
      expiresAt: params.accessExpiresIn ? new Date(Date.now() + params.accessExpiresIn * 24 * 60 * 60 * 1000) : undefined,
    };

    const grant: NdaAccessGrant = {
      id: `nda-grant-${crypto.randomUUID()}`,
      signatureId: signature.id,
      roomId: params.roomId,
      userEmail: signature.signerEmail,
      grantedAt: signedAt,
      expiresAt: signature.expiresAt,
      accessScope: params.accessScope || 'full_room',
      isActive: true,
    };

    const storedSig: StoredSignature = {
      ...(signature as any),
      signedAt: signedAt.toISOString(),
      revokedAt: undefined,
      expiresAt: signature.expiresAt ? signature.expiresAt.toISOString() : undefined,
    };
    const storedGrant: StoredGrant = {
      ...(grant as any),
      grantedAt: signedAt.toISOString(),
      expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : undefined,
      revokedAt: undefined,
    };

    await putItem({ pk: pkRoom(params.roomId), sk: `NDA_SIGNATURE#${storedSig.signedAt}#${signature.id}`, ...storedSig });
    await putItem({ pk: pkRoom(params.roomId), sk: `NDA_GRANT#${storedGrant.grantedAt}#${grant.id}`, ...storedGrant });
    // Email index for verify
    await putItem({ pk: `NDA_EMAIL#${signature.signerEmail}`, sk: `ROOM#${params.roomId}#${grant.id}`, roomId: params.roomId, grantId: grant.id, grantedAt: storedGrant.grantedAt });

    return { signature, accessGrant: grant };
  }

  async verifyNdaAccess(roomId: string, userEmail: string): Promise<NdaVerificationResult> {
    if (!this.enabled) return { valid: false, error: 'access_denied' };
    const email = userEmail.toLowerCase();
    const idx = await queryPk<any>(`NDA_EMAIL#${email}`, `ROOM#${roomId}#`, 20, false);
    if (!idx.length) return { valid: false, error: 'no_signature' };

    // Get latest grant by sorting grantedAt desc
    idx.sort((a, b) => String(b.grantedAt || '').localeCompare(String(a.grantedAt || '')));
    const grantId = idx[0].grantId as string;
    const grants = await queryPk<StoredGrant>(pkRoom(roomId), 'NDA_GRANT#', 500, false);
    const grant = grants.map(toGrant).find(g => g.id === grantId);
    if (!grant || !grant.isActive) return { valid: false, error: 'access_denied' };
    if (grant.expiresAt && new Date() > grant.expiresAt) return { valid: false, error: 'expired', accessGrant: grant };

    const template = await this.getActiveTemplateForRoom(roomId);
    return { valid: true, accessGrant: grant, template: template || undefined };
  }
}

export const ndaServiceV2 = new NdaServiceV2();


