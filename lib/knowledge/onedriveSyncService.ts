/**
 * OneDrive sync to Knowledge Base: delta sync files, extract text, upload to Bedrock KB.
 */

import { createMicrosoftClient } from '@/lib/integrations/clients/microsoft';
import type { MicrosoftDriveItem } from '@/lib/integrations/clients/microsoft';
import {
  uploadUserDocument,
  syncKnowledgeBase,
} from '@/lib/compliance/bedrockKnowledgeBase';
import {
  getOneDriveSyncState,
  setOneDriveSyncState,
} from '@/lib/knowledge/onedriveSyncStateStore';
import { extractTextForSync } from '@/lib/documents/extractTextForSync';

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt']);
const MAX_FILES_PER_SYNC = 50;

function isSupportedFile(item: MicrosoftDriveItem): boolean {
  if (item.folder) return false;
  const name = (item.name || '').toLowerCase();
  return [...ALLOWED_EXT].some((ext) => name.endsWith(ext));
}

function inferCategory(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('brand') || lower.includes('varumarke')) return 'brandbook';
  if (lower.includes('brev') || lower.includes('mall') || lower.includes('letter')) return 'brevmall';
  if (lower.includes('rapport') || lower.includes('report')) return 'rapportmall';
  if (lower.includes('policy') || lower.includes('policy')) return 'policy';
  if (lower.includes('avtal') || lower.includes('contract')) return 'avtal';
  return 'company-doc';
}

export interface OneDriveSyncOptions {
  companyId: string;
  /** Optional folder ID to sync (default: root). */
  folderId?: string;
}

export interface OneDriveSyncResult {
  success: boolean;
  syncedCount: number;
  error?: string;
  deltaLink?: string;
  ingestionJobId?: string;
}

/**
 * Run OneDrive delta sync: fetch changed files, extract text, upload to Bedrock KB, trigger ingestion.
 */
export async function runOneDriveSync(options: OneDriveSyncOptions): Promise<OneDriveSyncResult> {
  const { companyId, folderId } = options;

  await setOneDriveSyncState(companyId, { status: 'syncing', error: undefined });

  try {
    const client = await createMicrosoftClient(companyId);
    const state = await getOneDriveSyncState(companyId);
    const deltaLink = state?.deltaLink;
    const effectiveFolderId = folderId ?? state?.folderId;

    const deltaRes = await client.getDriveDelta({
      deltaLink: deltaLink || undefined,
      folderId: effectiveFolderId || undefined,
    });

    if (!deltaRes.success || !deltaRes.data) {
      const err = deltaRes.error || 'Delta request failed';
      await setOneDriveSyncState(companyId, { status: 'error', error: err });
      return { success: false, syncedCount: 0, error: err };
    }

    const { value: items, deltaLink: newDeltaLink } = deltaRes.data;
    const files = items.filter(
      (i) => isSupportedFile(i) && !(i as MicrosoftDriveItem & { deleted?: unknown }).deleted
    ) as MicrosoftDriveItem[];
    const toProcess = files.slice(0, MAX_FILES_PER_SYNC);

    let syncedCount = 0;

    for (const item of toProcess) {
      const name = item.name || 'unknown';
      const contentRes = await client.getDriveItemContent(item.id);
      if (!contentRes.success || !contentRes.data) continue;

      const buf = Buffer.from(contentRes.data);
      let text = await extractTextForSync(buf, name, item.file?.mimeType);
      if (!text || text.length < 30) {
        text = `[Dokument: ${name}. Ingen text kunde extraheras.]`;
      }

      const documentId = `onedrive-${item.id.replace(/[^a-zA-Z0-9-]/g, '_')}`;
      const category = inferCategory(name);
      await uploadUserDocument(companyId, documentId, text, {
        title: name,
        category,
        source: 'OneDrive',
        fileName: name,
        uploadedBy: 'onedrive-sync',
      });
      syncedCount++;
    }

    if (newDeltaLink) {
      await setOneDriveSyncState(companyId, {
        deltaLink: newDeltaLink,
        folderId: effectiveFolderId,
        lastSyncAt: new Date().toISOString(),
        status: 'success',
        syncedCount,
        error: undefined,
      });
    }

    let ingestionJobId: string | undefined;
    if (syncedCount > 0) {
      const syncRes = await syncKnowledgeBase();
      ingestionJobId = syncRes.ingestionJobId;
    }

    return {
      success: true,
      syncedCount,
      deltaLink: newDeltaLink ?? undefined,
      ingestionJobId,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await setOneDriveSyncState(companyId, { status: 'error', error });
    return { success: false, syncedCount: 0, error };
  }
}
