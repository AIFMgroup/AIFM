/**
 * Shared Link Service
 * Time-limited sharing links for external access to data room documents
 */

import crypto from 'crypto';

// Types
export interface SharedLink {
  id: string;
  roomId: string;
  documentId?: string; // If null, provides access to entire room
  folderId?: string; // If set, provides access to a folder
  
  // Link details
  token: string; // Unique secure token
  shortCode?: string; // Optional short code for easy sharing
  
  // Creator info
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  
  // Expiration
  expiresAt: Date;
  maxUses?: number; // Limit number of accesses
  currentUses: number;
  
  // Recipient info
  recipientEmail?: string; // If set, only this email can access
  recipientName?: string;
  recipientCompany?: string;
  
  // Permissions
  permissions: SharedLinkPermissions;
  
  // Security
  requirePassword: boolean;
  passwordHash?: string;
  requireNda: boolean;
  ndaTemplateId?: string;
  
  // Status
  status: 'active' | 'expired' | 'revoked' | 'exhausted';
  revokedAt?: Date;
  revokedBy?: string;
  
  // Tracking
  accessLog: SharedLinkAccess[];
}

export interface SharedLinkPermissions {
  canView: boolean;
  canDownload: boolean;
  canPrint: boolean;
  applyWatermark: boolean;
  trackActivity: boolean;
}

export interface SharedLinkAccess {
  id: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  userEmail?: string;
  userName?: string;
  ndaSigned: boolean;
  success: boolean;
  failureReason?: string;
}

export interface CreateSharedLinkParams {
  roomId: string;
  documentId?: string;
  folderId?: string;
  createdBy: string;
  createdByEmail: string;
  
  // Expiration options
  expiresIn?: 'hours' | 'days' | 'weeks' | 'custom';
  expiresInValue?: number; // For 'hours', 'days', 'weeks'
  expiresAt?: Date; // For 'custom'
  maxUses?: number;
  
  // Recipient
  recipientEmail?: string;
  recipientName?: string;
  recipientCompany?: string;
  
  // Permissions
  permissions?: Partial<SharedLinkPermissions>;
  
