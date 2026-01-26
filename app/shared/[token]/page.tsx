'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  FolderLock, Shield, FileText, Download, Eye, 
  Lock, AlertCircle, CheckCircle2, Clock, Loader2,
  FileSpreadsheet, Image, File, X
} from 'lucide-react';

interface SharedLinkData {
  valid: boolean;
  error?: string;
  requiresPassword?: boolean;
  requiresNda?: boolean;
  ndaVerified?: boolean;
  link?: {
    id: string;
    roomId: string;
    roomName: string;
    roomDescription: string;
    expiresAt: string;
    permissions: {
      canView: boolean;
      canDownload: boolean;
      canPrint: boolean;
      applyWatermark: boolean;
    };
    recipientName?: string;
    recipientCompany?: string;
    requireNda: boolean;
  };
  documents?: Array<{
    id: string;
    name: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }>;
  ndaInfo?: {
    templateId: string;
    name: string;
    requireSignature: boolean;
    requireFullName: boolean;
    requireEmail: boolean;
    requireCompany: boolean;
  };
}

export default function SharedLinkPage() {
  const params = useParams();
  const token = params.token as string;

  // State
  const [data, setData] = useState<SharedLinkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [ndaSigned, setNdaSigned] = useState(false);
  const [showNdaModal, setShowNdaModal] = useState(false);
  const [accessIdentity, setAccessIdentity] = useState({ name: '', email: '' });
  const [ndaForm, setNdaForm] = useState({
    signerName: '',
    signerEmail: '',
    signerCompany: '',
    accepted: false,
  });
  const [isSigningNda, setIsSigningNda] = useState(false);
  const [accessingDocId, setAccessingDocId] = useState<string | null>(null);

  // Fetch link data
  const fetchLinkData = useCallback(async (pwd?: string, nda?: boolean) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (pwd) queryParams.set('password', pwd);
      if (nda) queryParams.set('ndaSigned', 'true');
      // If the link is restricted to a recipient email, or NDA verification is required,
      // we need to provide an email for server-side checks.
      const effectiveEmail = (ndaForm.signerEmail || accessIdentity.email || '').trim();
      if (effectiveEmail) queryParams.set('email', effectiveEmail);
      
      const response = await fetch(`/api/shared/${token}?${queryParams}`);
      const result = await response.json();
      setData(result);
      
      if (result?.ndaVerified) {
        setNdaSigned(true);
      }

      if (result.valid && result.link?.requireNda && !result?.ndaVerified) {
        setShowNdaModal(true);
      }
    } catch (error) {
      console.error('Error fetching link data:', error);
      setData({ valid: false, error: 'fetch_error' });
    }
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    fetchLinkData();
  }, [fetchLinkData]);

  // Handle password submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLinkData(password, ndaSigned);
  };

  // Handle NDA signing
  const handleSignNda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ndaForm.accepted || !ndaForm.signerName || !ndaForm.signerEmail) return;

    setIsSigningNda(true);
    try {
      const response = await fetch(`/api/data-rooms/${data?.link?.roomId}/nda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          signerName: ndaForm.signerName,
          signerEmail: ndaForm.signerEmail,
          signerCompany: ndaForm.signerCompany,
        }),
      });

      if (response.ok) {
        setNdaSigned(true);
        setShowNdaModal(false);
        fetchLinkData(password, true);
      }
    } catch (error) {
      console.error('Error signing NDA:', error);
    }
    setIsSigningNda(false);
  };

  // Handle document access
  const handleDocumentAccess = async (documentId: string, action: 'view' | 'download') => {
    setAccessingDocId(documentId);
    try {
      const effectiveName = (ndaForm.signerName || accessIdentity.name || 'Gäst').trim() || 'Gäst';
      const effectiveEmail = (ndaForm.signerEmail || accessIdentity.email || '').trim();
      const response = await fetch(`/api/shared/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          action,
          password,
          ndaSigned,
          userName: effectiveName,
          userEmail: effectiveEmail,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.url) {
          window.open(result.url, '_blank');
        }
      }
    } catch (error) {
      console.error('Error accessing document:', error);
    }
    setAccessingDocId(null);
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    if (fileType.includes('image')) return <Image className="w-5 h-5 text-purple-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (!data?.valid) {
    // Password required
    if (data?.requiresPassword) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Lösenordsskyddad länk</h1>
            <p className="text-gray-500 text-center mb-6">Ange lösenordet för att få tillgång till dokumenten</p>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ange lösenord"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Fortsätt
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Other errors
    const errorMessages: Record<string, { title: string; message: string; icon: React.ReactNode }> = {
      not_found: { 
        title: 'Länken hittades inte', 
        message: 'Denna delningslänk existerar inte eller har tagits bort.',
        icon: <AlertCircle className="w-8 h-8 text-gray-400" />
      },
      expired: { 
        title: 'Länken har gått ut', 
        message: 'Denna delningslänk har passerat sitt utgångsdatum.',
        icon: <Clock className="w-8 h-8 text-amber-500" />
      },
      revoked: { 
        title: 'Länken är återkallad', 
        message: 'Denna delningslänk har återkallats av avsändaren.',
        icon: <X className="w-8 h-8 text-red-500" />
      },
      exhausted: { 
        title: 'Maxantal nått', 
        message: 'Denna länk har använts maximalt antal gånger.',
        icon: <AlertCircle className="w-8 h-8 text-amber-500" />
      },
      wrong_email: { 
        title: 'Behörighet saknas', 
        message: 'Denna länk är begränsad till en specifik e-postadress. Ange din e-post för att fortsätta.',
        icon: <Lock className="w-8 h-8 text-red-500" />
      },
    };

    const errorInfo = errorMessages[data?.error || 'not_found'] || errorMessages.not_found;

    // Special case: recipient-limited links need an email to validate
    if (data?.error === 'wrong_email') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Verifiera e-post</h1>
            <p className="text-gray-500 text-center mb-6">
              Den här länken är begränsad till en specifik mottagare. Ange din e-post för att fortsätta.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchLinkData(password, ndaSigned);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={accessIdentity.name}
                onChange={(e) => setAccessIdentity((p) => ({ ...p, name: e.target.value }))}
                placeholder="Namn (valfritt)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <input
                type="email"
                value={accessIdentity.email}
                onChange={(e) => setAccessIdentity((p) => ({ ...p, email: e.target.value }))}
                placeholder="E-postadress"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                autoFocus
                required
              />
              {data?.requiresPassword && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Lösenord"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              )}
              <button
                type="submit"
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Fortsätt
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            {errorInfo.icon}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{errorInfo.title}</h1>
          <p className="text-gray-500">{errorInfo.message}</p>
        </div>
      </div>
    );
  }

  const link = data.link!;
  const documents = data.documents || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
              <FolderLock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{link.roomName}</h1>
              <p className="text-sm text-gray-500">{link.roomDescription}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Info banner */}
        <div className="bg-white rounded-xl p-4 mb-6 flex items-center gap-4 shadow-sm">
          <Shield className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              {link.permissions.applyWatermark && 'Dokument är vattenmärkta med din identitet. '}
              Länken går ut {new Date(link.expiresAt).toLocaleDateString('sv-SE')}.
            </p>
          </div>
          {link.recipientName && (
            <span className="text-sm text-gray-500">
              Delat med: {link.recipientName}
            </span>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Dokument ({documents.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(doc.fileSize)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {link.permissions.canView && (
                    <button
                      onClick={() => handleDocumentAccess(doc.id, 'view')}
                      disabled={accessingDocId === doc.id}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Förhandsgranska"
                    >
                      {accessingDocId === doc.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  {link.permissions.canDownload && (
                    <button
                      onClick={() => handleDocumentAccess(doc.id, 'download')}
                      disabled={accessingDocId === doc.id}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Ladda ner"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Säker dokumentdelning via AIFM</p>
        </div>
      </div>

      {/* NDA Modal */}
      {showNdaModal && data.ndaInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Sekretessavtal krävs</h3>
              <p className="text-sm text-gray-500 mt-1">
                Du måste acceptera sekretessavtalet för att få tillgång till dokumenten
              </p>
            </div>
            
            <form onSubmit={handleSignNda} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fullständigt namn *
                </label>
                <input
                  type="text"
                  value={ndaForm.signerName}
                  onChange={(e) => setNdaForm({ ...ndaForm, signerName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-postadress *
                </label>
                <input
                  type="email"
                  value={ndaForm.signerEmail}
                  onChange={(e) => setNdaForm({ ...ndaForm, signerEmail: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
              </div>
              
              {data.ndaInfo.requireCompany && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Företag
                  </label>
                  <input
                    type="text"
                    value={ndaForm.signerCompany}
                    onChange={(e) => setNdaForm({ ...ndaForm, signerCompany: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              )}
              
              <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto">
                <h4 className="font-medium text-gray-900 mb-2">{data.ndaInfo.name}</h4>
                <p className="text-sm text-gray-600">
                  Genom att signera detta avtal förbinder jag mig att behandla all information 
                  som jag får tillgång till genom detta datarum som strikt konfidentiell. 
                  Jag förstår att all information är skyddad av sekretess och får inte delas 
                  med tredje part utan uttryckligt skriftligt medgivande.
                </p>
              </div>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ndaForm.accepted}
                  onChange={(e) => setNdaForm({ ...ndaForm, accepted: e.target.checked })}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-600">
                  Jag har läst och accepterar sekretessavtalet ovan. Jag förstår att brott mot 
                  detta avtal kan medföra rättsliga konsekvenser.
                </span>
              </label>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="flex-1 py-3 px-4 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={!ndaForm.accepted || !ndaForm.signerName || !ndaForm.signerEmail || isSigningNda}
                  className="flex-1 py-3 px-4 text-white bg-gray-900 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSigningNda ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signerar...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Signera och fortsätt
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}







