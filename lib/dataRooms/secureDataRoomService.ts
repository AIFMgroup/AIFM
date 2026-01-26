/**
 * Secure Data Room Service
 * 
 * Enterprise-grade document sharing with:
 * - Watermarking (dynamic with viewer info)
 * - Expiring links
 * - Viewer permissions (view/download/print)
 * - Full access logging
 * - Download disable option
 * - External viewer tracking
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { TenantContext } from '../tenancy/tenantContext';
import { requireCompanyAccess } from '../tenancy/tenantMiddleware';

// ============================================================================
// Types
// ============================================================================

export interface SecureDataRoom {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  description: string;
  type: 'DEAL_ROOM' | 'DUE_DILIGENCE' | 'INVESTOR_PORTAL' | 'BOARD' | 'COMPLIANCE' | 'GENERAL';
  status: 'ACTIVE' | 'ARCHIVED' | 'EXPIRED';
  
  // Security settings
  watermarkEnabled: boolean;
  watermarkText?: string; // Custom text, default uses viewer email
  downloadEnabled: boolean;
  printEnabled: boolean;
  copyEnabled: boolean; // Text copy
  screenshotProtection: boolean;
  
  // Access control
  expiresAt?: string;
  accessPin?: string; // Hashed
  ipWhitelist?: string[]; // CIDR ranges
  domainWhitelist?: string[]; // Email domains allowed
  maxViewers?: number;
  
  // NDA requirement
  ndaRequired: boolean;
  ndaDocumentId?: string;
  
  // Metadata
  fundId?: string;
  fundName?: string;
  documentsCount: number;
  membersCount: number;
  lastActivity: string;
  
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataRoomDocument {
  id: string;
  dataRoomId: string;
  tenantId: string;
  companyId: string;
  
  // Document info
  name: string;
  description?: string;
  fileKey: string; // S3 key
  mimeType: string;
  fileSize: number;
  
  // Categorization
  folderId?: string;
  folderPath?: string;
  category?: string;
  tags?: string[];
  
  // Version control
  version: number;
  previousVersionId?: string;
  
  // Security override (can be more restrictive than room)
  downloadOverride?: boolean; // If false, overrides room setting
  viewerRestrictions?: string[]; // List of viewer IDs who can't access
  
  // Metadata
  uploadedBy: string;
  uploadedAt: string;
  lastViewedAt?: string;
  viewCount: number;
  downloadCount: number;
}

export interface DataRoomViewer {
  id: string;
  dataRoomId: string;
  tenantId: string;
  
  // Viewer info
  email: string;
  name?: string;
  company?: string;
  
  // Access
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'external';
  permissions: ViewerPermissions;
  
  // Status
  status: 'invited' | 'active' | 'revoked' | 'expired';
  invitedAt: string;
  invitedBy: string;
  activatedAt?: string;
  lastAccessAt?: string;
  
  // NDA
  ndaSignedAt?: string;
  ndaSignatureId?: string;
  
  // Security
  accessCount: number;
  downloadCount: number;
  lastIpAddress?: string;
  deviceFingerprint?: string;
}

export interface ViewerPermissions {
  canView: boolean;
  canDownload: boolean;
  canPrint: boolean;
  canShare: boolean;
  canUpload: boolean;
  canDelete: boolean;
  canManageViewers: boolean;
  folderRestrictions?: string[]; // Folder IDs they CAN'T access
  documentRestrictions?: string[]; // Document IDs they CAN'T access
  expiresAt?: string; // Individual expiry
}

export interface DocumentAccessLog {
  id: string;
  dataRoomId: string;
  documentId: string;
  tenantId: string;
  
  // Actor
  viewerId: string;
  viewerEmail: string;
  viewerName?: string;
  
  // Action
  action: 'view' | 'download' | 'print' | 'share' | 'upload' | 'delete' | 'preview';
  
  // Context
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  geoLocation?: {
    country?: string;
    city?: string;
    region?: string;
  };
  
  // Result
  success: boolean;
  errorReason?: string;
  
  // Watermark tracking
  watermarkId?: string; // Unique watermark ID for this access
  
  timestamp: string;
  duration?: number; // View duration in seconds
  pagesViewed?: number[];
}

export interface SecureLink {
  id: string;
  dataRoomId: string;
  documentId?: string; // If specific document, otherwise full room access
  tenantId: string;
  
  // Link info
  token: string; // Hashed
  url: string;
  
  // Expiry
  expiresAt: string;
  maxUses?: number;
  currentUses: number;
  
  // Restrictions
  requireEmail: boolean;
  allowedEmails?: string[];
  requirePin: boolean;
  pinHash?: string;
  ipRestrictions?: string[];
  
  // Permissions (subset of what link creator has)
  permissions: ViewerPermissions;
  
  // Metadata
  createdBy: string;
  createdAt: string;
  label?: string;
}

// ============================================================================
// DynamoDB & S3 Setup
// ============================================================================

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const DATA_ROOMS_TABLE = process.env.DATA_ROOMS_TABLE_NAME || 'aifm-data-rooms';
const ACCESS_LOGS_TABLE = process.env.ACCESS_LOGS_TABLE_NAME || 'aifm-document-access-logs';
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET || 'aifm-documents';

// ============================================================================
// Secure Data Room Service
// ============================================================================

export const secureDataRoomService = {
  // ========== Data Room CRUD ==========

  async createDataRoom(
    context: TenantContext,
    params: {
      companyId: string;
      name: string;
      description: string;
      type: SecureDataRoom['type'];
      watermarkEnabled?: boolean;
      downloadEnabled?: boolean;
      expiresAt?: string;
      fundId?: string;
      fundName?: string;
      ndaRequired?: boolean;
    }
  ): Promise<SecureDataRoom> {
    requireCompanyAccess(context, params.companyId);

    const now = new Date().toISOString();
    const roomId = `room-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    const room: SecureDataRoom = {
      id: roomId,
      tenantId: context.tenantId,
      companyId: params.companyId,
      name: params.name,
      description: params.description,
      type: params.type,
      status: 'ACTIVE',
      watermarkEnabled: params.watermarkEnabled ?? true,
      downloadEnabled: params.downloadEnabled ?? true,
      printEnabled: true,
      copyEnabled: false,
      screenshotProtection: true,
      expiresAt: params.expiresAt,
      fundId: params.fundId,
      fundName: params.fundName,
      documentsCount: 0,
      membersCount: 1, // Creator
      lastActivity: now,
      ndaRequired: params.ndaRequired ?? false,
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: DATA_ROOMS_TABLE,
      Item: {
        pk: `TENANT#${context.tenantId}`,
        sk: `ROOM#${roomId}`,
        gsi1pk: `COMPANY#${params.companyId}`,
        gsi1sk: `ROOM#${roomId}`,
        ...room,
      },
    }));

    // Add creator as owner
    await this.addViewer(context, {
      dataRoomId: roomId,
      email: context.userEmail,
      role: 'owner',
      permissions: {
        canView: true,
        canDownload: true,
        canPrint: true,
        canShare: true,
        canUpload: true,
        canDelete: true,
        canManageViewers: true,
      },
    });

    // Log creation
    await this.logAccess({
      dataRoomId: roomId,
      documentId: '',
      tenantId: context.tenantId,
      viewerId: context.userId,
      viewerEmail: context.userEmail,
      action: 'view', // Room creation logged as view
      ipAddress: context.ipAddress || 'unknown',
      userAgent: 'system',
      success: true,
    });

    console.log(`[SecureDataRoom] Created room ${roomId} for company ${params.companyId}`);

    return room;
  },

  async getDataRoom(context: TenantContext, roomId: string): Promise<SecureDataRoom | null> {
    const command = new GetCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `TENANT#${context.tenantId}`,
        sk: `ROOM#${roomId}`,
      },
    });

    const response = await docClient.send(command);
    const room = response.Item as SecureDataRoom | undefined;

    if (!room) return null;

    // Validate company access
    requireCompanyAccess(context, room.companyId);

    return room;
  },

  async getDataRoomsForCompany(context: TenantContext, companyId: string): Promise<SecureDataRoom[]> {
    requireCompanyAccess(context, companyId);

    const command = new QueryCommand({
      TableName: DATA_ROOMS_TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${companyId}`,
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []) as SecureDataRoom[];
  },

  // ========== Viewers ==========

  async addViewer(
    context: TenantContext,
    params: {
      dataRoomId: string;
      email: string;
      name?: string;
      company?: string;
      role?: DataRoomViewer['role'];
      permissions: ViewerPermissions;
    }
  ): Promise<DataRoomViewer> {
    const room = await this.getDataRoom(context, params.dataRoomId);
    if (!room) throw new Error('Data room not found');

    const now = new Date().toISOString();
    const viewerId = `viewer-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    const viewer: DataRoomViewer = {
      id: viewerId,
      dataRoomId: params.dataRoomId,
      tenantId: context.tenantId,
      email: params.email,
      name: params.name,
      company: params.company,
      role: params.role || 'viewer',
      permissions: params.permissions,
      status: 'invited',
      invitedAt: now,
      invitedBy: context.userId,
      accessCount: 0,
      downloadCount: 0,
    };

    await docClient.send(new PutCommand({
      TableName: DATA_ROOMS_TABLE,
      Item: {
        pk: `ROOM#${params.dataRoomId}`,
        sk: `VIEWER#${viewerId}`,
        gsi1pk: `EMAIL#${params.email.toLowerCase()}`,
        gsi1sk: `ROOM#${params.dataRoomId}`,
        ...viewer,
      },
    }));

    // Update member count
    await docClient.send(new UpdateCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `TENANT#${context.tenantId}`,
        sk: `ROOM#${params.dataRoomId}`,
      },
      UpdateExpression: 'SET membersCount = membersCount + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': now,
      },
    }));

    console.log(`[SecureDataRoom] Added viewer ${params.email} to room ${params.dataRoomId}`);

    return viewer;
  },

  async revokeViewer(context: TenantContext, dataRoomId: string, viewerId: string): Promise<void> {
    await docClient.send(new UpdateCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `ROOM#${dataRoomId}`,
        sk: `VIEWER#${viewerId}`,
      },
      UpdateExpression: 'SET #status = :revoked, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':revoked': 'revoked',
        ':now': new Date().toISOString(),
      },
    }));

    console.log(`[SecureDataRoom] Revoked viewer ${viewerId} from room ${dataRoomId}`);
  },

  // ========== Documents ==========

  async getSignedUploadUrl(
    context: TenantContext,
    params: {
      dataRoomId: string;
      fileName: string;
      mimeType: string;
    }
  ): Promise<{ uploadUrl: string; documentId: string; fileKey: string }> {
    const room = await this.getDataRoom(context, params.dataRoomId);
    if (!room) throw new Error('Data room not found');

    const documentId = `doc-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const fileKey = `tenants/${context.tenantId}/companies/${room.companyId}/rooms/${params.dataRoomId}/${documentId}/${params.fileName}`;

    const command = new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: fileKey,
      ContentType: params.mimeType,
      Metadata: {
        'document-id': documentId,
        'tenant-id': context.tenantId,
        'data-room-id': params.dataRoomId,
        'uploaded-by': context.userId,
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return { uploadUrl, documentId, fileKey };
  },

  async getSecureViewUrl(
    context: TenantContext,
    params: {
      dataRoomId: string;
      documentId: string;
      viewerEmail: string;
    }
  ): Promise<{
    url: string;
    watermarkId: string;
    expiresAt: string;
  }> {
    const room = await this.getDataRoom(context, params.dataRoomId);
    if (!room) throw new Error('Data room not found');

    // Get document
    const docResult = await docClient.send(new GetCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `ROOM#${params.dataRoomId}`,
        sk: `DOC#${params.documentId}`,
      },
    }));

    const doc = docResult.Item as DataRoomDocument | undefined;
    if (!doc) throw new Error('Document not found');

    // Generate watermark ID for tracking
    const watermarkId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours

    // Generate signed URL with watermark parameter
    const command = new GetObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: doc.fileKey,
    });

    const baseUrl = await getSignedUrl(s3Client, command, { expiresIn: 4 * 60 * 60 });

    // Log access
    await this.logAccess({
      dataRoomId: params.dataRoomId,
      documentId: params.documentId,
      tenantId: context.tenantId,
      viewerId: context.userId,
      viewerEmail: params.viewerEmail,
      action: 'view',
      ipAddress: context.ipAddress || 'unknown',
      userAgent: 'web',
      success: true,
      watermarkId,
    });

    // Update view count
    await docClient.send(new UpdateCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `ROOM#${params.dataRoomId}`,
        sk: `DOC#${params.documentId}`,
      },
      UpdateExpression: 'SET viewCount = viewCount + :inc, lastViewedAt = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': new Date().toISOString(),
      },
    }));

    return {
      url: baseUrl,
      watermarkId,
      expiresAt,
    };
  },

  // ========== Secure Links ==========

  async createSecureLink(
    context: TenantContext,
    params: {
      dataRoomId: string;
      documentId?: string;
      expiresInHours?: number;
      maxUses?: number;
      requireEmail?: boolean;
      allowedEmails?: string[];
      requirePin?: boolean;
      pin?: string;
      label?: string;
      permissions?: Partial<ViewerPermissions>;
    }
  ): Promise<SecureLink> {
    const room = await this.getDataRoom(context, params.dataRoomId);
    if (!room) throw new Error('Data room not found');

    const now = new Date();
    const linkId = `link-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(now.getTime() + (params.expiresInHours || 72) * 60 * 60 * 1000).toISOString();

    const link: SecureLink = {
      id: linkId,
      dataRoomId: params.dataRoomId,
      documentId: params.documentId,
      tenantId: context.tenantId,
      token: tokenHash,
      url: `/share/${token}`,
      expiresAt,
      maxUses: params.maxUses,
      currentUses: 0,
      requireEmail: params.requireEmail ?? false,
      allowedEmails: params.allowedEmails,
      requirePin: params.requirePin ?? false,
      pinHash: params.pin ? crypto.createHash('sha256').update(params.pin).digest('hex') : undefined,
      permissions: {
        canView: true,
        canDownload: params.permissions?.canDownload ?? room.downloadEnabled,
        canPrint: params.permissions?.canPrint ?? room.printEnabled,
        canShare: false,
        canUpload: false,
        canDelete: false,
        canManageViewers: false,
      },
      createdBy: context.userId,
      createdAt: now.toISOString(),
      label: params.label,
    };

    await docClient.send(new PutCommand({
      TableName: DATA_ROOMS_TABLE,
      Item: {
        pk: `ROOM#${params.dataRoomId}`,
        sk: `LINK#${linkId}`,
        gsi1pk: `TOKEN#${tokenHash}`,
        gsi1sk: 'LINK',
        ...link,
      },
    }));

    console.log(`[SecureDataRoom] Created secure link ${linkId} for room ${params.dataRoomId}`);

    // Return with actual token (not hash) for the URL
    return {
      ...link,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`,
    };
  },

  async validateSecureLink(token: string, pin?: string, email?: string): Promise<{
    valid: boolean;
    link?: SecureLink;
    room?: SecureDataRoom;
    errorReason?: string;
  }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find link by token hash
    const linkResult = await docClient.send(new QueryCommand({
      TableName: DATA_ROOMS_TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `TOKEN#${tokenHash}`,
        ':sk': 'LINK',
      },
    }));

    const link = (linkResult.Items?.[0]) as SecureLink | undefined;
    if (!link) {
      return { valid: false, errorReason: 'Invalid link' };
    }

    // Check expiry
    if (new Date(link.expiresAt) < new Date()) {
      return { valid: false, errorReason: 'Link has expired' };
    }

    // Check max uses
    if (link.maxUses && link.currentUses >= link.maxUses) {
      return { valid: false, errorReason: 'Link usage limit reached' };
    }

    // Check PIN
    if (link.requirePin) {
      if (!pin) {
        return { valid: false, errorReason: 'PIN required' };
      }
      const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
      if (pinHash !== link.pinHash) {
        return { valid: false, errorReason: 'Invalid PIN' };
      }
    }

    // Check email
    if (link.requireEmail) {
      if (!email) {
        return { valid: false, errorReason: 'Email required' };
      }
      if (link.allowedEmails && !link.allowedEmails.includes(email.toLowerCase())) {
        return { valid: false, errorReason: 'Email not authorized' };
      }
    }

    // Get room info
    const roomResult = await docClient.send(new GetCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `TENANT#${link.tenantId}`,
        sk: `ROOM#${link.dataRoomId}`,
      },
    }));

    const room = roomResult.Item as SecureDataRoom | undefined;

    // Increment usage
    await docClient.send(new UpdateCommand({
      TableName: DATA_ROOMS_TABLE,
      Key: {
        pk: `ROOM#${link.dataRoomId}`,
        sk: `LINK#${link.id}`,
      },
      UpdateExpression: 'SET currentUses = currentUses + :inc',
      ExpressionAttributeValues: {
        ':inc': 1,
      },
    }));

    return { valid: true, link, room };
  },

  // ========== Access Logging ==========

  async logAccess(params: Omit<DocumentAccessLog, 'id' | 'timestamp'>): Promise<void> {
    const logId = `log-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const log: DocumentAccessLog = {
      id: logId,
      ...params,
      timestamp,
    };

    await docClient.send(new PutCommand({
      TableName: ACCESS_LOGS_TABLE,
      Item: {
        pk: `ROOM#${params.dataRoomId}`,
        sk: `LOG#${timestamp}#${logId}`,
        gsi1pk: `DOC#${params.documentId}`,
        gsi1sk: `LOG#${timestamp}`,
        gsi2pk: `VIEWER#${params.viewerId}`,
        gsi2sk: `LOG#${timestamp}`,
        ...log,
      },
    }));
  },

  async getAccessLogs(
    context: TenantContext,
    params: {
      dataRoomId: string;
      documentId?: string;
      viewerId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<DocumentAccessLog[]> {
    let queryParams: Record<string, unknown>;

    if (params.documentId) {
      queryParams = {
        TableName: ACCESS_LOGS_TABLE,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `DOC#${params.documentId}`,
        },
      };
    } else if (params.viewerId) {
      queryParams = {
        TableName: ACCESS_LOGS_TABLE,
        IndexName: 'gsi2',
        KeyConditionExpression: 'gsi2pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `VIEWER#${params.viewerId}`,
        },
      };
    } else {
      queryParams = {
        TableName: ACCESS_LOGS_TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `ROOM#${params.dataRoomId}`,
        },
      };
    }

    if (params.limit) {
      queryParams.Limit = params.limit;
    }

    // Add date range filter if specified
    if (params.startDate || params.endDate) {
      const filters: string[] = [];
      const values = queryParams.ExpressionAttributeValues as Record<string, unknown>;

      if (params.startDate) {
        filters.push('#ts >= :start');
        values[':start'] = params.startDate;
      }
      if (params.endDate) {
        filters.push('#ts <= :end');
        values[':end'] = params.endDate;
      }

      queryParams.FilterExpression = filters.join(' AND ');
      queryParams.ExpressionAttributeNames = { '#ts': 'timestamp' };
    }

    queryParams.ScanIndexForward = false; // Most recent first

    const response = await docClient.send(new QueryCommand(queryParams as any));
    return (response.Items || []) as DocumentAccessLog[];
  },

  // ========== Watermark Generation ==========

  generateWatermarkConfig(params: {
    viewerEmail: string;
    viewerName?: string;
    accessTime: string;
    watermarkId: string;
    customText?: string;
  }): WatermarkConfig {
    return {
      text: params.customText || `${params.viewerEmail} | ${new Date(params.accessTime).toLocaleString('sv-SE')} | ID: ${params.watermarkId.substring(0, 8)}`,
      opacity: 0.15,
      fontSize: 14,
      rotation: -30,
      color: '#000000',
      repetitions: 5,
    };
  },
};

export interface WatermarkConfig {
  text: string;
  opacity: number;
  fontSize: number;
  rotation: number;
  color: string;
  repetitions: number;
}