  // Security
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

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a short code for easy sharing
 */
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding confusing characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Hash a password
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Calculate expiration date
 */
function calculateExpirationDate(
  expiresIn?: 'hours' | 'days' | 'weeks' | 'custom',
  expiresInValue?: number,
  customDate?: Date
): Date {
  if (expiresIn === 'custom' && customDate) {
    return customDate;
  }
  
  const now = new Date();
  const value = expiresInValue || 1;
  
  switch (expiresIn) {
    case 'hours':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'days':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    case 'weeks':
      return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
    default:
      // Default to 7 days
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Shared Link Service
 */
class SharedLinkService {
  private links: Map<string, SharedLink> = new Map();
  private linksByToken: Map<string, string> = new Map(); // token -> id
  private linksByShortCode: Map<string, string> = new Map(); // shortCode -> id
  
  /**
   * Create a new shared link
   */
  createLink(params: CreateSharedLinkParams): SharedLink {
    const id = `link-${crypto.randomUUID()}`;
    const token = generateSecureToken();
    const shortCode = generateShortCode();
    
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
      createdAt: new Date(),
      expiresAt: calculateExpirationDate(
        params.expiresIn,
        params.expiresInValue,
        params.expiresAt
      ),
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
      accessLog: [],
    };
    
    this.links.set(id, link);
    this.linksByToken.set(token, id);
    this.linksByShortCode.set(shortCode, id);
    
    return link;
  }
  
  /**
   * Get a link by ID
   */
  getLinkById(id: string): SharedLink | null {
    return this.links.get(id) || null;
  }
  
  /**
   * Get a link by token
   */
  getLinkByToken(token: string): SharedLink | null {
    const id = this.linksByToken.get(token);
    if (!id) return null;
    return this.links.get(id) || null;
  }
  
  /**
   * Get a link by short code
   */
  getLinkByShortCode(shortCode: string): SharedLink | null {
    const id = this.linksByShortCode.get(shortCode.toUpperCase());
    if (!id) return null;
    return this.links.get(id) || null;
  }
  
  /**
   * Get all links for a room
   */
  getLinksByRoom(roomId: string): SharedLink[] {
    return Array.from(this.links.values())
      .filter(l => l.roomId === roomId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Get all links for a document
   */
  getLinksByDocument(documentId: string): SharedLink[] {
    return Array.from(this.links.values())
      .filter(l => l.documentId === documentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Validate a link for access
   */
  validateLink(
    token: string,
    options?: {
      userEmail?: string;
      password?: string;
      ndaSigned?: boolean;
    }
  ): ValidateLinkResult {
    const link = this.getLinkByToken(token);
    
    if (!link) {
      return { valid: false, error: 'not_found' };
    }
    
    // Check status
    if (link.status === 'revoked') {
      return { valid: false, error: 'revoked', link };
    }
    
    if (link.status === 'exhausted') {
      return { valid: false, error: 'exhausted', link };
    }
    
    // Check expiration
    if (new Date() > link.expiresAt) {
      this.updateLinkStatus(link.id, 'expired');
      return { valid: false, error: 'expired', link };
    }
    
    // Check max uses
    if (link.maxUses && link.currentUses >= link.maxUses) {
      this.updateLinkStatus(link.id, 'exhausted');
      return { valid: false, error: 'exhausted', link };
    }
    
    // Check recipient email restriction
    if (link.recipientEmail && options?.userEmail?.toLowerCase() !== link.recipientEmail) {
      return { valid: false, error: 'wrong_email', link };
    }
    
    // Check password
    if (link.requirePassword && link.passwordHash) {
      if (!options?.password) {
        return { 
          valid: false, 
          error: 'password_required', 
          link,
          requiresPassword: true 
        };
      }
      if (hashPassword(options.password) !== link.passwordHash) {
        return { 
          valid: false, 
          error: 'password_required', 
          link,
          requiresPassword: true 
        };
      }
    }
    
    // Check NDA
    if (link.requireNda && !options?.ndaSigned) {
      return { 
        valid: false, 
        error: 'nda_required', 
        link,
        requiresNda: true,
        ndaTemplateId: link.ndaTemplateId
      };
    }
    
    return { valid: true, link };
  }
  
  /**
   * Log access to a link
   */
  logAccess(
    linkId: string,
    accessInfo: {
      ipAddress?: string;
      userAgent?: string;
      userEmail?: string;
      userName?: string;
      ndaSigned?: boolean;
      success: boolean;
      failureReason?: string;
    }
  ): SharedLinkAccess | null {
    const link = this.links.get(linkId);
    if (!link) return null;
    
    const access: SharedLinkAccess = {
      id: `access-${crypto.randomUUID()}`,
      timestamp: new Date(),
      ipAddress: accessInfo.ipAddress,
      userAgent: accessInfo.userAgent,
      userEmail: accessInfo.userEmail,
      userName: accessInfo.userName,
      ndaSigned: accessInfo.ndaSigned || false,
      success: accessInfo.success,
      failureReason: accessInfo.failureReason,
    };
    
    link.accessLog.push(access);
    
    if (accessInfo.success) {
      link.currentUses++;
      
      // Check if exhausted
      if (link.maxUses && link.currentUses >= link.maxUses) {
        link.status = 'exhausted';
      }
    }
    
    this.links.set(linkId, link);
    return access;
  }
  
  /**
   * Revoke a link
   */
  revokeLink(linkId: string, revokedBy: string): boolean {
    const link = this.links.get(linkId);
    if (!link) return false;
    
    link.status = 'revoked';
    link.revokedAt = new Date();
    link.revokedBy = revokedBy;
    
    this.links.set(linkId, link);
    return true;
  }
  
  /**
   * Update link status
   */
  private updateLinkStatus(linkId: string, status: SharedLink['status']): void {
    const link = this.links.get(linkId);
    if (link) {
      link.status = status;
      this.links.set(linkId, link);
    }
  }
  
  /**
   * Extend link expiration
   */
  extendLink(
    linkId: string,
    newExpiresAt: Date
  ): SharedLink | null {
    const link = this.links.get(linkId);
    if (!link) return null;
    
    link.expiresAt = newExpiresAt;
    if (link.status === 'expired') {
      link.status = 'active';
    }
    
    this.links.set(linkId, link);
    return link;
  }
  
  /**
   * Update link permissions
   */
  updateLinkPermissions(
    linkId: string,
    permissions: Partial<SharedLinkPermissions>
  ): SharedLink | null {
    const link = this.links.get(linkId);
    if (!link) return null;
    
    link.permissions = { ...link.permissions, ...permissions };
    this.links.set(linkId, link);
    return link;
  }
  
  /**
   * Add/update password protection
   */
  updateLinkPassword(
    linkId: string,
    password: string | null
  ): SharedLink | null {
    const link = this.links.get(linkId);
    if (!link) return null;
    
    if (password) {
      link.requirePassword = true;
      link.passwordHash = hashPassword(password);
    } else {
      link.requirePassword = false;
      link.passwordHash = undefined;
    }
    
    this.links.set(linkId, link);
    return link;
  }
  
  /**
   * Get link URL
   */
  getLinkUrl(link: SharedLink, baseUrl: string): string {
    return `${baseUrl}/shared/${link.token}`;
  }
  
  /**
   * Get short link URL
   */
  getShortLinkUrl(link: SharedLink, baseUrl: string): string {
    return `${baseUrl}/s/${link.shortCode}`;
  }
  
  /**
   * Get statistics for a link
   */
  getLinkStats(linkId: string): {
    totalAccesses: number;
    successfulAccesses: number;
    failedAccesses: number;
    uniqueUsers: number;
    lastAccess?: Date;
    accessesByDate: Record<string, number>;
  } | null {
    const link = this.links.get(linkId);
    if (!link) return null;
    
    const uniqueUsers = new Set(
      link.accessLog
        .filter(a => a.userEmail)
        .map(a => a.userEmail)
    );
    
    const accessesByDate: Record<string, number> = {};
    for (const access of link.accessLog) {
      const date = access.timestamp.toISOString().split('T')[0];
      accessesByDate[date] = (accessesByDate[date] || 0) + 1;
    }
    
    return {
      totalAccesses: link.accessLog.length,
      successfulAccesses: link.accessLog.filter(a => a.success).length,
      failedAccesses: link.accessLog.filter(a => !a.success).length,
      uniqueUsers: uniqueUsers.size,
      lastAccess: link.accessLog.length > 0 
        ? link.accessLog[link.accessLog.length - 1].timestamp 
        : undefined,
      accessesByDate,
    };
  }
  
  /**
   * Clean up expired links (for maintenance)
   */
  cleanupExpiredLinks(): number {
    let cleaned = 0;
    const now = new Date();
    
    for (const [id, link] of this.links) {
      if (link.status === 'active' && now > link.expiresAt) {
        link.status = 'expired';
        this.links.set(id, link);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

export const sharedLinkService = new SharedLinkService();







