/**
 * Data Room Service
 * Handles data room operations with S3 file storage
 */

import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { getItem, putItem, queryPk, updateItem, requirePersistenceOrFallback } from './persistence';
import { s3Client, S3_BUCKET } from './s3';

// Types
export interface DataRoom {
  id: string;
  name: string;
  description: string;
  fundId: string;
  fundName: string;
  type: 'DEAL_ROOM' | 'DUE_DILIGENCE' | 'INVESTOR_PORTAL' | 'BOARD' | 'COMPLIANCE' | 'GENERAL';
  status: 'ACTIVE' | 'ARCHIVED' | 'LOCKED';
  createdAt: Date;
  createdBy: string;
  expiresAt?: Date;
  documentsCount: number;
  membersCount: number;
  lastActivity: Date;
  watermark: boolean;
  downloadEnabled: boolean;
}

export interface DataRoomFolder {
  id: string;
  roomId: string;
  name: string;
  parentId?: string;
  createdAt: Date;
  documentsCount: number;
}

export interface DataRoomDocument {
  id: string;
  roomId: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  folderId?: string;
  s3Key: string;
  uploadedAt: Date;
  uploadedBy: string;
  version: number;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  watermarked: boolean;
  viewCount: number;
  downloadCount: number;
  lastViewedAt?: Date;
  lastViewedBy?: string;
}

export interface DataRoomMember {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  email: string;
  company?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  permissions: {
    view: boolean;
    download: boolean;
    upload: boolean;
    delete: boolean;
    invite: boolean;
    manageSettings: boolean;
  };
  invitedAt: Date;
  invitedBy: string;
  acceptedAt?: Date;
  expiresAt?: Date;
  lastAccess?: Date;
  accessCount: number;
}

export interface DataRoomActivity {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  action: 'VIEW' | 'DOWNLOAD' | 'UPLOAD' | 'DELETE' | 'INVITE' | 'ACCEPT_INVITE' | 'UPDATE_SETTINGS' | 'CREATE_FOLDER';
  targetType: 'DOCUMENT' | 'FOLDER' | 'MEMBER' | 'ROOM';
  targetId: string;
  targetName: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

type StoredRoom = Omit<DataRoom, 'createdAt' | 'lastActivity' | 'expiresAt'> & {
  createdAt: string;
  lastActivity: string;
  expiresAt?: string;
};
type StoredFolder = Omit<DataRoomFolder, 'createdAt'> & { createdAt: string };
type StoredDoc = Omit<DataRoomDocument, 'uploadedAt' | 'lastViewedAt'> & { uploadedAt: string; lastViewedAt?: string };
type StoredMember = Omit<DataRoomMember, 'invitedAt' | 'acceptedAt' | 'expiresAt' | 'lastAccess'> & {
  invitedAt: string;
  acceptedAt?: string;
  expiresAt?: string;
  lastAccess?: string;
};
type StoredActivity = Omit<DataRoomActivity, 'timestamp'> & { timestamp: string };

function roomPk(id: string) { return `ROOM#${id}`; }
function roomsIndexPk() { return 'ROOMS'; }
function roomsIndexSk(id: string) { return `ROOM#${id}`; }
function roomMetaKey(id: string) { return { pk: roomPk(id), sk: 'META' }; }

function parseRoom(item: StoredRoom): DataRoom {
  return {
    ...item,
    createdAt: new Date(item.createdAt),
    lastActivity: new Date(item.lastActivity),
    expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
  };
}
function parseFolder(item: StoredFolder): DataRoomFolder {
  return { ...item, createdAt: new Date(item.createdAt) };
}
function parseDoc(item: StoredDoc): DataRoomDocument {
  return { ...item, uploadedAt: new Date(item.uploadedAt), lastViewedAt: item.lastViewedAt ? new Date(item.lastViewedAt) : undefined };
}
function parseMember(item: StoredMember): DataRoomMember {
  return {
    ...item,
    invitedAt: new Date(item.invitedAt),
    acceptedAt: item.acceptedAt ? new Date(item.acceptedAt) : undefined,
    expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
    lastAccess: item.lastAccess ? new Date(item.lastAccess) : undefined,
  };
}
function parseActivity(item: StoredActivity): DataRoomActivity {
  return { ...item, timestamp: new Date(item.timestamp) };
}

class DataRoomStore {
  private persistenceEnabled = requirePersistenceOrFallback('dataRoomStore');
  private seeded = false;

