'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FolderLock, ArrowLeft, Users, FileText, Shield,
  Upload, Download, Eye, Trash2, Plus,
  Folder, File, FileSpreadsheet, Image, MoreVertical,
  Settings, UserPlus, History, Search, Grid, List,
  CheckCircle2, X, Mail
} from 'lucide-react';
import {
  getDataRoomById, getMembersByRoom, getFoldersByRoom,
  getDocumentsByRoom, getActivitiesByRoom, formatFileSize,
  getFileIcon, getRoleColor, getTypeColor, getTypeLabel, getActionLabel
} from '@/lib/dataRoomData';
import { formatDate } from '@/lib/fundData';

export default function DataRoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const room = getDataRoomById(roomId);

  const [activeTab, setActiveTab] = useState<'documents' | 'members' | 'activity' | 'settings'>('documents');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FolderLock className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
          <p className="text-aifm-charcoal/60 mb-4">Datarummet hittades inte</p>
          <Link href="/data-rooms" className="btn-primary py-2 px-4">
            Tillbaka till datarum
          </Link>
        </div>
      </div>
    );
  }

  const members = getMembersByRoom(roomId);
  const folders = getFoldersByRoom(roomId);
  const documents = getDocumentsByRoom(roomId);
  const activities = getActivitiesByRoom(roomId);

  const filteredDocuments = selectedFolder 
    ? documents.filter(d => d.folderId === selectedFolder)
    : documents;

  const getFileIconComponent = (fileType: string) => {
    const iconType = getFileIcon(fileType);
    switch (iconType) {
      case 'pdf': return <File className="w-5 h-5 text-red-500" />;
      case 'excel': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case 'word': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'image': return <Image className="w-5 h-5 text-purple-500" />;
      default: return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/data-rooms')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-aifm-charcoal" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-aifm-gold/10 rounded-xl flex items-center justify-center">
                  <FolderLock className="w-5 h-5 text-aifm-gold" />
                </div>
                <div>
                  <h1 className="font-medium text-aifm-charcoal">{room.name}</h1>
                  <p className="text-xs text-aifm-charcoal/50">{room.fundName}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(room.type)}`}>
                {getTypeLabel(room.type)}
              </span>
              {room.watermark && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-aifm-charcoal/10 text-aifm-charcoal flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Watermarked
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sub-header with tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between">
            <nav className="flex gap-6">
              {[
                { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
                { id: 'members', label: 'Members', icon: Users, count: members.length },
                { id: 'activity', label: 'Activity', icon: History },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-aifm-gold text-aifm-gold'
                      : 'border-transparent text-aifm-charcoal/60 hover:text-aifm-charcoal'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm font-medium uppercase tracking-wider">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {activeTab === 'documents' && (
                <>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="btn-primary py-2 px-4 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </button>
                </>
              )}
              {activeTab === 'members' && (
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="btn-primary py-2 px-4 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Folders Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Folders</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      !selectedFolder ? 'bg-aifm-gold/5' : ''
                    }`}
                  >
                    <Folder className={`w-5 h-5 ${!selectedFolder ? 'text-aifm-gold' : 'text-gray-400'}`} />
                    <span className={`text-sm ${!selectedFolder ? 'text-aifm-gold font-medium' : 'text-aifm-charcoal'}`}>
                      All Documents
                    </span>
                    <span className="ml-auto text-xs text-aifm-charcoal/50">{documents.length}</span>
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                        selectedFolder === folder.id ? 'bg-aifm-gold/5' : ''
                      }`}
                    >
                      <Folder className={`w-5 h-5 ${selectedFolder === folder.id ? 'text-aifm-gold' : 'text-gray-400'}`} />
                      <span className={`text-sm truncate ${selectedFolder === folder.id ? 'text-aifm-gold font-medium' : 'text-aifm-charcoal'}`}>
                        {folder.name}
                      </span>
                      <span className="ml-auto text-xs text-aifm-charcoal/50">{folder.documentsCount}</span>
                    </button>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button className="w-full btn-outline py-2 flex items-center justify-center gap-2 text-sm">
                    <Plus className="w-4 h-4" />
                    New Folder
                  </button>
                </div>
              </div>
            </div>

            {/* Documents Grid */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
                      <input
                        type="text"
                        placeholder="Sök dokument..."
                        className="input pl-9 py-1.5 text-sm w-64"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-aifm-gold/10 text-aifm-gold' : 'hover:bg-gray-100 text-gray-400'}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-aifm-gold/10 text-aifm-gold' : 'hover:bg-gray-100 text-gray-400'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Visningar</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Uppladdad</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {getFileIconComponent(doc.fileType)}
                              <div>
                                <p className="text-sm font-medium text-aifm-charcoal">{doc.name}</p>
                                <p className="text-xs text-aifm-charcoal/50">{doc.fileName}</p>
                              </div>
                              {doc.watermarked && (
                                <Shield className="w-4 h-4 text-aifm-charcoal/30" />
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
                            <div className="flex items-center justify-end gap-2">
                              <button className="p-2 hover:bg-gray-100 rounded-lg" title="Preview">
                                <Eye className="w-4 h-4 text-aifm-charcoal/60" />
                              </button>
                              {room.downloadEnabled && (
                                <button className="p-2 hover:bg-gray-100 rounded-lg" title="Download">
                                  <Download className="w-4 h-4 text-aifm-charcoal/60" />
                                </button>
                              )}
                              <button className="p-2 hover:bg-gray-100 rounded-lg" title="More">
                                <MoreVertical className="w-4 h-4 text-aifm-charcoal/60" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocuments.map((doc) => (
                      <div 
                        key={doc.id}
                        className="border border-gray-100 rounded-xl p-4 hover:border-aifm-gold/30 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            {getFileIconComponent(doc.fileType)}
                          </div>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                        <h4 className="font-medium text-aifm-charcoal text-sm line-clamp-2 mb-1">{doc.name}</h4>
                        <p className="text-xs text-aifm-charcoal/50 mb-3">{formatFileSize(doc.fileSize)}</p>
                        <div className="flex items-center justify-between text-xs text-aifm-charcoal/50">
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
                  <div className="p-12 text-center">
                    <FileText className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                    <p className="text-aifm-charcoal/60">Inga dokument i denna mapp</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Room Members</h3>
              <span className="text-xs text-aifm-charcoal/50">{members.length} members</span>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Last Access</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Visits</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-aifm-gold/10 rounded-full flex items-center justify-center">
                          <span className="text-aifm-gold font-medium">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-aifm-charcoal">{member.name}</p>
                          <p className="text-xs text-aifm-charcoal/50">{member.email}</p>
                          {member.company && (
                            <p className="text-xs text-aifm-charcoal/40">{member.company}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {member.permissions.view && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">View</span>
                        )}
                        {member.permissions.download && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Download</span>
                        )}
                        {member.permissions.upload && (
                          <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">Ladda upp</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-aifm-charcoal/60">
                      {member.lastAccess ? formatDate(member.lastAccess) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-aifm-charcoal/60">{member.accessCount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                          <Settings className="w-4 h-4 text-aifm-charcoal/60" />
                        </button>
                        {member.role !== 'OWNER' && (
                          <button className="p-2 hover:bg-red-50 rounded-lg" title="Remove">
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

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Activity Log</h3>
              <button className="btn-outline py-1.5 px-3 text-sm flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportera
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {activities.map((activity) => (
                <div key={activity.id} className="px-6 py-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activity.action === 'VIEW' ? 'bg-blue-100' :
                    activity.action === 'DOWNLOAD' ? 'bg-green-100' :
                    activity.action === 'UPLOAD' ? 'bg-purple-100' :
                    'bg-gray-100'
                  }`}>
                    {activity.action === 'VIEW' && <Eye className="w-5 h-5 text-blue-600" />}
                    {activity.action === 'DOWNLOAD' && <Download className="w-5 h-5 text-green-600" />}
                    {activity.action === 'UPLOAD' && <Upload className="w-5 h-5 text-purple-600" />}
                    {activity.action === 'ACCEPT_INVITE' && <CheckCircle2 className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-aifm-charcoal">
                      <span className="font-medium">{activity.userName}</span>
                      {' '}
                      <span className="text-aifm-charcoal/60">{getActionLabel(activity.action)}</span>
                      {' '}
                      <span className="font-medium">{activity.targetName}</span>
                    </p>
                    <p className="text-xs text-aifm-charcoal/50 mt-0.5">
                      {activity.timestamp.toLocaleString('sv-SE')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Room Settings</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                    Room Name
                  </label>
                  <input type="text" defaultValue={room.name} className="input w-full max-w-md" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea defaultValue={room.description} className="input w-full max-w-md h-20 resize-none" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      defaultChecked={room.watermark}
                      className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                    />
                    <span className="text-sm text-aifm-charcoal">Apply watermarks to all documents</span>
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      defaultChecked={room.downloadEnabled}
                      className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                    />
                    <span className="text-sm text-aifm-charcoal">Allow document downloads</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                    Expiration Date
                  </label>
                  <input 
                    type="date" 
                    defaultValue={room.expiresAt?.toISOString().split('T')[0]} 
                    className="input max-w-xs"
                  />
                </div>
                <button className="btn-primary py-2 px-4">Spara ändringar</button>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-red-800 uppercase tracking-wider mb-2">Danger Zone</h3>
              <p className="text-sm text-red-700 mb-4">
                Once you archive or delete this room, all data will be preserved but no longer accessible to members.
              </p>
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium">
                  Archive Room
                </button>
                <button className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium">
                  Delete Room
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Invite Member</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-aifm-charcoal/60" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="namn@foretag.se"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Role
                </label>
                <select className="input w-full">
                  <option value="VIEWER">Viewer - Can view documents only</option>
                  <option value="MEMBER">Member - Can view and download</option>
                  <option value="ADMIN">Admin - Full access</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Access Expires (Optional)
                </label>
                <input type="date" className="input w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Personal Message (Optional)
                </label>
                <textarea
                  className="input w-full h-20 resize-none"
                  placeholder="Lägg till ett personligt meddelande..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowInviteModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert('Invitation sent! (Demo)');
                  setShowInviteModal(false);
                }}
                className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Ladda upp dokument</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-aifm-charcoal/60" />
              </button>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-aifm-gold/50 transition-colors">
                <Upload className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                <p className="text-aifm-charcoal font-medium mb-1">Drop files here or click to upload</p>
                <p className="text-sm text-aifm-charcoal/50">Stöder PDF, Word, Excel, PowerPoint och bilder</p>
                <input type="file" className="hidden" multiple />
                <button className="btn-outline py-2 px-4 mt-4">
                  Browse Files
                </button>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Upload to Folder
                </label>
                <select className="input w-full">
                  <option value="">Root (No folder)</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowUploadModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert('Documents uploaded! (Demo)');
                  setShowUploadModal(false);
                }}
                className="flex-1 btn-primary py-2"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

