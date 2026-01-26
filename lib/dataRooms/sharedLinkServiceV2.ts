/**
 * Shared Link Service (Persistent, V2)
 * DynamoDB-backed so links survive deploy/restart.
 *
 * Table: AIFM_DATAROOMS_TABLE (single-table, no GSIs required)
 */

import crypto from 'crypto';
import { getItem, putItem, queryPk, updateItem, requirePersistenceOrFallback } from './persistence';

// Types (same as legacy)
export interface SharedLink {
  id: string;
  roomId: string;
  documentId?: string;
  folderId?: string;
  token: string;
  shortCode?: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  expiresAt: Date;
  maxUses?: number;
  currentUses: number;
  recipientEmail?: string;
  recipientName?: string;
  recipientCompany?: string;
  permissions: SharedLinkPermissions;
  requirePassword: boolean;
  passwordHash?: string;
  requireNda: boolean;
  ndaTemplateId?: string;
  status: 'active' | 'expired' | 'revoked' | 'exhausted';
  revokedAt?: Date;
  revokedBy?: string;
}

export interface SharedLinkPermissions {
  canView: boolean;
  canDownload: boolean;
  canPrint: boolean;
  applyWatermark: boolean;
  trackActivity: boolean;
}

export interface CreateSharedLinkParams {
  roomId: string;
  documentId?: string;
  folderId?: string;
  createdBy: string;
  createdByEmail: string;
  expiresIn?: 'hours' | 'days' | 'weeks' | 'custom';
  expiresInValue?: number;
  expiresAt?: Date;
  maxUses?: number;
  recipientEmail?: string;
  recipientName?: string;
  recipientCompany?: string;
  permissions?: Partial<SharedLinkPermissions>;
  password?: string;
  requireNda?: boolean;
  ndaTemplateId?: string;
}

export interface ValidateLinkResult {
  valid: boolean;
  link?: SharedLink;
  error?: 'expired' | 'revoked' | 'exhausted' | 'not_found' | 'wrong_email' | 'password_required' | 'nda_required';
  requiresPassword?: boolean;
  requiresNda?: boolean;
  ndaTemplateId?: string;
}

