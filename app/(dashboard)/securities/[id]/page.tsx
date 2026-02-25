'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, CheckCircle2, XCircle, Clock, FileText, Shield,
  AlertCircle, User, Calendar, Building2, Loader2, MessageSquare, Send,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react';
import type { SecurityApprovalRequest, AuditEntry, ApprovalComment } from '@/lib/integrations/securities/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: 'Utkast', color: 'bg-gray-100 text-gray-700', icon: FileText },
  submitted: { label: 'Inskickad', color: 'bg-blue-100 text-blue-700', icon: Clock },
  under_review: { label: 'Granskas', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  approved: { label: 'Godkänd', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Avvisad', color: 'bg-red-100 text-red-700', icon: XCircle },
  needs_info: { label: 'Komplettering begärd', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  expired: { label: 'Utgången', color: 'bg-gray-100 text-gray-500', icon: Calendar },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <h3 className="text-sm font-semibold text-aifm-charcoal">{title}</h3>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-50">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | boolean | null; mono?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Ja' : 'Nej') : String(value);
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-aifm-charcoal/50">{label}</span>
      <span className={`text-aifm-charcoal font-medium text-right max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>{display}</span>
    </div>
  );
}

function CheckRow({ label, checked }: { label: string; checked?: boolean }) {
  if (checked === undefined) return null;
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <div className={`w-4 h-4 rounded flex items-center justify-center ${checked ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
        {checked ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      </div>
      <span className="text-aifm-charcoal/70">{label}</span>
    </div>
  );
}

export default function SecurityApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [approval, setApproval] = useState<SecurityApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState({ name: '', email: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [infoQuestion, setInfoQuestion] = useState('');
  const [showInfoForm, setShowInfoForm] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [showApproveForm, setShowApproveForm] = useState(false);

  const fetchApproval = useCallback(async () => {
    try {
      const res = await fetch(`/api/securities/approvals?id=${id}`);
      if (!res.ok) throw new Error('Kunde inte hämta ansökan');
      const data = await res.json();
      setApproval(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApproval();
    fetch('/api/auth/role', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setCurrentUser({ name: d.name || d.email?.split('@')[0] || '', email: d.email || '' }));
  }, [fetchApproval]);

  const performAction = async (action: string, data: Record<string, unknown> = {}) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/securities/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Åtgärden misslyckades');
      }
      await fetchApproval();
      setShowRejectForm(false);
      setShowInfoForm(false);
      setShowApproveForm(false);
      setRejectReason('');
      setInfoQuestion('');
      setApproveComment('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = () => performAction('approve', {
    reviewedBy: currentUser.name,
    reviewedByEmail: currentUser.email,
    comments: approveComment || undefined,
  });

  const handleReject = () => performAction('reject', {
    reviewedBy: currentUser.name,
    reviewedByEmail: currentUser.email,
    reason: rejectReason,
  });

  const handleRequestInfo = () => performAction('request_info', {
    reviewedBy: currentUser.name,
    reviewedByEmail: currentUser.email,
    question: infoQuestion,
  });

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setActionLoading('comment');
    try {
      await fetch('/api/securities/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'add_comment',
          author: currentUser.name,
          authorEmail: currentUser.email,
          role: 'operation',
          message: commentText,
        }),
      });
      setCommentText('');
      await fetchApproval();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/securities/pdf?id=${id}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vardepapper_${approval?.basicInfo?.name || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Kunde inte ladda ner PDF');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
    </div>
  );

  if (error || !approval) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">{error || 'Ansökan hittades inte'}</p>
      <Link href="/securities" className="text-aifm-gold hover:underline">Tillbaka</Link>
    </div>
  );

  const sc = STATUS_CONFIG[approval.status] || STATUS_CONFIG.draft;
  const StatusIcon = sc.icon;
  const canReview = approval.status === 'submitted' || approval.status === 'under_review';
  const bi = approval.basicInfo;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/securities')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-aifm-charcoal">{bi.name}</h1>
          <p className="text-sm text-aifm-charcoal/50 mt-0.5">{bi.ticker} • {bi.isin}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${sc.color}`}>
          <StatusIcon className="w-4 h-4" />
          {sc.label}
        </span>
      </div>

      {/* Action Bar */}
      {canReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-medium text-blue-800 mb-3">Denna ansökan väntar på granskning</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setShowApproveForm(true); setShowRejectForm(false); setShowInfoForm(false); }}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Godkänn
            </button>
            <button
              onClick={() => { setShowRejectForm(true); setShowApproveForm(false); setShowInfoForm(false); }}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Avvisa
            </button>
            <button
              onClick={() => { setShowInfoForm(true); setShowApproveForm(false); setShowRejectForm(false); }}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <AlertCircle className="w-4 h-4" /> Begär komplettering
            </button>
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:border-aifm-gold transition-colors">
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>

          {showApproveForm && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-green-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar (valfritt)</label>
              <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} rows={2} placeholder="Valfri kommentar vid godkännande..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={handleApprove} disabled={!!actionLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {actionLoading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bekräfta godkännande'}
                </button>
                <button onClick={() => setShowApproveForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Avbryt</button>
              </div>
            </div>
          )}

          {showRejectForm && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-red-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">Orsak till avvisning *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Beskriv varför ansökan avvisas..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={handleReject} disabled={!rejectReason.trim() || !!actionLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {actionLoading === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bekräfta avvisning'}
                </button>
                <button onClick={() => setShowRejectForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Avbryt</button>
              </div>
            </div>
          )}

          {showInfoForm && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-amber-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fråga till förvaltaren *</label>
              <textarea value={infoQuestion} onChange={e => setInfoQuestion(e.target.value)} rows={3} placeholder="Vad behöver kompletteras?" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={handleRequestInfo} disabled={!infoQuestion.trim() || !!actionLoading} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                  {actionLoading === 'request_info' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Skicka fråga'}
                </button>
                <button onClick={() => setShowInfoForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Avbryt</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approved / Rejected banner */}
      {approval.status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">Godkänd av {approval.reviewedBy}</p>
            <p className="text-xs text-green-600 mt-0.5">{approval.reviewedAt && formatDate(approval.reviewedAt)}</p>
            {approval.reviewComments && <p className="text-sm text-green-900 mt-1">{approval.reviewComments}</p>}
          </div>
          <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-lg text-sm hover:border-green-400">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      )}

      {approval.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-medium text-red-800">Avvisad av {approval.reviewedBy}</p>
          <p className="text-xs text-red-600 mt-0.5">{approval.reviewedAt && formatDate(approval.reviewedAt)}</p>
          {approval.rejectionReason && <p className="text-sm text-red-900 mt-2">{approval.rejectionReason}</p>}
        </div>
      )}

      <div className="space-y-4">
        {/* Overview */}
        <SectionCard title="Grundinformation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 mt-2">
            <InfoRow label="Namn" value={bi.name} />
            <InfoRow label="Ticker" value={bi.ticker} mono />
            <InfoRow label="ISIN" value={bi.isin} mono />
            <InfoRow label="Kategori" value={bi.category?.replace(/_/g, ' ')} />
            <InfoRow label="Typ" value={bi.type} />
            <InfoRow label="Marknadsplats" value={bi.marketPlace} />
            <InfoRow label="MIC" value={bi.mic} mono />
            <InfoRow label="Valuta" value={bi.currency} />
            <InfoRow label="Land" value={bi.country} />
            <InfoRow label="Emittent" value={bi.emitter} />
            <InfoRow label="LEI" value={bi.emitterLEI} mono />
            <InfoRow label="GICS-sektor" value={bi.gicsSector} />
            <InfoRow label="Listningstyp" value={bi.listingType?.replace(/_/g, ' ')} />
          </div>
          {bi.securityUrl && (
            <a href={bi.securityUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-aifm-gold hover:underline mt-2">
              <ExternalLink className="w-3 h-3" /> Värdepapperslänk
            </a>
          )}
        </SectionCard>

        {/* Fund & Compliance */}
        <SectionCard title="Fond & Compliance">
          <div className="mt-2">
            <InfoRow label="Fond" value={approval.fundName} />
            <InfoRow label="Fond-ID" value={approval.fundId} mono />
            {approval.fundCompliance && (
              <>
                <InfoRow label="Compliance-motivering" value={approval.fundCompliance.complianceMotivation} />
                <InfoRow label="Placeringsrestriktioner" value={approval.fundCompliance.placementRestrictions} />
              </>
            )}
          </div>
        </SectionCard>

        {/* FFFS Regulatory */}
        <SectionCard title="FFFS 2013:9 – Regulatorisk bedömning" defaultOpen={false}>
          <div className="mt-2 space-y-1">
            {approval.regulatoryFFFS && (
              <>
                <CheckRow label="Begränsad potentiell förlust (§1 p.1)" checked={approval.regulatoryFFFS.limitedPotentialLoss} />
                <CheckRow label="Likviditeten inte äventyras (§1 p.2)" checked={approval.regulatoryFFFS.liquidityNotEndangered} />
                <CheckRow label="Tillförlitlig värdering (§1 p.3)" checked={approval.regulatoryFFFS.reliableValuation?.checked} />
                <CheckRow label="Ändamålsenlig information (§1 p.4)" checked={approval.regulatoryFFFS.appropriateInformation?.checked} />
                <CheckRow label="Omsättningsbar (§1 p.5)" checked={approval.regulatoryFFFS.isMarketable} />
                <CheckRow label="Förenlig med fonden (§1 p.6)" checked={approval.regulatoryFFFS.compatibleWithFund} />
                <CheckRow label="Riskhantering fångar risker (§1 p.7)" checked={approval.regulatoryFFFS.riskManagementCaptures} />
              </>
            )}
          </div>
        </SectionCard>

        {/* Liquidity */}
        <SectionCard title="Likviditetsanalys" defaultOpen={false}>
          <div className="mt-2">
            {approval.liquidityAnalysis && (
              <>
                <InfoRow label="Instrumenttyp" value={approval.liquidityAnalysis.instrumentType} />
                <InfoRow label="Genomsnittlig daglig volym" value={approval.liquidityAnalysis.averageDailyVolume?.toLocaleString('sv-SE')} />
                <InfoRow label="Genomsnittligt dagligt värde (SEK)" value={approval.liquidityAnalysis.averageDailyValueSEK?.toLocaleString('sv-SE')} />
                <CheckRow label="FFFS: Likviditeten inte äventyras" checked={approval.liquidityAnalysis.fffsLiquidityNotEndangered} />
                <CheckRow label="FFFS: Omsättningsbar" checked={approval.liquidityAnalysis.fffsIsMarketable} />
                <InfoRow label="Hur likviditetskrav uppfylls" value={approval.liquidityAnalysis.howLiquidityRequirementMet} />
                <InfoRow label="Hur omsättningskrav uppfylls" value={approval.liquidityAnalysis.howMarketabilityRequirementMet} />
                <InfoRow label="Portfölj illikvid andel före" value={approval.liquidityAnalysis.portfolioIlliquidShareBefore != null ? `${approval.liquidityAnalysis.portfolioIlliquidShareBefore}%` : undefined} />
                <InfoRow label="Portfölj illikvid andel efter" value={approval.liquidityAnalysis.portfolioIlliquidShareAfter != null ? `${approval.liquidityAnalysis.portfolioIlliquidShareAfter}%` : undefined} />
              </>
            )}
          </div>
        </SectionCard>

        {/* Valuation */}
        <SectionCard title="Värdering" defaultOpen={false}>
          <div className="mt-2">
            {approval.valuationInfo && (
              <>
                <CheckRow label="Tillförlitliga dagliga priser" checked={approval.valuationInfo.reliableDailyPrices} />
                <InfoRow label="Priskälla" value={approval.valuationInfo.priceSourceUrl} />
                <InfoRow label="Kommentar" value={approval.valuationInfo.priceSourceComment} />
                <CheckRow label="Emission" checked={approval.valuationInfo.isEmission} />
                <InfoRow label="Värderingsmetod (emission)" value={approval.valuationInfo.emissionValuationMethod} />
                <InfoRow label="Föreslagen värderingsmetod" value={approval.valuationInfo.proposedValuationMethod} />
              </>
            )}
          </div>
        </SectionCard>

        {/* ESG */}
        <SectionCard title="ESG-bedömning" defaultOpen={false}>
          <div className="mt-2">
            {approval.esgInfo && (
              <>
                <CheckRow label="Artikel 8/9-fond" checked={approval.esgInfo.article8Or9Fund} />
                <InfoRow label="Fondartikel" value={approval.esgInfo.fundArticle ? `Artikel ${approval.esgInfo.fundArticle}` : undefined} />
                <InfoRow label="Miljöegenskaper" value={approval.esgInfo.environmentalCharacteristics} />
                <InfoRow label="Sociala egenskaper" value={approval.esgInfo.socialCharacteristics} />
                <CheckRow label="Uppfyller exkluderingskriterier" checked={approval.esgInfo.meetsExclusionCriteria} />
                <CheckRow label="Uppfyller minimum för hållbar investering" checked={approval.esgInfo.meetsSustainableInvestmentMinimum} />
                <CheckRow label="PAI beaktade" checked={approval.esgInfo.paiConsidered} />
                <InfoRow label="ESG-beslut" value={approval.esgInfo.esgDecision === 'approved' ? 'Godkänd' : approval.esgInfo.esgDecision === 'rejected' ? 'Underkänd' : undefined} />
                <InfoRow label="ESG-beslutsmotivering" value={approval.esgInfo.esgDecisionMotivation} />
              </>
            )}
          </div>
        </SectionCard>

        {/* Meta */}
        <SectionCard title="Ansökningsinformation">
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
            <InfoRow label="Skapad av" value={approval.createdBy} />
            <InfoRow label="E-post" value={approval.createdByEmail} />
            <InfoRow label="Skapad" value={formatDate(approval.createdAt)} />
            <InfoRow label="Inskickad" value={approval.submittedAt ? formatDate(approval.submittedAt) : undefined} />
            <InfoRow label="Granskad av" value={approval.reviewedBy} />
            <InfoRow label="Granskad" value={approval.reviewedAt ? formatDate(approval.reviewedAt) : undefined} />
            <InfoRow label="Utgår" value={approval.expiresAt ? formatDate(approval.expiresAt) : undefined} />
          </div>
        </SectionCard>

        {/* Discussion */}
        <SectionCard title={`Diskussion (${approval.comments?.length || 0})`}>
          <div className="mt-2 space-y-3">
            {(approval.comments || []).map((c: ApprovalComment) => (
              <div key={c.id} className={`p-3 rounded-xl text-sm ${c.role === 'operation' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-aifm-charcoal">{c.author}</span>
                  <span className="text-xs text-gray-400">{c.role === 'operation' ? 'Operation' : 'Förvaltare'}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-aifm-charcoal/80 whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
            {(!approval.comments || approval.comments.length === 0) && (
              <p className="text-sm text-gray-400 py-2">Inga kommentarer ännu</p>
            )}
            <div className="flex gap-2 mt-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Skriv en kommentar..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || actionLoading === 'comment'}
                className="px-3 py-2 bg-aifm-charcoal text-white rounded-lg hover:bg-aifm-charcoal/90 disabled:opacity-50"
              >
                {actionLoading === 'comment' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Audit Trail */}
        <SectionCard title="Ändringshistorik" defaultOpen={false}>
          <div className="mt-2 space-y-2">
            {(approval.auditTrail || []).map((entry: AuditEntry, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-aifm-gold mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-aifm-charcoal capitalize">{entry.action.replace(/_/g, ' ')}</span>
                  <span className="text-gray-400 mx-1">av</span>
                  <span className="text-aifm-charcoal/70">{entry.actor}</span>
                  {entry.details && <p className="text-gray-500 mt-0.5">{entry.details}</p>}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
