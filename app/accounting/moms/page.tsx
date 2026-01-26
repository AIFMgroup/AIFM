'use client';


import { useEffect, useState, useCallback } from 'react';
import { useCompany } from '@/components/CompanyContext';


interface VATSummary {
  period: { start: string; end: string; type: string };
  outputVAT: {
    rate25: { net: number; vat: number; count: number };
    rate12: { net: number; vat: number; count: number };
    rate6: { net: number; vat: number; count: number };
    total: number;
  };
  inputVAT: {
    domestic: { net: number; vat: number; count: number };
    eu: { net: number; vat: number; count: number };
    total: number;
  };
  netVAT: number;
  entries: Array<{
    jobId: string;
    documentDate: string;
    supplier: string;
    description: string;
    netAmount: number;
    vatAmount: number;
    vatRate: number;
    isInputVAT: boolean;
  }>;
  generatedAt: string;
}

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercent = (rate: number) => `${Math.round(rate * 100)}%`;

// Simple Card components
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 border-b border-gray-50 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`font-medium text-gray-900 ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

export default function VATReportPage() {
  const { selectedCompany: company } = useCompany();
  const [report, setReport] = useState<VATSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());

  const getPeriodDates = useCallback(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (periodType === 'monthly') {
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
      };
    } else if (periodType === 'quarterly') {
      const quarter = Math.floor(month / 3);
      return {
        start: new Date(year, quarter * 3, 1),
        end: new Date(year, quarter * 3 + 3, 0),
      };
    } else {
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      };
    }
  }, [currentDate, periodType]);

  const formatPeriodLabel = () => {
    const { start } = getPeriodDates();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    
    if (periodType === 'monthly') {
      return `${months[start.getMonth()]} ${start.getFullYear()}`;
    } else if (periodType === 'quarterly') {
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `Q${quarter} ${start.getFullYear()}`;
    } else {
      return `${start.getFullYear()}`;
    }
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (periodType === 'monthly') {
        newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (periodType === 'quarterly') {
        newDate.setMonth(prev.getMonth() + (direction === 'next' ? 3 : -3));
      } else {
        newDate.setFullYear(prev.getFullYear() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const fetchReport = useCallback(async () => {
    if (!company) return;
    
    setLoading(true);
    try {
      const { start, end } = getPeriodDates();
      const params = new URLSearchParams({
        companyId: company.id,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        periodType,
      });

      const response = await fetch(`/api/accounting/vat?${params}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Failed to fetch VAT report:', error);
    } finally {
      setLoading(false);
    }
  }, [company, getPeriodDates, periodType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format: 'json' | 'xml') => {
    if (!company || !report) return;
    
    setExporting(true);
    try {
      const { start, end } = getPeriodDates();
      const response = await fetch('/api/accounting/vat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          organisationNumber: company.orgNumber || '556123-4567',
          format,
        }),
      });

      if (format === 'xml') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `momsdeklaration_${formatPeriodLabel().replace(' ', '_')}.xml`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `momsrapport_${formatPeriodLabel().replace(' ', '_')}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  if (!company) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Valj ett bolag for att se momsrapport.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-6 w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">
              Momsrapport
            </h1>
            <p className="text-gray-500 mt-1">
              {company.name}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchReport()}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Uppdatera
            </button>
            <button 
              onClick={() => handleExport('json')}
              disabled={exporting || !report}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              JSON
            </button>
            <button 
              onClick={() => handleExport('xml')}
              disabled={exporting || !report}
              className="px-4 py-2 text-sm bg-[#c0a280] hover:bg-[#a08260] text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Skatteverket XML
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-600">Period:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {(['monthly', 'quarterly', 'yearly'] as PeriodType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPeriodType(type)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                        periodType === type
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {type === 'monthly' ? 'Manad' : type === 'quarterly' ? 'Kvartal' : 'Ar'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigatePeriod('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-lg font-medium min-w-[120px] text-center">
                  {formatPeriodLabel()}
                </span>
                <button 
                  onClick={() => navigatePeriod('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#c0a280] border-t-transparent" />
          </div>
        ) : report ? (
          <>
            {/* Main Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Output VAT */}
              <Card className="border-l-4 border-l-red-400">
                <CardHeader className="pb-2 border-b-0">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Utgaende moms
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-3xl font-light text-gray-900">
                    {formatCurrency(report.outputVAT.total)}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">25%</span>
                      <span>{formatCurrency(report.outputVAT.rate25.vat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">12%</span>
                      <span>{formatCurrency(report.outputVAT.rate12.vat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">6%</span>
                      <span>{formatCurrency(report.outputVAT.rate6.vat)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Input VAT */}
              <Card className="border-l-4 border-l-green-400">
                <CardHeader className="pb-2 border-b-0">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                    Ingaende moms
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-3xl font-light text-gray-900">
                    {formatCurrency(report.inputVAT.total)}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Inrikes</span>
                      <span>{formatCurrency(report.inputVAT.domestic.vat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">EU-inkop</span>
                      <span>{formatCurrency(report.inputVAT.eu.vat)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Net VAT */}
              <Card className={`border-l-4 ${report.netVAT >= 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
                <CardHeader className="pb-2 border-b-0">
                  <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    {report.netVAT >= 0 ? 'Att betala' : 'Att fa tillbaka'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className={`text-3xl font-light ${report.netVAT >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(report.netVAT))}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {report.netVAT >= 0 
                      ? 'Betalas till Skatteverket'
                      : 'Aterbetalas fran Skatteverket'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detaljerad uppstallning</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Output VAT Details */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-4">Utgaende moms (forsaljning)</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-gray-500">Momssats</th>
                          <th className="text-right py-2 font-medium text-gray-500">Omsattning</th>
                          <th className="text-right py-2 font-medium text-gray-500">Moms</th>
                          <th className="text-right py-2 font-medium text-gray-500">Antal</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="py-2">25%</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.rate25.net)}</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.rate25.vat)}</td>
                          <td className="text-right text-gray-500">{report.outputVAT.rate25.count}</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2">12%</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.rate12.net)}</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.rate12.vat)}</td>
                          <td className="text-right text-gray-500">{report.outputVAT.rate12.count}</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2">6%</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.rate6.net)}</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.rate6.vat)}</td>
                          <td className="text-right text-gray-500">{report.outputVAT.rate6.count}</td>
                        </tr>
                        <tr className="font-medium">
                          <td className="py-2">Totalt</td>
                          <td className="text-right">-</td>
                          <td className="text-right">{formatCurrency(report.outputVAT.total)}</td>
                          <td className="text-right text-gray-500">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Input VAT Details */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-4">Ingaende moms (inkop)</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-gray-500">Kategori</th>
                          <th className="text-right py-2 font-medium text-gray-500">Inkopsvarde</th>
                          <th className="text-right py-2 font-medium text-gray-500">Moms</th>
                          <th className="text-right py-2 font-medium text-gray-500">Antal</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="py-2">Inrikes inkop</td>
                          <td className="text-right">{formatCurrency(report.inputVAT.domestic.net)}</td>
                          <td className="text-right">{formatCurrency(report.inputVAT.domestic.vat)}</td>
                          <td className="text-right text-gray-500">{report.inputVAT.domestic.count}</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2">EU-inkop</td>
                          <td className="text-right">{formatCurrency(report.inputVAT.eu.net)}</td>
                          <td className="text-right">{formatCurrency(report.inputVAT.eu.vat)}</td>
                          <td className="text-right text-gray-500">{report.inputVAT.eu.count}</td>
                        </tr>
                        <tr className="font-medium">
                          <td className="py-2">Totalt avdrag</td>
                          <td className="text-right">-</td>
                          <td className="text-right">{formatCurrency(report.inputVAT.total)}</td>
                          <td className="text-right text-gray-500">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction List */}
            {report.entries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Underlag ({report.entries.length} transaktioner)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-gray-500">Datum</th>
                          <th className="text-left py-2 font-medium text-gray-500">Leverantor</th>
                          <th className="text-left py-2 font-medium text-gray-500">Typ</th>
                          <th className="text-right py-2 font-medium text-gray-500">Netto</th>
                          <th className="text-right py-2 font-medium text-gray-500">Moms</th>
                          <th className="text-center py-2 font-medium text-gray-500">Sats</th>
                          <th className="text-center py-2 font-medium text-gray-500">Ing/Utg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.entries.slice(0, 20).map((entry, idx) => (
                          <tr key={entry.jobId} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="py-2">{entry.documentDate}</td>
                            <td className="py-2 max-w-[200px] truncate">{entry.supplier}</td>
                            <td className="py-2">{entry.description}</td>
                            <td className="text-right py-2">{formatCurrency(entry.netAmount)}</td>
                            <td className="text-right py-2">{formatCurrency(entry.vatAmount)}</td>
                            <td className="text-center py-2">{formatPercent(entry.vatRate)}</td>
                            <td className="text-center py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                entry.isInputVAT 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {entry.isInputVAT ? 'Ing' : 'Utg'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.entries.length > 20 && (
                      <p className="text-center text-sm text-gray-500 mt-4">
                        Visar 20 av {report.entries.length} transaktioner
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {report.entries.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <svg className="h-12 w-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700">Inga transaktioner</h3>
                  <p className="text-gray-500 mt-1">
                    Det finns inga godkanda dokument for denna period.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    
  );
}
