/**
 * Server-side utility to archive analysis PDFs to the user's personal datarum.
 * Called directly from export-pdf API routes after generating the PDF.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { dataRoomStore } from './dataRoomService';
import { s3Client, S3_BUCKET } from './s3';

export type AnalysisType = 'esg' | 'investment-analysis' | 'securities' | 'delegation' | 'helhetsanalys';

const FOLDER_NAMES: Record<AnalysisType, string> = {
  esg: 'ESG-analyser',
  'investment-analysis': 'Investeringsanalyser',
  securities: 'Värdepappersgodkännanden',
  delegation: 'Delegationsövervakningar',
  helhetsanalys: 'Helhetsanalyser',
};

const PERSONAL_ROOM_NAME = 'Mina analyser';

/**
 * Find or create the personal datarum for the given user (by email).
 * Uses a stable room name per user so all their analyses land in one place.
 */
async function getOrCreatePersonalRoom(userEmail: string, userName: string): Promise<{ id: string }> {
  const rooms = await dataRoomStore.getAllRooms();
  const existing = rooms.find(
    (r) => r.createdBy === userEmail && r.type === 'COMPLIANCE' && r.name.startsWith('Mina analyser')
  );
  if (existing) {
    console.log(`[archive] Found existing personal room ${existing.id} for ${userEmail}`);
    return { id: existing.id };
  }

  console.log(`[archive] Creating personal room for ${userEmail}`);
  const displayName = userName && userName !== userEmail ? userName : userEmail.split('@')[0];
  const room = await dataRoomStore.createRoom({
    name: `${PERSONAL_ROOM_NAME} – ${displayName}`,
    description: 'Automatiskt arkiv för alla analyser (ESG, investeringar, värdepapper, delegationer).',
    fundId: 'personal',
    fundName: PERSONAL_ROOM_NAME,
    type: 'COMPLIANCE',
    status: 'ACTIVE',
    createdBy: userEmail,
    watermark: false,
    downloadEnabled: true,
    ownerEmail: userEmail,
    ownerUserId: userEmail,
    ownerName: userName,
  });
  console.log(`[archive] Created personal room ${room.id} for ${userEmail}`);
  return { id: room.id };
}

/**
 * Find or create the folder for the given analysis type in the room.
 */
async function getOrCreateFolder(roomId: string, analysisType: AnalysisType): Promise<{ id: string }> {
  const folders = await dataRoomStore.getFoldersByRoom(roomId);
  const folderName = FOLDER_NAMES[analysisType];
  const existing = folders.find((f) => f.name === folderName);
  if (existing) return { id: existing.id };

  console.log(`[archive] Creating folder "${folderName}" in room ${roomId}`);
  const folder = await dataRoomStore.createFolder({
    roomId,
    name: folderName,
  });
  return { id: folder.id };
}

/**
 * Archive a PDF to the user's personal datarum. Creates room and folder if needed.
 * Each export creates a new document entry (no dedup) so the user has a full history.
 */
export async function archiveToDataroom(params: {
  userEmail: string;
  userName: string;
  analysisType: AnalysisType;
  fileName: string;
  pdfBuffer: Buffer;
  skipIfExists?: boolean;
}): Promise<{ documentId: string; roomId: string; folderId: string }> {
  const { userEmail, userName, analysisType, fileName, pdfBuffer, skipIfExists = false } = params;

  console.log(`[archive] Archiving "${fileName}" (${analysisType}) for ${userEmail}, size=${pdfBuffer.length}`);

  const { id: roomId } = await getOrCreatePersonalRoom(userEmail, userName);
  const { id: folderId } = await getOrCreateFolder(roomId, analysisType);

  if (skipIfExists) {
    const existingDocs = await dataRoomStore.getDocumentsByFolder(folderId, roomId);
    const alreadyExists = existingDocs.some(
      (d) => d.fileName === fileName || d.name === fileName
    );
    if (alreadyExists) {
      const doc = existingDocs.find((d) => d.fileName === fileName || d.name === fileName)!;
      console.log(`[archive] Document already exists: ${doc.id}`);
      return { documentId: doc.id, roomId, folderId };
    }
  }

  const s3Key = `datarooms/${roomId}/${folderId}/${Date.now()}-${fileName}`;
  console.log(`[archive] Uploading to S3: ${s3Key}`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );

  const doc = await dataRoomStore.createDocument({
    roomId,
    name: fileName,
    fileName,
    fileType: 'application/pdf',
    fileSize: pdfBuffer.length,
    folderId,
    s3Key,
    uploadedBy: userName,
    watermarked: false,
  });

  await dataRoomStore.logActivity({
    roomId,
    userId: userEmail,
    userName,
    action: 'UPLOAD',
    targetType: 'DOCUMENT',
    targetId: doc.id,
    targetName: doc.name,
  });

  console.log(`[archive] Successfully archived: docId=${doc.id}, room=${roomId}, folder=${folderId}`);
  return { documentId: doc.id, roomId, folderId };
}
