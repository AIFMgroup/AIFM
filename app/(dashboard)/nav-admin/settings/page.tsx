'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Settings, Building2, Users, Mail, Shield, Clock,
  Plus, Trash2, Edit2, Check, X, Save, RefreshCw, Loader2,
  DollarSign, Percent, Calendar, Globe, FileText, Bell,
  ChevronRight, AlertCircle, CheckCircle2, Info
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ShareClass {
  id: string;
  name: string;
  isin: string;
  currency: string;
  managementFee: number;
  performanceFee: number;
  minInvestment: number;
  isActive: boolean;
}

interface Fund {
  id: string;
  name: string;
  legalName: string;
  baseCurrency: string;
  navFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  navTime: string;
  fiscalYearEnd: string;
  launchDate: string;
  shareClasses: ShareClass[];
  isActive: boolean;
}

interface NAVRecipient {
  id: string;
  name: string;
  email: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'REGULATOR';
  funds: string[];
  receiveDaily: boolean;
  receiveWeekly: boolean;
  receiveMonthly: boolean;
}

interface ApprovalRole {
  id: string;
  userId: string;
  userName: string;
  email: string;
  role: 'FIRST_APPROVER' | 'SECOND_APPROVER' | 'ADMIN';
  funds: string[];
}

// ============================================================================
// Mock Data
// ============================================================================

const mockFunds: Fund[] = [
  {
    id: 'f1',
    name: 'AUAG Essential Metals',
    legalName: 'AUAG Essential Metals AB',
    baseCurrency: 'SEK',
    navFrequency: 'DAILY',
    navTime: '15:00',
    fiscalYearEnd: '12-31',
    launchDate: '2021-03-15',
    isActive: true,
    shareClasses: [
      { id: 'sc1a', name: 'A', isin: 'SE0019175563', currency: 'SEK', managementFee: 1.25, performanceFee: 0, minInvestment: 100, isActive: true },
      { id: 'sc1b', name: 'B', isin: 'SE0019175571', currency: 'EUR', managementFee: 1.25, performanceFee: 0, minInvestment: 100, isActive: true },
    ],
  },
  {
    id: 'f2',
    name: 'AuAg Gold Rush',
    legalName: 'AuAg Gold Rush AB',
    baseCurrency: 'SEK',
    navFrequency: 'DAILY',
    navTime: '15:00',
    fiscalYearEnd: '12-31',
    launchDate: '2022-06-01',
    isActive: true,
    shareClasses: [
      { id: 'sc2a', name: 'A', isin: 'SE0020677946', currency: 'SEK', managementFee: 1.50, performanceFee: 20, minInvestment: 100, isActive: true },
      { id: 'sc2h', name: 'H (NOK)', isin: 'SE0020678001', currency: 'NOK', managementFee: 1.50, performanceFee: 20, minInvestment: 1000, isActive: true },
    ],
  },
  {
    id: 'f3',
    name: 'AuAg Precious Green',
    legalName: 'AuAg Precious Green AB',
    baseCurrency: 'SEK',
    navFrequency: 'DAILY',
    navTime: '15:00',
    fiscalYearEnd: '12-31',
    launchDate: '2020-11-20',
    isActive: true,
    shareClasses: [
      { id: 'sc3a', name: 'A', isin: 'SE0014808440', currency: 'SEK', managementFee: 1.25, performanceFee: 0, minInvestment: 100, isActive: true },
    ],
  },
  {
    id: 'f4',
    name: 'AuAg Silver Bullet',
    legalName: 'AuAg Silver Bullet AB',
    baseCurrency: 'SEK',
    navFrequency: 'DAILY',
    navTime: '15:00',
    fiscalYearEnd: '12-31',
    launchDate: '2019-09-01',
    isActive: true,
    shareClasses: [
      { id: 'sc4a', name: 'A', isin: 'SE0013358181', currency: 'SEK', managementFee: 1.00, performanceFee: 0, minInvestment: 100, isActive: true },
      { id: 'sc4b', name: 'B', isin: 'SE0013358199', currency: 'EUR', managementFee: 1.00, performanceFee: 0, minInvestment: 100, isActive: true },
    ],
  },
];

const mockRecipients: NAVRecipient[] = [
  { id: 'r1', name: 'Christopher Genberg', email: 'christopher.genberg@aifm.se', type: 'INTERNAL', funds: ['f1', 'f2', 'f3', 'f4'], receiveDaily: true, receiveWeekly: true, receiveMonthly: true },
  { id: 'r2', name: 'NAV Team', email: 'nav@aifm.se', type: 'INTERNAL', funds: ['f1', 'f2', 'f3', 'f4'], receiveDaily: true, receiveWeekly: false, receiveMonthly: true },
  { id: 'r3', name: 'Finansinspektionen', email: 'rapporter@fi.se', type: 'REGULATOR', funds: ['f1', 'f2', 'f3', 'f4'], receiveDaily: false, receiveWeekly: false, receiveMonthly: true },
];

