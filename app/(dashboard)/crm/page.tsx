'use client';

import { useEffect, useState } from 'react';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { 
  Users, Building2, Kanban, Calendar, CheckSquare, 
  TrendingUp, Clock, AlertCircle, DollarSign, ArrowUpRight, 
  Plus, ChevronRight, Loader2, Phone, Mail, MessageSquare,
  Globe
} from 'lucide-react';
import Link from 'next/link';
import type { CrmStats, Activity, Task, Deal } from '@/lib/crm/types';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Card, CardHeader, CardContent, Button, StatusPill } from '@/components/crm/ui';
import { cn } from '@/lib/utils';

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const [statsRes, activitiesRes, tasksRes, dealsRes] = await Promise.all([
          fetch('/api/crm/stats'),
          fetch('/api/crm/activities'),
          fetch('/api/crm/tasks'),
          fetch('/api/crm/deals'),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (activitiesRes.ok) {
          const activities = await activitiesRes.json();
          setRecentActivities(activities.slice(0, 5));
        }
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          setUpcomingTasks(
            tasks
              .filter((t: Task) => t.status !== 'completed' && t.status !== 'cancelled')
              .sort((a: Task, b: Task) => (a.dueDate || '').localeCompare(b.dueDate || ''))
              .slice(0, 5)
          );
        }
        if (dealsRes.ok) {
          const deals = await dealsRes.json();
          setRecentDeals(
            deals
              .filter((d: Deal) => d.status === 'open')
              .sort((a: Deal, b: Deal) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 5)
          );
        }
      } catch (error) {
        console.error('Failed to load CRM dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin" />
        </div>
      </CrmLayout>
    );
  }

  return (
    <CrmLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#2d2a26] tracking-tight">CRM</h1>
            <div className="flex items-center gap-2 mt-1">
              <Globe className="w-4 h-4 text-[#c0a280]" />
              <p className="text-gray-500">Alla kunder, affärer och aktiviteter</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Kontakter"
            value={stats?.totalContacts ?? 0}
            icon={Users}
            href="/crm/contacts"
            color="blue"
          />
          <StatCard
            label="Företag"
            value={stats?.totalCompanies ?? 0}
            icon={Building2}
            href="/crm/companies"
            color="purple"
          />
          <StatCard
            label="Öppna affärer"
            value={stats?.openDeals ?? 0}
            icon={Kanban}
            href="/crm/pipeline"
            color="amber"
          />
          <StatCard
            label="Vunna"
            value={stats?.wonDeals ?? 0}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            label="Försenade"
            value={stats?.tasksOverdue ?? 0}
            icon={AlertCircle}
            href="/crm/tasks"
            color="red"
          />
          <StatCard
            label="Idag"
            value={stats?.tasksDueToday ?? 0}
            icon={CheckSquare}
            href="/crm/tasks"
            color="gold"
          />
        </div>

        {/* Pipeline + Quick Actions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pipeline Value */}
          <div className="bg-gradient-to-br from-[#2d2a26] to-[#3d3a36] rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-white/60 uppercase tracking-wider">Pipeline-värde</span>
              <div className="p-2 bg-white/10 rounded-xl">
                <DollarSign className="w-5 h-5 text-[#c0a280]" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-bold tracking-tight">
                {(stats?.totalValue ?? 0).toLocaleString('sv-SE')}
              </span>
              <span className="text-lg text-white/60">SEK</span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-sm text-white/50 mb-1">Vunna affärer</p>
                <p className="text-xl font-semibold text-emerald-400">
                  {(stats?.wonValue ?? 0).toLocaleString('sv-SE')}
                  <span className="text-sm text-white/40 ml-1">SEK</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-white/50 mb-1">Aktiva affärer</p>
                <p className="text-xl font-semibold">
                  {stats?.openDeals ?? 0}
                  <span className="text-sm text-white/40 ml-1">st</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-[#2d2a26] uppercase tracking-wider mb-4">Snabbåtgärder</h3>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction href="/crm/contacts?new=true" icon={Users} label="Ny kontakt" color="blue" />
              <QuickAction href="/crm/companies?new=true" icon={Building2} label="Nytt företag" color="purple" />
              <QuickAction href="/crm/pipeline?new=true" icon={DollarSign} label="Ny affär" color="amber" />
              <QuickAction href="/crm/calendar?new=true" icon={Calendar} label="Ny aktivitet" color="green" />
            </div>
          </Card>
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming Tasks */}
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-[#2d2a26]">Kommande uppgifter</h3>
              <Link href="/crm/tasks" className="text-sm text-[#c0a280] hover:underline flex items-center gap-1">
                Visa alla <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-gray-50">
              {upcomingTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Inga uppgifter</p>
                </div>
              ) : (
                upcomingTasks.map((task) => (
                  <div key={task.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        {task.contactName && (
                          <p className="text-xs text-gray-500 mt-0.5">{task.contactName}</p>
                        )}
                      </div>
                      {task.dueDate && (
                        <DueDateBadge date={task.dueDate} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Deals */}
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-[#2d2a26]">Öppna affärer</h3>
              <Link href="/crm/pipeline" className="text-sm text-[#c0a280] hover:underline flex items-center gap-1">
                Pipeline <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-gray-50">
              {recentDeals.length === 0 ? (
                <div className="py-12 text-center">
                  <Kanban className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Inga öppna affärer</p>
                </div>
              ) : (
                recentDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/crm/pipeline?deal=${deal.id}`}
                    className="block px-5 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{deal.name}</p>
                        {deal.crmCompanyName && (
                          <p className="text-xs text-gray-500 mt-0.5">{deal.crmCompanyName}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {(deal.value ?? 0).toLocaleString('sv-SE')}
                        </p>
                        <StatusPill status={deal.stage} size="sm" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Recent Activities */}
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-[#2d2a26]">Senaste aktiviteter</h3>
              <Link href="/crm/activities" className="text-sm text-[#c0a280] hover:underline flex items-center gap-1">
                Visa alla <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-gray-50">
              {recentActivities.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Inga aktiviteter</p>
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <ActivityIcon type={activity.type} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {activity.contactName && (
                            <span className="text-xs text-gray-500">{activity.contactName}</span>
                          )}
                          {activity.startTime && (
                            <span className="text-xs text-gray-400">
                              {format(parseISO(activity.startTime), 'd MMM HH:mm', { locale: sv })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </CrmLayout>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  href?: string;
  color: 'blue' | 'purple' | 'amber' | 'green' | 'red' | 'gold';
}

function StatCard({ label, value, icon: Icon, href, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    gold: 'bg-[#c0a280]/10 text-[#c0a280]',
  };

  const content = (
    <Card 
      interactive={!!href}
      className={cn('p-4', href && 'hover:shadow-md')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {href && <ArrowUpRight className="w-4 h-4 text-gray-300" />}
      </div>
      <p className="text-2xl font-bold text-[#2d2a26]">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// Quick Action Component
function QuickAction({ 
  href, 
  icon: Icon, 
  label, 
  color 
}: { 
  href: string; 
  icon: React.ElementType; 
  label: string; 
  color: 'blue' | 'purple' | 'amber' | 'green'; 
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    green: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all group"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}

// Due Date Badge Component
function DueDateBadge({ date }: { date: string }) {
  const d = parseISO(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = d < today;
  
  let label = format(d, 'd MMM', { locale: sv });
  let className = 'bg-gray-100 text-gray-600';
  
  if (isOverdue) {
    label = 'Försenad';
    className = 'bg-red-100 text-red-700';
  } else if (isToday(d)) {
    label = 'Idag';
    className = 'bg-amber-100 text-amber-700';
  } else if (isTomorrow(d)) {
    label = 'Imorgon';
    className = 'bg-blue-100 text-blue-700';
  }

  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap', className)}>
      {label}
    </span>
  );
}

// Activity Icon Component
function ActivityIcon({ type }: { type: Activity['type'] }) {
  const config = {
    meeting: { icon: Calendar, bg: 'bg-blue-100 text-blue-600' },
    call: { icon: Phone, bg: 'bg-green-100 text-green-600' },
    email: { icon: Mail, bg: 'bg-amber-100 text-amber-600' },
    note: { icon: MessageSquare, bg: 'bg-purple-100 text-purple-600' },
    task_completed: { icon: CheckSquare, bg: 'bg-emerald-100 text-emerald-600' },
  };
  
  const { icon: Icon, bg } = config[type] || config.note;
  
  return (
    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
      <Icon className="w-4 h-4" />
    </div>
  );
}