  private async ensureSeeded() {
    if (!this.persistenceEnabled || this.seeded) return;
    this.seeded = true;
    const existing = await queryPk<any>(roomsIndexPk(), 'ROOM#', 1);
    if (existing.length > 0) return;

    // Create a default room on first run to keep UX consistent
    const id = 'dr-default';
    const now = new Date().toISOString();
    const defaultRoom: StoredRoom = {
      id,
      name: 'Allmänna dokument',
      description: 'Delat utrymme för allmänna dokument',
      fundId: 'fund-1',
      fundName: 'Nordic Growth Fund I',
      type: 'GENERAL',
      status: 'ACTIVE',
      createdAt: now,
      createdBy: 'System',
      documentsCount: 0,
      membersCount: 1,
      lastActivity: now,
      watermark: false,
      downloadEnabled: true,
    };

    await putItem({ pk: roomPk(id), sk: 'META', ...defaultRoom });
    await putItem({ pk: roomsIndexPk(), sk: roomsIndexSk(id), ...defaultRoom });

    // Default folders
    const folders: Array<{ id: string; name: string }> = [
      { id: 'folder-1', name: 'Avtal' },
      { id: 'folder-2', name: 'Rapporter' },
      { id: 'folder-3', name: 'Presentations' },
    ];
    for (const f of folders) {
      const folder: StoredFolder = { id: f.id, roomId: id, name: f.name, createdAt: now, documentsCount: 0 };
      await putItem({ pk: roomPk(id), sk: `FOLDER#${folder.id}`, ...folder });
    }

    const member: StoredMember = {
      id: 'member-1',
      roomId: id,
      userId: 'system',
      name: 'System',
      email: 'system@aifm.se',
      role: 'OWNER',
      permissions: { view: true, download: true, upload: true, delete: true, invite: true, manageSettings: true },
      invitedAt: now,
      invitedBy: 'System',
      acceptedAt: now,
      accessCount: 0,
    };
    await putItem({ pk: roomPk(id), sk: `MEMBER#${member.id}`, ...member });
  }

  // Room operations
  async getAllRooms(): Promise<DataRoom[]> {
    if (!this.persistenceEnabled) return [];
    await this.ensureSeeded();
    const items = await queryPk<StoredRoom>(roomsIndexPk(), 'ROOM#', 200, false);
    return items.map(parseRoom);
  }

  async getRoomById(id: string): Promise<DataRoom | undefined> {
    if (!this.persistenceEnabled) return undefined;
    await this.ensureSeeded();
    const item = await getItem<StoredRoom>(roomMetaKey(id));
    return item ? parseRoom(item) : undefined;
  }

  async createRoom(
    room: Omit<DataRoom, 'id' | 'createdAt' | 'lastActivity' | 'documentsCount' | 'membersCount'> & {
      ownerEmail?: string;
      ownerUserId?: string;
      ownerName?: string;
    }
  ): Promise<DataRoom> {
    if (!this.persistenceEnabled) throw new Error('DataRooms persistence not configured');
    await this.ensureSeeded();
    const id = `dr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const { ownerEmail, ownerUserId, ownerName, ...roomData } = room as any;
    const stored: StoredRoom = {
      ...(roomData as any),
      id,
      createdAt: now,
      lastActivity: now,
      expiresAt: room.expiresAt ? room.expiresAt.toISOString() : undefined,
      documentsCount: 0,
      membersCount: 1,
    };

    await putItem({ pk: roomPk(id), sk: 'META', ...stored });
    await putItem({ pk: roomsIndexPk(), sk: roomsIndexSk(id), ...stored });

    // Owner member
    const owner: StoredMember = {
      id: `member-${crypto.randomUUID()}`,
      roomId: id,
      userId: ownerUserId || ownerEmail || room.createdBy,
      name: ownerName || room.createdBy,
      email: ownerEmail || `${String(room.createdBy).toLowerCase().replace(/\s+/g, '.')}@aifm.se`,
      role: 'OWNER',
      permissions: { view: true, download: true, upload: true, delete: true, invite: true, manageSettings: true },
      invitedAt: now,
      invitedBy: 'System',
      acceptedAt: now,
      accessCount: 0,
    };
    await putItem({ pk: roomPk(id), sk: `MEMBER#${owner.id}`, ...owner });

    return parseRoom(stored);
  }

