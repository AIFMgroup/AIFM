'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Calendar,
  Building2,
  Shield,
  DollarSign,
  ChevronRight,
  Clock,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useCompany } from '@/components/CompanyContext';
import { downloadPDF, reportTemplates, ReportConfig } from '@/lib/reports/pdfGenerator';
import { useToast } from '@/components/Toast';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'compliance' | 'financial' | 'operational' | 'custom';
  icon: React.ReactNode;
  lastGenerated?: string;
}

const reportTemplatesList: ReportTemplate[] = [
  {
    id: 'compliance-quarterly',
    name: 'Compliance Kvartalsrapport',
    description: 'Komplett översikt av compliance-status, öppna ärenden och regulatoriska krav',
    category: 'compliance',
    icon: <Shield className="w-5 h-5" />,
    lastGenerated: '2026-01-02',
  },
  {
    id: 'compliance-annual',
    name: 'Compliance Årsrapport',
    description: 'Årlig sammanställning för FI och interna granskningar',
    category: 'compliance',
    icon: <Shield className="w-5 h-5" />,
    lastGenerated: '2025-12-31',
  },
  {
    id: 'financial-nav',
    name: 'NAV-rapport',
    description: 'Detaljerad NAV-beräkning med tillgångar och skulder',
    category: 'financial',
    icon: <DollarSign className="w-5 h-5" />,
    lastGenerated: '2026-01-07',
  },
  {
    id: 'financial-summary',
    name: 'Finansiell Sammanfattning',
    description: 'Översikt av ekonomisk ställning, transaktioner och nyckeltal',
    category: 'financial',
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    id: 'investor-report',
    name: 'Investerarrapport',
    description: 'Rapport för investerare med avkastning och portföljutveckling',
    category: 'financial',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: 'audit-log',
    name: 'Audit Trail Rapport',
    description: 'Exportera systemloggar för granskningsändamål',
    category: 'operational',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 'data-room-activity',
    name: 'Data Room Aktivitetsrapport',
    description: 'Spåra dokumentåtkomst och delningar i data rooms',
    category: 'operational',
    icon: <FileText className="w-5 h-5" />,
  },
];

const getCategoryColor = (category: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    compliance: { bg: 'bg-aifm-gold/10', text: 'text-aifm-charcoal', border: 'border-aifm-gold/20' },
    financial: { bg: 'bg-aifm-charcoal/[0.06]', text: 'text-aifm-charcoal', border: 'border-aifm-charcoal/10' },
    operational: { bg: 'bg-aifm-gold/[0.06]', text: 'text-aifm-charcoal', border: 'border-aifm-gold/15' },
    custom: { bg: 'bg-aifm-charcoal/[0.04]', text: 'text-aifm-charcoal', border: 'border-gray-100' },
  };
  return colors[category] || colors.custom;
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    compliance: 'Compliance',
    financial: 'Finansiell',
    operational: 'Operativ',
    custom: 'Anpassad',
  };
  return labels[category] || category;
};

