'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  FolderLock, Plus, Clock, Shield,
  Search, Lock, Archive, FileText, Users, Eye
} from 'lucide-react';
import {
  mockDataRooms, getTypeLabel
} from '@/lib/dataRoomData';
import { formatDate } from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';

// Metric Card
function MetricCard({ 
  label, 
  value, 
  subValue,
  icon: Icon,
  variant = 'default'
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
  variant?: 'default' | 'primary';
}) {
  const isPrimary = variant === 'primary';

  return (
    <div className={`
      group relative rounded-2xl p-6 transition-all duration-500 hover:-translate-y-0.5
      ${isPrimary 
        ? 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20' 
        : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20'
      }
    `}>
      {!isPrimary && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl transition-colors duration-300 ${
            isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'
          }`}>
            <Icon className={`w-5 h-5 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold'} transition-colors duration-300`} />
          </div>
        </div>
        <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>
          {value}
        </p>
        {subValue && (
          <p className={`text-sm mt-2 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>{subValue}</p>
        )}
      </div>
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

// Type Filter Tabs
function TypeFilterTabs({ 
  value, 
  onChange,
  counts
}: { 
  value: string; 
  onChange: (value: string) => void;
  counts: Record<string, number>;
}) {
  const types = [
    { value: 'all', label: 'Alla' },
    { value: 'DEAL_ROOM', label: 'Affärsrum' },
    { value: 'DUE_DILIGENCE', label: 'Due Diligence' },
    { value: 'INVESTOR_PORTAL', label: 'Investerarportal' },
    { value: 'BOARD', label: 'Styrelse' },
    { value: 'COMPLIANCE', label: 'Compliance' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => (
        <button
          key={type.value}
          onClick={() => onChange(type.value)}
          className={`px-4 py-2 text-xs font-medium rounded-xl transition-all duration-300 ${
            value === type.value
              ? 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20'
              : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200 hover:text-aifm-charcoal'
          }`}
        >
          {type.label}
          {counts[type.value] !== undefined && (
            <span className={`ml-2 ${value === type.value ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>
              {counts[type.value]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function DataRoomsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomType, setNewRoomType] = useState('DEAL_ROOM');

  const filteredRooms = mockDataRooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || room.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && room.status === 'ACTIVE') ||
                         (filterStatus === 'archived' && room.status === 'ARCHIVED');
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeRooms = mockDataRooms.filter(r => r.status === 'ACTIVE').length;
  const totalDocuments = mockDataRooms.reduce((sum, r) => sum + r.documentsCount, 0);
  const totalMembers = mockDataRooms.reduce((sum, r) => sum + r.membersCount, 0);

  // Count by type
  const typeCounts: Record<string, number> = {
    all: mockDataRooms.length,
  };
  mockDataRooms.forEach(room => {
    typeCounts[room.type] = (typeCounts[room.type] || 0) + 1;
  });

  const roomTypes = [
    { value: 'DEAL_ROOM', label: 'Affärsrum' },
    { value: 'DUE_DILIGENCE', label: 'Due Diligence' },
    { value: 'INVESTOR_PORTAL', label: 'Investerarportal' },
    { value: 'BOARD', label: 'Styrelserum' },
    { value: 'COMPLIANCE', label: 'Compliance' },
    { value: 'GENERAL', label: 'Allmänt' },
  ];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Säkra datarum</h1>
          <p className="text-aifm-charcoal/40 mt-2">Dela dokument säkert med kontrollerad åtkomst och full spårbarhet</p>
        </div>
        <button 
          onClick={() => setShowNewRoomModal(true)}
          className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-white 
                     bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                     shadow-lg shadow-aifm-charcoal/20 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          Nytt datarum
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          label="Aktiva rum" 
          value={activeRooms.toString()}
          icon={FolderLock}
          variant="primary"
        />
        <MetricCard 
          label="Dokument" 
          value={totalDocuments.toString()}
          icon={FileText}
        />
        <MetricCard 
          label="Medlemmar" 
          value={totalMembers.toString()}
          icon={Users}
        />
        <MetricCard 
          label="Säkerhet" 
          value="256-bit"
          subValue="AES-krypterad"
          icon={Shield}
        />
      </div>

      {/* Security Notice */}
      <div className="bg-gradient-to-r from-aifm-charcoal/5 via-aifm-charcoal/5 to-transparent border border-aifm-charcoal/10 rounded-2xl p-6 mb-10 flex items-center gap-5">
        <div className="w-12 h-12 bg-aifm-charcoal/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock className="w-6 h-6 text-aifm-charcoal/60" />
        </div>
        <div>
          <p className="font-semibold text-aifm-charcoal">Banksäkerhet</p>
          <p className="text-sm text-aifm-charcoal/50 mt-1">Alla dokument är krypterade med banknivå. Åtkomst loggas och kan granskas.</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
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
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${
              filterStatus === 'active'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200'
            }`}
          >
            Aktiva
          </button>
          <button
            onClick={() => setFilterStatus('archived')}
            className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${
              filterStatus === 'archived'
                ? 'bg-gray-600 text-white shadow-lg shadow-gray-600/30'
                : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200'
            }`}
          >
            Arkiverade
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${
              filterStatus === 'all'
                ? 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20'
                : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200'
            }`}
          >
            Alla
          </button>
        </div>
      </div>

      {/* Type Filters */}
      <div className="mb-8">
        <TypeFilterTabs value={filterType} onChange={setFilterType} counts={typeCounts} />
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
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Nytt datarum</h3>
              <button 
                onClick={() => setShowNewRoomModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-aifm-charcoal/50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Rumsnamn
                </label>
                <input
                  type="text"
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="t.ex. Projekt Alpha Due Diligence"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Beskrivning
                </label>
                <textarea
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm h-20 resize-none
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="Kort beskrivning av rummets syfte..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-3 uppercase tracking-wider">
                  Rumstyp
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {roomTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewRoomType(type.value)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        newRoomType === type.value
                          ? 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20'
                          : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Utgångsdatum
                  </label>
                  <input 
                    type="date" 
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                               focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" defaultChecked />
                    <span className="text-sm text-aifm-charcoal/70 group-hover:text-aifm-charcoal transition-colors">Vattenstämpel</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
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
                           shadow-lg shadow-aifm-charcoal/20 transition-all"
              >
                Skapa rum
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
