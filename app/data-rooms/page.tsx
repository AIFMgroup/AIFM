'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderLock, Plus, Shield, Search, Archive,
  FileText, Users, Loader2, ChevronRight,
  BarChart3, Scale, ClipboardCheck, TrendingUp, X,
} from 'lucide-react';
import {
  getDataRooms, createDataRoom, getTypeLabel, formatDate,
  type DataRoom,
} from '@/lib/dataRooms/dataRoomClient';
import { useCompany } from '@/components/CompanyContext';

const TYPE_ICONS: Record<string, React.ElementType> = {
  COMPLIANCE: Shield,
  DEAL_ROOM: FolderLock,
  DUE_DILIGENCE: Search,
  INVESTOR_PORTAL: TrendingUp,
  BOARD: Scale,
  GENERAL: FileText,
};

const ANALYSIS_FOLDERS: { key: string; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'ESG-analyser', label: 'ESG-analyser', icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'Investeringsanalyser', label: 'Investeringsanalyser', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
  { key: 'Värdepappersgodkännanden', label: 'Värdepappersgodkännanden', icon: Scale, color: 'text-amber-600 bg-amber-50' },
  { key: 'Delegationsövervakningar', label: 'Delegationsövervakningar', icon: ClipboardCheck, color: 'text-purple-600 bg-purple-50' },
];

