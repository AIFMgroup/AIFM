/**
 * Data Room Client
 * Frontend client for interacting with the data room API
 */

import type {
  DataRoom,
  DataRoomFolder,
  DataRoomDocument,
  DataRoomMember,
  DataRoomActivity,
} from './dataRoomService';

const API_BASE = '/api/data-rooms';

// Type exports for frontend use
export type {
  DataRoom,
  DataRoomFolder,
  DataRoomDocument,
  DataRoomMember,
  DataRoomActivity,
};

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Helper function for API calls
async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'same-origin', // Important: Include cookies with requests
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'An error occurred' };
    }

    return { data };
  } catch (error) {
    console.error('API call error:', error);
    return { error: 'Network error' };
  }
}

// ============================================================================
// DATA ROOM OPERATIONS
// ============================================================================

export async function getDataRooms(): Promise<ApiResponse<{ rooms: DataRoom[] }>> {
  return apiCall(`${API_BASE}`);
}

export async function getDataRoom(id: string): Promise<ApiResponse<{
  room: DataRoom;
  folders: DataRoomFolder[];
  documents: DataRoomDocument[];
  members: DataRoomMember[];
  activities: DataRoomActivity[];
}>> {
  return apiCall(`${API_BASE}/${id}`);
}

export async function createDataRoom(room: {
  name: string;
  description?: string;
  fundId?: string;
  fundName?: string;
  type: DataRoom['type'];
  watermark?: boolean;
  downloadEnabled?: boolean;
  expiresAt?: string;
  createdBy?: string;
}): Promise<ApiResponse<{ room: DataRoom }>> {
  return apiCall(`${API_BASE}`, {
    method: 'POST',
    body: JSON.stringify(room),
  });
}

export async function updateDataRoom(
  id: string,
  updates: Partial<DataRoom>
): Promise<ApiResponse<{ room: DataRoom }>> {
  return apiCall(`${API_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteDataRoom(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return apiCall(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

export async function getFolders(roomId: string): Promise<ApiResponse<{ folders: DataRoomFolder[] }>> {
  return apiCall(`${API_BASE}/${roomId}/folders`);
}

export async function createFolder(
  roomId: string,
  folder: { name: string; parentId?: string; createdBy?: string }
): Promise<ApiResponse<{ folder: DataRoomFolder }>> {
  return apiCall(`${API_BASE}/${roomId}/folders`, {
    method: 'POST',
    body: JSON.stringify(folder),
  });
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export async function getDocuments(
  roomId: string,
  folderId?: string
): Promise<ApiResponse<{ documents: DataRoomDocument[] }>> {
  const url = folderId
    ? `${API_BASE}/${roomId}/documents?folderId=${folderId}`
    : `${API_BASE}/${roomId}/documents`;
  return apiCall(url);
}

export async function getUploadUrl(
  roomId: string,
  fileName: string,
  contentType: string,
  folderId?: string
): Promise<ApiResponse<{ uploadUrl: string; s3Key: string }>> {
  return apiCall(`${API_BASE}/${roomId}/documents/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType, folderId }),
  });
}

export async function createDocument(
  roomId: string,
  document: {
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    folderId?: string;
    s3Key: string;
    uploadedBy?: string;
  }
): Promise<ApiResponse<{ document: DataRoomDocument }>> {
  return apiCall(`${API_BASE}/${roomId}/documents`, {
    method: 'POST',
    body: JSON.stringify(document),
  });
}

export async function getDownloadUrl(
  roomId: string,
  docId: string,
  viewOnly: boolean = false,
  requestedBy?: string
): Promise<ApiResponse<{ url: string }>> {
  const params = new URLSearchParams();
  if (viewOnly) params.set('view', 'true');
  if (requestedBy) params.set('requestedBy', requestedBy);
  
  return apiCall(`${API_BASE}/${roomId}/documents/${docId}/download?${params.toString()}`);
}

export async function deleteDocument(
  roomId: string,
  docId: string,
  deletedBy?: string
): Promise<ApiResponse<{ success: boolean }>> {
  const params = deletedBy ? `?deletedBy=${encodeURIComponent(deletedBy)}` : '';
  return apiCall(`${API_BASE}/${roomId}/documents/${docId}${params}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// UPLOAD HELPER
// ============================================================================

export async function uploadDocument(
  roomId: string,
  file: File,
  folderId?: string,
  uploadedBy?: string,
  onProgress?: (progress: number) => void
): Promise<ApiResponse<{ document: DataRoomDocument }>> {
  try {
    // 1. Get presigned upload URL
    const uploadUrlResponse = await getUploadUrl(
      roomId,
      file.name,
      file.type || 'application/octet-stream',
      folderId
    );

    if (uploadUrlResponse.error || !uploadUrlResponse.data) {
      return { error: uploadUrlResponse.error || 'Failed to get upload URL' };
    }

    const { uploadUrl, s3Key } = uploadUrlResponse.data;

    // 2. Upload file to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });

    if (!uploadResponse.ok) {
      return { error: 'Failed to upload file to storage' };
    }

    // 3. Create document record
    const documentResponse = await createDocument(roomId, {
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for display name
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      folderId,
      s3Key,
      uploadedBy,
    });

    return documentResponse;
  } catch (error) {
    console.error('Upload error:', error);
    return { error: 'Upload failed' };
  }
}

// ============================================================================
// MEMBER OPERATIONS
// ============================================================================

export async function getMembers(roomId: string): Promise<ApiResponse<{ members: DataRoomMember[] }>> {
  return apiCall(`${API_BASE}/${roomId}/members`);
}

export async function inviteMember(
  roomId: string,
  member: {
    email: string;
    name?: string;
    role: DataRoomMember['role'];
    company?: string;
    invitedBy?: string;
    expiresAt?: string;
  }
): Promise<ApiResponse<{ member: DataRoomMember }>> {
  return apiCall(`${API_BASE}/${roomId}/members`, {
    method: 'POST',
    body: JSON.stringify(member),
  });
}

export async function updateMember(
  roomId: string,
  memberId: string,
  updates: Partial<DataRoomMember>
): Promise<ApiResponse<{ member: DataRoomMember }>> {
  return apiCall(`${API_BASE}/${roomId}/members/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function removeMember(
  roomId: string,
  memberId: string
): Promise<ApiResponse<{ success: boolean }>> {
  return apiCall(`${API_BASE}/${roomId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(fileType: string): 'pdf' | 'excel' | 'word' | 'image' | 'ppt' | 'file' {
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('xlsx') || fileType.includes('xls')) return 'excel';
  if (fileType.includes('word') || fileType.includes('document') || fileType.includes('docx') || fileType.includes('doc')) return 'word';
  if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) return 'image';
  if (fileType.includes('presentation') || fileType.includes('powerpoint') || fileType.includes('pptx') || fileType.includes('ppt')) return 'ppt';
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

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


