'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  FolderLock, Plus, Clock, Shield,
  Search, Lock, Archive, FileText, Users, Eye, Loader2
} from 'lucide-react';
import {
  getDataRooms, createDataRoom, getTypeLabel, formatDate,
  type DataRoom
} from '@/lib/dataRooms/dataRoomClient';

import { useCompany } from '@/components/CompanyContext';

// Simple Card components
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

// Data Room Card
function DataRoomCard({ room }: { room: DataRoom }) {
  return (
    
    <Link 
      href={`/data-rooms/${room.id}`}
      className="group bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden
                 hover:shadow-xl hover:shadow-gray-200/50 hover:border-[#c0a280]/20 
                 hover:-translate-y-1 transition-all duration-500"
    >
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 sm:mb-5 gap-2">
          <div className={`
            w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors duration-300 flex-shrink-0
            ${room.status === 'ARCHIVED' 
              ? 'bg-gray-100 group-hover:bg-gray-200' 
              : 'bg-gray-100 group-hover:bg-[#c0a280]/10'
            }
          `}>
            {room.status === 'ARCHIVED' ? (
              <Archive className="w-5 h-5 sm:w-7 sm:h-7 text-gray-400" />
            ) : (
              <FolderLock className="w-5 h-5 sm:w-7 sm:h-7 text-gray-500 group-hover:text-[#c0a280] transition-colors duration-300" />
            )}
          </div>
          <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full bg-gray-900 text-white">
            {getTypeLabel(room.type)}
          </span>
        </div>
        
        {/* Title & Description */}
        <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-1.5 sm:mb-2 group-hover:text-[#c0a280] transition-colors duration-300 line-clamp-1">
          {room.name}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-3 sm:mb-4">{room.description}</p>

        {/* Fund */}
        <p className="text-[10px] sm:text-xs text-gray-400 mb-4 sm:mb-5 truncate">{room.fundName}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 sm:pt-5 border-t border-gray-100">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
              <FileText className="w-3 h-3 text-gray-400" />
              <p className="text-base sm:text-lg font-semibold text-gray-900">{room.documentsCount}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Dok</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
              <Users className="w-3 h-3 text-gray-400" />
              <p className="text-base sm:text-lg font-semibold text-gray-900">{room.membersCount}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Medl</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
              <Eye className="w-3 h-3 text-gray-400" />
              <p className="text-xs sm:text-sm font-medium text-gray-900">{formatDate(room.lastActivity)}</p>
            </div>
            <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Senast</p>
          </div>
        </div>
      </div>

      {/* Footer badges */}
      {(room.expiresAt || room.watermark) && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50/50 border-t border-gray-100 flex flex-wrap gap-1.5 sm:gap-2">
          {room.expiresAt && (
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-amber-600 bg-amber-50 rounded-full px-2 sm:px-3 py-1 sm:py-1.5">
              <Clock className="w-3 h-3" />
              <span>Utgår {formatDate(room.expiresAt)}</span>
            </div>
          )}
          {room.watermark && (
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500 bg-gray-100 rounded-full px-2 sm:px-3 py-1 sm:py-1.5">
              <Shield className="w-3 h-3" />
              <span>Vattenstämplad</span>
            </div>
          )}
        </div>
      )}
    </Link>
    
  );
}

export default function DataRoomsPage() {
  const { selectedCompany: company } = useCompany();
  const [rooms, setRooms] = useState<DataRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
  const [activeTypeTab, setActiveTypeTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomType, setNewRoomType] = useState<DataRoom['type']>('DEAL_ROOM');
  const [newRoomExpiry, setNewRoomExpiry] = useState('');
  const [newRoomWatermark, setNewRoomWatermark] = useState(true);
  const [newRoomDownload, setNewRoomDownload] = useState(true);

  // Load data rooms
  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    const response = await getDataRooms();
    if (response.data) {
      setRooms(response.data.rooms);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRooms();
  }, [loadRooms]);

  // Filter rooms
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = activeTypeTab === 'all' || room.type === activeTypeTab;
    const matchesStatus = activeTab === 'all' || 
                         (activeTab === 'active' && room.status === 'ACTIVE') ||
                         (activeTab === 'archived' && room.status === 'ARCHIVED');
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeRooms = rooms.filter(r => r.status === 'ACTIVE').length;
  const archivedRooms = rooms.filter(r => r.status === 'ARCHIVED').length;
  const totalDocuments = rooms.reduce((sum, r) => sum + r.documentsCount, 0);
  const totalMembers = rooms.reduce((sum, r) => sum + r.membersCount, 0);

  const typeCounts: Record<string, number> = {
    all: rooms.length,
    DEAL_ROOM: rooms.filter(r => r.type === 'DEAL_ROOM').length,
    DUE_DILIGENCE: rooms.filter(r => r.type === 'DUE_DILIGENCE').length,
    INVESTOR_PORTAL: rooms.filter(r => r.type === 'INVESTOR_PORTAL').length,
    BOARD: rooms.filter(r => r.type === 'BOARD').length,
    COMPLIANCE: rooms.filter(r => r.type === 'COMPLIANCE').length,
  };

  const roomTypes: { value: DataRoom['type']; label: string }[] = [
    { value: 'DEAL_ROOM', label: 'Affärsrum' },
    { value: 'DUE_DILIGENCE', label: 'Due Diligence' },
    { value: 'INVESTOR_PORTAL', label: 'Investerarportal' },
    { value: 'BOARD', label: 'Styrelserum' },
    { value: 'COMPLIANCE', label: 'Compliance' },
    { value: 'GENERAL', label: 'Allmänt' },
  ];

  const typeFilters = [
    { value: 'all', label: 'Alla typer' },
    { value: 'DEAL_ROOM', label: 'Affärsrum' },
    { value: 'DUE_DILIGENCE', label: 'Due Diligence' },
    { value: 'INVESTOR_PORTAL', label: 'Investerarportal' },
    { value: 'BOARD', label: 'Styrelse' },
    { value: 'COMPLIANCE', label: 'Compliance' },
  ];

  // Create new room
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    
    setIsCreating(true);
    const response = await createDataRoom({
      name: newRoomName,
      description: newRoomDescription,
      type: newRoomType,
      watermark: newRoomWatermark,
      downloadEnabled: newRoomDownload,
      expiresAt: newRoomExpiry || undefined,
      fundId: 'fund-1',
      fundName: company?.name || 'Nordic Growth Fund I',
    });

    if (response.data) {
      // Add new room to list
      setRooms(prev => [response.data!.room, ...prev]);
      // Reset form
      setNewRoomName('');
      setNewRoomDescription('');
      setNewRoomType('DEAL_ROOM');
      setNewRoomExpiry('');
      setNewRoomWatermark(true);
      setNewRoomDownload(true);
      setShowNewRoomModal(false);
    } else {
      alert(`Fel: ${response.error}`);
    }
    setIsCreating(false);
  };

  if (!company) {
    return (
    
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Välj ett bolag för att se datarum.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-4 sm:p-6 w-full space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-gray-900 tracking-tight">
              Säkra datarum
            </h1>
            <p className="text-gray-500 mt-1 text-sm sm:text-base truncate">
              {company.name}
            </p>
          </div>
          <button 
            onClick={() => setShowNewRoomModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                       bg-[#c0a280] rounded-lg hover:bg-[#a08260] transition-all w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nytt datarum
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-l-4 border-l-[#c0a280]">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FolderLock className="w-4 h-4" />
                <span className="text-sm">Aktiva rum</span>
              </div>
              <div className="text-2xl font-light text-gray-900">{activeRooms}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Dokument</span>
              </div>
              <div className="text-2xl font-light text-gray-900">{totalDocuments}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-sm">Medlemmar</span>
              </div>
              <div className="text-2xl font-light text-gray-900">{totalMembers}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Säkerhet</span>
              </div>
              <div className="text-2xl font-light text-gray-900">256-bit</div>
              <p className="text-xs text-gray-400 mt-1">AES-krypterad</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            <div className="flex overflow-x-auto border-b border-gray-100 -mx-1 px-1">
              {[
                { key: 'all', label: 'Alla', count: rooms.length },
                { key: 'active', label: 'Aktiva', count: activeRooms },
                { key: 'archived', label: 'Arkiverade', count: archivedRooms },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-all relative flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.key
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-[#c0a280]/20 text-[#c0a280]' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Banksäkerhet</p>
                <p className="text-xs text-gray-500 mt-0.5">Alla dokument är krypterade med banknivå. Åtkomst loggas och kan granskas.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search & Type Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Sök datarum..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm
                         placeholder:text-gray-400 focus:outline-none focus:border-[#c0a280]/30 
                         focus:ring-2 focus:ring-[#c0a280]/10 transition-all"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((type) => (
              <button
                key={type.value}
                onClick={() => setActiveTypeTab(type.value)}
                className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                  activeTypeTab === type.value
                    ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {type.label}
                {typeCounts[type.value] !== undefined && (
                  <span className={`ml-1.5 ${activeTypeTab === type.value ? 'text-white/60' : 'text-gray-400'}`}>
                    {typeCounts[type.value]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin" />
          </div>
        )}

        {/* Data Rooms Grid */}
        {!isLoading && filteredRooms.length > 0 && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <DataRoomCard key={room.id} room={room} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRooms.length === 0 && (
          <Card>
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderLock className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium text-lg">Inga datarum hittades</p>
              <p className="text-sm text-gray-400 mt-2 mb-6">Skapa ett nytt datarum för att komma igång</p>
              <button 
                onClick={() => setShowNewRoomModal(true)}
                className="px-5 py-2.5 bg-[#c0a280] text-white rounded-xl text-sm font-medium hover:bg-[#a08260] transition-colors"
              >
                Skapa datarum
              </button>
            </CardContent>
          </Card>
        )}

        {/* New Room Modal */}
        {showNewRoomModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col">
              <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Skapa nytt datarum</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Säker delning av dokument</p>
                </div>
                <button 
                  onClick={() => setShowNewRoomModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      Rumsnamn *
                    </label>
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#c0a280]/20 transition-all"
                      placeholder="t.ex. Projekt Alpha Due Diligence"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      Beskrivning
                    </label>
                    <textarea
                      value={newRoomDescription}
                      onChange={(e) => setNewRoomDescription(e.target.value)}
                      className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm h-20 resize-none
                                 focus:outline-none focus:ring-2 focus:ring-[#c0a280]/20 transition-all"
                      placeholder="Kort beskrivning av rummets syfte och innehåll..."
                    />
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                    Rumstyp *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {roomTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setNewRoomType(type.value)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                          newRoomType === type.value
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      Utgångsdatum (valfritt)
                    </label>
                    <input 
                      type="date" 
                      value={newRoomExpiry}
                      onChange={(e) => setNewRoomExpiry(e.target.value)}
                      className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#c0a280]/20 transition-all"
                    />
                    <p className="text-xs text-gray-400 mt-2">Rummet stängs automatiskt efter detta datum</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      Fond
                    </label>
                    <select className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                                       focus:outline-none focus:ring-2 focus:ring-[#c0a280]/20 transition-all">
                      <option>{company?.name || 'Nordic Growth Fund I'}</option>
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Säkerhetsinställningar</p>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-900 group-hover:text-[#c0a280] transition-colors">Vattenstämpel på dokument</span>
                      <input 
                        type="checkbox" 
                        checked={newRoomWatermark}
                        onChange={(e) => setNewRoomWatermark(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]" 
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-900 group-hover:text-[#c0a280] transition-colors">Tillåt nedladdning</span>
                      <input 
                        type="checkbox" 
                        checked={newRoomDownload}
                        onChange={(e) => setNewRoomDownload(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]" 
                      />
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50/50">
                <button 
                  onClick={() => setShowNewRoomModal(false)}
                  className="flex-1 py-3 px-4 text-sm font-medium text-gray-700 
                             bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all"
                  disabled={isCreating}
                >
                  Avbryt
                </button>
                <button 
                  onClick={handleCreateRoom}
                  disabled={isCreating || !newRoomName.trim()}
                  className="flex-1 py-3 px-4 text-sm font-medium text-white 
                             bg-[#c0a280] rounded-xl hover:bg-[#a08260] 
                             shadow-lg shadow-[#c0a280]/20 transition-all flex items-center justify-center gap-2
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderLock className="w-4 h-4" />
                  )}
                  {isCreating ? 'Skapar...' : 'Skapa datarum'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
