'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { 
  Building2, Users, Briefcase, FileText, Shield, TrendingUp, 
  MessageSquare, ArrowLeft, Edit2, Trash2, ExternalLink, 
  Phone, Mail, Globe, MapPin, Hash, User, Calendar, 
  DollarSign, AlertCircle, CheckCircle2, Clock, MoreHorizontal,
  Plus, ChevronRight, Download, Upload, Link2, Scale
} from 'lucide-react';
import type { 
  CrmCompany, Contact, Deal, Task, Activity, TimelineEntry,
  Customer360Stats, KycRecord, Contract, Quote
} from '@/lib/crm/types';
import { mockCompanies, Company } from '@/lib/companyData';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

// Breadcrumb Component
function Breadcrumbs({ customer }: { customer: CrmCompany }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-aifm-charcoal/40 mb-6">
      <Link href="/crm" className="hover:text-aifm-gold transition-colors">
        CRM
      </Link>
      <ChevronRight className="w-4 h-4" />
      <Link href="/crm/companies" className="hover:text-aifm-gold transition-colors">
        Företag
      </Link>
      <ChevronRight className="w-4 h-4" />
      <span className="text-aifm-charcoal font-medium">
        {customer.name}
      </span>
    </nav>
  );
}

// Mock compliance status per managed company
const companyComplianceStatus: Record<string, { score: number; status: 'ok' | 'warning' | 'critical' }> = {
  'aifm-1': { score: 87, status: 'warning' },
  'aifm-2': { score: 95, status: 'ok' },
  'aifm-3': { score: 62, status: 'critical' },
  'aifm-4': { score: 90, status: 'ok' },
  'aifm-5': { score: 78, status: 'warning' },
};

