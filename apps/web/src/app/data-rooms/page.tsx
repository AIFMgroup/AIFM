'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  FolderLock, Plus, Users, FileText, Clock, Shield,
  Search, Lock, Building2, Archive, BookOpen
} from 'lucide-react';
import {
  mockDataRooms, getTypeColor, getTypeLabel
} from '@/lib/dataRoomData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { formatDate } from '@/lib/fundData';

export default function DataRoomsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-aifm-gold rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="font-medium tracking-widest text-aifm-charcoal uppercase text-sm">AIFM</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/fund" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Funds</Link>
                <Link href="/data-rooms" className="text-sm font-medium text-aifm-gold uppercase tracking-wider">Data Rooms</Link>
                <Link href="/investors" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Investors</Link>
              </nav>
            </div>
            <button 
              onClick={() => setShowNewRoomModal(true)}
              className="btn-primary py-2 px-4 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Data Room
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="heading-2">Secure Data Rooms</h1>
            <HelpTooltip 
              {...helpContent.dataRooms}
              learnMoreLink="/guide#data-rooms"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">Share documents securely with controlled access and full audit trails</p>
            <Link href="/guide#data-rooms" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Active Rooms</span>
              <FolderLock className="w-5 h-5 text-aifm-gold" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal">{activeRooms}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Documents</span>
              <FileText className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal">{totalDocuments}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Total Members</span>
              <Users className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal">{totalMembers}</p>
          </div>

          <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/80 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-white/70">Security</span>
              <Shield className="w-5 h-5 text-white/50" />
            </div>
            <p className="text-lg font-medium">256-bit Encrypted</p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-aifm-charcoal/5 border border-aifm-charcoal/10 rounded-2xl p-4 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-aifm-charcoal/10 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-aifm-charcoal" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-aifm-charcoal">Bank-grade Security</p>
            <p className="text-sm text-aifm-charcoal/60">All documents are encrypted at rest and in transit. Access is logged and auditable.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-aifm-charcoal/40" />
            <input
              type="text"
              placeholder="Search data rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input py-2 px-4 min-w-[180px]"
          >
            <option value="all">All Types</option>
            <option value="DEAL_ROOM">Deal Rooms</option>
            <option value="DUE_DILIGENCE">Due Diligence</option>
            <option value="INVESTOR_PORTAL">Investor Portals</option>
            <option value="BOARD">Board Rooms</option>
            <option value="COMPLIANCE">Compliance</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input py-2 px-4 min-w-[150px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Data Rooms Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <Link 
              key={room.id}
              href={`/data-rooms/${room.id}`}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-aifm-gold/30 transition-all overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    room.status === 'ARCHIVED' ? 'bg-gray-100' : 'bg-aifm-gold/10'
                  }`}>
                    {room.status === 'ARCHIVED' ? (
                      <Archive className="w-6 h-6 text-gray-400" />
                    ) : (
                      <FolderLock className="w-6 h-6 text-aifm-gold" />
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(room.type)}`}>
                    {getTypeLabel(room.type)}
                  </span>
                </div>
                
                <h3 className="font-medium text-aifm-charcoal mb-1 group-hover:text-aifm-gold transition-colors">
                  {room.name}
                </h3>
                <p className="text-sm text-aifm-charcoal/60 line-clamp-2 mb-4">{room.description}</p>

                <div className="flex items-center gap-1 text-xs text-aifm-charcoal/50 mb-4">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{room.fundName}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-lg font-medium text-aifm-charcoal">{room.documentsCount}</p>
                    <p className="text-xs text-aifm-charcoal/50">Documents</p>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <p className="text-lg font-medium text-aifm-charcoal">{room.membersCount}</p>
                    <p className="text-xs text-aifm-charcoal/50">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-aifm-charcoal">{formatDate(room.lastActivity)}</p>
                    <p className="text-xs text-aifm-charcoal/50">Last Active</p>
                  </div>
                </div>

                {room.expiresAt && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires {formatDate(room.expiresAt)}</span>
                  </div>
                )}

                {room.watermark && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-aifm-charcoal/50">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Watermarked</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {filteredRooms.length === 0 && (
          <div className="text-center py-12">
            <FolderLock className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
            <p className="text-aifm-charcoal/60">No data rooms found</p>
            <button 
              onClick={() => setShowNewRoomModal(true)}
              className="btn-primary mt-4 py-2 px-4"
            >
              Create First Data Room
            </button>
          </div>
        )}
      </main>

      {/* New Room Modal */}
      {showNewRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">New Data Room</h3>
              <button 
                onClick={() => setShowNewRoomModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-aifm-charcoal/60"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Room Name
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g., Project Alpha Due Diligence"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  className="input w-full h-20 resize-none"
                  placeholder="Brief description of the room's purpose..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Room Type
                </label>
                <select className="input w-full">
                  <option value="DEAL_ROOM">Deal Room</option>
                  <option value="DUE_DILIGENCE">Due Diligence</option>
                  <option value="INVESTOR_PORTAL">Investor Portal</option>
                  <option value="BOARD">Board Room</option>
                  <option value="COMPLIANCE">Compliance</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Fund
                </label>
                <select className="input w-full">
                  <option value="fund-1">Nordic Growth Fund I</option>
                  <option value="fund-2">Scandinavian Tech Fund II</option>
                  <option value="fund-3">Baltic Real Estate Fund</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                    Expiration Date (Optional)
                  </label>
                  <input type="date" className="input w-full" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold" defaultChecked />
                    <span className="text-sm text-aifm-charcoal">Enable Watermarks</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowNewRoomModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert('Data room created! (Demo)');
                  setShowNewRoomModal(false);
                }}
                className="flex-1 btn-primary py-2"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

