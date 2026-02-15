import { NextRequest, NextResponse } from 'next/server';
import { DropboxClient, isDropboxConfigured } from '@/lib/integrations/dropbox/dropbox-client';
import { getSyncStore, SyncJob } from '@/lib/integrations/dropbox/sync-store';
import { getUserIdFromSession } from '@/lib/auth/session';
import { parseOr400, dropboxPostBodySchema } from '@/lib/api/validate';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// GET - Get Dropbox connection status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const userId = await getUserIdFromSession();
    if (!userId && action !== 'auth-url') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const effectiveUserId = userId ?? 'default-user';

    const store = getSyncStore();

    if (action === 'status') {
      const connection = await store.getConnection(effectiveUserId);
      const stats = await store.getSyncStats();
      const latestJob = await store.getLatestSyncJob(effectiveUserId);

      return NextResponse.json({
        configured: isDropboxConfigured(),
        connected: !!connection,
        connection: connection ? {
          displayName: connection.displayName,
          email: connection.email,
          connectedAt: connection.connectedAt,
          lastSync: connection.lastSync,
          selectedFolders: connection.selectedFolders,
          syncEnabled: connection.syncEnabled,
        } : null,
        stats,
        latestJob: latestJob ? {
          jobId: latestJob.jobId,
          status: latestJob.status,
          startedAt: latestJob.startedAt,
          completedAt: latestJob.completedAt,
          totalFiles: latestJob.totalFiles,
          processedFiles: latestJob.processedFiles,
          addedFiles: latestJob.addedFiles,
          errors: latestJob.errors.slice(0, 5), // Limit errors shown
        } : null,
      });
    }

    if (action === 'files') {
      const files = await store.listSyncedFiles(100);
      return NextResponse.json({ files });
    }

    if (action === 'auth-url') {
      if (!isDropboxConfigured()) {
        return NextResponse.json({ error: 'Dropbox not configured' }, { status: 400 });
      }

      const client = new DropboxClient({
        clientId: process.env.DROPBOX_CLIENT_ID!,
        clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/dropbox/callback`,
      });

      const state = uuidv4();
      // In production, store state in session for validation
      const authUrl = client.getAuthorizationUrl(state);

      return NextResponse.json({ authUrl, state });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Dropbox API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ============================================================================
// POST - Trigger sync or other actions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = parseOr400(dropboxPostBodySchema, raw);
    if (!parsed.ok) return parsed.response;
    const { action, folders } = parsed.data;

    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = getSyncStore();

    if (action === 'sync') {
      const connection = await store.getConnection(userId);
      if (!connection) {
        return NextResponse.json({ error: 'Not connected to Dropbox' }, { status: 400 });
      }

      // Create a new sync job
      const jobId = uuidv4();
      const job: SyncJob = {
        jobId,
        userId,
        status: 'running',
        startedAt: new Date().toISOString(),
        totalFiles: 0,
        processedFiles: 0,
        addedFiles: 0,
        updatedFiles: 0,
        errors: [],
      };
      await store.saveSyncJob(job);

      // Start sync in background (in production, use SQS/Lambda)
      const client = new DropboxClient({
        clientId: process.env.DROPBOX_CLIENT_ID!,
        clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/dropbox/callback`,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.expiresAt,
      });

      // Run sync asynchronously
      (async () => {
        try {
          const foldersToSync = folders || connection.selectedFolders || [''];
          const result = await client.syncToS3(foldersToSync, async (processed, total, currentFile) => {
            // Update job progress
            job.processedFiles = processed;
            job.totalFiles = total;
            await store.saveSyncJob(job);
          });

          // Update job as completed
          job.status = result.success ? 'completed' : 'failed';
          job.completedAt = new Date().toISOString();
          job.addedFiles = result.filesAdded;
          job.updatedFiles = result.filesUpdated;
          job.errors = result.errors;
          await store.saveSyncJob(job);

          // Update connection last sync
          connection.lastSync = new Date().toISOString();
          await store.saveConnection(connection);

          console.log(`[Dropbox Sync] Completed: ${result.filesAdded} files synced in ${result.duration}ms`);
        } catch (error) {
          job.status = 'failed';
          job.completedAt = new Date().toISOString();
          job.errors = [(error as Error).message];
          await store.saveSyncJob(job);
        }
      })();

      return NextResponse.json({ 
        message: 'Sync started',
        jobId,
      });
    }

    if (action === 'update-folders') {
      const connection = await store.getConnection(userId);
      if (!connection) {
        return NextResponse.json({ error: 'Not connected to Dropbox' }, { status: 400 });
      }

      connection.selectedFolders = folders || [];
      await store.saveConnection(connection);

      return NextResponse.json({ 
        message: 'Folders updated',
        selectedFolders: connection.selectedFolders,
      });
    }

    if (action === 'toggle-sync') {
      const connection = await store.getConnection(userId);
      if (!connection) {
        return NextResponse.json({ error: 'Not connected to Dropbox' }, { status: 400 });
      }

      connection.syncEnabled = body.enabled ?? !connection.syncEnabled;
      await store.saveConnection(connection);

      return NextResponse.json({ 
        syncEnabled: connection.syncEnabled,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Dropbox API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Disconnect Dropbox
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const store = getSyncStore();

    await store.deleteConnection(userId);

    return NextResponse.json({ message: 'Dropbox disconnected' });
  } catch (error) {
    console.error('[Dropbox API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
