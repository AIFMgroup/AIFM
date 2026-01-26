'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Link2, Plus, Copy, Trash2, Clock, Lock, FileText, 
  CheckCircle2, X, Loader2, Eye, Download, Shield,
  Calendar, Users, ExternalLink, MoreVertical, AlertCircle
} from 'lucide-react';

interface SharedLink {
  id: string;
  token: string;
  shortCode: string;
  documentId?: string;
  folderId?: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxUses?: number;
  currentUses: number;
  recipientEmail?: string;
  recipientName?: string;
  recipientCompany?: string;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canPrint: boolean;
    applyWatermark: boolean;
  };
  requirePassword: boolean;
  requireNda: boolean;
  status: 'active' | 'expired' | 'revoked' | 'exhausted';
  stats?: {
    totalAccesses: number;
    successfulAccesses: number;
    failedAccesses: number;
    uniqueUsers: number;
    lastAccess?: string;
  };
}

interface Props {
  roomId: string;
  documents: Array<{ id: string; name: string }>;
  folders: Array<{ id: string; name: string }>;
}

export default function SharedLinksTab({ roomId, documents, folders }: Props) {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  
  // Create form state
  const [newLink, setNewLink] = useState({
    documentId: '',
    folderId: '',
    recipientEmail: '',
    recipientName: '',
    recipientCompany: '',
    expiresIn: 'days' as 'hours' | 'days' | 'weeks',
    expiresInValue: 7,
    maxUses: 0,
    password: '',
    requireNda: false,
    permissions: {
      canView: true,
      canDownload: false,
      canPrint: false,
      applyWatermark: true,
    },
  });
  const [isCreating, setIsCreating] = useState(false);

  // Fetch links
  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/data-rooms/${roomId}/shared-links`);
      if (response.ok) {
        const data = await response.json();
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    }
    setIsLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Create link
  const handleCreateLink = async () => {
    setIsCreating(true);
    try {
      const response = await fetch(`/api/data-rooms/${roomId}/shared-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: newLink.documentId || undefined,
          folderId: newLink.folderId || undefined,
          recipientEmail: newLink.recipientEmail || undefined,
          recipientName: newLink.recipientName || undefined,
          recipientCompany: newLink.recipientCompany || undefined,
          expiresIn: newLink.expiresIn,
          expiresInValue: newLink.expiresInValue,
          maxUses: newLink.maxUses || undefined,
          password: newLink.password || undefined,
          requireNda: newLink.requireNda,
          permissions: newLink.permissions,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLinks(prev => [{ ...data.link, stats: { totalAccesses: 0, successfulAccesses: 0, failedAccesses: 0, uniqueUsers: 0 } }, ...prev]);
        setShowCreateModal(false);
        resetForm();
        
        // Copy short link (or full link) to clipboard
        const baseUrl = window.location.origin;
        const linkUrl = data.link.shortCode ? `${baseUrl}/s/${data.link.shortCode}` : `${baseUrl}/shared/${data.link.token}`;
        await navigator.clipboard.writeText(linkUrl);
        setCopiedLinkId(data.link.id);
        setTimeout(() => setCopiedLinkId(null), 2000);
      }
    } catch (error) {
      console.error('Error creating link:', error);
    }
    setIsCreating(false);
  };

  // Revoke link
  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Är du säker på att du vill återkalla denna länk?')) return;
    
    try {
      const response = await fetch(`/api/data-rooms/${roomId}/shared-links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      
      if (response.ok) {
        setLinks(prev => prev.map(l => l.id === linkId ? { ...l, status: 'revoked' as const } : l));
      }
    } catch (error) {
      console.error('Error revoking link:', error);
    }
  };

  // Copy link
  const handleCopyLink = async (link: SharedLink) => {
    const baseUrl = window.location.origin;
    // Prefer short link if available
    const linkUrl = link.shortCode ? `${baseUrl}/s/${link.shortCode}` : `${baseUrl}/shared/${link.token}`;
    await navigator.clipboard.writeText(linkUrl);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  // Open link in new tab
  const handleOpenLink = (link: SharedLink) => {
    const url = link.shortCode ? `/s/${link.shortCode}` : `/shared/${link.token}`;
    window.open(url, '_blank');
  };

  // Reset form
  const resetForm = () => {
    setNewLink({
      documentId: '',
      folderId: '',
      recipientEmail: '',
      recipientName: '',
      recipientCompany: '',
      expiresIn: 'days',
      expiresInValue: 7,
      maxUses: 0,
      password: '',
      requireNda: false,
      permissions: {
        canView: true,
        canDownload: false,
        canPrint: false,
        applyWatermark: true,
      },
    });
  };

  // Get status badge
  const getStatusBadge = (status: SharedLink['status']) => {
    const badges = {
      active: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Aktiv' },
      expired: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Utgången' },
      revoked: { bg: 'bg-red-50', text: 'text-red-600', label: 'Återkallad' },
      exhausted: { bg: 'bg-gray-50', text: 'text-gray-600', label: 'Förbrukad' },
    };
    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-aifm-gold animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-aifm-charcoal">Delningslänkar</h3>
          <p className="text-sm text-aifm-charcoal/40 mt-0.5">
            Skapa tidsbegränsade länkar för externa användare
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Skapa länk
        </button>
      </div>

      {/* Links list */}
      {links.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-8 h-8 text-aifm-charcoal/20" />
          </div>
          <p className="text-aifm-charcoal/50 font-medium">Inga delningslänkar</p>
          <p className="text-sm text-aifm-charcoal/30 mt-1">Skapa en länk för att dela dokument externt</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {links.map((link) => (
            <div key={link.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  link.status === 'active' ? 'bg-emerald-50' : 'bg-gray-100'
                }`}>
                  <Link2 className={`w-5 h-5 ${
                    link.status === 'active' ? 'text-emerald-500' : 'text-gray-400'
                  }`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {link.recipientEmail ? (
                      <span className="font-medium text-aifm-charcoal">
                        {link.recipientName || link.recipientEmail}
                      </span>
                    ) : (
                      <span className="font-medium text-aifm-charcoal">Offentlig länk</span>
                    )}
                    {getStatusBadge(link.status)}
                    {link.requirePassword && (
                      <Lock className="w-3.5 h-3.5 text-aifm-charcoal/30" />
                    )}
                    {link.requireNda && (
                      <Shield className="w-3.5 h-3.5 text-aifm-charcoal/30" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-aifm-charcoal/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Utgår {new Date(link.expiresAt).toLocaleDateString('sv-SE')}
                    </span>
                    {link.maxUses && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {link.currentUses}/{link.maxUses} användningar
                      </span>
                    )}
                    {link.stats && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {link.stats.totalAccesses} visningar
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    {link.permissions.canView && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Visa</span>
                    )}
                    {link.permissions.canDownload && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Ladda ner</span>
                    )}
                    {link.permissions.applyWatermark && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">Vattenstämpel</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {link.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleCopyLink(link)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Kopiera länk"
                      >
                        {copiedLinkId === link.id ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-aifm-charcoal/40" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenLink(link)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Öppna länk"
                      >
                        <ExternalLink className="w-4 h-4 text-aifm-charcoal/40" />
                      </button>
                      <button
                        onClick={() => handleRevokeLink(link.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Återkalla länk"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Skapa delningslänk</h3>
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Document/Folder selection */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Dela
                </label>
                <select
                  value={newLink.documentId || newLink.folderId || 'all'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'all') {
                      setNewLink({ ...newLink, documentId: '', folderId: '' });
                    } else if (value.startsWith('doc-')) {
                      setNewLink({ ...newLink, documentId: value, folderId: '' });
                    } else if (value.startsWith('folder-')) {
                      setNewLink({ ...newLink, folderId: value, documentId: '' });
                    }
                  }}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10"
                >
                  <option value="all">Alla dokument i rummet</option>
                  <optgroup label="Mappar">
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>📁 {f.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Dokument">
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>📄 {d.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              
              {/* Recipient */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Mottagarens e-post (valfritt)
                  </label>
                  <input
                    type="email"
                    value={newLink.recipientEmail}
                    onChange={(e) => setNewLink({ ...newLink, recipientEmail: e.target.value })}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                    placeholder="namn@foretag.se"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Namn (valfritt)
                  </label>
                  <input
                    type="text"
                    value={newLink.recipientName}
                    onChange={(e) => setNewLink({ ...newLink, recipientName: e.target.value })}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                    placeholder="Anna Andersson"
                  />
                </div>
              </div>
              
              {/* Expiration */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Giltighet
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={newLink.expiresInValue}
                    onChange={(e) => setNewLink({ ...newLink, expiresInValue: parseInt(e.target.value) || 1 })}
                    className="w-24 py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                  />
                  <select
                    value={newLink.expiresIn}
                    onChange={(e) => setNewLink({ ...newLink, expiresIn: e.target.value as 'hours' | 'days' | 'weeks' })}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                  >
                    <option value="hours">timmar</option>
                    <option value="days">dagar</option>
                    <option value="weeks">veckor</option>
                  </select>
                </div>
              </div>
              
              {/* Max uses */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Max antal användningar (0 = obegränsat)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newLink.maxUses}
                  onChange={(e) => setNewLink({ ...newLink, maxUses: parseInt(e.target.value) || 0 })}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                />
              </div>
              
              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Lösenordsskydd (valfritt)
                </label>
                <input
                  type="password"
                  value={newLink.password}
                  onChange={(e) => setNewLink({ ...newLink, password: e.target.value })}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                  placeholder="Lämna tomt för ingen lösenordsskydd"
                />
              </div>
              
              {/* Permissions */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-3 uppercase tracking-wider">
                  Behörigheter
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newLink.permissions.canView}
                      onChange={(e) => setNewLink({ 
                        ...newLink, 
                        permissions: { ...newLink.permissions, canView: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                    />
                    <span className="text-sm text-aifm-charcoal">Kan förhandsgranska dokument</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newLink.permissions.canDownload}
                      onChange={(e) => setNewLink({ 
                        ...newLink, 
                        permissions: { ...newLink.permissions, canDownload: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                    />
                    <span className="text-sm text-aifm-charcoal">Kan ladda ner dokument</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newLink.permissions.applyWatermark}
                      onChange={(e) => setNewLink({ 
                        ...newLink, 
                        permissions: { ...newLink.permissions, applyWatermark: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                    />
                    <span className="text-sm text-aifm-charcoal">Applicera vattenstämpel</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newLink.requireNda}
                      onChange={(e) => setNewLink({ ...newLink, requireNda: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                    />
                    <span className="text-sm text-aifm-charcoal">Kräv NDA-signering</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={handleCreateLink}
                disabled={isCreating}
                className="flex-1 py-3 px-4 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {isCreating ? 'Skapar...' : 'Skapa & kopiera länk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