const mockApprovalRoles: ApprovalRole[] = [
  { id: 'a1', userId: 'u1', userName: 'Christopher Genberg', email: 'christopher.genberg@aifm.se', role: 'ADMIN', funds: ['f1', 'f2', 'f3', 'f4'] },
  { id: 'a2', userId: 'u2', userName: 'Anna Lindberg', email: 'anna.lindberg@aifm.se', role: 'FIRST_APPROVER', funds: ['f1', 'f2', 'f3', 'f4'] },
  { id: 'a3', userId: 'u3', userName: 'Erik Svensson', email: 'erik.svensson@aifm.se', role: 'SECOND_APPROVER', funds: ['f1', 'f2', 'f3', 'f4'] },
];

// ============================================================================
// Tab Component
// ============================================================================

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: 'funds', label: 'Fonder', icon: Building2 },
  { id: 'recipients', label: 'Mottagare', icon: Mail },
  { id: 'approvals', label: 'Godkännare', icon: Shield },
  { id: 'schedule', label: 'Schemaläggning', icon: Clock },
  { id: 'integrations', label: 'Integrationer', icon: Globe },
];

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      isActive 
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
        : 'bg-gray-50 text-gray-500 border border-gray-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {isActive ? 'Aktiv' : 'Inaktiv'}
    </span>
  );
}

function RoleBadge({ role }: { role: ApprovalRole['role'] }) {
  const config = {
    ADMIN: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Admin' },
    FIRST_APPROVER: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Första godkännare' },
    SECOND_APPROVER: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Andra godkännare' },
  }[role];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  );
}

function TypeBadge({ type }: { type: NAVRecipient['type'] }) {
  const config = {
    INTERNAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Intern' },
    EXTERNAL: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', label: 'Extern' },
    REGULATOR: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Myndighet' },
  }[type];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  );
}

function ToggleSwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-aifm-gold' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ============================================================================
// Fund Configuration Tab
// ============================================================================

