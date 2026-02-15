'use client';

import { useEffect, useState } from 'react';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { 
  Video, Phone, Mail, FileText, Calendar, User, 
  Building2, Briefcase, Clock, CheckCircle2, XCircle,
  Filter, Search, Globe
} from 'lucide-react';
import type { Activity } from '@/lib/crm/types';
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import { sv } from 'date-fns/locale';
import Link from 'next/link';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const res = await fetch('/api/crm/activities');
        if (res.ok) setActivities(await res.json());
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredActivities = activities
    .filter(activity => {
      const matchesType = typeFilter === 'all' || activity.type === typeFilter;
      const matchesSearch = 
        !searchQuery ||
        activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.crmCompanyName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.startTime || a.createdAt;
      const dateB = b.startTime || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = activity.startTime || activity.createdAt;
    const dateKey = format(parseISO(date), 'yyyy-MM-dd');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Idag';
    if (isYesterday(date)) return 'Igår';
    if (isThisWeek(date)) return format(date, 'EEEE', { locale: sv });
    return format(date, 'd MMMM yyyy', { locale: sv });
  };

  const getActivityIcon = (type: Activity['type']) => {
    const icons = {
      meeting: Video,
      call: Phone,
      email: Mail,
      note: FileText,
      task_completed: CheckCircle2,
    };
    return icons[type] || Calendar;
  };

  const getActivityColor = (type: Activity['type']) => {
    const colors = {
      meeting: 'bg-aifm-charcoal/5 text-aifm-charcoal',
      call: 'bg-aifm-gold/10 text-aifm-gold',
      email: 'bg-aifm-gold/10 text-aifm-charcoal',
      note: 'bg-aifm-charcoal/5 text-aifm-charcoal/60',
      task_completed: 'bg-aifm-gold/10 text-aifm-gold',
    };
    return colors[type] || 'bg-aifm-charcoal/5 text-aifm-charcoal/60';
  };

  const getStatusBadge = (status: Activity['status']) => {
    const badges = {
      scheduled: { label: 'Planerad', className: 'bg-aifm-gold/15 text-aifm-charcoal' },
      completed: { label: 'Genomförd', className: 'bg-aifm-charcoal/5 text-aifm-charcoal' },
      cancelled: { label: 'Avbokad', className: 'bg-gray-100 text-aifm-charcoal/50' },
      no_show: { label: 'Utebliven', className: 'bg-red-50 text-red-700' },
    };
    return badges[status] || badges.scheduled;
  };

  const activityTypes = [
    { id: 'all', label: 'Alla' },
    { id: 'meeting', label: 'Möten', icon: Video },
    { id: 'call', label: 'Samtal', icon: Phone },
    { id: 'email', label: 'E-post', icon: Mail },
    { id: 'note', label: 'Anteckningar', icon: FileText },
  ];

  return (
    <CrmLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Aktiviteter</h1>
            <p className="text-sm text-aifm-charcoal/40 mt-1">{activities.length} aktiviteter totalt</p>
          </div>
          <Link
            href="/crm/calendar?new=true"
            className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white text-sm font-medium rounded-full hover:bg-aifm-charcoal/90 transition-all shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            Ny aktivitet
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök aktiviteter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
            />
          </div>
          <div className="flex items-center bg-aifm-charcoal/[0.03] rounded-xl p-1">
            {activityTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setTypeFilter(type.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  typeFilter === type.id
                    ? 'bg-white text-aifm-charcoal shadow-sm'
                    : 'text-aifm-charcoal/40 hover:text-aifm-charcoal/60'
                }`}
              >
                {type.icon && <type.icon className="w-4 h-4" />}
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-aifm-charcoal/5 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-aifm-charcoal/20" />
            </div>
            <h3 className="text-lg font-medium text-aifm-charcoal mb-1">Inga aktiviteter</h3>
            <p className="text-aifm-charcoal/40 mb-4">
              {searchQuery ? 'Inga aktiviteter matchar din sökning' : 'Börja med att lägga till en aktivitet'}
            </p>
            <Link
              href="/crm/calendar?new=true"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white text-sm font-medium rounded-full hover:bg-aifm-charcoal/90 transition-all shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              Lägg till aktivitet
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
              <div key={dateKey}>
                <h2 className="text-sm font-semibold text-aifm-charcoal/60 uppercase tracking-wider mb-4">
                  {getDateLabel(dateKey)}
                </h2>
                <div className="space-y-3">
                  {dayActivities.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    const statusBadge = getStatusBadge(activity.status);

                    return (
                      <Link
                        key={activity.id}
                        href={`/crm/calendar?activity=${activity.id}`}
                        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}>
                            <Icon className="w-5 h-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-medium text-aifm-charcoal">{activity.title}</h3>
                                {activity.description && (
                                  <p className="text-sm text-aifm-charcoal/40 mt-0.5 line-clamp-2">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusBadge.className}`}>
                                {statusBadge.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 mt-3 text-sm text-aifm-charcoal/40">
                              {activity.startTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {format(parseISO(activity.startTime), 'HH:mm')}
                                  {activity.endTime && (
                                    <> - {format(parseISO(activity.endTime), 'HH:mm')}</>
                                  )}
                                </span>
                              )}
                              {activity.contactName && (
                                <span className="flex items-center gap-1">
                                  <User className="w-4 h-4" />
                                  {activity.contactName}
                                </span>
                              )}
                              {activity.crmCompanyName && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-4 h-4" />
                                  {activity.crmCompanyName}
                                </span>
                              )}
                              {activity.dealName && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="w-4 h-4" />
                                  {activity.dealName}
                                </span>
                              )}
                            </div>

                            {activity.location && (
                              <div className="mt-2 text-sm text-aifm-charcoal/30 flex items-center gap-1">
                                📍 {activity.location}
                              </div>
                            )}

                            {activity.outcome && (
                              <div className="mt-3 p-3 bg-aifm-charcoal/[0.03] rounded-xl text-sm">
                                <div className="font-medium text-aifm-charcoal/70 mb-1">Resultat</div>
                                <p className="text-aifm-charcoal/50">{activity.outcome}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}

