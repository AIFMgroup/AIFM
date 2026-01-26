'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { 
  User, Building2, Mail, Phone, Linkedin, MapPin, Calendar, 
  Briefcase, MessageSquare, CheckSquare, Clock, DollarSign,
  ArrowLeft, Edit2, Trash2, Plus, ExternalLink, ChevronRight,
  Activity, FileText, Users, Link2, Tag, MoreHorizontal
} from 'lucide-react';
import type { 
  Contact, CrmCompany, Deal, Task, Activity as CrmActivity, TimelineEntry 
} from '@/lib/crm/types';
import { mockCompanies, Company } from '@/lib/companyData';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Card, StatusPill, Avatar, Button, IconButton } from '@/components/crm/ui';

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Översikt', icon: User },
  { id: 'activities', label: 'Aktiviteter', icon: Activity },
  { id: 'deals', label: 'Affärer', icon: DollarSign },
  { id: 'tasks', label: 'Uppgifter', icon: CheckSquare },
  { id: 'documents', label: 'Dokument', icon: FileText },
] as const;

type TabId = typeof TABS[number]['id'];

// Breadcrumb Component
function Breadcrumbs({ contact }: { contact: Contact }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
      <Link href="/crm" className="hover:text-[#c0a280] transition-colors">
        CRM
      </Link>
      <ChevronRight className="w-4 h-4" />
      <Link href="/crm/contacts" className="hover:text-[#c0a280] transition-colors">
        Kontakter
      </Link>
      <ChevronRight className="w-4 h-4" />
      <span className="text-[#2d2a26] font-medium">
        {contact.firstName} {contact.lastName}
      </span>
    </nav>
  );
}

