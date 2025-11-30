'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  FolderLock, Plus, Clock, Shield,
  Search, Lock, Archive, FileText, Users, Eye, Home,
  TrendingUp, Activity, Settings
} from 'lucide-react';
import {
  mockDataRooms, getTypeLabel
} from '@/lib/dataRoomData';
import { formatDate } from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Tab Button Component
function TabButton({ 
  label, 
  isActive, 
  onClick,
  count
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
        isActive
          ? 'bg-white text-aifm-charcoal shadow-sm'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-2 ${isActive ? 'text-aifm-charcoal/50' : 'text-white/50'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Hero Metric Card
function HeroMetric({ 
  label, 
  value, 
  subValue,
  icon: Icon
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/10 rounded-lg">
          <Icon className="w-4 h-4 text-white/70" />
        </div>
        <p className="text-xs text-white/50 uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {subValue && <p className="text-sm text-white/60 mt-1">{subValue}</p>}
    </div>
  );
}

// Data Room Card
function DataRoomCard({ 
  room 
}: { 
  room: typeof mockDataRooms[0];
}) {
  return (
    <Link 
      href={`/data-rooms/${room.id}`}
      className="group bg-white rounded-2xl border border-gray-100/50 overflow-hidden
                 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20 
                 hover:-translate-y-1 transition-all duration-500"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className={`
            w-14 h-14 rounded-xl flex items-center justify-center transition-colors duration-300
            ${room.status === 'ARCHIVED' 
              ? 'bg-gray-100 group-hover:bg-gray-200' 
              : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'
            }
          `}>
            {room.status === 'ARCHIVED' ? (
              <Archive className="w-7 h-7 text-gray-400" />
            ) : (
              <FolderLock className="w-7 h-7 text-aifm-charcoal/50 group-hover:text-aifm-gold transition-colors duration-300" />
            )}
          </div>
          <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-aifm-charcoal text-white">
            {getTypeLabel(room.type)}
          </span>
        </div>
        
        {/* Title & Description */}
        <h3 className="font-semibold text-aifm-charcoal text-lg mb-2 group-hover:text-aifm-gold transition-colors duration-300">
          {room.name}
        </h3>
        <p className="text-sm text-aifm-charcoal/50 line-clamp-2 mb-4">{room.description}</p>

        {/* Fund */}
        <p className="text-xs text-aifm-charcoal/40 mb-5">{room.fundName}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-5 border-t border-gray-100">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <FileText className="w-3 h-3 text-aifm-charcoal/30" />
              <p className="text-lg font-semibold text-aifm-charcoal">{room.documentsCount}</p>
            </div>
            <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider">Dokument</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-3 h-3 text-aifm-charcoal/30" />
              <p className="text-lg font-semibold text-aifm-charcoal">{room.membersCount}</p>
            </div>
            <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider">Medlemmar</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Eye className="w-3 h-3 text-aifm-charcoal/30" />
              <p className="text-sm font-medium text-aifm-charcoal">{formatDate(room.lastActivity)}</p>
            </div>
            <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider">Senast</p>
          </div>
        </div>
      </div>

      {/* Footer badges */}
      {(room.expiresAt || room.watermark) && (
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100/50 flex flex-wrap gap-2">
          {room.expiresAt && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-full px-3 py-1.5">
              <Clock className="w-3 h-3" />
              <span>Utgår {formatDate(room.expiresAt)}</span>
            </div>
          )}
          {room.watermark && (
            <div className="flex items-center gap-1.5 text-xs text-aifm-charcoal/50 bg-gray-100 rounded-full px-3 py-1.5">
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
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
  const [activeTypeTab, setActiveTypeTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomType, setNewRoomType] = useState('DEAL_ROOM');

  const filteredRooms = mockDataRooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = activeTypeTab === 'all' || room.type === activeTypeTab;
    const matchesStatus = activeTab === 'all' || 
                         (activeTab === 'active' && room.status === 'ACTIVE') ||
                         (activeTab === 'archived' && room.status === 'ARCHIVED');
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeRooms = mockDataRooms.filter(r => r.status === 'ACTIVE').length;
  const archivedRooms = mockDataRooms.filter(r => r.status === 'ARCHIVED').length;
  const totalDocuments = mockDataRooms.reduce((sum, r) => sum + r.documentsCount, 0);
  const totalMembers = mockDataRooms.reduce((sum, r) => sum + r.membersCount, 0);

  // Count by type
  const typeCounts: Record<string, number> = {
    all: mockDataRooms.length,
    DEAL_ROOM: mockDataRooms.filter(r => r.type === 'DEAL_ROOM').length,
    DUE_DILIGENCE: mockDataRooms.filter(r => r.type === 'DUE_DILIGENCE').length,
    INVESTOR_PORTAL: mockDataRooms.filter(r => r.type === 'INVESTOR_PORTAL').length,
    BOARD: mockDataRooms.filter(r => r.type === 'BOARD').length,
    COMPLIANCE: mockDataRooms.filter(r => r.type === 'COMPLIANCE').length,
  };

  const roomTypes = [
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

  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 px-4 lg:px-8 pt-6 lg:pt-8 pb-6 mb-8 rounded-b-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Home className="w-4 h-4" />
          <span>/</span>
          <span className="text-white">Datarum</span>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight mb-2">
              Säkra datarum
            </h1>
            <p className="text-white/50 text-sm lg:text-base">
              Dela dokument säkert med kontrollerad åtkomst
            </p>
          </div>
          <button 
            onClick={() => setShowNewRoomModal(true)}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-aifm-charcoal 
                       bg-white rounded-xl hover:bg-gray-100 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nytt datarum</span>
          </button>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <HeroMetric 
            label="Aktiva rum"
            value={activeRooms.toString()}
            icon={FolderLock}
          />
          <HeroMetric 
            label="Dokument"
            value={totalDocuments.toString()}
            icon={FileText}
          />
          <HeroMetric 
            label="Medlemmar"
            value={totalMembers.toString()}
            icon={Users}
          />
          <HeroMetric 
            label="Säkerhet"
            value="256-bit"
            subValue="AES-krypterad"
            icon={Shield}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1.5 w-fit">
          <TabButton 
            label="Alla" 
            isActive={activeTab === 'all'} 
            onClick={() => setActiveTab('all')}
            count={mockDataRooms.length}
          />
          <TabButton 
            label="Aktiva" 
            isActive={activeTab === 'active'} 
            onClick={() => setActiveTab('active')}
            count={activeRooms}
          />
          <TabButton 
            label="Arkiverade" 
            isActive={activeTab === 'archived'} 
            onClick={() => setActiveTab('archived')}
            count={archivedRooms}
          />
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-gradient-to-r from-aifm-charcoal/5 via-aifm-charcoal/5 to-transparent border border-aifm-charcoal/10 rounded-2xl p-5 mb-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-aifm-charcoal/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-aifm-charcoal/60" />
        </div>
        <div>
          <p className="font-semibold text-aifm-charcoal text-sm">Banksäkerhet</p>
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">Alla dokument är krypterade med banknivå. Åtkomst loggas och kan granskas.</p>
        </div>
      </div>

      {/* Search & Type Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Sök datarum..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-3 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm
                       placeholder:text-aifm-charcoal/30 focus:outline-none focus:border-aifm-gold/30 
                       focus:ring-2 focus:ring-aifm-gold/10 transition-all duration-300"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((type) => (
            <button
              key={type.value}
              onClick={() => setActiveTypeTab(type.value)}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
                activeTypeTab === type.value
                  ? 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20'
                  : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200 hover:text-aifm-charcoal'
              }`}
            >
              {type.label}
              {typeCounts[type.value] !== undefined && (
                <span className={`ml-1.5 ${activeTypeTab === type.value ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>
                  {typeCounts[type.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Data Rooms Grid */}
      {filteredRooms.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <DataRoomCard key={room.id} room={room} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FolderLock className="w-10 h-10 text-aifm-charcoal/20" />
          </div>
          <p className="text-aifm-charcoal/50 font-medium text-lg">Inga datarum hittades</p>
          <p className="text-sm text-aifm-charcoal/30 mt-2 mb-6">Skapa ett nytt datarum för att komma igång</p>
          <button 
            onClick={() => setShowNewRoomModal(true)}
            className="px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors"
          >
            Skapa datarum
          </button>
        </div>
      )}

      {/* New Room Modal */}
      {showNewRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-aifm-charcoal">Skapa nytt datarum</h3>
                <p className="text-sm text-aifm-charcoal/40 mt-0.5">Säker delning av dokument</p>
              </div>
              <button 
                onClick={() => setShowNewRoomModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-aifm-charcoal/50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Rumsnamn *
                  </label>
                  <input
                    type="text"
                    className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                    placeholder="t.ex. Projekt Alpha Due Diligence"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Beskrivning
                  </label>
                  <textarea
                    className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm h-20 resize-none
                               focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                    placeholder="Kort beskrivning av rummets syfte och innehåll..."
                  />
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Rumstyp *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roomTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewRoomType(type.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border ${
                        newRoomType === type.value
                          ? 'bg-aifm-charcoal text-white border-aifm-charcoal'
                          : 'bg-white text-aifm-charcoal/60 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Utgångsdatum (valfritt)
                  </label>
                  <input 
                    type="date" 
                    className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                  />
                  <p className="text-xs text-aifm-charcoal/40 mt-2">Rummet stängs automatiskt efter detta datum</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Fond
                  </label>
                  <select className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                                     focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all">
                    <option>Nordic Growth Fund I</option>
                    <option>Scandinavian Tech Fund II</option>
                    <option>Baltic Real Estate Fund</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-3">Säkerhetsinställningar</p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-aifm-charcoal group-hover:text-aifm-gold transition-colors">Vattenstämpel på dokument</span>
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-aifm-charcoal group-hover:text-aifm-gold transition-colors">Tillåt nedladdning</span>
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-aifm-charcoal group-hover:text-aifm-gold transition-colors">Kräv NDA</span>
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" />
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-gray-50/50">
              <button 
                onClick={() => setShowNewRoomModal(false)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 
                           bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => {
                  alert('Datarum skapat! (Demo)');
                  setShowNewRoomModal(false);
                }}
                className="flex-1 py-3 px-4 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                           shadow-lg shadow-aifm-charcoal/20 transition-all flex items-center justify-center gap-2"
              >
                <FolderLock className="w-4 h-4" />
                Skapa datarum
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