type StoredLink = Omit<SharedLink, 'createdAt' | 'expiresAt' | 'revokedAt'> & {
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

function pkLink(id: string) { return `SLINK#${id}`; }
function pkRoom(roomId: string) { return `SLINKROOM#${roomId}`; }
function skRoom(createdAtIso: string, id: string) { return `${createdAtIso}#${id}`; }
function pkToken(token: string) { return `SLINKTOKEN#${token}`; }
function pkShort(code: string) { return `SLINKSHORT#${code.toUpperCase()}`; }

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
function calculateExpirationDate(
  expiresIn?: 'hours' | 'days' | 'weeks' | 'custom',
  expiresInValue?: number,
  customDate?: Date
): Date {
  if (expiresIn === 'custom' && customDate) return customDate;
  const now = new Date();
  const value = expiresInValue || 1;
  switch (expiresIn) {
    case 'hours': return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'days': return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    case 'weeks': return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

function toLink(item: StoredLink): SharedLink {
  return {
    ...item,
    createdAt: new Date(item.createdAt),
    expiresAt: new Date(item.expiresAt),
    revokedAt: item.revokedAt ? new Date(item.revokedAt) : undefined,
  };
}
function toStored(link: SharedLink): StoredLink {
  return {
    ...(link as any),
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt.toISOString(),
    revokedAt: link.revokedAt ? link.revokedAt.toISOString() : undefined,
  };
}

class SharedLinkServiceV2 {
  private enabled = requirePersistenceOrFallback('sharedLinkServiceV2');

  async createLink(params: CreateSharedLinkParams): Promise<SharedLink> {
    if (!this.enabled) throw new Error('Shared links persistence not configured');

    const id = `link-${crypto.randomUUID()}`;
    const token = generateSecureToken();
    const shortCode = generateShortCode();
    const createdAt = new Date();

    const defaultPermissions: SharedLinkPermissions = {
      canView: true,
      canDownload: false,
      canPrint: false,
      applyWatermark: true,
      trackActivity: true,
    };

    const link: SharedLink = {
      id,
      roomId: params.roomId,
      documentId: params.documentId,
      folderId: params.folderId,
      token,
      shortCode,
      createdBy: params.createdBy,
      createdByEmail: params.createdByEmail,
      createdAt,
      expiresAt: calculateExpirationDate(params.expiresIn, params.expiresInValue, params.expiresAt),
      maxUses: params.maxUses,
      currentUses: 0,
      recipientEmail: params.recipientEmail?.toLowerCase(),
      recipientName: params.recipientName,
      recipientCompany: params.recipientCompany,
      permissions: { ...defaultPermissions, ...params.permissions },
      requirePassword: !!params.password,
      passwordHash: params.password ? hashPassword(params.password) : undefined,
      requireNda: params.requireNda || false,
      ndaTemplateId: params.ndaTemplateId,
      status: 'active',
    };

    const stored = toStored(link);

    // Primary meta
    await putItem({ pk: pkLink(id), sk: 'META', ...stored });
    // Token + shortcode indexes (no GSIs)
    await putItem({ pk: pkToken(token), sk: 'LINK', linkId: id, roomId: link.roomId, createdAt: stored.createdAt });
    await putItem({ pk: pkShort(shortCode), sk: 'LINK', linkId: id, roomId: link.roomId, createdAt: stored.createdAt });
    // Room index
    await putItem({ pk: pkRoom(link.roomId), sk: skRoom(stored.createdAt, id), ...stored });

    return link;
  }

  async getLinkById(id: string): Promise<SharedLink | null> {
    if (!this.enabled) return null;
    const item = await getItem<StoredLink>({ pk: pkLink(id), sk: 'META' });
    return item ? toLink(item) : null;
  }

  async getLinkByToken(token: string): Promise<SharedLink | null> {
    if (!this.enabled) return null;
    const idx = await getItem<{ linkId: string } & Record<string, any>>({ pk: pkToken(token), sk: 'LINK' });
    if (!idx?.linkId) return null;
    return this.getLinkById(idx.linkId);
  }

  async getLinkByShortCode(shortCode: string): Promise<SharedLink | null> {
    if (!this.enabled) return null;
    const idx = await getItem<{ linkId: string } & Record<string, any>>({ pk: pkShort(shortCode), sk: 'LINK' });
    if (!idx?.linkId) return null;
    return this.getLinkById(idx.linkId);
  }

  async getLinksByRoom(roomId: string): Promise<SharedLink[]> {
    if (!this.enabled) return [];
    const items = await queryPk<StoredLink>(pkRoom(roomId), undefined, 200, false);
    // Sort newest first
    return items.map(toLink).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async validateLink(
    token: string,
    options?: { userEmail?: string; password?: string; ndaSigned?: boolean; skipNdaCheck?: boolean }
  ): Promise<ValidateLinkResult> {
    const link = await this.getLinkByToken(token);
    if (!link) return { valid: false, error: 'not_found' };

    if (link.status === 'revoked') return { valid: false, error: 'revoked', link };
    if (link.status === 'exhausted') return { valid: false, error: 'exhausted', link };

    if (new Date() > link.expiresAt) {
      await this.updateLinkStatus(link, 'expired');
      return { valid: false, error: 'expired', link: { ...link, status: 'expired' } };
    }

    if (link.maxUses && link.currentUses >= link.maxUses) {
      await this.updateLinkStatus(link, 'exhausted');
      return { valid: false, error: 'exhausted', link: { ...link, status: 'exhausted' } };
    }

    if (link.recipientEmail && options?.userEmail?.toLowerCase() !== link.recipientEmail) {
      return { valid: false, error: 'wrong_email', link };
    }

    if (link.requirePassword && link.passwordHash) {
      if (!options?.password) return { valid: false, error: 'password_required', link, requiresPassword: true };
      if (hashPassword(options.password) !== link.passwordHash) return { valid: false, error: 'password_required', link, requiresPassword: true };
    }

    if (link.requireNda && !options?.skipNdaCheck && !options?.ndaSigned) {
      return { valid: false, error: 'nda_required', link, requiresNda: true, ndaTemplateId: link.ndaTemplateId };
    }

    return { valid: true, link };
  }

  async logAccess(linkId: string, accessInfo: { userEmail?: string; success: boolean; failureReason?: string }): Promise<void> {
    if (!this.enabled) return;
    const link = await this.getLinkById(linkId);
    if (!link) return;

    // Write immutable access record (keeps meta small)
    const ts = new Date().toISOString();
    await putItem({
      pk: pkLink(linkId),
      sk: `ACCESS#${ts}#${crypto.randomUUID()}`,
      roomId: link.roomId,
      timestamp: ts,
      userEmail: accessInfo.userEmail,
      success: accessInfo.success,
      failureReason: accessInfo.failureReason,
    });

    // Update counters on meta (+ room index copy)
    let nextUses = link.currentUses;
    let nextStatus: SharedLink['status'] = link.status;
    if (accessInfo.success) {
      nextUses = link.currentUses + 1;
      if (link.maxUses && nextUses >= link.maxUses) nextStatus = 'exhausted';
    }
    await this.persistLink({ ...link, currentUses: nextUses, status: nextStatus });
  }

  async revokeLink(linkId: string, revokedBy: string): Promise<boolean> {
    const link = await this.getLinkById(linkId);
    if (!link) return false;
    await this.persistLink({ ...link, status: 'revoked', revokedAt: new Date(), revokedBy });
    return true;
  }

  async extendLink(linkId: string, newExpiresAt: Date): Promise<SharedLink | null> {
    const link = await this.getLinkById(linkId);
    if (!link) return null;
    const next: SharedLink = { ...link, expiresAt: newExpiresAt, status: link.status === 'expired' ? 'active' : link.status };
    await this.persistLink(next);
    return next;
  }

  async updateLinkPermissions(linkId: string, permissions: Partial<SharedLinkPermissions>): Promise<SharedLink | null> {
    const link = await this.getLinkById(linkId);
    if (!link) return null;
    const next: SharedLink = { ...link, permissions: { ...link.permissions, ...permissions } };
    await this.persistLink(next);
    return next;
  }

  async updateLinkPassword(linkId: string, password: string | null): Promise<SharedLink | null> {
    const link = await this.getLinkById(linkId);
    if (!link) return null;
    const next: SharedLink = password
      ? { ...link, requirePassword: true, passwordHash: hashPassword(password) }
      : { ...link, requirePassword: false, passwordHash: undefined };
    await this.persistLink(next);
    return next;
  }

  getLinkUrl(link: SharedLink, baseUrl: string): string {
    return `${baseUrl}/shared/${link.token}`;
  }

  getShortLinkUrl(link: SharedLink, baseUrl: string): string {
    return `${baseUrl}/s/${link.shortCode}`;
  }

  async getLinkStats(linkId: string): Promise<{
    totalAccesses: number;
    successfulAccesses: number;
    failedAccesses: number;
    uniqueUsers: number;
    lastAccess?: Date;
    accessesByDate: Record<string, number>;
  } | null> {
    if (!this.enabled) return null;
    const link = await this.getLinkById(linkId);
    if (!link) return null;

    const accesses = await queryPk<any>(pkLink(linkId), 'ACCESS#', 500, true);
    const accessesByDate: Record<string, number> = {};
    const uniqueUsers = new Set<string>();
    let successful = 0;
    let failed = 0;
    let lastAccessIso: string | undefined;

    for (const a of accesses) {
      const ts = a.timestamp as string | undefined;
      if (ts) lastAccessIso = ts;
      const date = (ts || '').split('T')[0];
      if (date) accessesByDate[date] = (accessesByDate[date] || 0) + 1;
      if (a.userEmail) uniqueUsers.add(String(a.userEmail).toLowerCase());
      if (a.success) successful++; else failed++;
    }

    return {
      totalAccesses: accesses.length,
      successfulAccesses: successful,
      failedAccesses: failed,
      uniqueUsers: uniqueUsers.size,
      lastAccess: lastAccessIso ? new Date(lastAccessIso) : undefined,
      accessesByDate,
    };
  }

  private async updateLinkStatus(link: SharedLink, status: SharedLink['status']) {
    await this.persistLink({ ...link, status });
  }

  private async persistLink(link: SharedLink) {
    if (!this.enabled) return;
    const stored = toStored(link);
    await putItem({ pk: pkLink(link.id), sk: 'META', ...stored });
    await putItem({ pk: pkRoom(link.roomId), sk: skRoom(stored.createdAt, link.id), ...stored });
  }
}

export const sharedLinkServiceV2 = new SharedLinkServiceV2();