// Timeline Item Component
function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const getIcon = () => {
    switch (entry.type) {
      case 'deal_created':
      case 'deal_stage_change':
        return <DollarSign className="w-4 h-4" />;
      case 'task':
      case 'task_completed':
        return <CheckSquare className="w-4 h-4" />;
      case 'activity':
        return <Activity className="w-4 h-4" />;
      case 'note':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getColor = () => {
    switch (entry.type) {
      case 'task_completed': return 'bg-emerald-100 text-emerald-600';
      case 'kyc_approved': return 'bg-emerald-100 text-emerald-600';
      case 'kyc_rejected': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="flex gap-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getColor()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0 pb-6 border-l border-gray-200 -ml-4 pl-8">
        <p className="text-sm font-medium text-[#2d2a26]">{entry.title}</p>
        {entry.description && (
          <p className="text-sm text-gray-500 mt-1">{entry.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          {formatDistanceToNow(parseISO(entry.timestamp), { addSuffix: true, locale: sv })}
        </p>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Related data
  const [company, setCompany] = useState<CrmCompany | null>(null);
  const [linkedManagedCompanies, setLinkedManagedCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  // Load contact data
  const loadContact = useCallback(async () => {
    if (!contactId) return;
    
    setLoading(true);
    try {
      // Load contact
      const res = await fetch(`/api/crm/contacts/${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setContact(data);
        
        // Load linked company if exists
        if (data.crmCompanyId) {
          const companyRes = await fetch(`/api/crm/companies/${data.crmCompanyId}`);
          if (companyRes.ok) setCompany(await companyRes.json());
        }
        
        // Get linked managed companies
        if (data.linkedManagedCompanyIds?.length > 0) {
          const linked = mockCompanies.filter(c => 
            data.linkedManagedCompanyIds.includes(c.id)
          );
          setLinkedManagedCompanies(linked);
        }
      }
      
      // Load related data
      const [dealsRes, tasksRes, activitiesRes] = await Promise.all([
        fetch(`/api/crm/deals?contactId=${contactId}`),
        fetch(`/api/crm/tasks?contactId=${contactId}`),
        fetch(`/api/crm/activities?contactId=${contactId}`),
      ]);
      
      if (dealsRes.ok) setDeals(await dealsRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (activitiesRes.ok) setActivities(await activitiesRes.json());
      
      // Build timeline
      buildTimeline();
      
    } catch (error) {
      console.error('Failed to load contact:', error);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  const buildTimeline = () => {
    const entries: TimelineEntry[] = [];
    
    // Add deal events
    deals.forEach(deal => {
      entries.push({
        id: `deal-${deal.id}`,
        type: 'deal_created',
        title: `Affär skapad: ${deal.name}`,
        description: `Värde: ${deal.value?.toLocaleString('sv-SE')} SEK`,
        timestamp: deal.createdAt,
        entityType: 'deal',
        entityId: deal.id,
      });
    });
    
    // Add task events
    tasks.forEach(task => {
      entries.push({
        id: `task-${task.id}`,
        type: task.status === 'completed' ? 'task_completed' : 'task',
        title: task.status === 'completed' ? `Uppgift slutförd: ${task.title}` : `Uppgift skapad: ${task.title}`,
        timestamp: task.completedAt || task.createdAt,
        entityType: 'task',
        entityId: task.id,
      });
    });
    
    // Add activity events
    activities.forEach(activity => {
      entries.push({
        id: `activity-${activity.id}`,
        type: 'activity',
        title: activity.title,
        description: activity.description,
        timestamp: activity.startTime || activity.createdAt,
        entityType: 'activity',
        entityId: activity.id,
      });
    });
    
    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTimeline(entries.slice(0, 20));
  };

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  useEffect(() => {
    if (deals.length > 0 || tasks.length > 0 || activities.length > 0) {
      buildTimeline();
    }
  }, [deals, tasks, activities]);

  if (loading) {
    return (
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
        </div>
      </CrmLayout>
    );
  }

  if (!contact) {
    return (
      <CrmLayout>
        <div className="text-center py-20">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900">Kontakt hittades inte</h2>
          <p className="text-gray-500 mt-1">Kontakten kan ha tagits bort.</p>
          <Button onClick={() => router.push('/crm/contacts')} className="mt-4">
            Tillbaka till kontakter
          </Button>
        </div>
      </CrmLayout>
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const openDeals = deals.filter(d => d.status === 'open');
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  return (
    <CrmLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumbs */}
        <Breadcrumbs contact={contact} />

        {/* Header Card */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Avatar & Basic Info */}
            <div className="flex items-start gap-4 flex-1">
              <Avatar name={fullName} size="xl" className="w-20 h-20 text-2xl" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-semibold text-[#2d2a26]">{fullName}</h1>
                  <StatusPill status={contact.status} />
                </div>
                {contact.title && (
                  <p className="text-gray-500 mt-1">{contact.title}</p>
                )}
                {company && (
                  <Link 
                    href={`/crm/companies/${company.id}`}
                    className="inline-flex items-center gap-1.5 text-[#c0a280] hover:underline mt-1"
                  >
                    <Building2 className="w-4 h-4" />
                    {company.name}
                  </Link>
                )}
                
                {/* Contact info row */}
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  {contact.email && (
                    <a 
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#c0a280] transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a 
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#c0a280] transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.linkedIn && (
                    <a 
                      href={contact.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#c0a280] transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={<Edit2 className="w-4 h-4" />}>
                Redigera
              </Button>
              <IconButton tooltip="Mer">
                <MoreHorizontal className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold text-[#2d2a26]">{openDeals.length}</p>
              <p className="text-sm text-gray-500">Öppna affärer</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold text-[#2d2a26]">
                {openDeals.reduce((sum, d) => sum + (d.value || 0), 0).toLocaleString('sv-SE')}
              </p>
              <p className="text-sm text-gray-500">Pipeline-värde (SEK)</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold text-[#2d2a26]">{pendingTasks.length}</p>
              <p className="text-sm text-gray-500">Pågående uppgifter</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold text-[#2d2a26]">{activities.length}</p>
              <p className="text-sm text-gray-500">Aktiviteter</p>
            </div>
          </div>
        </Card>

        {/* Linked Managed Companies */}
        {linkedManagedCompanies.length > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-[#c0a280]" />
              <h3 className="text-sm font-semibold text-[#2d2a26]">Kopplade bolag</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {linkedManagedCompanies.map(company => (
                <Link
                  key={company.id}
                  href={`/overview?company=${company.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-[#c0a280]/10 text-[#c0a280] rounded-lg hover:bg-[#c0a280]/20 transition-colors text-sm font-medium"
                >
                  <Building2 className="w-4 h-4" />
                  {company.name}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#c0a280] text-[#c0a280]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'overview' && (
              <>
                {/* Recent Activity Timeline */}
                <Card className="p-6">
                  <h3 className="font-semibold text-[#2d2a26] mb-4">Senaste aktivitet</h3>
                  {timeline.length === 0 ? (
                    <p className="text-gray-500 text-sm">Ingen aktivitet ännu</p>
                  ) : (
                    <div className="space-y-0">
                      {timeline.slice(0, 5).map(entry => (
                        <TimelineItem key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}
                </Card>

                {/* Notes */}
                {contact.notes && (
                  <Card className="p-6">
                    <h3 className="font-semibold text-[#2d2a26] mb-3">Anteckningar</h3>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{contact.notes}</p>
                  </Card>
                )}
              </>
            )}

            {activeTab === 'deals' && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#2d2a26]">Affärer</h3>
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>Ny affär</Button>
                </div>
                {deals.length === 0 ? (
                  <p className="text-gray-500 text-sm">Inga affärer kopplade till denna kontakt</p>
                ) : (
                  <div className="space-y-3">
                    {deals.map(deal => (
                      <Link
                        key={deal.id}
                        href={`/crm/pipeline?deal=${deal.id}`}
                        className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-[#2d2a26]">{deal.name}</p>
                            <p className="text-sm text-gray-500">{deal.crmCompanyName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[#2d2a26]">
                              {deal.value?.toLocaleString('sv-SE')} SEK
                            </p>
                            <StatusPill status={deal.stage} size="sm" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'tasks' && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#2d2a26]">Uppgifter</h3>
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>Ny uppgift</Button>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-gray-500 text-sm">Inga uppgifter kopplade till denna kontakt</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        className={`p-4 rounded-xl ${
                          task.status === 'completed' ? 'bg-gray-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                            task.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-200'
                          }`}>
                            {task.status === 'completed' && (
                              <CheckSquare className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${
                              task.status === 'completed' ? 'text-gray-400 line-through' : 'text-[#2d2a26]'
                            }`}>{task.title}</p>
                            {task.dueDate && (
                              <p className="text-sm text-gray-500 mt-1">
                                Deadline: {format(parseISO(task.dueDate), 'd MMM yyyy', { locale: sv })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'activities' && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#2d2a26]">Aktiviteter</h3>
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>Ny aktivitet</Button>
                </div>
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-sm">Inga aktiviteter loggade</p>
                ) : (
                  <div className="space-y-3">
                    {activities.map(activity => (
                      <div key={activity.id} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#c0a280]/10 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-[#c0a280]" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-[#2d2a26]">{activity.title}</p>
                            {activity.description && (
                              <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              {activity.startTime && format(parseISO(activity.startTime), 'd MMM yyyy HH:mm', { locale: sv })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeTab === 'documents' && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#2d2a26]">Dokument</h3>
                  <Button size="sm" icon={<Plus className="w-4 h-4" />}>Ladda upp</Button>
                </div>
                <p className="text-gray-500 text-sm">Inga dokument uppladdade</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Details */}
            <Card className="p-6">
              <h3 className="font-semibold text-[#2d2a26] mb-4">Kontaktuppgifter</h3>
              <div className="space-y-4">
                {contact.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">E-post</p>
                      <a href={`mailto:${contact.email}`} className="text-sm text-[#2d2a26] hover:text-[#c0a280]">
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Telefon</p>
                      <a href={`tel:${contact.phone}`} className="text-sm text-[#2d2a26] hover:text-[#c0a280]">
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}
                {contact.mobile && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Mobil</p>
                      <a href={`tel:${contact.mobile}`} className="text-sm text-[#2d2a26] hover:text-[#c0a280]">
                        {contact.mobile}
                      </a>
                    </div>
                  </div>
                )}
                {contact.address && (contact.address.street || contact.address.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Adress</p>
                      <p className="text-sm text-[#2d2a26]">
                        {contact.address.street && <span>{contact.address.street}<br /></span>}
                        {contact.address.postalCode} {contact.address.city}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold text-[#2d2a26] mb-4">Taggar</h3>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-[#2d2a26] mb-4">Snabbåtgärder</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Skicka e-post
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <Phone className="w-4 h-4 text-gray-400" />
                  Logga samtal
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Boka möte
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <CheckSquare className="w-4 h-4 text-gray-400" />
                  Skapa uppgift
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </CrmLayout>
  );
}

