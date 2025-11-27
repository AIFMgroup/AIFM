/**
 * Data Room Mock Data
 * Secure document sharing with granular access control
 */

// ============================================================================
// TYPES
// ============================================================================

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

export interface DataRoomDocument {
  id: string;
  roomId: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  folderId?: string;
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

export interface DataRoomFolder {
  id: string;
  roomId: string;
  name: string;
  parentId?: string;
  createdAt: Date;
  documentsCount: number;
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

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockDataRooms: DataRoom[] = [
  {
    id: 'dr-1',
    name: 'TechStart Förvärv',
    description: 'Due diligence-dokument för förvärv av TechStart AB',
    fundId: 'fund-1',
    fundName: 'Nordic Growth Fund I',
    type: 'DEAL_ROOM',
    status: 'ACTIVE',
    createdAt: new Date('2024-10-15'),
    createdBy: 'Anna Svensson',
    expiresAt: new Date('2024-12-31'),
    documentsCount: 24,
    membersCount: 8,
    lastActivity: new Date('2024-11-27'),
    watermark: true,
    downloadEnabled: true,
  },
  {
    id: 'dr-2',
    name: 'Q4 2024 LP-rapporter',
    description: 'Kvartalsrapporter och kapitalräkningar för LPs',
    fundId: 'fund-1',
    fundName: 'Nordic Growth Fund I',
    type: 'INVESTOR_PORTAL',
    status: 'ACTIVE',
    createdAt: new Date('2024-10-01'),
    createdBy: 'System',
    documentsCount: 15,
    membersCount: 5,
    lastActivity: new Date('2024-11-26'),
    watermark: false,
    downloadEnabled: true,
  },
  {
    id: 'dr-3',
    name: 'Styrelsedokument 2024',
    description: 'Konfidentiella styrelsemötesmaterial',
    fundId: 'fund-1',
    fundName: 'Nordic Growth Fund I',
    type: 'BOARD',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    createdBy: 'Anna Svensson',
    documentsCount: 42,
    membersCount: 4,
    lastActivity: new Date('2024-11-25'),
    watermark: true,
    downloadEnabled: false,
  },
  {
    id: 'dr-4',
    name: 'Ny LP Due Diligence',
    description: 'Material för prospektiv investerare Oslo Pensjonskasse',
    fundId: 'fund-2',
    fundName: 'Scandinavian Tech Fund II',
    type: 'DUE_DILIGENCE',
    status: 'ACTIVE',
    createdAt: new Date('2024-11-01'),
    createdBy: 'Carl Johansson',
    expiresAt: new Date('2025-01-31'),
    documentsCount: 18,
    membersCount: 3,
    lastActivity: new Date('2024-11-27'),
    watermark: true,
    downloadEnabled: true,
  },
  {
    id: 'dr-5',
    name: 'Compliance-arkiv 2023',
    description: 'KYC/AML-dokumentation och regulatoriska rapporter',
    fundId: 'fund-1',
    fundName: 'Nordic Growth Fund I',
    type: 'COMPLIANCE',
    status: 'ARCHIVED',
    createdAt: new Date('2023-01-01'),
    createdBy: 'Compliance Officer',
    documentsCount: 156,
    membersCount: 2,
    lastActivity: new Date('2024-02-15'),
    watermark: true,
    downloadEnabled: false,
  },
];

export const mockDataRoomMembers: DataRoomMember[] = [
  // TechStart Acquisition members
  {
    id: 'drm-1',
    roomId: 'dr-1',
    userId: 'user-1',
    name: 'Anna Svensson',
    email: 'anna@aifm.se',
    company: 'AIFM',
    role: 'OWNER',
    permissions: { view: true, download: true, upload: true, delete: true, invite: true, manageSettings: true },
    invitedAt: new Date('2024-10-15'),
    invitedBy: 'System',
    acceptedAt: new Date('2024-10-15'),
    lastAccess: new Date('2024-11-27'),
    accessCount: 45,
  },
  {
    id: 'drm-2',
    roomId: 'dr-1',
    userId: 'user-2',
    name: 'Erik Lindahl',
    email: 'erik.lindahl@lindahl.se',
    company: 'Advokatfirman Lindahl',
    role: 'MEMBER',
    permissions: { view: true, download: true, upload: true, delete: false, invite: false, manageSettings: false },
    invitedAt: new Date('2024-10-16'),
    invitedBy: 'Anna Svensson',
    acceptedAt: new Date('2024-10-16'),
    lastAccess: new Date('2024-11-26'),
    accessCount: 32,
  },
  {
    id: 'drm-3',
    roomId: 'dr-1',
    userId: 'user-3',
    name: 'Sofia Bergström',
    email: 'sofia.bergstrom@kpmg.se',
    company: 'KPMG',
    role: 'VIEWER',
    permissions: { view: true, download: false, upload: false, delete: false, invite: false, manageSettings: false },
    invitedAt: new Date('2024-10-20'),
    invitedBy: 'Anna Svensson',
    acceptedAt: new Date('2024-10-21'),
    expiresAt: new Date('2024-12-31'),
    lastAccess: new Date('2024-11-24'),
    accessCount: 12,
  },
  {
    id: 'drm-4',
    roomId: 'dr-1',
    userId: 'user-4',
    name: 'Johan Karlsson',
    email: 'johan@techstart.se',
    company: 'TechStart AB',
    role: 'MEMBER',
    permissions: { view: true, download: true, upload: true, delete: false, invite: false, manageSettings: false },
    invitedAt: new Date('2024-10-18'),
    invitedBy: 'Anna Svensson',
    acceptedAt: new Date('2024-10-18'),
    lastAccess: new Date('2024-11-25'),
    accessCount: 28,
  },
  // LP Reports members
  {
    id: 'drm-5',
    roomId: 'dr-2',
    userId: 'inv-1',
    name: 'Första AP-fonden',
    email: 'investments@ap1.se',
    role: 'VIEWER',
    permissions: { view: true, download: true, upload: false, delete: false, invite: false, manageSettings: false },
    invitedAt: new Date('2024-10-01'),
    invitedBy: 'System',
    acceptedAt: new Date('2024-10-01'),
    lastAccess: new Date('2024-11-20'),
    accessCount: 8,
  },
  {
    id: 'drm-6',
    roomId: 'dr-2',
    userId: 'inv-3',
    name: 'Wallenberg Foundations',
    email: 'investments@wallenberg.org',
    role: 'VIEWER',
    permissions: { view: true, download: true, upload: false, delete: false, invite: false, manageSettings: false },
    invitedAt: new Date('2024-10-01'),
    invitedBy: 'System',
    acceptedAt: new Date('2024-10-02'),
    lastAccess: new Date('2024-11-18'),
    accessCount: 5,
  },
];

export const mockDataRoomFolders: DataRoomFolder[] = [
  { id: 'drf-1', roomId: 'dr-1', name: 'Finansiella rapporter', createdAt: new Date('2024-10-15'), documentsCount: 8 },
  { id: 'drf-2', roomId: 'dr-1', name: 'Juridiska dokument', createdAt: new Date('2024-10-15'), documentsCount: 6 },
  { id: 'drf-3', roomId: 'dr-1', name: 'Teknisk Due Diligence', createdAt: new Date('2024-10-16'), documentsCount: 5 },
  { id: 'drf-4', roomId: 'dr-1', name: 'Ledningspresentationer', createdAt: new Date('2024-10-18'), documentsCount: 3 },
  { id: 'drf-5', roomId: 'dr-1', name: 'Ägarstruktur', createdAt: new Date('2024-10-20'), documentsCount: 2 },
  { id: 'drf-6', roomId: 'dr-2', name: 'Q4-rapporter', createdAt: new Date('2024-10-01'), documentsCount: 5 },
  { id: 'drf-7', roomId: 'dr-2', name: 'Kapitalräkningar', createdAt: new Date('2024-10-01'), documentsCount: 5 },
  { id: 'drf-8', roomId: 'dr-2', name: 'Värderingar', createdAt: new Date('2024-10-01'), documentsCount: 5 },
];

export const mockDataRoomDocuments: DataRoomDocument[] = [
  // TechStart Acquisition documents
  {
    id: 'drd-1',
    roomId: 'dr-1',
    name: 'Reviderade finansiella rapporter 2023',
    fileName: 'TechStart_Financials_2023_Audited.pdf',
    fileType: 'application/pdf',
    fileSize: 4500000,
    folderId: 'drf-1',
    uploadedAt: new Date('2024-10-16'),
    uploadedBy: 'Johan Karlsson',
    version: 1,
    status: 'ACTIVE',
    watermarked: true,
    viewCount: 18,
    downloadCount: 5,
    lastViewedAt: new Date('2024-11-26'),
    lastViewedBy: 'Erik Lindahl',
  },
  {
    id: 'drd-2',
    roomId: 'dr-1',
    name: 'Månadsrapporter Q1-Q3 2024',
    fileName: 'TechStart_MgmtAccounts_2024.xlsx',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSize: 850000,
    folderId: 'drf-1',
    uploadedAt: new Date('2024-10-18'),
    uploadedBy: 'Johan Karlsson',
    version: 2,
    status: 'ACTIVE',
    watermarked: true,
    viewCount: 24,
    downloadCount: 8,
    lastViewedAt: new Date('2024-11-27'),
    lastViewedBy: 'Anna Svensson',
  },
  {
    id: 'drd-3',
    roomId: 'dr-1',
    name: 'Aktieöverlåtelseavtal - Utkast',
    fileName: 'SPA_Draft_v3.pdf',
    fileType: 'application/pdf',
    fileSize: 1200000,
    folderId: 'drf-2',
    uploadedAt: new Date('2024-11-15'),
    uploadedBy: 'Erik Lindahl',
    version: 3,
    status: 'ACTIVE',
    watermarked: true,
    viewCount: 12,
    downloadCount: 4,
    lastViewedAt: new Date('2024-11-25'),
    lastViewedBy: 'Anna Svensson',
  },
  {
    id: 'drd-4',
    roomId: 'dr-1',
    name: 'Teknisk arkitekturöversikt',
    fileName: 'TechStart_Architecture_2024.pdf',
    fileType: 'application/pdf',
    fileSize: 3200000,
    folderId: 'drf-3',
    uploadedAt: new Date('2024-10-20'),
    uploadedBy: 'Johan Karlsson',
    version: 1,
    status: 'ACTIVE',
    watermarked: true,
    viewCount: 8,
    downloadCount: 2,
    lastViewedAt: new Date('2024-11-22'),
    lastViewedBy: 'Sofia Bergström',
  },
  {
    id: 'drd-5',
    roomId: 'dr-1',
    name: 'Ägarstruktur - November 2024',
    fileName: 'TechStart_CapTable_Nov2024.xlsx',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSize: 125000,
    folderId: 'drf-5',
    uploadedAt: new Date('2024-11-01'),
    uploadedBy: 'Johan Karlsson',
    version: 1,
    status: 'ACTIVE',
    watermarked: true,
    viewCount: 15,
    downloadCount: 6,
    lastViewedAt: new Date('2024-11-26'),
    lastViewedBy: 'Erik Lindahl',
  },
  // LP Reports documents
  {
    id: 'drd-6',
    roomId: 'dr-2',
    name: 'Kvartalsrapport Q3 2024',
    fileName: 'NGF1_Q3_2024_Report.pdf',
    fileType: 'application/pdf',
    fileSize: 2800000,
    folderId: 'drf-6',
    uploadedAt: new Date('2024-10-15'),
    uploadedBy: 'System',
    version: 1,
    status: 'ACTIVE',
    watermarked: false,
    viewCount: 12,
    downloadCount: 8,
    lastViewedAt: new Date('2024-11-20'),
    lastViewedBy: 'Första AP-fonden',
  },
];

export const mockDataRoomActivities: DataRoomActivity[] = [
  {
    id: 'dra-1',
    roomId: 'dr-1',
    userId: 'user-1',
    userName: 'Anna Svensson',
    action: 'VIEW',
    targetType: 'DOCUMENT',
    targetId: 'drd-2',
    targetName: 'Månadsrapporter Q1-Q3 2024',
    timestamp: new Date('2024-11-27T10:30:00'),
  },
  {
    id: 'dra-2',
    roomId: 'dr-1',
    userId: 'user-2',
    userName: 'Erik Lindahl',
    action: 'DOWNLOAD',
    targetType: 'DOCUMENT',
    targetId: 'drd-5',
    targetName: 'Ägarstruktur - November 2024',
    timestamp: new Date('2024-11-26T15:45:00'),
  },
  {
    id: 'dra-3',
    roomId: 'dr-1',
    userId: 'user-2',
    userName: 'Erik Lindahl',
    action: 'VIEW',
    targetType: 'DOCUMENT',
    targetId: 'drd-1',
    targetName: 'Reviderade finansiella rapporter 2023',
    timestamp: new Date('2024-11-26T14:20:00'),
  },
  {
    id: 'dra-4',
    roomId: 'dr-1',
    userId: 'user-1',
    userName: 'Anna Svensson',
    action: 'UPLOAD',
    targetType: 'DOCUMENT',
    targetId: 'drd-3',
    targetName: 'Aktieöverlåtelseavtal - Utkast',
    timestamp: new Date('2024-11-25T09:15:00'),
  },
  {
    id: 'dra-5',
    roomId: 'dr-1',
    userId: 'user-3',
    userName: 'Sofia Bergström',
    action: 'ACCEPT_INVITE',
    targetType: 'ROOM',
    targetId: 'dr-1',
    targetName: 'TechStart Förvärv',
    timestamp: new Date('2024-10-21T11:00:00'),
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getDataRoomById(id: string): DataRoom | undefined {
  return mockDataRooms.find(r => r.id === id);
}

export function getDataRoomsByFund(fundId: string): DataRoom[] {
  return mockDataRooms.filter(r => r.fundId === fundId);
}

export function getMembersByRoom(roomId: string): DataRoomMember[] {
  return mockDataRoomMembers.filter(m => m.roomId === roomId);
}

export function getFoldersByRoom(roomId: string): DataRoomFolder[] {
  return mockDataRoomFolders.filter(f => f.roomId === roomId);
}

export function getDocumentsByRoom(roomId: string): DataRoomDocument[] {
  return mockDataRoomDocuments.filter(d => d.roomId === roomId);
}

export function getDocumentsByFolder(folderId: string): DataRoomDocument[] {
  return mockDataRoomDocuments.filter(d => d.folderId === folderId);
}

export function getActivitiesByRoom(roomId: string): DataRoomActivity[] {
  return mockDataRoomActivities
    .filter(a => a.roomId === roomId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

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

export function getRoleColor(role: DataRoomMember['role']): string {
  switch (role) {
    case 'OWNER': return 'bg-purple-100 text-purple-700';
    case 'ADMIN': return 'bg-blue-100 text-blue-700';
    case 'MEMBER': return 'bg-green-100 text-green-700';
    case 'VIEWER': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function getTypeColor(type: DataRoom['type']): string {
  // Unified dark brown/charcoal style with white text for all types
  return 'bg-aifm-charcoal text-white';
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
    case 'VIEW': return 'Visade';
    case 'DOWNLOAD': return 'Laddade ned';
    case 'UPLOAD': return 'Laddade upp';
    case 'DELETE': return 'Raderade';
    case 'INVITE': return 'Bjöd in';
    case 'ACCEPT_INVITE': return 'Accepterade inbjudan till';
    case 'UPDATE_SETTINGS': return 'Uppdaterade inställningar';
    case 'CREATE_FOLDER': return 'Skapade mapp';
    default: return action;
  }
}