  async updateRoom(id: string, updates: Partial<DataRoom>): Promise<DataRoom | undefined> {
    if (!this.persistenceEnabled) return undefined;
    const existing = await this.getRoomById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const merged: StoredRoom = {
      ...(existing as any),
      ...(updates as any),
      createdAt: existing.createdAt.toISOString(),
      lastActivity: now,
      expiresAt: updates.expiresAt ? updates.expiresAt.toISOString() : existing.expiresAt?.toISOString(),
    };
    await putItem({ pk: roomPk(id), sk: 'META', ...merged });
    await putItem({ pk: roomsIndexPk(), sk: roomsIndexSk(id), ...merged });
    return parseRoom(merged);
  }

  async deleteRoom(id: string): Promise<boolean> {
    // We keep archive semantics at API layer; hard delete not implemented for persistence
    const room = await this.getRoomById(id);
    if (!room) return false;
    await this.updateRoom(id, { status: 'ARCHIVED' } as any);
    return true;
  }

  // Folder operations
  async getFoldersByRoom(roomId: string): Promise<DataRoomFolder[]> {
    if (!this.persistenceEnabled) return [];
    const items = await queryPk<StoredFolder>(roomPk(roomId), 'FOLDER#', 500);
    return items.map(parseFolder);
  }

  async createFolder(folder: Omit<DataRoomFolder, 'id' | 'createdAt' | 'documentsCount'>): Promise<DataRoomFolder> {
    if (!this.persistenceEnabled) throw new Error('DataRooms persistence not configured');
    const id = `folder-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const stored: StoredFolder = { ...(folder as any), id, createdAt: now, documentsCount: 0 };
    await putItem({ pk: roomPk(folder.roomId), sk: `FOLDER#${id}`, ...stored });
    await this.updateRoom(folder.roomId, {});
    return parseFolder(stored);
  }

  async deleteFolder(id: string, roomId: string): Promise<boolean> {
    if (!this.persistenceEnabled) return false;
    await updateItem({ pk: roomPk(roomId), sk: `FOLDER#${id}` }, 'SET deleted = :d', { ':d': true });
    return true;
  }

  // Document operations
  async getDocumentsByRoom(roomId: string): Promise<DataRoomDocument[]> {
    if (!this.persistenceEnabled) return [];
    const items = await queryPk<StoredDoc>(roomPk(roomId), 'DOC#', 1000);
    return items.map(parseDoc).filter(d => d.status === 'ACTIVE');
  }

  async getDocumentsByFolder(folderId: string, roomId: string): Promise<DataRoomDocument[]> {
    const docs = await this.getDocumentsByRoom(roomId);
    return docs.filter(d => d.folderId === folderId);
  }

  async getDocumentById(docId: string, roomId: string): Promise<DataRoomDocument | undefined> {
    if (!this.persistenceEnabled) return undefined;
    const item = await getItem<StoredDoc>({ pk: roomPk(roomId), sk: `DOC#${docId}` });
    return item ? parseDoc(item) : undefined;
  }