function RoomCard({ room }: { room: DataRoom }) {
  const Icon = TYPE_ICONS[room.type] || FolderLock;
  const isPersonal = room.name.startsWith('Mina analyser');

  return (
    <Link
      href={`/data-rooms/${room.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 overflow-hidden
                 hover:border-aifm-gold/20 hover:shadow-lg hover:shadow-gray-100/80
                 transition-all duration-300"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center
            ${room.status === 'ARCHIVED' ? 'bg-gray-100' : 'bg-gray-50 group-hover:bg-aifm-gold/5'}
            transition-colors duration-300`}
          >
            {room.status === 'ARCHIVED'
              ? <Archive className="w-5 h-5 text-gray-400" />
              : <Icon className="w-5 h-5 text-aifm-charcoal/50 group-hover:text-aifm-gold transition-colors" />
            }
          </div>
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-gray-50 text-aifm-charcoal/60 uppercase tracking-wider">
            {getTypeLabel(room.type)}
          </span>
        </div>

        <h3 className="font-medium text-aifm-charcoal text-[15px] mb-1 group-hover:text-aifm-gold transition-colors line-clamp-1">
          {isPersonal ? 'Mina analyser' : room.name}
        </h3>
        <p className="text-xs text-aifm-charcoal/40 line-clamp-2 mb-5 leading-relaxed">
          {room.description}
        </p>

        <div className="flex items-center gap-6 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-aifm-charcoal/30" />
            <span className="text-sm font-medium text-aifm-charcoal">{room.documentsCount}</span>
            <span className="text-[10px] text-aifm-charcoal/30">dok</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-aifm-charcoal/30" />
            <span className="text-sm font-medium text-aifm-charcoal">{room.membersCount}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-aifm-charcoal/30">
            <span className="text-[10px]">{formatDate(room.lastActivity)}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DataRoomsPage() {
  const { selectedCompany: company } = useCompany();
  const [rooms, setRooms] = useState<DataRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomType, setNewRoomType] = useState<DataRoom['type']>('GENERAL');
  const [newRoomExpiry, setNewRoomExpiry] = useState('');
  const [newRoomWatermark, setNewRoomWatermark] = useState(true);
  const [newRoomDownload, setNewRoomDownload] = useState(true);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    const response = await getDataRooms();
    if (response.data) setRooms(response.data.rooms);
    setIsLoading(false);
  }, []);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      activeTab === 'all' ||
      (activeTab === 'active' && room.status === 'ACTIVE') ||
      (activeTab === 'archived' && room.status === 'ARCHIVED');
    return matchesSearch && matchesStatus;
  });

  const personalRoom = rooms.find((r) => r.name.startsWith('Mina analyser') && r.type === 'COMPLIANCE');
  const otherRooms = filteredRooms.filter((r) => r !== personalRoom);
  const activeRooms = rooms.filter((r) => r.status === 'ACTIVE').length;
  const archivedRooms = rooms.filter((r) => r.status === 'ARCHIVED').length;
  const totalDocuments = rooms.reduce((sum, r) => sum + r.documentsCount, 0);

  const roomTypes: { value: DataRoom['type']; label: string }[] = [
    { value: 'DEAL_ROOM', label: 'Affärsrum' },
    { value: 'DUE_DILIGENCE', label: 'Due Diligence' },
    { value: 'INVESTOR_PORTAL', label: 'Investerarportal' },
    { value: 'BOARD', label: 'Styrelserum' },
    { value: 'COMPLIANCE', label: 'Compliance' },
    { value: 'GENERAL', label: 'Allmänt' },
  ];

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
      fundId: 'auag-silver-bullet',
      fundName: company?.name || 'AuAg Silver Bullet',
    });
    if (response.data) {
      setRooms((prev) => [response.data!.room, ...prev]);
      setNewRoomName('');
      setNewRoomDescription('');
      setNewRoomType('GENERAL');
      setNewRoomExpiry('');
      setNewRoomWatermark(true);
      setNewRoomDownload(true);
      setShowNewRoomModal(false);
    }
    setIsCreating(false);
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-aifm-charcoal/40">Välj ett bolag för att se datarum.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-aifm-charcoal/30 uppercase tracking-widest mb-1">
            Dokument
          </p>
          <h1 className="text-2xl sm:text-3xl font-light text-aifm-charcoal tracking-tight">
            Datarum
          </h1>
        </div>
        <button
          onClick={() => setShowNewRoomModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white
                     bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nytt datarum
        </button>
      </div>

      {/* ── Stat strip ── */}
      <div className="flex flex-wrap items-center gap-6 py-4 px-5 rounded-2xl bg-white border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-aifm-gold/10 flex items-center justify-center">
            <FolderLock className="w-4 h-4 text-aifm-gold" />
          </div>
          <div>
            <p className="text-lg font-medium text-aifm-charcoal leading-none">{activeRooms}</p>
            <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider mt-0.5">Aktiva rum</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-100" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-medium text-aifm-charcoal leading-none">{totalDocuments}</p>
            <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider mt-0.5">Dokument</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-100 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <Shield className="w-4 h-4 text-aifm-charcoal/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-aifm-charcoal leading-none">256-bit AES</p>
            <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider mt-0.5">Kryptering</p>
          </div>
        </div>
      </div>

      {/* ── Personal analysis archive ── */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-aifm-gold/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-aifm-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-aifm-charcoal">Mina analyser</h2>
              <p className="text-[10px] text-aifm-charcoal/40">
                {personalRoom
                  ? `${personalRoom.documentsCount} dokument – sparas automatiskt vid PDF-export`
                  : 'Ditt personliga arkiv skapas automatiskt vid första PDF-exporten'}
              </p>
            </div>
          </div>
          {personalRoom && (
            <Link
              href={`/data-rooms/${personalRoom.id}`}
              className="text-xs font-medium text-aifm-gold hover:text-aifm-gold/80 transition-colors flex items-center gap-1"
            >
              Öppna
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-50">
          {ANALYSIS_FOLDERS.map((af) => {
            const AFIcon = af.icon;
            const target = personalRoom ? `/data-rooms/${personalRoom.id}` : '#';
            return (
              <Link
                key={af.key}
                href={target}
                className={`group flex items-center gap-3 px-4 sm:px-5 py-4 transition-colors ${
                  personalRoom ? 'hover:bg-gray-50/50' : 'opacity-60 cursor-default'
                }`}
                onClick={personalRoom ? undefined : (e) => e.preventDefault()}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${af.color}`}>
                  <AFIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-aifm-charcoal/70 group-hover:text-aifm-charcoal transition-colors line-clamp-1">
                  {af.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
          {[
            { key: 'all' as const, label: 'Alla', count: rooms.length },
            { key: 'active' as const, label: 'Aktiva', count: activeRooms },
            { key: 'archived' as const, label: 'Arkiverade', count: archivedRooms },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-white text-aifm-charcoal shadow-sm'
                  : 'text-aifm-charcoal/40 hover:text-aifm-charcoal/60'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] ${activeTab === tab.key ? 'text-aifm-gold' : 'text-aifm-charcoal/30'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Sök datarum..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 bg-white border border-gray-100 rounded-xl text-sm
                       placeholder:text-aifm-charcoal/30 focus:outline-none focus:border-aifm-gold/30
                       focus:ring-2 focus:ring-aifm-gold/10 transition-all"
          />
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-aifm-gold animate-spin" />
        </div>
      )}

      {/* ── Rooms grid ── */}
      {!isLoading && otherRooms.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filteredRooms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
            <FolderLock className="w-7 h-7 text-aifm-charcoal/20" />
          </div>
          <p className="text-aifm-charcoal/60 font-medium mb-1">Inga datarum hittades</p>
          <p className="text-xs text-aifm-charcoal/30 mb-6">Skapa ett nytt datarum för att komma igång</p>
          <button
            onClick={() => setShowNewRoomModal(true)}
            className="px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors"
          >
            Skapa datarum
          </button>
        </div>
      )}

      {/* ── Create room modal ── */}
      {showNewRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-aifm-charcoal">Nytt datarum</h3>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5">Säker dokumentdelning</p>
              </div>
              <button
                onClick={() => setShowNewRoomModal(false)}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-aifm-charcoal/40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-[11px] font-semibold text-aifm-charcoal/40 mb-2 uppercase tracking-wider">
                  Namn
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                  placeholder="t.ex. Due Diligence – Projekt Alpha"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-aifm-charcoal/40 mb-2 uppercase tracking-wider">
                  Beskrivning
                </label>
                <textarea
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm h-20 resize-none
                             focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                  placeholder="Kort beskrivning..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-aifm-charcoal/40 mb-2 uppercase tracking-wider">
                  Typ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roomTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewRoomType(type.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                        newRoomType === type.value
                          ? 'bg-aifm-charcoal text-white border-aifm-charcoal'
                          : 'bg-white text-aifm-charcoal/60 border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-aifm-charcoal/40 mb-2 uppercase tracking-wider">
                    Utgångsdatum
                  </label>
                  <input
                    type="date"
                    value={newRoomExpiry}
                    onChange={(e) => setNewRoomExpiry(e.target.value)}
                    className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-aifm-charcoal/40 mb-2 uppercase tracking-wider">
                    Fond
                  </label>
                  <select className="w-full py-3 px-4 bg-gray-50 border-0 rounded-xl text-sm
                                     focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all">
                    <option>{company?.name || 'AuAg Silver Bullet'}</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Säkerhet</p>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-aifm-charcoal/70">Vattenstämpel</span>
                  <input
                    type="checkbox"
                    checked={newRoomWatermark}
                    onChange={(e) => setNewRoomWatermark(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-aifm-charcoal/70">Tillåt nedladdning</span>
                  <input
                    type="checkbox"
                    checked={newRoomDownload}
                    onChange={(e) => setNewRoomDownload(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                </label>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-50 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowNewRoomModal(false)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/60
                           bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-all"
                disabled={isCreating}
              >
                Avbryt
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !newRoomName.trim()}
                className="flex-1 py-3 px-4 text-sm font-medium text-white
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90
                           transition-all flex items-center justify-center gap-2
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {isCreating ? 'Skapar...' : 'Skapa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
