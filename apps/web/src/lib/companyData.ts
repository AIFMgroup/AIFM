/**
 * Company Dashboard Data
 * Mock data for 5 client companies with full dashboards
 */

export interface Company {
  id: string;
  name: string;
  shortName: string;
  orgNumber: string;
  type: 'FUND' | 'HOLDING' | 'OPERATING' | 'SPV';
  status: 'ACTIVE' | 'INACTIVE';
  color: string;
}

export interface PortfolioItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface Transaction {
  id: string;
  type: 'INVESTMENT' | 'EXPENSE' | 'INCOME' | 'DISTRIBUTION';
  description: string;
  amount: number;
  currency: string;
  date: Date;
  status: 'COMPLETED' | 'PENDING';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assignee?: string;
}

export interface KPIData {
  month: string;
  value1: number;
  value2: number;
}

export interface KPIDataSet {
  nav: KPIData[];
  irr: KPIData[];
  moic: KPIData[];
}

export interface CompanyDashboard {
  company: Company;
  portfolio: PortfolioItem[];
  transactions: Transaction[];
  tasks: Task[];
  kpiData: KPIData[]; // Legacy - kept for compatibility
  kpiDataSet: KPIDataSet; // New separate data for NAV, IRR, MOIC
  metrics: {
    moic: number;
    irr: number;
    nav: number;
    totalInvested: number;
    totalDistributed: number;
    unrealizedGain: number;
  };
}

// 5 Mock Companies
export const mockCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'Nordic Ventures I AB',
    shortName: 'Nordic Ventures I',
    orgNumber: '559123-4567',
    type: 'FUND',
    status: 'ACTIVE',
    color: '#c0a280',
  },
  {
    id: 'company-2',
    name: 'TechGrowth Holding AB',
    shortName: 'TechGrowth',
    orgNumber: '559234-5678',
    type: 'HOLDING',
    status: 'ACTIVE',
    color: '#4F46E5',
  },
  {
    id: 'company-3',
    name: 'Scandinavian RE Fund KB',
    shortName: 'Scandi RE',
    orgNumber: '969789-0123',
    type: 'FUND',
    status: 'ACTIVE',
    color: '#059669',
  },
  {
    id: 'company-4',
    name: 'Impact Invest Nordic AB',
    shortName: 'Impact Nordic',
    orgNumber: '559345-6789',
    type: 'FUND',
    status: 'ACTIVE',
    color: '#DC2626',
  },
  {
    id: 'company-5',
    name: 'Baltic Growth Partners KB',
    shortName: 'Baltic Growth',
    orgNumber: '969456-7890',
    type: 'FUND',
    status: 'ACTIVE',
    color: '#7C3AED',
  },
];