  async createDocument(
    doc: Omit<DataRoomDocument, 'id' | 'uploadedAt' | 'version' | 'status' | 'viewCount' | 'downloadCount'>
  ): Promise<DataRoomDocument> {
    if (!this.persistenceEnabled) throw new Error('DataRooms persistence not configured');
    const id = `doc-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const stored: StoredDoc = {
      ...(doc as any),
      id,
      uploadedAt: now,
      version: 1,
      status: 'ACTIVE',
      viewCount: 0,
      downloadCount: 0,
    };
    await putItem({ pk: roomPk(doc.roomId), sk: `DOC#${id}`, ...stored });
    // Update room counts
    const room = await this.getRoomById(doc.roomId);
    if (room) await this.updateRoom(doc.roomId, { documentsCount: (room.documentsCount || 0) + 1 } as any);
    return parseDoc(stored);
  }

  async incrementDocumentViews(docId: string, roomId: string, viewedBy: string): Promise<void> {
    if (!this.persistenceEnabled) return;
    const now = new Date().toISOString();
    await updateItem(
      { pk: roomPk(roomId), sk: `DOC#${docId}` },
      'SET viewCount = if_not_exists(viewCount, :z) + :one, lastViewedAt = :now, lastViewedBy = :by',
      { ':z': 0, ':one': 1, ':now': now, ':by': viewedBy }
    );
  }

  async incrementDocumentDownloads(docId: string, roomId: string): Promise<void> {
    if (!this.persistenceEnabled) return;
    await updateItem(
      { pk: roomPk(roomId), sk: `DOC#${docId}` },
      'SET downloadCount = if_not_exists(downloadCount, :z) + :one',
      { ':z': 0, ':one': 1 }
    );
  }

  async deleteDocument(docId: string, roomId: string): Promise<boolean> {
    if (!this.persistenceEnabled) return false;
    await updateItem(
      { pk: roomPk(roomId), sk: `DOC#${docId}` },
      'SET #status = :deleted',
      { ':deleted': 'DELETED' },
      { '#status': 'status' }
    );
    return true;
  }

  // Member operations
  async getMembersByRoom(roomId: string): Promise<DataRoomMember[]> {
    if (!this.persistenceEnabled) return [];
    const items = await queryPk<StoredMember>(roomPk(roomId), 'MEMBER#', 500);
    return items.map(parseMember);
  }

  async getMemberById(memberId: string, roomId: string): Promise<DataRoomMember | undefined> {
    if (!this.persistenceEnabled) return undefined;
    const item = await getItem<StoredMember>({ pk: roomPk(roomId), sk: `MEMBER#${memberId}` });
    return item ? parseMember(item) : undefined;
  }

  async getMemberByEmail(roomId: string, email: string): Promise<DataRoomMember | undefined> {
    const members = await this.getMembersByRoom(roomId);
    return members.find(m => m.email.toLowerCase() === email.toLowerCase());
  }

  async createMember(member: Omit<DataRoomMember, 'id' | 'invitedAt' | 'accessCount'>): Promise<DataRoomMember> {
    if (!this.persistenceEnabled) throw new Error('DataRooms persistence not configured');
    const id = `member-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const stored: StoredMember = {
      ...(member as any),
      id,
      invitedAt: now,
      acceptedAt: member.acceptedAt ? member.acceptedAt.toISOString() : undefined,
      expiresAt: member.expiresAt ? member.expiresAt.toISOString() : undefined,
      lastAccess: member.lastAccess ? member.lastAccess.toISOString() : undefined,
      accessCount: 0,
    };
    await putItem({ pk: roomPk(member.roomId), sk: `MEMBER#${id}`, ...stored });
    const room = await this.getRoomById(member.roomId);
    if (room) await this.updateRoom(member.roomId, { membersCount: (room.membersCount || 0) + 1 } as any);
    return parseMember(stored);
  }

