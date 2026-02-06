'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderOpen,
  FileText,
  Link2,
  Unlink,
  Play,
  Pause,
  Settings,
  ChevronRight,
  Loader2,
  HardDrive,
  Files,
  Zap,
  Shield,
  Database,
  Search,
  Download,
  Trash2,
  FolderPlus,
  Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DropboxStatus {
  configured: boolean;
  connected: boolean;
  connection: {
    displayName: string;
    email: string;
    connectedAt: string;
    lastSync: string | null;
    selectedFolders: string[];
    syncEnabled: boolean;
  } | null;
  stats: {
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    errorFiles: number;
  };
  latestJob: {
    jobId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    totalFiles: number;
    processedFiles: number;
    addedFiles: number;
    errors: string[];
  } | null;
}

interface SyncedFile {
  dropboxPath: string;
  name: string;
  size: number;
  syncedAt: string;
  status: 'synced' | 'pending' | 'error';
}

// ============================================================================
// Main Component
// ============================================================================

export default function DropboxAdminPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<DropboxStatus | null>(null);
  const [files, setFiles] = useState<SyncedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);

  // Check for success/error from OAuth callback
  const connected = searchParams.get('connected');
  const error = searchParams.get('error');

  // Load status
  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, filesRes] = await Promise.all([
        fetch('/api/integrations/dropbox?action=status'),
        fetch('/api/integrations/dropbox?action=files'),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
        if (data.connection?.selectedFolders) {
          setSelectedFolders(data.connection.selectedFolders);
        }
      }

      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to load Dropbox status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Auto-refresh while syncing
  useEffect(() => {
    if (status?.latestJob?.status === 'running') {
      const interval = setInterval(loadStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [status?.latestJob?.status, loadStatus]);

  // Connect to Dropbox
  const handleConnect = async () => {
    try {
      const response = await fetch('/api/integrations/dropbox?action=auth-url');
      if (response.ok) {
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      }
    } catch (error) {
      alert('Kunde inte starta anslutning');
    }
  };

  // Disconnect from Dropbox
  const handleDisconnect = async () => {
    if (!confirm('Är du säker på att du vill koppla bort Dropbox? Synkade filer finns kvar i kunskapsbasen.')) {
      return;
    }

    try {
      await fetch('/api/integrations/dropbox', { method: 'DELETE' });
      loadStatus();
    } catch (error) {
      alert('Kunde inte koppla bort Dropbox');
    }
  };

  // Start sync
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/integrations/dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', folders: selectedFolders }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Synkronisering startad! Job ID: ${data.jobId}`);
        loadStatus();
      } else {
        const error = await response.json();
        alert(`❌ Fel: ${error.error}`);
      }
    } catch (error) {
      alert('Kunde inte starta synkronisering');
    } finally {
      setIsSyncing(false);
    }
  };

  // Add folder
  const handleAddFolder = async () => {
    if (!newFolder.trim()) return;

    const updatedFolders = [...selectedFolders, newFolder.trim()];
    setSelectedFolders(updatedFolders);
    setNewFolder('');
    setShowFolderInput(false);

    try {
      await fetch('/api/integrations/dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-folders', folders: updatedFolders }),
      });
    } catch (error) {
      console.error('Failed to update folders');
    }
  };

  // Remove folder
  const handleRemoveFolder = async (folder: string) => {
    const updatedFolders = selectedFolders.filter(f => f !== folder);
    setSelectedFolders(updatedFolders);

    try {
      await fetch('/api/integrations/dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-folders', folders: updatedFolders }),
      });
    } catch (error) {
      console.error('Failed to update folders');
    }
  };

  // Toggle sync
  const handleToggleSync = async () => {
    try {
      await fetch('/api/integrations/dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-sync' }),
      });
      loadStatus();
    } catch (error) {
      alert('Kunde inte ändra synk-status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
          <p className="text-aifm-charcoal/60">Laddar Dropbox-status...</p>
        </div>
      </div>
    );
  }

  const isJobRunning = status?.latestJob?.status === 'running';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/knowledge-base"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Cloud className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-aifm-charcoal">Dropbox Integration</h1>
              <p className="text-aifm-charcoal/60 mt-1">
                Synka företagets dokument till AI-kunskapsbasen
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {connected && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <p className="text-emerald-700">Dropbox kopplat! Välj mappar att synkronisera nedan.</p>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{decodeURIComponent(error)}</p>
        </div>
      )}

      {/* Not Configured Warning */}
      {!status?.configured && (
        <div className="p-6 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Dropbox inte konfigurerat</h4>
              <p className="text-sm text-amber-700 mt-1">
                För att aktivera Dropbox-integration behöver du:
              </p>
              <ol className="text-sm text-amber-700 mt-2 list-decimal list-inside space-y-1">
                <li>Skapa en app på <a href="https://www.dropbox.com/developers/apps" target="_blank" className="underline">Dropbox Developer Portal</a></li>
                <li>Lägg till miljövariabler: DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET</li>
                <li>Sätt NEXT_PUBLIC_APP_URL till din domän</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Connection Card */}
      {status?.configured && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <div>
                  <h3 className="font-semibold text-aifm-charcoal">
                    {status.connected ? 'Ansluten' : 'Ej ansluten'}
                  </h3>
                  {status.connection && (
                    <p className="text-sm text-aifm-charcoal/60">
                      {status.connection.displayName} ({status.connection.email})
                    </p>
                  )}
                </div>
              </div>

              {status.connected ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleSync}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
                      status.connection?.syncEnabled
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    {status.connection?.syncEnabled ? (
                      <>
                        <Play className="w-4 h-4" />
                        Synk aktiv
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4" />
                        Synk pausad
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <Unlink className="w-4 h-4" />
                    Koppla bort
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  Koppla Dropbox
                </button>
              )}
            </div>
          </div>

          {status.connection && (
            <div className="p-6 bg-gray-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  icon={Files}
                  label="Synkade filer"
                  value={status.stats.syncedFiles}
                  color="emerald"
                />
                <StatCard
                  icon={Clock}
                  label="Väntar"
                  value={status.stats.pendingFiles}
                  color="amber"
                />
                <StatCard
                  icon={AlertCircle}
                  label="Fel"
                  value={status.stats.errorFiles}
                  color="red"
                />
                <StatCard
                  icon={Database}
                  label="Totalt"
                  value={status.stats.totalFiles}
                  color="blue"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Folder Selection */}
      {status?.connected && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-aifm-charcoal">Mappar att synkronisera</h3>
              <p className="text-sm text-aifm-charcoal/60 mt-1">
                Välj vilka Dropbox-mappar som ska indexeras
              </p>
            </div>
            <button
              onClick={() => setShowFolderInput(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Lägg till mapp
            </button>
          </div>

          {showFolderInput && (
            <div className="flex items-center gap-3 mb-4 p-4 bg-blue-50 rounded-xl">
              <FolderOpen className="w-5 h-5 text-blue-500" />
              <input
                type="text"
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="/Dokument/Compliance"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold"
              />
              <button
                onClick={handleAddFolder}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Lägg till
              </button>
              <button
                onClick={() => {
                  setShowFolderInput(false);
                  setNewFolder('');
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
            </div>
          )}

          {selectedFolders.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <FolderOpen className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-aifm-charcoal/60">
                Inga mappar valda. Lägg till mappar för att börja synkronisera.
              </p>
              <p className="text-sm text-aifm-charcoal/40 mt-1">
                Lämna tomt för att synkronisera hela Dropbox (kan ta lång tid)
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedFolders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-amber-500" />
                    <span className="font-mono text-sm">{folder || '/ (hela Dropbox)'}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveFolder(folder)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sync Button */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={handleSync}
              disabled={isSyncing || isJobRunning}
              className="flex items-center justify-center gap-2 w-full py-3 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors disabled:opacity-50"
            >
              {isJobRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Synkroniserar... ({status?.latestJob?.processedFiles || 0}/{status?.latestJob?.totalFiles || '?'})
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Starta synkronisering
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Sync Job Status */}
      {status?.latestJob && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-aifm-charcoal mb-4">Senaste synkronisering</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-aifm-charcoal/50 mb-1">Status</p>
              <StatusBadge status={status.latestJob.status} />
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 mb-1">Startad</p>
              <p className="text-sm font-medium">
                {new Date(status.latestJob.startedAt).toLocaleString('sv-SE')}
              </p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 mb-1">Filer</p>
              <p className="text-sm font-medium">
                {status.latestJob.processedFiles} / {status.latestJob.totalFiles}
              </p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 mb-1">Tillagda</p>
              <p className="text-sm font-medium text-emerald-600">
                +{status.latestJob.addedFiles}
              </p>
            </div>
          </div>

          {status.latestJob.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl">
              <p className="text-sm font-medium text-red-700 mb-2">Fel ({status.latestJob.errors.length}):</p>
              <ul className="text-xs text-red-600 space-y-1">
                {status.latestJob.errors.slice(0, 3).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {status.latestJob.errors.length > 3 && (
                  <li className="text-red-500">...och {status.latestJob.errors.length - 3} till</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Hur fungerar det?</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>1. Välda mappar synkas till AWS S3</li>
              <li>2. Dokumenten indexeras i AWS Bedrock Knowledge Base</li>
              <li>3. AI-assistenten kan söka och hämta information från alla synkade dokument</li>
              <li>4. Stödjer PDF, Word, Excel, text och bildfiler</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Files */}
      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-aifm-charcoal">Senast synkade filer</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {files.slice(0, 10).map((file) => (
              <div key={file.dropboxPath} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50/50">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aifm-charcoal truncate">{file.name}</p>
                  <p className="text-xs text-aifm-charcoal/50 truncate">{file.dropboxPath}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-aifm-charcoal/50">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  <StatusBadge status={file.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub Components
// ============================================================================

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: 'emerald' | 'amber' | 'red' | 'blue';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
  };

  return (
    <div className={`p-3 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-xl font-bold">{value.toLocaleString('sv-SE')}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    synced: { label: 'Synkad', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    completed: { label: 'Klar', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
    running: { label: 'Pågår', color: 'bg-blue-50 text-blue-700', icon: RefreshCw },
    pending: { label: 'Väntar', color: 'bg-amber-50 text-amber-700', icon: Clock },
    error: { label: 'Fel', color: 'bg-red-50 text-red-700', icon: AlertCircle },
    failed: { label: 'Misslyckad', color: 'bg-red-50 text-red-700', icon: AlertCircle },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
