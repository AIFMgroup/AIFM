'use client';


import { useEffect, useState, useCallback } from 'react';
import { useCompany } from '@/components/CompanyContext';


// ============ Types ============

interface VATDeclaration {
  id: string;
  period: {
    year: number;
    month?: number;
    quarter?: number;
    label: string;
    type: string;
  };
  sales: {
    box05: number;
    box10: number;
    box11: number;
    box12: number;
  };
  purchases: {
    box20: number;
    box21: number;
  };
  taxFree: {
    box35: number;
    box36: number;
  };
  summary: {
    box48: number;
    box49: number;
    box50: number;
  };
  calculated: {
    totalOutputVAT: number;
    totalInputVAT: number;
    netVAT: number;
  };
  status: string;
  validationErrors: string[];
  validationWarnings: string[];
}

interface SRUDocument {
  id: string;
  type: string;
  fiscalYear: { year: number };
  status: string;
  fields: Record<string, { label: string; value: number }>;
}

type Tab = 'vat' | 'sru';
type PeriodType = 'monthly' | 'quarterly' | 'yearly';

// ============ Components ============

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ============ Main Component ============

export default function TaxDeclarationPage() {
  const { selectedCompany: company } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('vat');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // VAT state
  const [vatDeclaration, setVatDeclaration] = useState<VATDeclaration | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  
  // SRU state
  const [sruDocument, setSRUDocument] = useState<SRUDocument | null>(null);
  const [sruType, setSRUType] = useState<'INK2' | 'INK4'>('INK2');
  const [sruYear, setSRUYear] = useState(new Date().getFullYear() - 1);

  // Generate VAT Declaration
  const generateVATDeclaration = useCallback(async () => {
    if (!company) return;
    
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        action: 'generate',
        companyId: company.id,
        year: selectedYear,
      };
      
      if (periodType === 'monthly') {
        body.month = selectedMonth;
      } else if (periodType === 'quarterly') {
        body.quarter = selectedQuarter;
      }

      const response = await fetch('/api/accounting/vat-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const data = await response.json();
        setVatDeclaration(data.declaration);
      }
    } catch (error) {
      console.error('Failed to generate VAT declaration:', error);
    } finally {
      setLoading(false);
    }
  }, [company, selectedYear, selectedMonth, selectedQuarter, periodType]);

  // Export VAT to XML
  const exportVATToXML = async () => {
    if (!company) return;
    
    setExporting(true);
    try {
      const body: Record<string, unknown> = {
        action: 'export-xml',
        companyId: company.id,
        year: selectedYear,
      };
      
      if (periodType === 'monthly') {
        body.month = selectedMonth;
      } else if (periodType === 'quarterly') {
        body.quarter = selectedQuarter;
      }

      const response = await fetch('/api/accounting/vat-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `momsdeklaration_${selectedYear}_${periodType === 'monthly' ? selectedMonth : periodType === 'quarterly' ? `Q${selectedQuarter}` : 'år'}.xml`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export VAT declaration:', error);
    } finally {
      setExporting(false);
    }
  };

  // Generate SRU
  const generateSRU = useCallback(async () => {
    if (!company) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/accounting/sru-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          companyId: company.id,
          fiscalYear: sruYear,
          type: sruType,
          organisationNumber: company.orgNumber || '556123-4567',
          companyName: company.name,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSRUDocument(data.document);
      }
    } catch (error) {
      console.error('Failed to generate SRU:', error);
    } finally {
      setLoading(false);
    }
  }, [company, sruYear, sruType]);

  // Export SRU
  const exportSRU = async (format: 'sru' | 'xml' | 'json') => {
    if (!company || !sruDocument) return;
    
    setExporting(true);
    try {
      const response = await fetch('/api/accounting/sru-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: `export-${format}`,
          companyId: company.id,
          documentId: sruDocument.id,
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'sru' ? 'sru' : format === 'xml' ? 'xml' : 'json';
        a.download = `${sruType}_${sruYear}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export SRU:', error);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'vat' && company) {
      generateVATDeclaration();
    }
  }, [activeTab, company, generateVATDeclaration]);

  const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

  if (!company) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Välj ett bolag för att se skattedeklarationer.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-6 w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">
              Skattedeklarationer
            </h1>
            <p className="text-gray-500 mt-1">
              {company.name} • Momsdeklaration & Inkomstdeklaration
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('vat')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'vat'
                  ? 'border-[#c0a280] text-[#c0a280]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Momsdeklaration
            </button>
            <button
              onClick={() => setActiveTab('sru')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'sru'
                  ? 'border-[#c0a280] text-[#c0a280]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              SRU-export (INK2/INK4)
            </button>
          </nav>
        </div>

        {/* VAT Tab */}
        {activeTab === 'vat' && (
          <div className="space-y-6">
            {/* Period Selection */}
            <Card>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
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
                          {type === 'monthly' ? 'Månad' : type === 'quarterly' ? 'Kvartal' : 'År'}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                  
                  {periodType === 'monthly' && (
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      {months.map((month, i) => (
                        <option key={i} value={i + 1}>{month}</option>
                      ))}
                    </select>
                  )}
                  
                  {periodType === 'quarterly' && (
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value={1}>Q1 (Jan-Mar)</option>
                      <option value={2}>Q2 (Apr-Jun)</option>
                      <option value={3}>Q3 (Jul-Sep)</option>
                      <option value={4}>Q4 (Okt-Dec)</option>
                    </select>
                  )}
                  
                  <button
                    onClick={generateVATDeclaration}
                    disabled={loading}
                    className="px-4 py-2 bg-[#c0a280] text-white rounded-lg text-sm hover:bg-[#a08260] disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                    Generera
                  </button>
                </div>
              </CardContent>
            </Card>

            {vatDeclaration && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-l-4 border-l-red-400">
                    <CardContent className="pt-4">
                      <p className="text-sm text-gray-500 mb-1">Utgående moms</p>
                      <p className="text-2xl font-light">{formatCurrency(vatDeclaration.calculated.totalOutputVAT)}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-green-400">
                    <CardContent className="pt-4">
                      <p className="text-sm text-gray-500 mb-1">Ingående moms</p>
                      <p className="text-2xl font-light">{formatCurrency(vatDeclaration.calculated.totalInputVAT)}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className={`border-l-4 ${vatDeclaration.calculated.netVAT >= 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
                    <CardContent className="pt-4">
                      <p className="text-sm text-gray-500 mb-1">
                        {vatDeclaration.calculated.netVAT >= 0 ? 'Att betala' : 'Att få tillbaka'}
                      </p>
                      <p className={`text-2xl font-light ${vatDeclaration.calculated.netVAT >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(vatDeclaration.calculated.netVAT))}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Form */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Momsdeklaration - {vatDeclaration.period.label}</CardTitle>
                    <div className="flex gap-2">
                      <button
                        onClick={exportVATToXML}
                        disabled={exporting}
                        className="px-4 py-2 bg-[#c0a280] text-white rounded-lg text-sm hover:bg-[#a08260] disabled:opacity-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Ladda ner XML för Skatteverket
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Försäljning */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Momspliktig försäljning</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">05. Försäljning exkl. moms (25%, 12%, 6%)</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.sales.box05)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Utgående moms */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Utgående moms</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">10. Utgående moms 25%</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.sales.box10)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">11. Utgående moms 12%</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.sales.box11)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">12. Utgående moms 6%</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.sales.box12)}</span>
                          </div>
                        </div>
                      </div>

                      {/* EU-förvärv */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">EU-förvärv</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">20. Inköp av varor från annat EU-land</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.purchases.box20)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">21. Inköp av tjänster från annat EU-land</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.purchases.box21)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Momsfri omsättning */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Momsfri omsättning</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">35. Försäljning av varor till annat EU-land</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.taxFree.box35)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">36. Export utanför EU</span>
                            <span className="font-mono">{formatCurrency(vatDeclaration.taxFree.box36)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Summering */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Summering</h4>
                        <div className="bg-[#c0a280]/10 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">48. Ingående moms att dra av</span>
                            <span className="font-mono font-medium">{formatCurrency(vatDeclaration.summary.box48)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">49. Utgående moms</span>
                            <span className="font-mono font-medium">{formatCurrency(vatDeclaration.summary.box49)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-[#c0a280]/20">
                            <span className="font-medium">50. Moms att betala/få tillbaka</span>
                            <span className={`font-mono font-bold text-lg ${vatDeclaration.summary.box50 >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(vatDeclaration.summary.box50)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Warnings */}
                      {vatDeclaration.validationWarnings?.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Varningar
                          </h4>
                          <ul className="text-sm text-amber-700 space-y-1">
                            {vatDeclaration.validationWarnings.map((warning, i) => (
                              <li key={i}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* SRU Tab */}
        {activeTab === 'sru' && (
          <div className="space-y-6">
            {/* Settings */}
            <Card>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Typ:</span>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setSRUType('INK2')}
                        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                          sruType === 'INK2'
                            ? 'bg-white shadow text-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        INK2 (Aktiebolag)
                      </button>
                      <button
                        onClick={() => setSRUType('INK4')}
                        className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                          sruType === 'INK4'
                            ? 'bg-white shadow text-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        INK4 (Enskild firma)
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Räkenskapsår:</span>
                    <select
                      value={sruYear}
                      onChange={(e) => setSRUYear(parseInt(e.target.value))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      {[...Array(5)].map((_, i) => {
                        const year = new Date().getFullYear() - 1 - i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
                  
                  <button
                    onClick={generateSRU}
                    disabled={loading}
                    className="px-4 py-2 bg-[#c0a280] text-white rounded-lg text-sm hover:bg-[#a08260] disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                    Generera {sruType}
                  </button>
                </div>
              </CardContent>
            </Card>

            {sruDocument && (
              <>
                {/* Export Buttons */}
                <Card>
                  <CardHeader>
                    <CardTitle>{sruDocument.type} - Räkenskapsår {sruDocument.fiscalYear.year}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => exportSRU('sru')}
                        disabled={exporting}
                        className="px-4 py-2 bg-[#c0a280] text-white rounded-lg text-sm hover:bg-[#a08260] disabled:opacity-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Ladda ner SRU-fil
                      </button>
                      <button
                        onClick={() => exportSRU('xml')}
                        disabled={exporting}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        XML-format
                      </button>
                      <button
                        onClick={() => exportSRU('json')}
                        disabled={exporting}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        JSON-format
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Fields Display */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Resultaträkning */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Resultaträkning</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(sruDocument.fields)
                          .filter(([key]) => key.startsWith('R'))
                          .map(([key, field]) => (
                            <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                              <span className="text-sm">
                                <span className="font-mono text-gray-400 mr-2">{key}</span>
                                {field.label}
                              </span>
                              <span className="font-mono text-sm">{formatCurrency(field.value as number)}</span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Balansräkning */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Balansräkning</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(sruDocument.fields)
                          .filter(([key]) => key.startsWith('B'))
                          .map(([key, field]) => (
                            <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                              <span className="text-sm">
                                <span className="font-mono text-gray-400 mr-2">{key}</span>
                                {field.label}
                              </span>
                              <span className="font-mono text-sm">{formatCurrency(field.value as number)}</span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status */}
                <Card>
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {sruDocument.status === 'validated' ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Validerad och redo för export</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Utkast - granska innan export</span>
                        </div>
                      )}
                    </div>
                    <a
                      href="https://www.skatteverket.se/foretag/deklarera/inkomstdeklaration/lamnauppgifter.4.71004e4c133e23bf6db800082734.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#c0a280] hover:underline flex items-center gap-1"
                    >
                      Till Skatteverket
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Help Section */}
            {!sruDocument && (
              <Card>
                <CardContent className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">SRU-export för inkomstdeklaration</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Generera SRU-filer för elektronisk inlämning till Skatteverket. 
                    Välj typ (INK2 för aktiebolag, INK4 för enskild firma) och räkenskapsår ovan.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    
  );
}