  async updateMember(memberId: string, roomId: string, updates: Partial<DataRoomMember>): Promise<DataRoomMember | undefined> {
    const existing = await this.getMemberById(memberId, roomId);
    if (!existing) return undefined;
    const merged: StoredMember = {
      ...(existing as any),
      ...(updates as any),
      invitedAt: existing.invitedAt.toISOString(),
      acceptedAt: updates.acceptedAt ? updates.acceptedAt.toISOString() : existing.acceptedAt?.toISOString(),
      expiresAt: updates.expiresAt ? updates.expiresAt.toISOString() : existing.expiresAt?.toISOString(),
      lastAccess: updates.lastAccess ? updates.lastAccess.toISOString() : existing.lastAccess?.toISOString(),
    };
    await putItem({ pk: roomPk(roomId), sk: `MEMBER#${memberId}`, ...merged });
    return parseMember(merged);
  }

  async deleteMember(memberId: string, roomId: string): Promise<boolean> {
    const member = await this.getMemberById(memberId, roomId);
    if (!member || member.role === 'OWNER') return false;
    await updateItem({ pk: roomPk(roomId), sk: `MEMBER#${memberId}` }, 'SET deleted = :d', { ':d': true });
    return true;
  }

  // Activity operations
  async getActivitiesByRoom(roomId: string, limit: number = 50): Promise<DataRoomActivity[]> {
    if (!this.persistenceEnabled) return [];
    const items = await queryPk<StoredActivity>(roomPk(roomId), 'ACT#', limit, false);
    return items.map(parseActivity).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async logActivity(activity: Omit<DataRoomActivity, 'id' | 'timestamp'>): Promise<DataRoomActivity> {
    if (!this.persistenceEnabled) throw new Error('DataRooms persistence not configured');
    const id = `activity-${crypto.randomUUID()}`;
    const ts = new Date().toISOString();
    const stored: StoredActivity = { ...(activity as any), id, timestamp: ts };
    await putItem({ pk: roomPk(activity.roomId), sk: `ACT#${ts}#${id}`, ...stored });
    await this.updateRoom(activity.roomId, {});
    return parseActivity(stored);
  }
}

// Singleton instance (async store)
export const dataRoomStore = new DataRoomStore();

// S3 Helper Functions
export async function generateUploadUrl(
  roomId: string,
  folderId: string | null,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Key = `datarooms/${roomId}/${folderId || 'root'}/${Date.now()}-${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

  return { uploadUrl, s3Key };
}

export async function generateDownloadUrl(s3Key: string, fileName: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

export async function generateViewUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });

  await s3Client.send(command);
}

// Helper functions
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(fileType: string): string {
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'excel';
  if (fileType.includes('word') || fileType.includes('document')) return 'word';
  if (fileType.includes('image')) return 'image';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return 'ppt';
  return 'file';
}

export function getRolePermissions(role: DataRoomMember['role']): DataRoomMember['permissions'] {
  switch (role) {
    case 'OWNER':
      return { view: true, download: true, upload: true, delete: true, invite: true, manageSettings: true };
    case 'ADMIN':
      return { view: true, download: true, upload: true, delete: true, invite: true, manageSettings: false };
    case 'MEMBER':
      return { view: true, download: true, upload: true, delete: false, invite: false, manageSettings: false };
    case 'VIEWER':
      return { view: true, download: false, upload: false, delete: false, invite: false, manageSettings: false };
  }
}

export function getTypeLabel(type: DataRoom['type']): string {
  switch (type) {
    case 'DEAL_ROOM': return 'Affärsrum';
    case 'DUE_DILIGENCE': return 'Due Diligence';
    case 'INVESTOR_PORTAL': return 'Investerarportal';
    case 'BOARD': return 'Styrelse';
    case 'COMPLIANCE': return 'Compliance';
    case 'GENERAL': return 'Allmänt';
    default: return type;
  }
}

export function getActionLabel(action: DataRoomActivity['action']): string {
  switch (action) {
    case 'VIEW': return 'visade';
    case 'DOWNLOAD': return 'laddade ned';
    case 'UPLOAD': return 'laddade upp';
    case 'DELETE': return 'raderade';
    case 'INVITE': return 'bjöd in';
    case 'ACCEPT_INVITE': return 'accepterade inbjudan till';
    case 'UPDATE_SETTINGS': return 'uppdaterade inställningar för';
    case 'CREATE_FOLDER': return 'skapade mapp';
    default: return action;
  }
}