// Dashboard data for each company
export const companyDashboards: Record<string, CompanyDashboard> = {
  'company-1': {
    company: mockCompanies[0],
    portfolio: [
      { name: 'SaaS', value: 45000000, percentage: 35, color: '#c0a280' },
      { name: 'DeepTech', value: 32000000, percentage: 25, color: '#615c59' },
      { name: 'AI', value: 26000000, percentage: 20, color: '#94a3b8' },
      { name: 'FinTech', value: 25500000, percentage: 20, color: '#cbd5e1' },
    ],
    transactions: [
      { id: 't1', type: 'INVESTMENT', description: 'Såddfinansiering NyVenture', amount: 1255549, currency: 'EUR', date: new Date('2024-11-15'), status: 'COMPLETED' },
      { id: 't2', type: 'EXPENSE', description: 'Tech Summit 2025', amount: 150000, currency: 'SEK', date: new Date('2024-11-20'), status: 'PENDING' },
      { id: 't3', type: 'DISTRIBUTION', description: 'Q3 Utdelning', amount: 2500000, currency: 'SEK', date: new Date('2024-10-30'), status: 'COMPLETED' },
    ],
    tasks: [
      { id: 'task1', title: 'Förbered Q4 styrelsemöte', description: 'Förbered material inför kommande styrelsemöte', dueDate: new Date('2024-12-10'), priority: 'HIGH', status: 'IN_PROGRESS', assignee: 'Anna S.' },
      { id: 'task2', title: 'Utkast årsredovisning', description: 'Första utkast till årsredovisning', dueDate: new Date('2024-12-20'), priority: 'MEDIUM', status: 'TODO' },
      { id: 'task3', title: 'LP-möte uppföljning', description: 'Skicka mötesprotokoll till alla LPs', dueDate: new Date('2024-11-30'), priority: 'LOW', status: 'DONE' },
    ],
    kpiData: [
      { month: 'Jun', value1: 85, value2: 75 },
      { month: 'Jul', value1: 92, value2: 80 },
      { month: 'Aug', value1: 88, value2: 82 },
      { month: 'Sep', value1: 95, value2: 85 },
      { month: 'Oct', value1: 102, value2: 90 },
      { month: 'Nov', value1: 115, value2: 95 },
    ],
    kpiDataSet: {
      nav: [
        { month: 'Jun', value1: 118.2, value2: 115.0 },
        { month: 'Jul', value1: 121.5, value2: 118.0 },
        { month: 'Aug', value1: 119.8, value2: 120.0 },
        { month: 'Sep', value1: 124.3, value2: 122.0 },
        { month: 'Oct', value1: 126.9, value2: 125.0 },
        { month: 'Nov', value1: 128.5, value2: 127.0 },
      ],
      irr: [
        { month: 'Jun', value1: 10.2, value2: 12.0 },
        { month: 'Jul', value1: 11.1, value2: 12.0 },
        { month: 'Aug', value1: 10.8, value2: 12.0 },
        { month: 'Sep', value1: 11.5, value2: 12.0 },
        { month: 'Oct', value1: 12.0, value2: 12.0 },
        { month: 'Nov', value1: 12.4, value2: 12.0 },
      ],
      moic: [
        { month: 'Jun', value1: 2.85, value2: 3.00 },
        { month: 'Jul', value1: 2.95, value2: 3.00 },
        { month: 'Aug', value1: 2.92, value2: 3.00 },
        { month: 'Sep', value1: 3.05, value2: 3.00 },
        { month: 'Oct', value1: 3.12, value2: 3.00 },
        { month: 'Nov', value1: 3.21, value2: 3.00 },
      ],
    },
    metrics: {
      moic: 3.21,
      irr: 12.37,
      nav: 128500000,
      totalInvested: 85000000,
      totalDistributed: 45000000,
      unrealizedGain: 43500000,
    },
  },
  'company-2': {
    company: mockCompanies[1],
    portfolio: [
      { name: 'Företags-SaaS', value: 28000000, percentage: 40, color: '#4F46E5' },
      { name: 'B2B-plattformar', value: 21000000, percentage: 30, color: '#818CF8' },
      { name: 'Utvecklarverktyg', value: 14000000, percentage: 20, color: '#A5B4FC' },
      { name: 'Övrigt', value: 7000000, percentage: 10, color: '#C7D2FE' },
    ],
    transactions: [
      { id: 't4', type: 'INVESTMENT', description: 'Serie A CloudTech', amount: 3500000, currency: 'EUR', date: new Date('2024-11-10'), status: 'COMPLETED' },
      { id: 't5', type: 'INCOME', description: 'Exitintäkt - DataCorp', amount: 8500000, currency: 'EUR', date: new Date('2024-10-25'), status: 'COMPLETED' },
    ],
    tasks: [
      { id: 'task4', title: 'Due Diligence-granskning', description: 'Slutför DD för Serie B-mål', dueDate: new Date('2024-12-05'), priority: 'HIGH', status: 'IN_PROGRESS' },
    ],
    kpiData: [
      { month: 'Jun', value1: 100, value2: 90 },
      { month: 'Jul', value1: 105, value2: 95 },
      { month: 'Aug', value1: 110, value2: 100 },
      { month: 'Sep', value1: 108, value2: 98 },
      { month: 'Oct', value1: 115, value2: 105 },
      { month: 'Nov', value1: 125, value2: 112 },
    ],
    kpiDataSet: {
      nav: [
        { month: 'Jun', value1: 58.0, value2: 55.0 },
        { month: 'Jul', value1: 61.2, value2: 58.0 },
        { month: 'Aug', value1: 64.5, value2: 62.0 },
        { month: 'Sep', value1: 66.8, value2: 65.0 },
        { month: 'Oct', value1: 68.4, value2: 67.0 },
        { month: 'Nov', value1: 70.0, value2: 68.0 },
      ],
      irr: [
        { month: 'Jun', value1: 15.2, value2: 15.0 },
        { month: 'Jul', value1: 16.1, value2: 15.0 },
        { month: 'Aug', value1: 17.3, value2: 15.0 },
        { month: 'Sep', value1: 17.8, value2: 15.0 },
        { month: 'Oct', value1: 18.2, value2: 15.0 },
        { month: 'Nov', value1: 18.5, value2: 15.0 },
      ],
      moic: [
        { month: 'Jun', value1: 1.95, value2: 2.00 },
        { month: 'Jul', value1: 2.08, value2: 2.00 },
        { month: 'Aug', value1: 2.18, value2: 2.00 },
        { month: 'Sep', value1: 2.28, value2: 2.00 },
        { month: 'Oct', value1: 2.35, value2: 2.00 },
        { month: 'Nov', value1: 2.45, value2: 2.00 },
      ],
    },
    metrics: {
      moic: 2.45,
      irr: 18.5,
      nav: 70000000,
      totalInvested: 45000000,
      totalDistributed: 15000000,
      unrealizedGain: 25000000,
    },
  },
  'company-3': {
    company: mockCompanies[2],
    portfolio: [
      { name: 'Kontor', value: 85000000, percentage: 45, color: '#059669' },
      { name: 'Logistik', value: 57000000, percentage: 30, color: '#34D399' },
      { name: 'Handel', value: 28000000, percentage: 15, color: '#6EE7B7' },
      { name: 'Bostäder', value: 19000000, percentage: 10, color: '#A7F3D0' },
    ],
    transactions: [
      { id: 't6', type: 'INVESTMENT', description: 'Malmö Logistikcenter', amount: 25000000, currency: 'SEK', date: new Date('2024-11-01'), status: 'COMPLETED' },
      { id: 't7', type: 'INCOME', description: 'Hyresintäkter Q4', amount: 4500000, currency: 'SEK', date: new Date('2024-11-15'), status: 'COMPLETED' },
    ],
    tasks: [
      { id: 'task5', title: 'Fastighetsvärdering', description: 'Årliga fastighetsvärderingar', dueDate: new Date('2024-12-15'), priority: 'HIGH', status: 'TODO' },
    ],
    kpiData: [
      { month: 'Jun', value1: 95, value2: 88 },
      { month: 'Jul', value1: 96, value2: 89 },
      { month: 'Aug', value1: 98, value2: 91 },
      { month: 'Sep', value1: 100, value2: 93 },
      { month: 'Oct', value1: 102, value2: 95 },
      { month: 'Nov', value1: 105, value2: 98 },
    ],
    kpiDataSet: {
      nav: [
        { month: 'Jun', value1: 175.0, value2: 170.0 },
        { month: 'Jul', value1: 178.5, value2: 175.0 },
        { month: 'Aug', value1: 182.0, value2: 180.0 },
        { month: 'Sep', value1: 184.8, value2: 183.0 },
        { month: 'Oct', value1: 187.2, value2: 185.0 },
        { month: 'Nov', value1: 189.0, value2: 186.0 },
      ],
      irr: [
        { month: 'Jun', value1: 6.8, value2: 8.0 },
        { month: 'Jul', value1: 7.2, value2: 8.0 },
        { month: 'Aug', value1: 7.5, value2: 8.0 },
        { month: 'Sep', value1: 7.8, value2: 8.0 },
        { month: 'Oct', value1: 8.0, value2: 8.0 },
        { month: 'Nov', value1: 8.2, value2: 8.0 },
      ],
      moic: [
        { month: 'Jun', value1: 1.62, value2: 1.75 },
        { month: 'Jul', value1: 1.68, value2: 1.75 },
        { month: 'Aug', value1: 1.72, value2: 1.75 },
        { month: 'Sep', value1: 1.78, value2: 1.75 },
        { month: 'Oct', value1: 1.82, value2: 1.75 },
        { month: 'Nov', value1: 1.85, value2: 1.75 },
      ],
    },
    metrics: {
      moic: 1.85,
      irr: 8.2,
      nav: 189000000,
      totalInvested: 150000000,
      totalDistributed: 35000000,
      unrealizedGain: 39000000,
    },
  },
  'company-4': {
    company: mockCompanies[3],
    portfolio: [
      { name: 'CleanTech', value: 35000000, percentage: 50, color: '#DC2626' },
      { name: 'HealthTech', value: 21000000, percentage: 30, color: '#F87171' },
      { name: 'EdTech', value: 14000000, percentage: 20, color: '#FCA5A5' },
    ],
    transactions: [
      { id: 't8', type: 'INVESTMENT', description: 'Serie A GreenPower', amount: 5000000, currency: 'EUR', date: new Date('2024-11-12'), status: 'COMPLETED' },
    ],
    tasks: [
      { id: 'task6', title: 'Påverkansrapport', description: 'Kvartalsvis rapport om påverkansmått', dueDate: new Date('2024-12-01'), priority: 'MEDIUM', status: 'IN_PROGRESS' },
    ],
    kpiData: [
      { month: 'Jun', value1: 80, value2: 70 },
      { month: 'Jul', value1: 88, value2: 75 },
      { month: 'Aug', value1: 95, value2: 82 },
      { month: 'Sep', value1: 105, value2: 90 },
      { month: 'Oct', value1: 118, value2: 100 },
      { month: 'Nov', value1: 135, value2: 115 },
    ],
    kpiDataSet: {
      nav: [
        { month: 'Jun', value1: 48.0, value2: 45.0 },
        { month: 'Jul', value1: 52.5, value2: 50.0 },
        { month: 'Aug', value1: 57.2, value2: 55.0 },
        { month: 'Sep', value1: 62.8, value2: 60.0 },
        { month: 'Oct', value1: 66.5, value2: 65.0 },
        { month: 'Nov', value1: 70.0, value2: 68.0 },
      ],
      irr: [
        { month: 'Jun', value1: 18.2, value2: 20.0 },
        { month: 'Jul', value1: 19.5, value2: 20.0 },
        { month: 'Aug', value1: 20.4, value2: 20.0 },
        { month: 'Sep', value1: 21.2, value2: 20.0 },
        { month: 'Oct', value1: 21.8, value2: 20.0 },
        { month: 'Nov', value1: 22.4, value2: 20.0 },
      ],
      moic: [
        { month: 'Jun', value1: 2.15, value2: 2.50 },
        { month: 'Jul', value1: 2.32, value2: 2.50 },
        { month: 'Aug', value1: 2.48, value2: 2.50 },
        { month: 'Sep', value1: 2.62, value2: 2.50 },
        { month: 'Oct', value1: 2.75, value2: 2.50 },
        { month: 'Nov', value1: 2.85, value2: 2.50 },
      ],
    },
    metrics: {
      moic: 2.85,
      irr: 22.4,
      nav: 70000000,
      totalInvested: 40000000,
      totalDistributed: 10000000,
      unrealizedGain: 30000000,
    },
  },
  'company-5': {
    company: mockCompanies[4],
    portfolio: [
      { name: 'E-handel', value: 22000000, percentage: 35, color: '#7C3AED' },
      { name: 'Logistiktech', value: 19000000, percentage: 30, color: '#A78BFA' },
      { name: 'FinTech', value: 13000000, percentage: 20, color: '#C4B5FD' },
      { name: 'Övrigt', value: 9000000, percentage: 15, color: '#DDD6FE' },
    ],
    transactions: [
      { id: 't9', type: 'INVESTMENT', description: 'Sådd BalticPay', amount: 800000, currency: 'EUR', date: new Date('2024-11-18'), status: 'COMPLETED' },
      { id: 't10', type: 'EXPENSE', description: 'Juridiska kostnader', amount: 125000, currency: 'EUR', date: new Date('2024-11-20'), status: 'PENDING' },
    ],
    tasks: [
      { id: 'task7', title: 'Investerarrelationer', description: 'Förbered kvartalsuppdatering för LPs', dueDate: new Date('2024-12-08'), priority: 'HIGH', status: 'TODO' },
      { id: 'task8', title: 'Portföljgenomgång', description: 'Månatlig uppföljning av portföljbolag', dueDate: new Date('2024-11-28'), priority: 'MEDIUM', status: 'DONE' },
    ],
    kpiData: [
      { month: 'Jun', value1: 90, value2: 82 },
      { month: 'Jul', value1: 95, value2: 86 },
      { month: 'Aug', value1: 92, value2: 84 },
      { month: 'Sep', value1: 98, value2: 88 },
      { month: 'Oct', value1: 105, value2: 94 },
      { month: 'Nov', value1: 112, value2: 100 },
    ],
    kpiDataSet: {
      nav: [
        { month: 'Jun', value1: 52.5, value2: 50.0 },
        { month: 'Jul', value1: 55.2, value2: 53.0 },
        { month: 'Aug', value1: 56.8, value2: 56.0 },
        { month: 'Sep', value1: 59.2, value2: 58.0 },
        { month: 'Oct', value1: 61.5, value2: 60.0 },
        { month: 'Nov', value1: 63.0, value2: 62.0 },
      ],
      irr: [
        { month: 'Jun', value1: 13.2, value2: 14.0 },
        { month: 'Jul', value1: 14.0, value2: 14.0 },
        { month: 'Aug', value1: 14.5, value2: 14.0 },
        { month: 'Sep', value1: 15.0, value2: 14.0 },
        { month: 'Oct', value1: 15.4, value2: 14.0 },
        { month: 'Nov', value1: 15.8, value2: 14.0 },
      ],
      moic: [
        { month: 'Jun', value1: 1.82, value2: 2.00 },
        { month: 'Jul', value1: 1.90, value2: 2.00 },
        { month: 'Aug', value1: 1.95, value2: 2.00 },
        { month: 'Sep', value1: 2.02, value2: 2.00 },
        { month: 'Oct', value1: 2.08, value2: 2.00 },
        { month: 'Nov', value1: 2.15, value2: 2.00 },
      ],
    },
    metrics: {
      moic: 2.15,
      irr: 15.8,
      nav: 63000000,
      totalInvested: 42000000,
      totalDistributed: 12000000,
      unrealizedGain: 21000000,
    },
  },
};

export function getCompanyById(id: string): Company | undefined {
  return mockCompanies.find(c => c.id === id);
}

export function getCompanyDashboard(companyId: string): CompanyDashboard | undefined {
  return companyDashboards[companyId];
}

export function formatCurrencyCompact(amount: number, currency: string = 'SEK'): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${currency}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K ${currency}`;
  }
  return `${amount.toLocaleString('sv-SE')} ${currency}`;
}

export function formatPercentageValue(value: number): string {
  return `${value.toFixed(2)}%`;
}

