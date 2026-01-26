'use client';

import { useState } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Eye, Users,
  Shield, ChevronRight, ChevronDown, Loader2, MessageSquare,
  TrendingUp, TrendingDown, ArrowRight, FileText, BarChart3,
  Calendar, Hash, Coins, Activity
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface FundNAV {
  fundId: string;
  fundName: string;
  isin: string;
  currency: string;
  navValue: number;
  previousNav?: number;
  changePercent?: number;
  aum: number;
  sharesOutstanding?: number;
  netInflows?: number;
  grossAssets?: number;
  liabilities?: number;
  accruals?: number;
  shareClasses?: {
    className: string;
    isin: string;
    currency: string;
    navValue: number;
    previousNav?: number;
    shares: number;
    classAum: number;
  }[];
}

interface Approver {
  userId: string;
  userName: string;
  approvedAt: string;
  comment?: string;
}

interface NAVApprovalData {
  id: string;
  navDate: string;
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'APPROVED' | 'REJECTED';
  funds: FundNAV[];
  firstApprover?: Approver;
  secondApprover?: Approver;
  rejection?: {
    userName: string;
    rejectedAt: string;
    reason: string;
  };
}

interface NAVApprovalCardProps {
  data?: NAVApprovalData;
  currentUserId?: string;
  currentUserName?: string;
  requireFourEyes?: boolean;
  onApprove?: (requestId: string, comment?: string) => Promise<void>;
  onReject?: (requestId: string, reason: string) => Promise<void>;
  onViewDetails?: (requestId: string) => void;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_DATA: NAVApprovalData = {
  id: 'nav-2025-01-25-001',
  navDate: '2025-01-25',
  status: 'PENDING_FIRST',
  funds: [
    { 
      fundId: 'f1', 
      fundName: 'AUAG Essential Metals', 
      isin: 'SE0019175563', 
      currency: 'SEK', 
      navValue: 142.42, 
      previousNav: 141.85, 
      changePercent: 0.40, 
      aum: 395584099,
      sharesOutstanding: 2746217.43,
      netInflows: 1250000,
      grossAssets: 398500000,
      liabilities: 2915901,
      accruals: 0,
      shareClasses: [
        { className: 'A', isin: 'SE0019175563', currency: 'SEK', navValue: 142.42, previousNav: 141.85, shares: 2456766.31, classAum: 349892028 },
        { className: 'B', isin: 'SE0019175571', currency: 'EUR', navValue: 14.65, previousNav: 14.58, shares: 269451.12, classAum: 43120778 },
        { className: 'C', isin: 'SE0019175589', currency: 'SEK', navValue: 128.56, previousNav: 128.05, shares: 20000, classAum: 2571291 },
      ]
    },
    { 
      fundId: 'f2', 
      fundName: 'AuAg Gold Rush', 
      isin: 'SE0020677946', 
      currency: 'SEK', 
      navValue: 208.71, 
      previousNav: 207.12, 
      changePercent: 0.77, 
      aum: 613070568,
      sharesOutstanding: 3034839.62,
      netInflows: 3500000,
      grossAssets: 618000000,
      liabilities: 4929432,
      accruals: 0,
      shareClasses: [
        { className: 'A', isin: 'SE0020677946', currency: 'SEK', navValue: 208.71, previousNav: 207.12, shares: 2422025.74, classAum: 505494096 },
        { className: 'B', isin: 'SE0020677953', currency: 'EUR', navValue: 22.63, previousNav: 22.46, shares: 400, classAum: 98912 },
        { className: 'C', isin: 'SE0020677961', currency: 'SEK', navValue: 170.52, previousNav: 169.21, shares: 74543.90, classAum: 12710988 },
        { className: 'H', isin: 'SE0020678001', currency: 'NOK', navValue: 197.23, previousNav: 195.74, shares: 488103.97, classAum: 87854781 },
        { className: 'L', isin: 'SE0020678050', currency: 'USD', navValue: 11.96, previousNav: 11.87, shares: 30000, classAum: 3336387 },
        { className: 'N', isin: 'SE0020678076', currency: 'CHF', navValue: 15.48, previousNav: 15.36, shares: 19766.01, classAum: 3575401 },
      ]
    },
    { 
      fundId: 'f3', 
      fundName: 'AuAg Precious Green', 
      isin: 'SE0014808440', 
      currency: 'SEK', 
      navValue: 198.87, 
      previousNav: 199.45, 
      changePercent: -0.29, 
      aum: 347295087,
      sharesOutstanding: 1756374.73,
      netInflows: -500000,
      grossAssets: 350000000,
      liabilities: 2704913,
      accruals: 0,
      shareClasses: [
        { className: 'A', isin: 'SE0014808440', currency: 'SEK', navValue: 198.87, previousNav: 199.45, shares: 1653996.37, classAum: 328924859 },
        { className: 'B', isin: 'SE0014808457', currency: 'EUR', navValue: 18.88, previousNav: 18.93, shares: 60729.92, classAum: 12524335 },
        { className: 'C', isin: 'SE0015948641', currency: 'SEK', navValue: 140.36, previousNav: 140.77, shares: 41648.44, classAum: 5845893 },
      ]
    },
    { 
      fundId: 'f4', 
      fundName: 'AuAg Silver Bullet', 
      isin: 'SE0013358181', 
      currency: 'SEK', 
      navValue: 378.33, 
      previousNav: 375.82, 
      changePercent: 0.67, 
      aum: 4344439682,
      sharesOutstanding: 11253297.96,
      netInflows: 25000000,
      grossAssets: 4385000000,
      liabilities: 40560318,
      accruals: 0,
      shareClasses: [
        { className: 'A', isin: 'SE0013358181', currency: 'SEK', navValue: 378.33, previousNav: 375.82, shares: 8987586.35, classAum: 3400248947 },
        { className: 'B', isin: 'SE0013358199', currency: 'EUR', navValue: 37.23, previousNav: 36.98, shares: 2265711.61, classAum: 921562837 },
      ]
    },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLargeCurrency(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} Mdr`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} Mkr`;
  }
  return formatCurrency(value);
}

function getStatusConfig(status: NAVApprovalData['status']) {
  switch (status) {
    case 'PENDING_FIRST':
      return {
        label: 'Väntar på godkännande',
        sublabel: 'Första godkännandet',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: Clock,
      };
    case 'PENDING_SECOND':
      return {
        label: 'Väntar på andra godkännande',
        sublabel: '4-ögon-principen',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: Users,
      };
    case 'APPROVED':
      return {
        label: 'Godkänt',
        sublabel: 'Redo för distribution',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: CheckCircle2,
      };
    case 'REJECTED':
      return {
        label: 'Avvisat',
        sublabel: 'Åtgärd krävs',
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: XCircle,
      };
  }
}

// ============================================================================
// Components
// ============================================================================

function ApproverBadge({ approver, label }: { approver: Approver; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      <div>
        <p className="text-xs text-emerald-600 font-medium">{label}</p>
        <p className="text-sm text-aifm-charcoal">
          {approver.userName} • {new Date(approver.approvedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function NAVApprovalCard({
  data = MOCK_DATA,
  currentUserId = 'user-1',
  currentUserName = 'Du',
  requireFourEyes = true,
  onApprove,
  onReject,
  onViewDetails,
}: NAVApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const statusConfig = getStatusConfig(data.status);
  const StatusIcon = statusConfig.icon;

  const canApprove = 
    (data.status === 'PENDING_FIRST') ||
    (data.status === 'PENDING_SECOND' && data.firstApprover?.userId !== currentUserId);

  const isOwnFirstApproval = data.firstApprover?.userId === currentUserId;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove?.(data.id, comment || undefined);
    } finally {
      setIsApproving(false);
      setComment('');
      setShowComment(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    
    setIsRejecting(true);
    try {
      await onReject?.(data.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    } finally {
      setIsRejecting(false);
    }
  };

  // Calculate totals
  const totalAUM = data.funds.reduce((sum, f) => sum + f.aum, 0);

  return (
    <div className={`bg-white rounded-2xl border-2 ${statusConfig.border} overflow-hidden`}>
      {/* Header */}
      <div className={`px-6 py-4 ${statusConfig.bg} border-b ${statusConfig.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-white`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-aifm-charcoal">NAV för {data.navDate}</h3>
              <p className={`text-sm ${statusConfig.color}`}>{statusConfig.sublabel}</p>
            </div>
          </div>
          
          <div className={`px-3 py-1.5 rounded-full ${statusConfig.bg} border ${statusConfig.border}`}>
            <span className={`text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* 4-eyes indicator */}
      {requireFourEyes && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
          <Shield className="w-4 h-4 text-aifm-charcoal/40" />
          <span className="text-sm text-aifm-charcoal/60">
            4-ögon-principen: Kräver godkännande från två olika personer
          </span>
        </div>
      )}

      {/* Approvers */}
      {(data.firstApprover || data.secondApprover) && (
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          {data.firstApprover && (
            <ApproverBadge approver={data.firstApprover} label="Första godkännandet" />
          )}
          {data.secondApprover && (
            <ApproverBadge approver={data.secondApprover} label="Andra godkännandet" />
          )}
        </div>
      )}

      {/* Rejection info */}
      {data.rejection && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">
                Avvisad av {data.rejection.userName}
              </p>
              <p className="text-sm text-red-600 mt-1">{data.rejection.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* NAV Summary */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-aifm-charcoal">NAV-sammanfattning</h4>
          <span className="text-sm text-aifm-charcoal/50">
            Totalt AUM: {formatLargeCurrency(totalAUM)} SEK
          </span>
        </div>

        <div className="space-y-2">
          {data.funds.map((fund) => (
            <div 
              key={fund.fundId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-aifm-charcoal text-sm">{fund.fundName}</p>
                <p className="text-xs text-aifm-charcoal/50">{fund.isin}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-aifm-charcoal">
                  {formatCurrency(fund.navValue)} {fund.currency}
                </p>
                {fund.changePercent !== undefined && (
                  <p className={`text-xs font-medium ${fund.changePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fund.changePercent >= 0 ? '+' : ''}{fund.changePercent.toFixed(2)}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Details Section */}
      {showDetails && (
        <div className="border-t border-gray-200 bg-gray-50/50">
          <div className="px-6 py-4">
            <h4 className="font-semibold text-aifm-charcoal mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-aifm-gold" />
              Detaljerad NAV-beräkning
            </h4>
            
            {data.funds.map((fund) => (
              <div key={fund.fundId} className="mb-6 last:mb-0">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Fund Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-white">{fund.fundName}</h5>
                        <p className="text-xs text-white/60">{fund.isin}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {fund.changePercent !== undefined && (
                          <span className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded ${
                            fund.changePercent >= 0 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {fund.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {fund.changePercent >= 0 ? '+' : ''}{fund.changePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fund Overview Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 border-b border-gray-100">
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3" /> NAV-kurs
                      </p>
                      <p className="font-semibold text-aifm-charcoal">
                        {formatCurrency(fund.navValue)} {fund.currency}
                      </p>
                      {fund.previousNav && (
                        <p className="text-xs text-aifm-charcoal/40 mt-0.5">
                          Föregående: {formatCurrency(fund.previousNav)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> AUM
                      </p>
                      <p className="font-semibold text-aifm-charcoal">{formatLargeCurrency(fund.aum)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Utst. andelar
                      </p>
                      <p className="font-semibold text-aifm-charcoal">
                        {fund.sharesOutstanding ? formatCurrency(fund.sharesOutstanding) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Nettoflöde
                      </p>
                      <p className={`font-semibold ${fund.netInflows && fund.netInflows >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fund.netInflows ? (fund.netInflows >= 0 ? '+' : '') + formatLargeCurrency(Math.abs(fund.netInflows)) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Balance Sheet Details */}
                  <div className="p-4">
                    <h6 className="text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider mb-3 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Balansräkningsdetaljer
                    </h6>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-aifm-charcoal/70">Brutto tillgångar</span>
                        <span className="font-medium text-aifm-charcoal">
                          {fund.grossAssets ? formatLargeCurrency(fund.grossAssets) : 'N/A'} SEK
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-aifm-charcoal/70">Skulder</span>
                        <span className="font-medium text-red-600">
                          -{fund.liabilities ? formatLargeCurrency(fund.liabilities) : 'N/A'} SEK
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-aifm-charcoal/70">Upplupna kostnader</span>
                        <span className="font-medium text-aifm-charcoal/60">
                          -{fund.accruals !== undefined ? formatLargeCurrency(fund.accruals) : 'N/A'} SEK
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 bg-aifm-gold/10 rounded-lg px-3">
                        <span className="text-sm font-semibold text-aifm-charcoal">Netto tillgångar (NAV)</span>
                        <span className="font-bold text-aifm-charcoal">{formatLargeCurrency(fund.aum)} SEK</span>
                      </div>
                    </div>
                  </div>

                  {/* Share Classes */}
                  {fund.shareClasses && fund.shareClasses.length > 0 && (
                    <div className="p-4 border-t border-gray-100">
                      <h6 className="text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider mb-3 flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        Andelsklasser ({fund.shareClasses.length})
                      </h6>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px]">
                          <thead>
                            <tr className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">
                              <th className="text-left py-2 px-2">Klass</th>
                              <th className="text-left py-2 px-2">ISIN</th>
                              <th className="text-center py-2 px-2">Valuta</th>
                              <th className="text-right py-2 px-2">NAV</th>
                              <th className="text-right py-2 px-2">Föreg.</th>
                              <th className="text-right py-2 px-2">Förändring</th>
                              <th className="text-right py-2 px-2">Andelar</th>
                              <th className="text-right py-2 px-2">Klass AUM</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {fund.shareClasses.map((sc) => {
                              const scChange = sc.previousNav 
                                ? ((sc.navValue - sc.previousNav) / sc.previousNav) * 100 
                                : 0;
                              return (
                                <tr key={sc.isin} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2 px-2 font-medium text-aifm-charcoal">Klass {sc.className}</td>
                                  <td className="py-2 px-2 font-mono text-xs text-aifm-charcoal/60">{sc.isin}</td>
                                  <td className="py-2 px-2 text-center">
                                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-aifm-charcoal/70">
                                      {sc.currency}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right font-semibold text-aifm-charcoal">
                                    {formatCurrency(sc.navValue)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-aifm-charcoal/50">
                                    {sc.previousNav ? formatCurrency(sc.previousNav) : '-'}
                                  </td>
                                  <td className={`py-2 px-2 text-right font-medium ${scChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {scChange >= 0 ? '+' : ''}{scChange.toFixed(2)}%
                                  </td>
                                  <td className="py-2 px-2 text-right text-aifm-charcoal/70">
                                    {formatCurrency(sc.shares)}
                                  </td>
                                  <td className="py-2 px-2 text-right font-medium text-aifm-charcoal">
                                    {formatLargeCurrency(sc.classAum)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Calculation Timestamp */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-aifm-charcoal/50">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>NAV-datum: {data.navDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>Beräknad: {new Date().toLocaleString('sv-SE', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comment input */}
      {showComment && canApprove && (
        <div className="px-6 pb-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Lägg till en kommentar (valfritt)..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-aifm-gold/50"
            rows={2}
          />
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setShowDetails(!showDetails);
              onViewDetails?.(data.id);
            }}
            className="flex items-center gap-2 text-sm text-aifm-charcoal/60 hover:text-aifm-charcoal transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>{showDetails ? 'Dölj detaljer' : 'Visa detaljer'}</span>
            {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            {canApprove && (
              <>
                <button
                  onClick={() => setShowComment(!showComment)}
                  className={`p-2 rounded-lg transition-colors ${showComment ? 'bg-gray-200' : 'hover:bg-gray-200'}`}
                  title="Lägg till kommentar"
                >
                  <MessageSquare className="w-4 h-4 text-aifm-charcoal/60" />
                </button>
                
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-aifm-charcoal/70 hover:bg-gray-100 transition-colors"
                >
                  Avvisa
                </button>
                
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {isApproving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {data.status === 'PENDING_FIRST' ? 'Godkänn' : 'Slutgodkänn'}
                  </span>
                </button>
              </>
            )}

            {isOwnFirstApproval && data.status === 'PENDING_SECOND' && (
              <div className="text-sm text-aifm-charcoal/60 italic">
                Väntar på andra godkännaren...
              </div>
            )}

            {data.status === 'APPROVED' && (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Godkänt och klart</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Avvisa NAV</h3>
              <p className="text-sm text-aifm-charcoal/60 mt-1">
                Ange anledning till varför NAV för {data.navDate} avvisas
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Anledning till avvisning..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-red-300"
                rows={4}
                autoFocus
              />
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-aifm-charcoal/70 hover:bg-gray-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || isRejecting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRejecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Avvisa NAV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NAVApprovalCard;
