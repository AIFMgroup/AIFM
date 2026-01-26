'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  FolderLock, ArrowLeft, Users, FileText, Shield,
  Upload, Download, Eye, Trash2, Plus,
  Folder, File, FileSpreadsheet, Image, MoreVertical,
  Settings, UserPlus, History, Search, LayoutGrid, List,
  CheckCircle2, X, Mail, Loader2, Link2, Activity
} from 'lucide-react';
import SharedLinksTab from '@/components/dataRoom/SharedLinksTab';
import DetailedActivityTab from '@/components/dataRoom/DetailedActivityTab';
import {
  getDataRoom, createFolder, uploadDocument, getDownloadUrl, deleteDocument,
  inviteMember, removeMember, updateDataRoom,
  formatFileSize, getFileIcon, getRoleColor, getTypeLabel, getActionLabel, formatDate, formatDateTime,
  type DataRoom, type DataRoomFolder, type DataRoomDocument, type DataRoomMember, type DataRoomActivity
} from '@/lib/dataRooms/dataRoomClient';


// Tab Button Component
function TabButton({ 
  label, 
  icon: Icon, 
  count,
  isActive, 
  onClick 
}: { 
  label: string; 
  icon: React.ElementType;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all duration-300 relative
        ${isActive
          ? 'text-aifm-charcoal'
          : 'text-aifm-charcoal/40 hover:text-aifm-charcoal/70'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isActive ? 'bg-aifm-gold/10 text-aifm-gold' : 'bg-gray-100 text-gray-500'
        }`}>
          {count}
        </span>
      )}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aifm-gold rounded-full" />
      )}
    </button>
  );
}

export default function DataRoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const roomId = params.id as string;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [room, setRoom] = useState<DataRoom | null>(null);
  const [folders, setFolders] = useState<DataRoomFolder[]>([]);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [members, setMembers] = useState<DataRoomMember[]>([]);
  const [activities, setActivities] = useState<DataRoomActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'documents' | 'members' | 'activity' | 'shared-links' | 'settings'>('documents');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  
  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<DataRoomMember['role']>('VIEWER');
  const [inviteCompany, setInviteCompany] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Settings form
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsWatermark, setSettingsWatermark] = useState(false);
  const [settingsDownload, setSettingsDownload] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const response = await getDataRoom(roomId);
    
    if (response.error) {
      setError(response.error);
      setIsLoading(false);
      return;
    }

    if (response.data) {
      setRoom(response.data.room);
      setFolders(response.data.folders);
      setDocuments(response.data.documents);
      setMembers(response.data.members);
      setActivities(response.data.activities);
      
      // Initialize settings form
      setSettingsName(response.data.room.name);
      setSettingsDescription(response.data.room.description);
      setSettingsWatermark(response.data.room.watermark);
      setSettingsDownload(response.data.room.downloadEnabled);
    }
    
    setIsLoading(false);
  }, [roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Filter documents by folder
  const filteredDocuments = selectedFolder 
    ? documents.filter(d => d.folderId === selectedFolder)
    : documents;

  // Get file icon component
  const getFileIconComponent = (fileType: string) => {
    const iconType = getFileIcon(fileType);
    switch (iconType) {
      case 'pdf': return <File className="w-5 h-5 text-red-500" />;
      case 'excel': return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'word': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'image': return <Image className="w-5 h-5 text-purple-500" />;
      default: return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(Math.round((i / files.length) * 100));

      const response = await uploadDocument(
        roomId,
        file,
        uploadFolderId || undefined,
        session?.user?.name || 'User'
      );

      if (response.data) {
        setDocuments(prev => [response.data!.document, ...prev]);
        // Update folder count
        if (uploadFolderId) {
          setFolders(prev => prev.map(f => 
            f.id === uploadFolderId 
              ? { ...f, documentsCount: f.documentsCount + 1 }
              : f
          ));
        }
        // Update room count
        if (room) {
          setRoom({ ...room, documentsCount: room.documentsCount + 1 });
        }
      }
    }

    setUploadProgress(100);
    setIsUploading(false);
    setShowUploadModal(false);
    setUploadFolderId(null);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle document download/view
  const handleDocumentAction = async (doc: DataRoomDocument, viewOnly: boolean = false) => {
    const response = await getDownloadUrl(roomId, doc.id, viewOnly, 'User');
    if (response.data?.url) {
      window.open(response.data.url, '_blank');
      // Refresh to update view/download counts
      loadData();
    }
  };

  // Handle document delete
  const handleDeleteDocument = async (doc: DataRoomDocument) => {
    if (!confirm(`Är du säker på att du vill radera "${doc.name}"?`)) return;
    
    const response = await deleteDocument(roomId, doc.id, 'User');
    if (response.data?.success) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      // Update counts
      if (doc.folderId) {
        setFolders(prev => prev.map(f => 
          f.id === doc.folderId 
            ? { ...f, documentsCount: Math.max(0, f.documentsCount - 1) }
            : f
        ));
      }
      if (room) {
        setRoom({ ...room, documentsCount: Math.max(0, room.documentsCount - 1) });
      }
    }
  };

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setIsCreatingFolder(true);
    const response = await createFolder(roomId, {
      name: newFolderName,
    });

    if (response.data) {
      setFolders(prev => [...prev, response.data!.folder]);
      setNewFolderName('');
      setShowNewFolderModal(false);
    }
    setIsCreatingFolder(false);
  };

  // Handle invite member
  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    
    setIsInviting(true);
    const response = await inviteMember(roomId, {
      email: inviteEmail,
      name: inviteName || undefined,
      role: inviteRole,
      company: inviteCompany || undefined,
    });

    if (response.data) {
      setMembers(prev => [...prev, response.data!.member]);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('VIEWER');
      setInviteCompany('');
      setShowInviteModal(false);
      if (room) {
        setRoom({ ...room, membersCount: room.membersCount + 1 });
      }
    } else {
      alert(response.error || 'Kunde inte bjuda in medlem');
    }
    setIsInviting(false);
  };

  // Handle remove member
  const handleRemoveMember = async (member: DataRoomMember) => {
    if (!confirm(`Är du säker på att du vill ta bort ${member.name} från datarummet?`)) return;
    
    const response = await removeMember(roomId, member.id);
    if (response.data?.success) {
      setMembers(prev => prev.filter(m => m.id !== member.id));
      if (room) {
        setRoom({ ...room, membersCount: Math.max(0, room.membersCount - 1) });
      }
    }
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const response = await updateDataRoom(roomId, {
      name: settingsName,
      description: settingsDescription,
      watermark: settingsWatermark,
      downloadEnabled: settingsDownload,
    });

    if (response.data) {
      setRoom(response.data.room);
    }
    setIsSavingSettings(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
      </div>
    );
  }

  // Error/Not found state
  if (error || !room) {
    return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FolderLock className="w-10 h-10 text-aifm-charcoal/20" />
            </div>
            <p className="text-aifm-charcoal/50 font-medium text-lg mb-2">
              {error || 'Datarummet hittades inte'}
            </p>
            <p className="text-sm text-aifm-charcoal/30 mb-6">Det kan ha tagits bort eller så saknar du behörighet</p>
            <Link 
              href="/data-rooms" 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Tillbaka till datarum
            </Link>
          </div>
        </div>
      
    );
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Room Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.push('/data-rooms')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/50" />
          </button>
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 bg-aifm-charcoal/5 rounded-xl flex items-center justify-center">
              <FolderLock className="w-7 h-7 text-aifm-charcoal/50" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">{room.name}</h1>
              <p className="text-sm text-aifm-charcoal/40">{room.fundName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-aifm-charcoal text-white">
              {getTypeLabel(room.type)}
            </span>
            {room.watermark && (
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-aifm-charcoal/60 flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                Vattenstämplad
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
          <div className="border-b border-gray-100 flex items-center justify-between px-2">
            <div className="flex">
              <TabButton 
                label="Dokument" 
                icon={FileText} 
                count={documents.length}
                isActive={activeTab === 'documents'} 
                onClick={() => setActiveTab('documents')} 
              />
              <TabButton 
                label="Medlemmar" 
                icon={Users} 
                count={members.length}
                isActive={activeTab === 'members'} 
                onClick={() => setActiveTab('members')} 
              />
              <TabButton 
                label="Aktivitet" 
                icon={Activity} 
                isActive={activeTab === 'activity'} 
                onClick={() => setActiveTab('activity')} 
              />
              <TabButton 
                label="Delningslänkar" 
                icon={Link2} 
                isActive={activeTab === 'shared-links'} 
                onClick={() => setActiveTab('shared-links')} 
              />
              <TabButton 
                label="Inställningar" 
                icon={Settings} 
                isActive={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
              />
            </div>
            <div className="pr-4">
              {activeTab === 'documents' && (
                <button 
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
                             bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Ladda upp
                </button>
              )}
              {activeTab === 'members' && (
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white 
                             bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Bjud in
                </button>
              )}
            </div>
          </div>

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="grid lg:grid-cols-4 gap-0">
              {/* Folders Sidebar */}
              <div className="lg:col-span-1 border-r border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Mappar</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      !selectedFolder ? 'bg-aifm-gold/5' : ''
                    }`}
                  >
                    <Folder className={`w-5 h-5 ${!selectedFolder ? 'text-aifm-gold' : 'text-aifm-charcoal/30'}`} />
                    <span className={`text-sm ${!selectedFolder ? 'text-aifm-gold font-medium' : 'text-aifm-charcoal'}`}>
                      Alla dokument
                    </span>
                    <span className="ml-auto text-xs text-aifm-charcoal/40">{documents.length}</span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                        selectedFolder === folder.id ? 'bg-aifm-gold/5' : ''
                      }`}
                    >
                      <Folder className={`w-5 h-5 ${selectedFolder === folder.id ? 'text-aifm-gold' : 'text-aifm-charcoal/30'}`} />
                      <span className={`text-sm truncate ${selectedFolder === folder.id ? 'text-aifm-gold font-medium' : 'text-aifm-charcoal'}`}>
                        {folder.name}
                      </span>
                      <span className="ml-auto text-xs text-aifm-charcoal/40">{folder.documentsCount}</span>
                    </button>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button 
                    onClick={() => setShowNewFolderModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                               bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Ny mapp
                  </button>
                </div>
              </div>

              {/* Documents Area */}
              <div className="lg:col-span-3">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="relative">
                    <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Sök dokument..."
                      className="w-64 py-2.5 pl-11 pr-4 bg-gray-50 border-0 rounded-xl text-sm
                                 placeholder:text-aifm-charcoal/30 focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-gray-400'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-gray-400'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Namn</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Storlek</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Visningar</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Uppladdad</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Åtgärder</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredDocuments.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                                  {getFileIconComponent(doc.fileType)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-aifm-charcoal">{doc.name}</p>
                                  <p className="text-xs text-aifm-charcoal/40">{doc.fileName}</p>
                                </div>
                                {doc.watermarked && (
                                  <Shield className="w-4 h-4 text-aifm-charcoal/20" />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-aifm-charcoal/60">{formatFileSize(doc.fileSize)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-aifm-charcoal/60">
                                <Eye className="w-4 h-4" />
                                {doc.viewCount}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-aifm-charcoal/60">{formatDate(doc.uploadedAt)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => handleDocumentAction(doc, true)}
                                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors" 
                                  title="Förhandsgranska"
                                >
                                  <Eye className="w-4 h-4 text-aifm-charcoal/40" />
                                </button>
                                {room.downloadEnabled && (
                                  <button 
                                    onClick={() => handleDocumentAction(doc, false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors" 
                                    title="Ladda ner"
                                  >
                                    <Download className="w-4 h-4 text-aifm-charcoal/40" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="p-2 hover:bg-red-50 rounded-lg transition-colors" 
                                  title="Radera"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredDocuments.map((doc) => (
                      <div 
                        key={doc.id}
                        className="border border-gray-100 rounded-xl p-4 hover:border-aifm-gold/30 hover:shadow-lg hover:shadow-gray-100/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
                            {getFileIconComponent(doc.fileType)}
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleDocumentAction(doc, true)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                            </button>
                            {room.downloadEnabled && (
                              <button 
                                onClick={() => handleDocumentAction(doc, false)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Download className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                          </div>
                        </div>
                        <h4 className="font-medium text-aifm-charcoal text-sm line-clamp-2 mb-1 group-hover:text-aifm-gold transition-colors">{doc.name}</h4>
                        <p className="text-xs text-aifm-charcoal/40 mb-4">{formatFileSize(doc.fileSize)}</p>
                        <div className="flex items-center justify-between text-xs text-aifm-charcoal/40">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {doc.viewCount}
                          </span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredDocuments.length === 0 && (
                  <div className="p-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-aifm-charcoal/20" />
                    </div>
                    <p className="text-aifm-charcoal/50 font-medium">Inga dokument i denna mapp</p>
                    <p className="text-sm text-aifm-charcoal/30 mt-1">Ladda upp dokument för att komma igång</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Medlem</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Roll</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Behörigheter</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Senast</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Besök</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-aifm-charcoal/5 rounded-full flex items-center justify-center">
                            <span className="text-aifm-charcoal/60 font-medium text-sm">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-aifm-charcoal">{member.name}</p>
                            <p className="text-xs text-aifm-charcoal/40">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {member.permissions.view && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Visa</span>
                          )}
                          {member.permissions.download && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">Ladda ner</span>
                          )}
                          {member.permissions.upload && (
                            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full">Ladda upp</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-aifm-charcoal/60">
                        {member.lastAccess ? formatDate(member.lastAccess) : 'Aldrig'}
                      </td>
                      <td className="px-6 py-4 text-sm text-aifm-charcoal/60">{member.accessCount}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Redigera">
                            <Settings className="w-4 h-4 text-aifm-charcoal/40" />
                          </button>
                          {member.role !== 'OWNER' && (
                            <button 
                              onClick={() => handleRemoveMember(member)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors" 
                              title="Ta bort"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activity Tab - Using new detailed component */}
          {activeTab === 'activity' && (
            <DetailedActivityTab roomId={roomId} />
          )}

          {/* Shared Links Tab */}
          {activeTab === 'shared-links' && (
            <SharedLinksTab 
              roomId={roomId} 
              documents={documents.map(d => ({ id: d.id, name: d.name }))}
              folders={folders.map(f => ({ id: f.id, name: f.name }))}
            />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="p-8 space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-6">Rumsinställningar</h3>
                <div className="space-y-6 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                      Rumsnamn
                    </label>
                    <input 
                      type="text" 
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                                 focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                      Beskrivning
                    </label>
                    <textarea 
                      value={settingsDescription}
                      onChange={(e) => setSettingsDescription(e.target.value)}
                      className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm h-24 resize-none
                                 focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={settingsWatermark}
                        onChange={(e) => setSettingsWatermark(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                      />
                      <span className="text-sm text-aifm-charcoal/70 group-hover:text-aifm-charcoal transition-colors">
                        Applicera vattenstämpel på alla dokument
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={settingsDownload}
                        onChange={(e) => setSettingsDownload(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                      />
                      <span className="text-sm text-aifm-charcoal/70 group-hover:text-aifm-charcoal transition-colors">
                        Tillåt nedladdning av dokument
                      </span>
                    </label>
                  </div>
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                    Spara ändringar
                  </button>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-2">Riskzon</h3>
                <p className="text-sm text-red-600/80 mb-5">
                  Om du arkiverar eller raderar detta rum kommer all data att bevaras men inte längre vara tillgänglig för medlemmar.
                </p>
                <div className="flex gap-3">
                  <button className="px-4 py-2.5 bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium">
                    Arkivera rum
                  </button>
                  <button className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium">
                    Radera rum
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Bjud in medlem</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  E-postadress *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="namn@foretag.se"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Namn (valfritt)
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="Anna Andersson"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-3 uppercase tracking-wider">
                  Roll
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'VIEWER' as const, label: 'Läsare', desc: 'Kan visa' },
                    { value: 'MEMBER' as const, label: 'Medlem', desc: 'Visa & ladda ner' },
                    { value: 'ADMIN' as const, label: 'Admin', desc: 'Full åtkomst' },
                  ].map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setInviteRole(role.value)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 text-center ${
                        inviteRole === role.value
                          ? 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20'
                          : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200'
                      }`}
                    >
                      <span className="block">{role.label}</span>
                      <span className={`text-xs ${inviteRole === role.value ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>
                        {role.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 
                           bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={handleInviteMember}
                disabled={isInviting || !inviteEmail.trim()}
                className="flex-1 py-3 px-4 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                           shadow-lg shadow-aifm-charcoal/20 transition-all flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {isInviting ? 'Skickar...' : 'Skicka inbjudan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Ladda upp dokument</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            <div className="p-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-aifm-gold/50 transition-colors cursor-pointer group"
              >
                {isUploading ? (
                  <div className="space-y-4">
                    <Loader2 className="w-8 h-8 text-aifm-gold animate-spin mx-auto" />
                    <p className="text-aifm-charcoal font-medium">Laddar upp... {uploadProgress}%</p>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-aifm-gold transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-aifm-gold/10 transition-colors">
                      <Upload className="w-8 h-8 text-aifm-charcoal/30 group-hover:text-aifm-gold transition-colors" />
                    </div>
                    <p className="text-aifm-charcoal font-medium mb-2">Släpp filer här eller klicka för att ladda upp</p>
                    <p className="text-sm text-aifm-charcoal/40">PDF, Word, Excel, PowerPoint och bilder</p>
                  </>
                )}
              </div>
              <div className="mt-5">
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Ladda upp till mapp
                </label>
                <select 
                  value={uploadFolderId || ''}
                  onChange={(e) => setUploadFolderId(e.target.value || null)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                >
                  <option value="">Rot (Ingen mapp)</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 
                           bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                {isUploading ? 'Vänta...' : 'Stäng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Ny mapp</h3>
              <button 
                onClick={() => setShowNewFolderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                Mappnamn
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                placeholder="t.ex. Finansiella rapporter"
                autoFocus
              />
            </div>
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowNewFolderModal(false)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 
                           bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="flex-1 py-3 px-4 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                           shadow-lg shadow-aifm-charcoal/20 transition-all flex items-center justify-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Folder className="w-4 h-4" />}
                {isCreatingFolder ? 'Skapar...' : 'Skapa mapp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