function FundsTab({ funds, setFunds }: { funds: Fund[]; setFunds: (funds: Fund[]) => void }) {
  const [expandedFund, setExpandedFund] = useState<string | null>(null);
  const [editingShareClass, setEditingShareClass] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-aifm-charcoal">Fondkonfiguration</h3>
          <p className="text-sm text-gray-500 mt-1">Hantera fonder och andelsklasser</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Lägg till fond</span>
        </button>
      </div>

      {/* Funds List */}
      <div className="space-y-3">
        {funds.map((fund) => (
          <div
            key={fund.id}
            className="bg-white border border-gray-100 rounded-xl overflow-hidden"
          >
            {/* Fund Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpandedFund(expandedFund === fund.id ? null : fund.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  fund.isActive ? 'bg-gradient-to-br from-aifm-gold to-amber-500' : 'bg-gray-200'
                }`}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-aifm-charcoal">{fund.name}</div>
                  <div className="text-sm text-gray-500">{fund.shareClasses.length} andelsklasser • {fund.baseCurrency}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge isActive={fund.isActive} />
                <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedFund === fund.id ? 'rotate-90' : ''}`} />
              </div>
            </div>

            {/* Expanded Content */}
            {expandedFund === fund.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                {/* Fund Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Juridiskt namn</label>
                    <div className="text-sm text-aifm-charcoal">{fund.legalName}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">NAV-frekvens</label>
                    <div className="text-sm text-aifm-charcoal">
                      {fund.navFrequency === 'DAILY' ? 'Daglig' : fund.navFrequency === 'WEEKLY' ? 'Veckovis' : 'Månadsvis'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">NAV-tid</label>
                    <div className="text-sm text-aifm-charcoal">{fund.navTime} CET</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Räkenskapsår</label>
                    <div className="text-sm text-aifm-charcoal">{fund.fiscalYearEnd}</div>
                  </div>
                </div>

                {/* Share Classes */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">Andelsklasser</h4>
                    <button className="flex items-center gap-1.5 text-sm text-aifm-gold hover:text-aifm-gold/80">
                      <Plus className="w-4 h-4" />
                      Lägg till
                    </button>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Klass</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">ISIN</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Valuta</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Mgmt Fee</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">Perf Fee</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">Status</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">Åtgärd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {fund.shareClasses.map((sc) => (
                          <tr key={sc.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium">{sc.name}</td>
                            <td className="px-4 py-3 font-mono text-gray-600">{sc.isin}</td>
                            <td className="px-4 py-3">{sc.currency}</td>
                            <td className="px-4 py-3 text-right">{sc.managementFee.toFixed(2)}%</td>
                            <td className="px-4 py-3 text-right">{sc.performanceFee > 0 ? `${sc.performanceFee}%` : '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge isActive={sc.isActive} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <Edit2 className="w-4 h-4 text-gray-500" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Recipients Tab
// ============================================================================

function RecipientsTab({ recipients, setRecipients, funds }: { recipients: NAVRecipient[]; setRecipients: (r: NAVRecipient[]) => void; funds: Fund[] }) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-aifm-charcoal">NAV-mottagare</h3>
          <p className="text-sm text-gray-500 mt-1">Hantera vem som får NAV-rapporter</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Lägg till mottagare</span>
        </button>
      </div>

      {/* Recipients List */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mottagare</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Typ</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Fonder</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Daglig</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Vecka</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Månad</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Åtgärd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recipients.map((recipient) => (
              <tr key={recipient.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-aifm-charcoal">{recipient.name}</div>
                  <div className="text-sm text-gray-500">{recipient.email}</div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={recipient.type} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                    {recipient.funds.length === funds.length ? 'Alla' : recipient.funds.length}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <ToggleSwitch
                    checked={recipient.receiveDaily}
                    onChange={(checked) => {
                      setRecipients(recipients.map(r => 
                        r.id === recipient.id ? { ...r, receiveDaily: checked } : r
                      ));
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <ToggleSwitch
                    checked={recipient.receiveWeekly}
                    onChange={(checked) => {
                      setRecipients(recipients.map(r => 
                        r.id === recipient.id ? { ...r, receiveWeekly: checked } : r
                      ));
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <ToggleSwitch
                    checked={recipient.receiveMonthly}
                    onChange={(checked) => {
                      setRecipients(recipients.map(r => 
                        r.id === recipient.id ? { ...r, receiveMonthly: checked } : r
                      ));
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Approvals Tab
// ============================================================================

function ApprovalsTab({ roles, setRoles, funds }: { roles: ApprovalRole[]; setRoles: (r: ApprovalRole[]) => void; funds: Fund[] }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-aifm-charcoal">Godkännare</h3>
          <p className="text-sm text-gray-500 mt-1">Hantera vem som kan godkänna NAV (4-ögonprincipen)</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Lägg till godkännare</span>
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-blue-800">4-ögonprincipen</div>
          <div className="text-sm text-blue-700 mt-1">
            NAV måste godkännas av två separata personer innan den blir officiell. 
            Första godkännaren verifierar beräkningen, andra godkännaren slutgodkänner.
          </div>
        </div>
      </div>

      {/* Approvers by Role */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* First Approvers */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="font-semibold text-aifm-charcoal">Första godkännare</h4>
              <p className="text-xs text-gray-500">Verifierar beräkningen</p>
            </div>
          </div>
          <div className="space-y-2">
            {roles.filter(r => r.role === 'FIRST_APPROVER').map((role) => (
              <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{role.userName}</div>
                  <div className="text-xs text-gray-500">{role.email}</div>
                </div>
                <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Second Approvers */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="font-semibold text-aifm-charcoal">Andra godkännare</h4>
              <p className="text-xs text-gray-500">Slutgodkänner NAV</p>
            </div>
          </div>
          <div className="space-y-2">
            {roles.filter(r => r.role === 'SECOND_APPROVER').map((role) => (
              <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{role.userName}</div>
                  <div className="text-xs text-gray-500">{role.email}</div>
                </div>
                <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admins */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Shield className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-aifm-charcoal">Administratörer</h4>
            <p className="text-xs text-gray-500">Full behörighet till alla funktioner</p>
          </div>
        </div>
        <div className="space-y-2">
          {roles.filter(r => r.role === 'ADMIN').map((role) => (
            <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">{role.userName}</div>
                <div className="text-xs text-gray-500">{role.email}</div>
              </div>
              <RoleBadge role={role.role} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Schedule Tab
// ============================================================================

function ScheduleTab() {
  const [navTime, setNavTime] = useState('15:00');
  const [timezone, setTimezone] = useState('Europe/Stockholm');
  const [runOnWeekends, setRunOnWeekends] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(1.0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-aifm-charcoal">Schemaläggning</h3>
        <p className="text-sm text-gray-500 mt-1">Konfigurera automatisk NAV-beräkning</p>
      </div>

      {/* NAV Time */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h4 className="font-semibold text-aifm-charcoal mb-4">NAV-tid</h4>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beräkningstid</label>
            <div className="flex gap-2">
              {['14:00', '14:30', '15:00', '15:30', '16:00'].map((time) => (
                <button
                  key={time}
                  onClick={() => setNavTime(time)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    navTime === time
                      ? 'bg-aifm-gold text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tidszon</label>
            <div className="flex gap-2">
              {[
                { id: 'Europe/Stockholm', label: 'CET' },
                { id: 'UTC', label: 'UTC' },
              ].map((tz) => (
                <button
                  key={tz.id}
                  onClick={() => setTimezone(tz.id)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    timezone === tz.id
                      ? 'bg-aifm-gold text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tz.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Run Days */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h4 className="font-semibold text-aifm-charcoal mb-4">Körningsdagar</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Vardagar (mån-fre)</div>
              <div className="text-sm text-gray-500">Kör NAV-beräkning på vardagar</div>
            </div>
            <ToggleSwitch checked={true} onChange={() => {}} disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Helger (lör-sön)</div>
              <div className="text-sm text-gray-500">Kör NAV-beräkning på helger</div>
            </div>
            <ToggleSwitch checked={runOnWeekends} onChange={setRunOnWeekends} />
          </div>
        </div>
      </div>

      {/* Auto Approve */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h4 className="font-semibold text-aifm-charcoal mb-4">Automatiskt godkännande</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Auto-godkänn små förändringar</div>
              <div className="text-sm text-gray-500">Hoppa över godkännande om NAV-förändringen är under tröskelvärdet</div>
            </div>
            <ToggleSwitch checked={autoApprove} onChange={setAutoApprove} />
          </div>
          {autoApprove && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tröskelvärde</label>
              <div className="flex gap-2">
                {[0.5, 1.0, 2.0, 5.0].map((threshold) => (
                  <button
                    key={threshold}
                    onClick={() => setAutoApproveThreshold(threshold)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      autoApproveThreshold === threshold
                        ? 'bg-aifm-gold text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ±{threshold}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Integrations Tab
// ============================================================================

function IntegrationsTab() {
  const [securaConnected, setSecuraConnected] = useState(false);
  const [ecbEnabled, setEcbEnabled] = useState(true);
  const [sesEnabled, setSesEnabled] = useState(true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-aifm-charcoal">Integrationer</h3>
        <p className="text-sm text-gray-500 mt-1">Konfigurera externa system och datakällor</p>
      </div>

      {/* ISEC/SECURA */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-aifm-charcoal">ISEC / SECURA API</h4>
              <p className="text-sm text-gray-500 mt-1">Hämta fonddata, positioner, och NAV-historik</p>
              <div className="mt-3 flex items-center gap-2">
                {securaConnected ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Ansluten
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    Väntar på API-nyckel
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-aifm-gold border border-aifm-gold rounded-lg hover:bg-aifm-gold/5 transition-colors">
            Konfigurera
          </button>
        </div>
      </div>

      {/* ECB FX Rates */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-aifm-charcoal">ECB Valutakurser</h4>
              <p className="text-sm text-gray-500 mt-1">Automatiska växelkurser från Europeiska Centralbanken</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Aktiv - Uppdateras kl 16:00 CET
                </span>
              </div>
            </div>
          </div>
          <ToggleSwitch checked={ecbEnabled} onChange={setEcbEnabled} />
        </div>
      </div>

      {/* AWS SES */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-aifm-charcoal">AWS SES (E-post)</h4>
              <p className="text-sm text-gray-500 mt-1">Skicka NAV-rapporter och notifikationer</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Konfigurerad - nav@aifm.se
                </span>
              </div>
            </div>
          </div>
          <ToggleSwitch checked={sesEnabled} onChange={setSesEnabled} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NAVSettingsPage() {
  const [activeTab, setActiveTab] = useState('funds');
  const [funds, setFunds] = useState<Fund[]>(mockFunds);
  const [recipients, setRecipients] = useState<NAVRecipient[]>(mockRecipients);
  const [approvalRoles, setApprovalRoles] = useState<ApprovalRole[]>(mockApprovalRoles);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">NAV-inställningar</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Konfigurera fonder, mottagare och schemaläggning
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="font-medium">Spara ändringar</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-aifm-gold text-aifm-gold bg-aifm-gold/5'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'funds' && <FundsTab funds={funds} setFunds={setFunds} />}
          {activeTab === 'recipients' && <RecipientsTab recipients={recipients} setRecipients={setRecipients} funds={funds} />}
          {activeTab === 'approvals' && <ApprovalsTab roles={approvalRoles} setRoles={setApprovalRoles} funds={funds} />}
          {activeTab === 'schedule' && <ScheduleTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
        </div>
      </div>
    </div>
  );
}