// Linked Managed Companies Section
function LinkedManagedCompaniesSection({ linkedIds }: { linkedIds?: string[] }) {
  if (!linkedIds || linkedIds.length === 0) return null;
  
  const linkedCompanies = mockCompanies.filter(c => linkedIds.includes(c.id));
  if (linkedCompanies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-aifm-gold" />
        <h3 className="font-semibold text-aifm-charcoal tracking-tight">Kopplade förvaltade bolag</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {linkedCompanies.map(company => {
          const compliance = companyComplianceStatus[company.id] || { score: 100, status: 'ok' };
          return (
            <Link
              key={company.id}
              href={`/overview`}
              className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${company.color}20` }}
                >
                  <Building2 className="w-5 h-5" style={{ color: company.color }} />
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">
                    {company.shortName || company.name}
                  </p>
                  <p className="text-xs text-aifm-charcoal/40">{company.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  compliance.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                  compliance.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {compliance.score}%
                </span>
                <ExternalLink className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold" />
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <Link
          href="/?view=compliance"
          className="inline-flex items-center gap-2 text-sm text-aifm-gold hover:underline"
        >
          <Scale className="w-4 h-4" />
          Öppna Compliance Manager
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Översikt', icon: Building2 },
  { id: 'contacts', label: 'Kontakter', icon: Users },
  { id: 'deals', label: 'Affärer', icon: Briefcase },
  { id: 'journal', label: 'Journal', icon: MessageSquare },
  { id: 'kyc', label: 'KYC', icon: Shield },
  { id: 'revenue', label: 'Intäkter', icon: TrendingUp },
  { id: 'documents', label: 'Dokument', icon: FileText },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [customer, setCustomer] = useState<CrmCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Customer360Stats | null>(null);
  
  // Related data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  
  // Load customer data
  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      // Load customer (global CRM data - no companyId filter)
      const res = await fetch(`/api/crm/companies/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      }
      
      // Load related data in parallel - filter by crmCompanyId only
      const [contactsRes, dealsRes, tasksRes, activitiesRes] = await Promise.all([
        fetch(`/api/crm/contacts?crmCompanyId=${customerId}`),
        fetch(`/api/crm/deals?crmCompanyId=${customerId}`),
        fetch(`/api/crm/tasks?crmCompanyId=${customerId}`),
        fetch(`/api/crm/activities?crmCompanyId=${customerId}`),
      ]);
      
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (dealsRes.ok) setDeals(await dealsRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (activitiesRes.ok) setActivities(await activitiesRes.json());
      
      // Calculate stats
      const allDeals = dealsRes.ok ? await dealsRes.clone().json() : [];
      const allTasks = tasksRes.ok ? await tasksRes.clone().json() : [];
      const allActivities = activitiesRes.ok ? await activitiesRes.clone().json() : [];
      
      setStats(calculateStats(allDeals, allTasks, allActivities));
      
      // Build timeline
      setTimeline(buildTimeline(allDeals, allTasks, allActivities));
      
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const calculateStats = (deals: Deal[], tasks: Task[], activities: Activity[]): Customer360Stats => {
    const openDeals = deals.filter(d => d.status === 'open');
    const wonDeals = deals.filter(d => d.status === 'won');
    const lostDeals = deals.filter(d => d.status === 'lost');
    const openTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed');
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentActivities = activities.filter(a => new Date(a.createdAt) > thirtyDaysAgo);
    
    return {
      totalDeals: deals.length,
      openDeals: openDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
      totalDealValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
      wonDealValue: wonDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      totalActivities: activities.length,
      activitiesLast30Days: recentActivities.length,
      lastActivityDate: activities[0]?.createdAt,
      totalTasks: tasks.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      totalRevenue: wonDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      revenueThisYear: 0,
      revenueLastYear: 0,
      mrr: customer?.currentMRR || 0,
      arr: customer?.currentARR || 0,
      activeContracts: 0,
      contractsExpiringSoon: 0,
      openQuotes: 0,
      pendingQuoteValue: 0,
    };
  };

  const buildTimeline = (deals: Deal[], tasks: Task[], activities: Activity[]): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];
    
    // Add activities
    activities.forEach(a => {
      entries.push({
        id: `activity-${a.id}`,
        type: a.type === 'note' ? 'note' : a.type === 'email' ? 'email' : 'activity',
        title: a.title,
        description: a.description,
        timestamp: a.createdAt,
        entityType: 'activity',
        entityId: a.id,
        user: { id: a.createdBy, name: a.ownerName || 'Användare' },
      });
    });
    
    // Add completed tasks
    tasks.filter(t => t.completedAt).forEach(t => {
      entries.push({
        id: `task-${t.id}`,
        type: 'task_completed',
        title: `Uppgift slutförd: ${t.title}`,
        timestamp: t.completedAt!,
        entityType: 'task',
        entityId: t.id,
        user: { id: t.assigneeId || '', name: t.assigneeName || 'Användare' },
      });
    });
    
    // Add deal events
    deals.forEach(d => {
      entries.push({
        id: `deal-${d.id}`,
        type: 'deal_created',
        title: `Affär skapad: ${d.name}`,
        description: d.value ? `Värde: ${d.value.toLocaleString('sv-SE')} ${d.currency || 'SEK'}` : undefined,
        timestamp: d.createdAt,
        entityType: 'deal',
        entityId: d.id,
        user: { id: d.createdBy, name: d.ownerName || 'Användare' },
      });
    });
    
    // Sort by timestamp descending
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getStatusColor = (status: CrmCompany['status']) => {
    const colors = {
      lead: 'bg-gray-100 text-aifm-charcoal/60',
      prospect: 'bg-blue-100 text-blue-700',
      customer: 'bg-emerald-100 text-emerald-700',
      partner: 'bg-purple-100 text-purple-700',
      inactive: 'bg-red-100 text-red-700',
    };
    return colors[status] || colors.lead;
  };

  const getKycStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      not_started: 'bg-gray-100 text-aifm-charcoal/60',
      in_progress: 'bg-blue-100 text-blue-700',
      pending_review: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-orange-100 text-orange-700',
    };
    return colors[status || 'not_started'] || colors.not_started;
  };

  const getKycStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      not_started: 'Ej påbörjad',
      in_progress: 'Pågår',
      pending_review: 'Väntar granskning',
      approved: 'Godkänd',
      rejected: 'Avvisad',
      expired: 'Utgången',
    };
    return labels[status || 'not_started'] || 'Ej påbörjad';
  };

  if (loading) {
    return (
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-aifm-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </CrmLayout>
    );
  }

  if (!customer) {
    return (
      <CrmLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Building2 className="w-12 h-12 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-2">Kund hittades inte</h2>
          <button
            onClick={() => router.push('/crm/companies')}
            className="text-aifm-gold hover:underline"
          >
            Tillbaka till kundlista
          </button>
        </div>
      </CrmLayout>
    );
  }

  return (
    <CrmLayout>
      <div className="min-h-screen">
        {/* Breadcrumbs */}
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          <Breadcrumbs customer={customer} />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-aifm-charcoal to-[#3d3a36] text-white">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            
            {/* Customer header */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  {customer.logoUrl ? (
                    <img src={customer.logoUrl} alt={customer.name} className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-white/60" />
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{customer.name}</h1>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(customer.status)}`}>
                      {customer.status === 'lead' ? 'Lead' : 
                       customer.status === 'prospect' ? 'Prospekt' :
                       customer.status === 'customer' ? 'Kund' :
                       customer.status === 'partner' ? 'Partner' : 'Inaktiv'}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
                    {customer.customerNumber && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        {customer.customerNumber}
                      </span>
                    )}
                    {customer.orgNumber && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {customer.orgNumber}
                      </span>
                    )}
                    {customer.industry && (
                      <span>{customer.industry}</span>
                    )}
                  </div>
                  
                  {customer.ownerName && (
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <User className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70">Ansvarig:</span>
                      <span className="text-white">{customer.ownerName}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/crm/companies?edit=${customer.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Redigera</span>
                </button>
                <button className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Öppna affärer</div>
                <div className="text-xl font-semibold tracking-tight">{stats?.openDeals || 0}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Pipeline-värde</div>
                <div className="text-xl font-semibold tracking-tight">
                  {(stats?.totalDealValue || 0).toLocaleString('sv-SE')} kr
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">KYC</div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getKycStatusColor(customer.kycStatus)}`}>
                    {getKycStatusLabel(customer.kycStatus)}
                  </span>
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Senaste aktivitet</div>
                <div className="text-sm">
                  {stats?.lastActivityDate 
                    ? formatDistanceToNow(parseISO(stats.lastActivityDate), { addSuffix: true, locale: sv })
                    : 'Ingen'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto pb-px -mb-px">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      isActive
                        ? 'border-aifm-gold text-white'
                        : 'border-transparent text-white/60 hover:text-white/80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Linked Managed Companies */}
        <div className="px-4 sm:px-6 lg:px-8 pt-6">
          <LinkedManagedCompaniesSection linkedIds={customer.linkedManagedCompanyIds} />
        </div>

        {/* Tab content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'overview' && (
            <OverviewTab customer={customer} stats={stats} contacts={contacts} deals={deals} activities={activities} />
          )}
          {activeTab === 'contacts' && (
            <ContactsTab contacts={contacts} customerId={customer.id} onRefresh={loadCustomer} />
          )}
          {activeTab === 'deals' && (
            <DealsTab deals={deals} customerId={customer.id} customerName={customer.name} onRefresh={loadCustomer} />
          )}
          {activeTab === 'journal' && (
            <JournalTab timeline={timeline} />
          )}
          {activeTab === 'kyc' && (
            <KycTab customer={customer} onRefresh={loadCustomer} />
          )}
          {activeTab === 'revenue' && (
            <RevenueTab customer={customer} deals={deals} stats={stats} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab customer={customer} />
          )}
        </div>
      </div>
    </CrmLayout>
  );
}

// ============ Overview Tab ============
function OverviewTab({ 
  customer, 
  stats, 
  contacts, 
  deals, 
  activities 
}: { 
  customer: CrmCompany;
  stats: Customer360Stats | null;
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">Kontaktuppgifter</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customer.email && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <Mail className="w-5 h-5 text-aifm-charcoal/30" />
                <div>
                  <div className="text-xs text-aifm-charcoal/40">E-post</div>
                  <a href={`mailto:${customer.email}`} className="text-sm text-aifm-gold hover:underline">
                    {customer.email}
                  </a>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <Phone className="w-5 h-5 text-aifm-charcoal/30" />
                <div>
                  <div className="text-xs text-aifm-charcoal/40">Telefon</div>
                  <a href={`tel:${customer.phone}`} className="text-sm text-aifm-charcoal">
                    {customer.phone}
                  </a>
                </div>
              </div>
            )}
            {customer.website && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <Globe className="w-5 h-5 text-aifm-charcoal/30" />
                <div>
                  <div className="text-xs text-aifm-charcoal/40">Webbplats</div>
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
                    {customer.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <MapPin className="w-5 h-5 text-aifm-charcoal/30" />
                <div>
                  <div className="text-xs text-aifm-charcoal/40">Adress</div>
                  <div className="text-sm text-aifm-charcoal">
                    {[customer.address.street, customer.address.postalCode, customer.address.city].filter(Boolean).join(', ')}
                  </div>
                </div>
              </div>
            )}
          </div>
          {customer.description && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs text-aifm-charcoal/40 mb-2">Beskrivning</div>
              <p className="text-sm text-aifm-charcoal/60">{customer.description}</p>
            </div>
          )}
        </div>
        
        {/* Recent activities */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Senaste aktiviteter</h3>
            <span className="text-xs text-aifm-charcoal/40">{activities.length} totalt</span>
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-aifm-charcoal/40">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Inga aktiviteter ännu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activity.type === 'meeting' ? 'bg-blue-100 text-blue-600' :
                    activity.type === 'call' ? 'bg-green-100 text-green-600' :
                    activity.type === 'email' ? 'bg-amber-100 text-amber-600' :
                    'bg-aifm-charcoal/[0.03] text-aifm-charcoal/60'
                  }`}>
                    {activity.type === 'meeting' ? <Calendar className="w-4 h-4" /> :
                     activity.type === 'call' ? <Phone className="w-4 h-4" /> :
                     activity.type === 'email' ? <Mail className="w-4 h-4" /> :
                     <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-aifm-charcoal truncate">{activity.title}</div>
                    <div className="text-xs text-aifm-charcoal/40">
                      {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true, locale: sv })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Right column */}
      <div className="space-y-6">
        {/* Key contacts */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Kontaktpersoner</h3>
            <span className="text-xs text-aifm-charcoal/40">{contacts.length} st</span>
          </div>
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-aifm-charcoal/40">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Inga kontakter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.slice(0, 4).map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 p-2 hover:bg-aifm-charcoal/[0.03] rounded-xl transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-aifm-gold to-[#a08060] flex items-center justify-center text-white text-sm font-medium">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-aifm-charcoal truncate">
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div className="text-xs text-aifm-charcoal/40 truncate">{contact.title || contact.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Open deals */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Öppna affärer</h3>
            <span className="text-xs text-aifm-charcoal/40">{stats?.openDeals || 0} st</span>
          </div>
          {deals.filter(d => d.status === 'open').length === 0 ? (
            <div className="text-center py-6 text-aifm-charcoal/40">
              <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Inga öppna affärer</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deals.filter(d => d.status === 'open').slice(0, 4).map((deal) => (
                <div key={deal.id} className="p-3 bg-white border border-gray-100 rounded-xl">
                  <div className="text-sm font-medium text-aifm-charcoal truncate">{deal.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-aifm-charcoal/40">{deal.stage}</span>
                    <span className="text-sm font-semibold text-aifm-charcoal tracking-tight">
                      {(deal.value || 0).toLocaleString('sv-SE')} {deal.currency || 'SEK'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Tags */}
        {customer.tags && customer.tags.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">Taggar</h3>
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag, idx) => (
                <span key={idx} className="px-2.5 py-0.5 bg-aifm-gold/15 text-aifm-charcoal text-xs font-medium rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Contacts Tab ============
function ContactsTab({ 
  contacts, 
  customerId, 
  onRefresh 
}: { 
  contacts: Contact[];
  customerId: string;
  onRefresh: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Kontaktpersoner</h2>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Lägg till kontakt
        </button>
      </div>
      
      {contacts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-2">Inga kontaktpersoner</h3>
          <p className="text-aifm-charcoal/40 mb-4">Lägg till kontaktpersoner för denna kund</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <Link 
              key={contact.id} 
              href={`/crm/contacts/${contact.id}`}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300 cursor-pointer block"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-aifm-gold to-[#a08060] flex items-center justify-center text-white font-medium">
                  {contact.firstName[0]}{contact.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-aifm-charcoal">{contact.firstName} {contact.lastName}</h3>
                  {contact.title && <p className="text-sm text-aifm-charcoal/40">{contact.title}</p>}
                </div>
                <ExternalLink className="w-4 h-4 text-aifm-charcoal/30" />
              </div>
              <div className="mt-4 space-y-2">
                {contact.email && (
                  <span className="flex items-center gap-2 text-sm text-aifm-charcoal/60">
                    <Mail className="w-4 h-4" />
                    {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-2 text-sm text-aifm-charcoal/60">
                    <Phone className="w-4 h-4" />
                    {contact.phone}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Deals Tab ============
function DealsTab({ 
  deals, 
  customerId, 
  customerName,
  onRefresh 
}: { 
  deals: Deal[];
  customerId: string;
  customerName: string;
  onRefresh: () => void;
}) {
  const router = useRouter();
  
  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-gray-100 text-aifm-charcoal/60',
      qualified: 'bg-blue-100 text-blue-700',
      proposal: 'bg-purple-100 text-purple-700',
      negotiation: 'bg-amber-100 text-amber-700',
      won: 'bg-emerald-100 text-emerald-700',
      lost: 'bg-red-100 text-red-700',
    };
    return colors[stage] || colors.lead;
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Affärer</h2>
        <button 
          onClick={() => router.push(`/crm/pipeline?new=true&company=${customerId}&companyName=${encodeURIComponent(customerName)}`)}
          className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Ny affär
        </button>
      </div>
      
      {deals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-2">Inga affärer</h3>
          <p className="text-aifm-charcoal/40 mb-4">Skapa din första affär för denna kund</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-aifm-charcoal/[0.03] border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider px-6 py-4">Affär</th>
                  <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider px-6 py-4">Stadium</th>
                  <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider px-6 py-4">Värde</th>
                  <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider px-6 py-4">Förväntat avslut</th>
                  <th className="text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-aifm-charcoal/[0.02] transition-colors cursor-pointer" onClick={() => router.push(`/crm/pipeline?deal=${deal.id}`)}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-aifm-charcoal">{deal.name}</div>
                      {deal.description && <div className="text-sm text-aifm-charcoal/40 truncate max-w-xs">{deal.description}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}>
                        {deal.stage === 'lead' ? 'Lead' :
                         deal.stage === 'qualified' ? 'Kvalificerad' :
                         deal.stage === 'proposal' ? 'Offert' :
                         deal.stage === 'negotiation' ? 'Förhandling' :
                         deal.stage === 'won' ? 'Vunnen' : 'Förlorad'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-aifm-charcoal tracking-tight">
                        {(deal.value || 0).toLocaleString('sv-SE')} {deal.currency || 'SEK'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-aifm-charcoal/60">
                      {deal.expectedCloseDate ? format(parseISO(deal.expectedCloseDate), 'd MMM yyyy', { locale: sv }) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`w-2 h-2 rounded-full inline-block mr-2 ${
                        deal.status === 'open' ? 'bg-blue-500' :
                        deal.status === 'won' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm text-aifm-charcoal/60">
                        {deal.status === 'open' ? 'Öppen' : deal.status === 'won' ? 'Vunnen' : 'Förlorad'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Journal Tab ============
function JournalTab({ timeline }: { timeline: TimelineEntry[] }) {
  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'activity':
      case 'meeting': return Calendar;
      case 'call': return Phone;
      case 'email': return Mail;
      case 'note': return MessageSquare;
      case 'task_completed': return CheckCircle2;
      case 'deal_created': return Briefcase;
      case 'deal_stage_change': return TrendingUp;
      default: return MessageSquare;
    }
  };
  
  const getEntryColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-600';
      case 'call': return 'bg-green-100 text-green-600';
      case 'email': return 'bg-amber-100 text-amber-600';
      case 'note': return 'bg-purple-100 text-purple-600';
      case 'task_completed': return 'bg-emerald-100 text-emerald-600';
      case 'deal_created': return 'bg-indigo-100 text-indigo-600';
      default: return 'bg-aifm-charcoal/[0.03] text-aifm-charcoal/60';
    }
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Journal</h2>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Lägg till notering
        </button>
      </div>
      
      {timeline.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-2">Ingen historik</h3>
          <p className="text-aifm-charcoal/40">Aktiviteter och händelser kommer visas här</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="space-y-6">
            {timeline.map((entry, idx) => {
              const Icon = getEntryIcon(entry.type);
              return (
                <div key={entry.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getEntryColor(entry.type)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {idx < timeline.length - 1 && (
                      <div className="w-px h-full bg-gray-100 my-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-aifm-charcoal">{entry.title}</h4>
                        {entry.description && (
                          <p className="text-sm text-aifm-charcoal/60 mt-1">{entry.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-aifm-charcoal/40 whitespace-nowrap ml-4">
                        {formatDistanceToNow(parseISO(entry.timestamp), { addSuffix: true, locale: sv })}
                      </div>
                    </div>
                    {entry.user && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-aifm-charcoal/40">
                        <User className="w-3 h-3" />
                        {entry.user.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ KYC Tab ============
function KycTab({ 
  customer, 
  onRefresh 
}: { 
  customer: CrmCompany;
  onRefresh: () => void;
}) {
  const kycChecklist = [
    { id: 'company_reg', name: 'Bolagsregistrering', description: 'Registreringsbevis från Bolagsverket', required: true, completed: false },
    { id: 'beneficial_owners', name: 'Verkliga huvudmän', description: 'Dokumentation av verkliga huvudmän', required: true, completed: false },
    { id: 'board_members', name: 'Styrelseledamöter', description: 'Lista på styrelseledamöter med ID', required: true, completed: false },
    { id: 'financials', name: 'Finansiell information', description: 'Årsredovisning eller motsvarande', required: false, completed: false },
    { id: 'pep_check', name: 'PEP-kontroll', description: 'Kontroll av politiskt exponerade personer', required: true, completed: false },
    { id: 'sanction_check', name: 'Sanktionskontroll', description: 'Kontroll mot sanktionslistor', required: true, completed: false },
  ];
  
  const completedItems = kycChecklist.filter(i => i.completed).length;
  const progress = (completedItems / kycChecklist.length) * 100;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">KYC - Kundkännedom</h2>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
          Starta KYC-process
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">Status</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-aifm-charcoal/60">Framsteg</span>
                <span className="text-sm font-medium text-aifm-charcoal">{completedItems}/{kycChecklist.length}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-aifm-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <div className="text-xs text-aifm-charcoal/40 mb-1">Risknivå</div>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                customer.kycRiskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' :
                customer.kycRiskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                customer.kycRiskLevel === 'high' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-aifm-charcoal/60'
              }`}>
                {customer.kycRiskLevel === 'low' ? 'Låg' :
                 customer.kycRiskLevel === 'medium' ? 'Medel' :
                 customer.kycRiskLevel === 'high' ? 'Hög' : 'Ej bedömd'}
              </span>
            </div>
            {customer.kycNextReviewAt && (
              <div className="pt-4 border-t border-gray-100">
                <div className="text-xs text-aifm-charcoal/40 mb-1">Nästa granskning</div>
                <div className="text-sm text-aifm-charcoal">
                  {format(parseISO(customer.kycNextReviewAt), 'd MMMM yyyy', { locale: sv })}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Checklist */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">Checklista</h3>
          <div className="space-y-3">
            {kycChecklist.map((item) => (
              <div key={item.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                item.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 hover:border-gray-200'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.completed ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-gray-300'
                }`}>
                  {item.completed && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-aifm-charcoal">{item.name}</span>
                    {item.required && <span className="text-xs text-red-500">Obligatorisk</span>}
                  </div>
                  <p className="text-sm text-aifm-charcoal/40 mt-0.5">{item.description}</p>
                </div>
                <button className="text-sm text-aifm-gold hover:underline">
                  {item.completed ? 'Visa' : 'Ladda upp'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Revenue Tab ============
function RevenueTab({ 
  customer, 
  deals,
  stats 
}: { 
  customer: CrmCompany;
  deals: Deal[];
  stats: Customer360Stats | null;
}) {
  const wonDeals = deals.filter(d => d.status === 'won');
  const openDeals = deals.filter(d => d.status === 'open');
  
  // Calculate weighted pipeline
  const weightedPipeline = openDeals.reduce((sum, d) => sum + (d.value || 0) * ((d.probability || 50) / 100), 0);
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Intäkter & Prognos</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm font-medium transition-all">
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            Registrera intäkt
          </button>
        </div>
      </div>
      
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">MRR</div>
          <div className="text-2xl font-semibold text-aifm-charcoal tracking-tight">
            {(customer.currentMRR || 0).toLocaleString('sv-SE')} kr
          </div>
          <div className="text-xs text-aifm-charcoal/40 mt-1">Månatlig återkommande</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">ARR</div>
          <div className="text-2xl font-semibold text-aifm-charcoal tracking-tight">
            {(customer.currentARR || 0).toLocaleString('sv-SE')} kr
          </div>
          <div className="text-xs text-aifm-charcoal/40 mt-1">Årlig återkommande</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Vunna affärer</div>
          <div className="text-2xl font-semibold text-emerald-600 tracking-tight">
            {(stats?.wonDealValue || 0).toLocaleString('sv-SE')} kr
          </div>
          <div className="text-xs text-aifm-charcoal/40 mt-1">{wonDeals.length} affärer</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Viktad pipeline</div>
          <div className="text-2xl font-semibold text-blue-600 tracking-tight">
            {weightedPipeline.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
          </div>
          <div className="text-xs text-aifm-charcoal/40 mt-1">{openDeals.length} öppna affärer</div>
        </div>
      </div>
      
      {/* Forecast scenarios */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
        <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">Prognos (12 månader)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-white border border-gray-100 rounded-xl">
            <div className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-2">Konservativ</div>
            <div className="text-xl font-semibold text-aifm-charcoal tracking-tight">
              {(stats?.wonDealValue || 0).toLocaleString('sv-SE')} kr
            </div>
            <div className="text-xs text-aifm-charcoal/40 mt-1">Endast vunna affärer</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">Realistisk</div>
            <div className="text-xl font-semibold text-blue-700 tracking-tight">
              {((stats?.wonDealValue || 0) + weightedPipeline).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
            </div>
            <div className="text-xs text-blue-600 mt-1">Vunna + viktad pipeline</div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl">
            <div className="text-xs text-emerald-600 uppercase tracking-wider mb-2">Optimistisk</div>
            <div className="text-xl font-semibold text-emerald-700 tracking-tight">
              {((stats?.wonDealValue || 0) + (stats?.totalDealValue || 0) - (stats?.wonDealValue || 0)).toLocaleString('sv-SE')} kr
            </div>
            <div className="text-xs text-emerald-600 mt-1">Vunna + all pipeline</div>
          </div>
        </div>
      </div>
      
      {/* Revenue history placeholder */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
        <h3 className="text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">Intäktshistorik</h3>
        <div className="h-64 flex items-center justify-center text-aifm-charcoal/30">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Intäktsdata visas här när den registreras</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Documents Tab ============
function DocumentsTab({ customer }: { customer: CrmCompany }) {
  const router = useRouter();
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Dokument</h2>
        <div className="flex items-center gap-2">
          {customer.dataroomId ? (
            <button 
              onClick={() => router.push(`/data-rooms/${customer.dataroomId}`)}
              className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Öppna datarum
            </button>
          ) : (
            <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              Skapa datarum
            </button>
          )}
        </div>
      </div>
      
      {customer.dataroomId ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl">
            <div className="w-12 h-12 bg-aifm-gold/10 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-aifm-gold" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-aifm-charcoal">{customer.dataroomName || 'Datarum'}</h4>
              <p className="text-sm text-aifm-charcoal/40">Kopplat datarum med dokument, avtal och offerter</p>
            </div>
            <button 
              onClick={() => router.push(`/data-rooms/${customer.dataroomId}`)}
              className="flex items-center gap-2 text-aifm-gold hover:underline"
            >
              Visa <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-2">Inget kopplat datarum</h3>
          <p className="text-aifm-charcoal/40 mb-4">Skapa ett datarum för att hantera dokument, avtal och offerter för denna kund</p>
          <button className="px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
            Skapa datarum
          </button>
        </div>
      )}
    </div>
  );
}