export default function ReportsPage() {
  const { selectedCompany } = useCompany();
  const { warning, promise } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  const filteredReports = selectedCategory === 'all' 
    ? reportTemplatesList 
    : reportTemplatesList.filter(r => r.category === selectedCategory);

  const handleGenerateReport = async (template: ReportTemplate) => {
    if (!selectedCompany) {
      warning('Välj ett bolag', 'Du måste välja ett bolag innan du kan generera rapporten');
      return;
    }

    setGeneratingReport(template.id);

    try {
      // Create mock data for the report
      let config: ReportConfig;

      if (template.id.startsWith('compliance')) {
        config = reportTemplates.complianceOverview(selectedCompany.name, {
          score: 87,
          openIssues: 3,
          documentsReviewed: 45,
          documentsChange: 12,
          daysSinceReview: 14,
          requirements: [
            { name: 'AIFMD Article 21', status: '✓ Godkänd', deadline: '2026-01-15', assignee: 'Anna S.' },
            { name: 'GDPR Compliance', status: '✓ Godkänd', deadline: '2026-02-01', assignee: 'Erik J.' },
            { name: 'AML/KYC', status: '⚠ Pågående', deadline: '2026-01-20', assignee: 'Maria L.' },
            { name: 'Rapportering FI', status: '✓ Godkänd', deadline: '2026-03-31', assignee: 'Anna S.' },
          ],
          activities: [
            { date: '2026-01-08', title: 'Kvartalsrapport inlämnad', description: 'Q4 2025 rapport skickad till FI', status: 'Slutförd' },
            { date: '2026-01-05', title: 'Policy uppdaterad', description: 'AML-policy version 3.2', status: 'Slutförd' },
            { date: '2026-01-02', title: 'Intern granskning', description: 'Compliance-granskning genomförd', status: 'Slutförd' },
          ],
        });
      } else {
        config = reportTemplates.financialSummary(selectedCompany.name, {
          period: `${dateRange.from} - ${dateRange.to}`,
          nav: '125.4 MSEK',
          navChange: 5.2,
          aum: '1.2 Mdr SEK',
          aumChange: 3.8,
          returnYTD: 8.5,
          expenseRatio: 1.2,
          transactions: [
            { date: '2026-01-07', type: 'Kapitalanrop', amount: '5,000,000 SEK', status: 'Genomförd' },
            { date: '2026-01-05', type: 'Utdelning', amount: '2,500,000 SEK', status: 'Genomförd' },
            { date: '2026-01-03', type: 'Investering', amount: '10,000,000 SEK', status: 'Väntande' },
          ],
          totalInflow: '15,000,000 SEK',
          totalOutflow: '2,500,000 SEK',
        });
      }

      await promise(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            downloadPDF(config);
            resolve();
          }, 1500);
        }),
        {
          loading: 'Genererar rapport...',
          success: 'Rapport genererad!',
          error: 'Kunde inte generera rapport',
        }
      );
    } catch (error) {
      console.error('Report generation error:', error);
    } finally {
      setGeneratingReport(null);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Rapporter</h1>
              <p className="text-sm text-aifm-charcoal/40">Generera och ladda ner rapporter för {selectedCompany?.name || 'ditt bolag'}</p>
            </div>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2 text-aifm-charcoal/70">
              <Calendar className="w-4 h-4" />
              <span className="font-medium text-sm">Rapportperiod:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
              <span className="text-aifm-charcoal/30">till</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'compliance', 'financial', 'operational'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-aifm-charcoal text-white shadow-sm'
                  : 'text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300'
              }`}
            >
              {cat === 'all' ? 'Alla rapporter' : getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Reports Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((template) => {
            const catStyle = getCategoryColor(template.category);
            const isGenerating = generatingReport === template.id;
            
            return (
              <div
                key={template.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${catStyle.bg} ${catStyle.text} flex items-center justify-center`}>
                    {template.icon}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${catStyle.bg} ${catStyle.text}`}>
                    {getCategoryLabel(template.category)}
                  </span>
                </div>
                
                <h3 className="font-semibold text-aifm-charcoal tracking-tight mb-2">{template.name}</h3>
                <p className="text-sm text-aifm-charcoal/40 mb-4 line-clamp-2">{template.description}</p>
                
                {template.lastGenerated && (
                  <div className="flex items-center gap-1.5 text-xs text-aifm-charcoal/30 mb-4">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Senast: {new Date(template.lastGenerated).toLocaleDateString('sv-SE')}</span>
                  </div>
                )}
                
                <button
                  onClick={() => handleGenerateReport(template)}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-aifm-charcoal 
                           text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Genererar...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generera PDF
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-aifm-charcoal tracking-tight mb-4">Relaterat</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/audit"
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-aifm-charcoal/40" />
                <span className="font-medium text-aifm-charcoal">Audit Trail</span>
              </div>
              <ChevronRight className="w-4 h-4 text-aifm-charcoal/30" />
            </a>
            <a
              href="/compliance/documents"
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-aifm-charcoal/40" />
                <span className="font-medium text-aifm-charcoal">Compliance Dokument</span>
              </div>
              <ChevronRight className="w-4 h-4 text-aifm-charcoal/30" />
            </a>
            <a
              href="/data-rooms"
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-aifm-charcoal/40" />
                <span className="font-medium text-aifm-charcoal">Data Rooms</span>
              </div>
              <ChevronRight className="w-4 h-4 text-aifm-charcoal/30" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

