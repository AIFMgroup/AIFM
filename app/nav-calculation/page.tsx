'use client';

import { useState } from 'react';
import { 
  Calculator, TrendingUp, TrendingDown, Building2,
  Users, Wallet, FileText, ChevronDown,
  BarChart3, Minus, Plus, RefreshCw, Download,
  CheckCircle2, Clock
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';
import { 
  getFundByCompanyId, formatCurrency, formatPercentage
} from '@/lib/fundData';
import { PageHeader, SecondaryButton } from '@/components/shared/PageHeader';

// NAV data per company
const navDataByCompany: Record<string, {
  currentNAV: number;
  previousNAV: number;
  historicalNAV: { month: string; nav: number; }[];
  assets: {
    portfolioValuation: number;
    cashAndBank: number;
    receivables: number;
    accruedIncome: number;
    otherAssets: number;
  };
  liabilities: {
    payables: number;
    accruedManagementFee: number;
    carriedInterestReserve: number;
    otherLiabilities: number;
  };
  investorBreakdown: {
    investorId: string;
    name: string;
    type: string;
    commitment: number;
    ownershipPct: number;
    navShare: number;
    calledCapital: number;
    distributions: number;
  }[];
}> = {
  'company-1': {
    currentNAV: 128500000,
    previousNAV: 125200000,
    historicalNAV: [
      { month: 'Jun', nav: 115000000 },
      { month: 'Jul', nav: 118500000 },
      { month: 'Aug', nav: 120000000 },
      { month: 'Sep', nav: 122500000 },
      { month: 'Okt', nav: 125200000 },
      { month: 'Nov', nav: 128500000 },
    ],
    assets: {
      portfolioValuation: 145000000,
      cashAndBank: 12500000,
      receivables: 2800000,
      accruedIncome: 450000,
      otherAssets: 250000,
    },
    liabilities: {
      payables: 1200000,
      accruedManagementFee: 3200000,
      carriedInterestReserve: 25000000,
      otherLiabilities: 3100000,
    },
    investorBreakdown: [
      { investorId: 'inv-1', name: 'Första AP-fonden', type: 'PENSION_FUND', commitment: 50000000, ownershipPct: 25, navShare: 32125000, calledCapital: 37500000, distributions: 5000000 },
      { investorId: 'inv-2', name: 'Nordea Liv & Pension', type: 'INSTITUTION', commitment: 40000000, ownershipPct: 20, navShare: 25700000, calledCapital: 30000000, distributions: 4000000 },
      { investorId: 'inv-3', name: 'Eriksson Family Office', type: 'FAMILY_OFFICE', commitment: 30000000, ownershipPct: 15, navShare: 19275000, calledCapital: 22500000, distributions: 3000000 },
      { investorId: 'inv-4', name: 'SEB Pensionsstiftelse', type: 'PENSION_FUND', commitment: 35000000, ownershipPct: 17.5, navShare: 22487500, calledCapital: 26250000, distributions: 3500000 },
      { investorId: 'inv-5', name: 'Industrivärden AB', type: 'INSTITUTION', commitment: 25000000, ownershipPct: 12.5, navShare: 16062500, calledCapital: 18750000, distributions: 2500000 },
      { investorId: 'inv-6', name: 'GP Commitment', type: 'GP', commitment: 20000000, ownershipPct: 10, navShare: 12850000, calledCapital: 15000000, distributions: 2000000 },
    ],
  },
  'company-2': {
    currentNAV: 215000000,
    previousNAV: 208000000,
    historicalNAV: [
      { month: 'Jun', nav: 185000000 },
      { month: 'Jul', nav: 192000000 },
      { month: 'Aug', nav: 198000000 },
      { month: 'Sep', nav: 203000000 },
      { month: 'Okt', nav: 208000000 },
      { month: 'Nov', nav: 215000000 },
    ],
    assets: {
      portfolioValuation: 240000000,
      cashAndBank: 18500000,
      receivables: 4200000,
      accruedIncome: 680000,
      otherAssets: 420000,
    },
    liabilities: {
      payables: 2100000,
      accruedManagementFee: 4800000,
      carriedInterestReserve: 38000000,
      otherLiabilities: 3900000,
    },
    investorBreakdown: [
      { investorId: 'inv-1', name: 'Alecta', type: 'PENSION_FUND', commitment: 80000000, ownershipPct: 28, navShare: 60200000, calledCapital: 56000000, distributions: 8000000 },
      { investorId: 'inv-2', name: 'AMF Pension', type: 'PENSION_FUND', commitment: 60000000, ownershipPct: 21, navShare: 45150000, calledCapital: 42000000, distributions: 6000000 },
      { investorId: 'inv-3', name: 'Länsförsäkringar', type: 'INSTITUTION', commitment: 50000000, ownershipPct: 17.5, navShare: 37625000, calledCapital: 35000000, distributions: 5000000 },
      { investorId: 'inv-4', name: 'Wallenberg Foundations', type: 'ENDOWMENT', commitment: 45000000, ownershipPct: 15.75, navShare: 33862500, calledCapital: 31500000, distributions: 4500000 },
      { investorId: 'inv-5', name: 'GP Commitment', type: 'GP', commitment: 50000000, ownershipPct: 17.5, navShare: 37625000, calledCapital: 35000000, distributions: 5000000 },
    ],
  },
  'company-3': {
    currentNAV: 89500000,
    previousNAV: 87200000,
    historicalNAV: [
      { month: 'Jun', nav: 78000000 },
      { month: 'Jul', nav: 81000000 },
      { month: 'Aug', nav: 83500000 },
      { month: 'Sep', nav: 85000000 },
      { month: 'Okt', nav: 87200000 },
      { month: 'Nov', nav: 89500000 },
    ],
    assets: {
      portfolioValuation: 98000000,
      cashAndBank: 8200000,
      receivables: 1800000,
      accruedIncome: 320000,
      otherAssets: 180000,
    },
    liabilities: {
      payables: 850000,
      accruedManagementFee: 2100000,
      carriedInterestReserve: 14500000,
      otherLiabilities: 1550000,
    },
    investorBreakdown: [
      { investorId: 'inv-1', name: 'Folksam', type: 'INSTITUTION', commitment: 35000000, ownershipPct: 30, navShare: 26850000, calledCapital: 26250000, distributions: 3500000 },
      { investorId: 'inv-2', name: 'Handelsbanken Fonder', type: 'INSTITUTION', commitment: 28000000, ownershipPct: 24, navShare: 21480000, calledCapital: 21000000, distributions: 2800000 },
      { investorId: 'inv-3', name: 'Kinnevik AB', type: 'INSTITUTION', commitment: 25000000, ownershipPct: 21.5, navShare: 19242500, calledCapital: 18750000, distributions: 2500000 },
      { investorId: 'inv-4', name: 'GP Commitment', type: 'GP', commitment: 28500000, ownershipPct: 24.5, navShare: 21927500, calledCapital: 21375000, distributions: 2850000 },
    ],
  },
  'company-4': {
    currentNAV: 156000000,
    previousNAV: 151000000,
    historicalNAV: [
      { month: 'Jun', nav: 132000000 },
      { month: 'Jul', nav: 138000000 },
      { month: 'Aug', nav: 143000000 },
      { month: 'Sep', nav: 147000000 },
      { month: 'Okt', nav: 151000000 },
      { month: 'Nov', nav: 156000000 },
    ],
    assets: {
      portfolioValuation: 175000000,
      cashAndBank: 14200000,
      receivables: 3100000,
      accruedIncome: 520000,
      otherAssets: 380000,
    },
    liabilities: {
      payables: 1650000,
      accruedManagementFee: 3900000,
      carriedInterestReserve: 28000000,
      otherLiabilities: 3650000,
    },
    investorBreakdown: [
      { investorId: 'inv-1', name: 'EQT Foundation', type: 'ENDOWMENT', commitment: 55000000, ownershipPct: 27, navShare: 42120000, calledCapital: 41250000, distributions: 5500000 },
      { investorId: 'inv-2', name: 'Skandia', type: 'INSTITUTION', commitment: 45000000, ownershipPct: 22, navShare: 34320000, calledCapital: 33750000, distributions: 4500000 },
      { investorId: 'inv-3', name: 'If Skadeförsäkring', type: 'INSTITUTION', commitment: 38000000, ownershipPct: 18.5, navShare: 28860000, calledCapital: 28500000, distributions: 3800000 },
      { investorId: 'inv-4', name: 'Lundberg Family', type: 'FAMILY_OFFICE', commitment: 32000000, ownershipPct: 15.5, navShare: 24180000, calledCapital: 24000000, distributions: 3200000 },
      { investorId: 'inv-5', name: 'GP Commitment', type: 'GP', commitment: 35000000, ownershipPct: 17, navShare: 26520000, calledCapital: 26250000, distributions: 3500000 },
    ],
  },
  'company-5': {
    currentNAV: 63000000,
    previousNAV: 61500000,
    historicalNAV: [
      { month: 'Jun', nav: 52000000 },
      { month: 'Jul', nav: 55000000 },
      { month: 'Aug', nav: 57500000 },
      { month: 'Sep', nav: 59500000 },
      { month: 'Okt', nav: 61500000 },
      { month: 'Nov', nav: 63000000 },
    ],
    assets: {
      portfolioValuation: 72000000,
      cashAndBank: 5800000,
      receivables: 1200000,
      accruedIncome: 180000,
      otherAssets: 120000,
    },
    liabilities: {
      payables: 580000,
      accruedManagementFee: 1450000,
      carriedInterestReserve: 12500000,
      otherLiabilities: 1770000,
    },
    investorBreakdown: [
      { investorId: 'inv-1', name: 'Swedbank Robur', type: 'INSTITUTION', commitment: 25000000, ownershipPct: 32, navShare: 20160000, calledCapital: 18750000, distributions: 2500000 },
      { investorId: 'inv-2', name: 'Storebrand', type: 'INSTITUTION', commitment: 20000000, ownershipPct: 25.5, navShare: 16065000, calledCapital: 15000000, distributions: 2000000 },
      { investorId: 'inv-3', name: 'Baltic Investment Group', type: 'FAMILY_OFFICE', commitment: 18000000, ownershipPct: 23, navShare: 14490000, calledCapital: 13500000, distributions: 1800000 },
      { investorId: 'inv-4', name: 'GP Commitment', type: 'GP', commitment: 15250000, ownershipPct: 19.5, navShare: 12285000, calledCapital: 11437500, distributions: 1525000 },
    ],
  },
};

// Local Tab Button for this page's specific needs
function LocalTabButton({ 
  label, 
  isActive, 
  onClick,
  icon: Icon
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  icon?: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2 ${
        isActive
          ? 'bg-white text-aifm-charcoal shadow-sm'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

// Waterfall Chart Component
function WaterfallChart({ 
  assets, 
  liabilities,
  nav
}: { 
  assets: typeof navDataByCompany['company-1']['assets'];
  liabilities: typeof navDataByCompany['company-1']['liabilities'];
  nav: number;
}) {
  const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);
  const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
  const maxValue = totalAssets;
  
  const assetItems = [
    { label: 'Portföljvärdering', value: assets.portfolioValuation, color: 'bg-emerald-500' },
    { label: 'Kassa & bank', value: assets.cashAndBank, color: 'bg-emerald-400' },
    { label: 'Fordringar', value: assets.receivables, color: 'bg-emerald-300' },
    { label: 'Upplupna intäkter', value: assets.accruedIncome, color: 'bg-teal-400' },
    { label: 'Övriga tillgångar', value: assets.otherAssets, color: 'bg-teal-300' },
  ];

  const liabilityItems = [
    { label: 'Leverantörsskulder', value: liabilities.payables, color: 'bg-red-400' },
    { label: 'Förvaltningsavgift', value: liabilities.accruedManagementFee, color: 'bg-red-500' },
    { label: 'Carried interest', value: liabilities.carriedInterestReserve, color: 'bg-orange-500' },
    { label: 'Övriga skulder', value: liabilities.otherLiabilities, color: 'bg-orange-400' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">
        NAV Waterfall
      </h3>
      
      <div className="space-y-3">
        {/* Assets */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-3 h-3" /> Tillgångar
          </p>
          {assetItems.map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <div className="w-32 text-xs text-aifm-charcoal/60 truncate">{item.label}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <div 
                  className={`h-full ${item.color} rounded-lg transition-all duration-500`}
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
              <div className="w-24 text-right text-xs font-medium text-aifm-charcoal">
                {formatCurrency(item.value, 'SEK')}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
            <div className="w-32 text-xs font-semibold text-emerald-600">Summa tillgångar</div>
            <div className="flex-1" />
            <div className="w-24 text-right text-sm font-bold text-emerald-600">
              {formatCurrency(totalAssets, 'SEK')}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4" />

        {/* Liabilities */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-2">
            <Minus className="w-3 h-3" /> Skulder
          </p>
          {liabilityItems.map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <div className="w-32 text-xs text-aifm-charcoal/60 truncate">{item.label}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                <div 
                  className={`h-full ${item.color} rounded-lg transition-all duration-500`}
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
              <div className="w-24 text-right text-xs font-medium text-aifm-charcoal">
                {formatCurrency(item.value, 'SEK')}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
            <div className="w-32 text-xs font-semibold text-red-600">Summa skulder</div>
            <div className="flex-1" />
            <div className="w-24 text-right text-sm font-bold text-red-600">
              {formatCurrency(totalLiabilities, 'SEK')}
            </div>
          </div>
        </div>

        {/* NAV Result */}
        <div className="mt-6 p-4 bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Nettotillgångsvärde (NAV)</p>
                <p className="text-xs text-white/40 mt-0.5">Tillgångar − Skulder</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(nav, 'SEK')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Historical NAV Chart
function HistoricalNAVChart({ data }: { data: { month: string; nav: number; }[] }) {
  const maxNav = Math.max(...data.map(d => d.nav));
  const minNav = Math.min(...data.map(d => d.nav));
  const range = maxNav - minNav;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
          NAV Utveckling
        </h3>
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
          <TrendingUp className="w-3 h-3" />
          +{formatPercentage(((data[data.length - 1].nav - data[0].nav) / data[0].nav) * 100)} YTD
        </div>
      </div>

      <div className="h-48 flex items-end gap-2">
        {data.map((item, index) => {
          const height = range > 0 ? ((item.nav - minNav) / range) * 100 + 20 : 50;
          const isLast = index === data.length - 1;
          
          return (
            <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex flex-col items-center">
                <div 
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    isLast ? 'bg-gradient-to-t from-aifm-gold to-aifm-gold/70' : 'bg-gradient-to-t from-aifm-charcoal/20 to-aifm-charcoal/10'
                  }`}
                  style={{ height: `${height}%`, minHeight: '20px' }}
                />
              </div>
              <p className="text-xs text-aifm-charcoal/50">{item.month}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-aifm-charcoal/50">Start</p>
          <p className="text-sm font-semibold text-aifm-charcoal">{formatCurrency(data[0].nav, 'SEK')}</p>
        </div>
        <div>
          <p className="text-xs text-aifm-charcoal/50">Nuvarande</p>
          <p className="text-sm font-semibold text-aifm-charcoal">{formatCurrency(data[data.length - 1].nav, 'SEK')}</p>
        </div>
        <div>
          <p className="text-xs text-aifm-charcoal/50">Förändring</p>
          <p className="text-sm font-semibold text-emerald-600">
            +{formatCurrency(data[data.length - 1].nav - data[0].nav, 'SEK')}
          </p>
        </div>
      </div>
    </div>
  );
}

// Investor Breakdown Table
function InvestorBreakdown({ 
  investors
}: { 
  investors: typeof navDataByCompany['company-1']['investorBreakdown'];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PENSION_FUND': return '🏛️';
      case 'INSTITUTION': return '🏢';
      case 'FAMILY_OFFICE': return '👨‍👩‍👧‍👦';
      case 'ENDOWMENT': return '🎓';
      case 'GP': return '⭐';
      default: return '👤';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
          NAV per Investerare
        </h3>
        <button className="flex items-center gap-2 text-xs text-aifm-gold font-medium hover:underline">
          <Download className="w-3 h-3" />
          Exportera
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {investors.map((investor) => (
          <div key={investor.investorId}>
            <div 
              className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpandedId(expandedId === investor.investorId ? null : investor.investorId)}
            >
              <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center text-lg">
                {getTypeIcon(investor.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-aifm-charcoal truncate">{investor.name}</p>
                <p className="text-xs text-aifm-charcoal/50">{investor.type.replace(/_/g, ' ')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-aifm-charcoal">{formatCurrency(investor.navShare, 'SEK')}</p>
                <p className="text-xs text-aifm-charcoal/50">{formatPercentage(investor.ownershipPct)} ägarandel</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-aifm-charcoal/40 transition-transform ${
                expandedId === investor.investorId ? 'rotate-180' : ''
              }`} />
            </div>

            {expandedId === investor.investorId && (
              <div className="px-6 pb-4 bg-gray-50/50">
                <div className="grid grid-cols-4 gap-4 pt-4">
                  <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-aifm-charcoal/50 mb-1">Commitment</p>
                    <p className="font-semibold text-aifm-charcoal">{formatCurrency(investor.commitment, 'SEK')}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-aifm-charcoal/50 mb-1">Inbetalt kapital</p>
                    <p className="font-semibold text-aifm-charcoal">{formatCurrency(investor.calledCapital, 'SEK')}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-aifm-charcoal/50 mb-1">Utdelningar</p>
                    <p className="font-semibold text-aifm-charcoal">{formatCurrency(investor.distributions, 'SEK')}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-aifm-charcoal/50 mb-1">TVPI</p>
                    <p className="font-semibold text-emerald-600">
                      {((investor.navShare + investor.distributions) / investor.calledCapital).toFixed(2)}x
                    </p>
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

// Interactive Calculator
function InteractiveCalculator({ 
  initialAssets, 
  initialLiabilities,
  onCalculate
}: { 
  initialAssets: typeof navDataByCompany['company-1']['assets'];
  initialLiabilities: typeof navDataByCompany['company-1']['liabilities'];
  onCalculate: (nav: number) => void;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [liabilities, setLiabilities] = useState(initialLiabilities);
  const [isCalculating, setIsCalculating] = useState(false);

  const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);
  const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
  const calculatedNAV = totalAssets - totalLiabilities;

  const handleRecalculate = () => {
    setIsCalculating(true);
    setTimeout(() => {
      onCalculate(calculatedNAV);
      setIsCalculating(false);
    }, 800);
  };

  const formatInputValue = (value: number) => {
    return (value / 1000000).toFixed(1);
  };

  const parseInputValue = (value: string) => {
    return parseFloat(value) * 1000000 || 0;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
          Interaktiv NAV-kalkylator
        </h3>
        <button 
          onClick={handleRecalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                     hover:bg-aifm-charcoal/90 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
          {isCalculating ? 'Beräknar...' : 'Beräkna NAV'}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Assets */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Plus className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-600">Tillgångar (MSEK)</p>
          </div>
          <div className="space-y-3">
            {[
              { key: 'portfolioValuation', label: 'Portföljvärdering' },
              { key: 'cashAndBank', label: 'Kassa & bank' },
              { key: 'receivables', label: 'Fordringar' },
              { key: 'accruedIncome', label: 'Upplupna intäkter' },
              { key: 'otherAssets', label: 'Övriga tillgångar' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <label className="flex-1 text-sm text-aifm-charcoal/70">{item.label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={formatInputValue(assets[item.key as keyof typeof assets])}
                  onChange={(e) => setAssets({ ...assets, [item.key]: parseInputValue(e.target.value) })}
                  className="w-28 px-3 py-2 text-right bg-gray-50 border-0 rounded-lg text-sm font-medium
                             focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <span className="flex-1 text-sm font-semibold text-emerald-600">Summa</span>
              <span className="w-28 text-right text-sm font-bold text-emerald-600">
                {(totalAssets / 1000000).toFixed(1)} M
              </span>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <Minus className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-sm font-semibold text-red-600">Skulder (MSEK)</p>
          </div>
          <div className="space-y-3">
            {[
              { key: 'payables', label: 'Leverantörsskulder' },
              { key: 'accruedManagementFee', label: 'Förvaltningsavgift' },
              { key: 'carriedInterestReserve', label: 'Carried interest' },
              { key: 'otherLiabilities', label: 'Övriga skulder' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <label className="flex-1 text-sm text-aifm-charcoal/70">{item.label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={formatInputValue(liabilities[item.key as keyof typeof liabilities])}
                  onChange={(e) => setLiabilities({ ...liabilities, [item.key]: parseInputValue(e.target.value) })}
                  className="w-28 px-3 py-2 text-right bg-gray-50 border-0 rounded-lg text-sm font-medium
                             focus:bg-white focus:ring-2 focus:ring-red-500/20 transition-all"
                />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <span className="flex-1 text-sm font-semibold text-red-600">Summa</span>
              <span className="w-28 text-right text-sm font-bold text-red-600">
                {(totalLiabilities / 1000000).toFixed(1)} M
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="mt-6 p-4 bg-gradient-to-r from-aifm-gold/10 to-aifm-gold/5 rounded-xl border border-aifm-gold/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="w-5 h-5 text-aifm-gold" />
            <span className="text-sm font-medium text-aifm-charcoal">Beräknat NAV</span>
          </div>
          <span className="text-2xl font-bold text-aifm-charcoal">
            {formatCurrency(calculatedNAV, 'SEK')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function NAVCalculationPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'overview' | 'calculator' | 'investors'>('overview');
  const [calculatedNAV, setCalculatedNAV] = useState<number | null>(null);

  // Get NAV data for selected company
  const navData = navDataByCompany[selectedCompany.id] || navDataByCompany['company-1'];
  const fund = getFundByCompanyId(selectedCompany.id);

  const navChange = navData.currentNAV - navData.previousNAV;
  const navChangePct = (navChange / navData.previousNAV) * 100;

  const totalAssets = Object.values(navData.assets).reduce((a, b) => a + b, 0);
  const totalLiabilities = Object.values(navData.liabilities).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="NAV-beräkning"
        description={`Nettotillgångsvärde för ${selectedCompany.shortName}`}
        breadcrumbs={[
          { label: 'Fond' },
          { label: 'NAV-beräkning' }
        ]}
        stats={[
          { 
            label: 'Aktuellt NAV', 
            value: formatCurrency(calculatedNAV || navData.currentNAV, 'SEK'), 
            icon: Calculator,
            trend: { value: `${navChange >= 0 ? '+' : ''}${formatPercentage(navChangePct)}`, positive: navChange >= 0 }
          },
          { 
            label: 'Totala tillgångar', 
            value: formatCurrency(totalAssets, 'SEK'), 
            icon: Wallet 
          },
          { 
            label: 'Totala skulder', 
            value: formatCurrency(totalLiabilities, 'SEK'), 
            icon: FileText 
          },
          { 
            label: 'Antal investerare', 
            value: navData.investorBreakdown.length.toString(), 
            subValue: 'Kapitalandelsägare',
            icon: Users 
          },
        ]}
        actions={
          <SecondaryButton icon={Download}>
            <span className="hidden sm:inline">Exportera rapport</span>
          </SecondaryButton>
        }
      >
        {/* Tabs inside PageHeader */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1.5 w-fit mt-6">
          <LocalTabButton 
            label="Översikt" 
            isActive={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={BarChart3}
          />
          <LocalTabButton 
            label="Kalkylator" 
            isActive={activeTab === 'calculator'} 
            onClick={() => setActiveTab('calculator')}
            icon={Calculator}
          />
          <LocalTabButton 
            label="Investerare" 
            isActive={activeTab === 'investors'} 
            onClick={() => setActiveTab('investors')}
            icon={Users}
          />
        </div>
      </PageHeader>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <WaterfallChart 
            assets={navData.assets}
            liabilities={navData.liabilities}
            nav={calculatedNAV || navData.currentNAV}
          />
          <HistoricalNAVChart data={navData.historicalNAV} />
        </div>
      )}

      {activeTab === 'calculator' && (
        <InteractiveCalculator 
          initialAssets={navData.assets}
          initialLiabilities={navData.liabilities}
          onCalculate={setCalculatedNAV}
        />
      )}

      {activeTab === 'investors' && (
        <InvestorBreakdown 
          investors={navData.investorBreakdown}
        />
      )}

      {/* Quick Stats Footer */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Status</span>
          </div>
          <p className="font-semibold text-aifm-charcoal">Verifierad</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Senast: {new Date().toLocaleDateString('sv-SE')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Nästa värdering</span>
          </div>
          <p className="font-semibold text-aifm-charcoal">31 Dec 2024</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Om 30 dagar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Portföljbolag</span>
          </div>
          <p className="font-semibold text-aifm-charcoal">{fund?.type === 'VENTURE_CAPITAL' ? '12' : '8'} bolag</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Aktiva investeringar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">NAV/Aktie</span>
          </div>
          <p className="font-semibold text-aifm-charcoal">
            {formatCurrency((calculatedNAV || navData.currentNAV) / 1000000, 'SEK')}
          </p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">Per M andelar</p>
        </div>
      </div>
    </>
  );
}
