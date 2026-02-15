'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CrmLayout } from '@/components/crm/CrmLayout';
import { 
  Plus, Search, CheckSquare, Circle, Clock, AlertCircle, 
  User, Building2, Briefcase, Calendar, X, Save, Flag, Globe
} from 'lucide-react';
import type { Task, Contact, CrmCompany, Deal, TaskStatus, TaskPriority } from '@/lib/crm/types';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { sv } from 'date-fns/locale';

function TasksContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowForm(true);
      setSelectedTask(null);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Global CRM data - no companyId filter
        const [tasksRes, contactsRes, companiesRes, dealsRes] = await Promise.all([
          fetch('/api/crm/tasks'),
          fetch('/api/crm/contacts'),
          fetch('/api/crm/companies'),
          fetch('/api/crm/deals'),
        ]);

        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (contactsRes.ok) setContacts(await contactsRes.json());
        if (companiesRes.ok) setCompanies(await companiesRes.json());
        if (dealsRes.ok) setDeals(await dealsRes.json());
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && task.status !== 'completed' && task.status !== 'cancelled') ||
      task.status === statusFilter;

    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    // Sort by: overdue first, then by due date, then by priority
    const aOverdue = a.dueDate && isPast(parseISO(a.dueDate)) && a.status !== 'completed';
    const bOverdue = b.dueDate && isPast(parseISO(b.dueDate)) && b.status !== 'completed';
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    
    return 0;
  });

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === task.id 
        ? { ...t, status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined }
        : t
    ));

    try {
      await fetch('/api/crm/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
    } catch (error) {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const handleSave = async (data: Partial<Task>) => {
    try {
      if (selectedTask) {
        const res = await fetch('/api/crm/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: selectedTask.id }),
        });
        if (res.ok) {
          const updated = await res.json();
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        }
      } else {
        const res = await fetch('/api/crm/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          setTasks(prev => [created, ...prev]);
        }
      }
      setShowForm(false);
      setSelectedTask(null);
      router.replace('/crm/tasks');
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTask) return;

    try {
      const res = await fetch(`/api/crm/tasks?id=${selectedTask.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
        setShowForm(false);
        setSelectedTask(null);
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      low: 'text-aifm-charcoal/30',
      medium: 'text-aifm-gold',
      high: 'text-amber-500',
      urgent: 'text-red-500',
    };
    return colors[priority];
  };

  const getDueDateInfo = (dueDate?: string) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    
    if (isToday(date)) return { label: 'Idag', className: 'text-aifm-charcoal bg-aifm-gold/15' };
    if (isTomorrow(date)) return { label: 'Imorgon', className: 'text-aifm-charcoal bg-aifm-charcoal/5' };
    if (isPast(date)) return { label: 'Försenad', className: 'text-red-600 bg-red-50' };
    return { label: format(date, 'd MMM', { locale: sv }), className: 'text-aifm-charcoal/60 bg-aifm-charcoal/5' };
  };

  const stats = {
    overdue: tasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== 'completed' && t.status !== 'cancelled').length,
    today: tasks.filter(t => t.dueDate && isToday(parseISO(t.dueDate)) && t.status !== 'completed').length,
    upcoming: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <CrmLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-aifm-charcoal tracking-tight">Uppgifter</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm">
              {stats.overdue > 0 && (
                <span className="text-red-600 font-medium">{stats.overdue} försenade</span>
              )}
              {stats.today > 0 && (
                <span className="text-aifm-gold font-medium">{stats.today} idag</span>
              )}
              <span className="text-aifm-charcoal/40">{stats.upcoming} öppna</span>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white text-sm font-medium rounded-full hover:bg-aifm-charcoal/90 transition-all shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Ny uppgift
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök uppgifter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
            />
          </div>
          <div className="flex gap-2 sm:gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors bg-white"
            >
              <option value="active">Aktiva</option>
              <option value="all">Alla</option>
              <option value="todo">Att göra</option>
              <option value="in_progress">Pågående</option>
              <option value="waiting">Väntar</option>
              <option value="completed">Slutförda</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors bg-white"
            >
              <option value="all">Prioritet</option>
              <option value="urgent">Brådskande</option>
              <option value="high">Hög</option>
              <option value="medium">Medium</option>
              <option value="low">Låg</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task List */}
          <div className={`${showForm ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-aifm-charcoal/5 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CheckSquare className="w-8 h-8 text-aifm-charcoal/20" />
                </div>
                <h3 className="text-lg font-medium text-aifm-charcoal mb-1">Inga uppgifter</h3>
                <p className="text-aifm-charcoal/40 mb-4">
                  {searchQuery ? 'Inga uppgifter matchar din sökning' : 'Lägg till din första uppgift'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white text-sm font-medium rounded-full hover:bg-aifm-charcoal/90 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Ny uppgift
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                {filteredTasks.map((task) => {
                  const dueDateInfo = getDueDateInfo(task.dueDate);
                  const isCompleted = task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors ${
                        isCompleted ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {isCompleted && <CheckSquare className="w-3 h-3" />}
                      </button>

                      {/* Content */}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setSelectedTask(task);
                          setShowForm(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className={`font-medium text-aifm-charcoal ${isCompleted ? 'line-through' : ''}`}>
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-sm text-aifm-charcoal/40 mt-0.5 line-clamp-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              {task.contactName && (
                                <span className="flex items-center gap-1 text-aifm-charcoal/40">
                                  <User className="w-3 h-3" />
                                  {task.contactName}
                                </span>
                              )}
                              {task.crmCompanyName && (
                                <span className="flex items-center gap-1 text-aifm-charcoal/40">
                                  <Building2 className="w-3 h-3" />
                                  {task.crmCompanyName}
                                </span>
                              )}
                              {task.dealName && (
                                <span className="flex items-center gap-1 text-aifm-charcoal/40">
                                  <Briefcase className="w-3 h-3" />
                                  {task.dealName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Flag className={`w-4 h-4 ${getPriorityColor(task.priority)}`} />
                            {dueDateInfo && (
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${dueDateInfo.className}`}>
                                {dueDateInfo.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Sidebar - Mobile: Full screen overlay, Desktop: Side panel */}
          {showForm && (
            <div className="fixed inset-0 z-50 md:static md:z-auto lg:col-span-1">
              {/* Mobile backdrop */}
              <div className="absolute inset-0 bg-black/50 md:hidden" onClick={() => { setShowForm(false); setSelectedTask(null); router.replace('/crm/tasks'); }} />
              <div className="absolute inset-x-0 bottom-0 top-16 md:static bg-white rounded-t-2xl md:rounded-2xl border border-gray-100 p-4 sm:p-6 overflow-y-auto md:sticky md:top-4">
                <TaskForm
                  task={selectedTask}
                  contacts={contacts}
                  companies={companies}
                  deals={deals}
                  onSave={handleSave}
                  onDelete={selectedTask ? handleDelete : undefined}
                  onCancel={() => {
                    setShowForm(false);
                    setSelectedTask(null);
                    router.replace('/crm/tasks');
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </CrmLayout>
  );
}

// Task Form Component
interface TaskFormProps {
  task?: Task | null;
  contacts: Contact[];
  companies: CrmCompany[];
  deals: Deal[];
  onSave: (data: Partial<Task>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

function TaskForm({ task, contacts, companies, deals, onSave, onDelete, onCancel }: TaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    dueDate: task?.dueDate || '',
    dueTime: task?.dueTime || '',
    contactId: task?.contactId || '',
    crmCompanyId: task?.crmCompanyId || '',
    dealId: task?.dealId || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const contact = contacts.find(c => c.id === formData.contactId);
      const company = companies.find(c => c.id === formData.crmCompanyId);
      const deal = deals.find(d => d.id === formData.dealId);

      await onSave({
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status as Task['status'],
        priority: formData.priority as Task['priority'],
        dueDate: formData.dueDate || undefined,
        dueTime: formData.dueTime || undefined,
        contactId: formData.contactId || undefined,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
        crmCompanyId: formData.crmCompanyId || undefined,
        crmCompanyName: company?.name,
        dealId: formData.dealId || undefined,
        dealName: deal?.name,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-aifm-charcoal" />
          </div>
          <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">
            {task ? 'Redigera uppgift' : 'Ny uppgift'}
          </h2>
        </div>
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-aifm-charcoal/30 hover:text-aifm-charcoal hover:bg-aifm-charcoal/5 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">
          Titel <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">Beskrivning</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="todo">Att göra</option>
            <option value="in_progress">Pågående</option>
            <option value="waiting">Väntar</option>
            <option value="completed">Slutförd</option>
            <option value="cancelled">Avbruten</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">Prioritet</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="low">Låg</option>
            <option value="medium">Medium</option>
            <option value="high">Hög</option>
            <option value="urgent">Brådskande</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">
            <Calendar className="w-4 h-4 inline mr-1" />
            Förfallodatum
          </label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">
            <Clock className="w-4 h-4 inline mr-1" />
            Tid
          </label>
          <input
            type="time"
            value={formData.dueTime}
            onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">
          <User className="w-4 h-4 inline mr-1" />
          Kontakt
        </label>
        <select
          value={formData.contactId}
          onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
        >
          <option value="">Välj kontakt...</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.firstName} {contact.lastName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">
          <Building2 className="w-4 h-4 inline mr-1" />
          Företag
        </label>
        <select
          value={formData.crmCompanyId}
          onChange={(e) => setFormData({ ...formData, crmCompanyId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
        >
          <option value="">Välj företag...</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-aifm-charcoal/70 mb-1">
          <Briefcase className="w-4 h-4 inline mr-1" />
          Affär
        </label>
        <select
          value={formData.dealId}
          onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c0a280] focus:border-transparent"
        >
          <option value="">Välj affär...</option>
          {deals.filter(d => d.status === 'open').map((deal) => (
            <option key={deal.id} value={deal.id}>{deal.name}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t border-gray-100">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
          >
            Ta bort
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm font-medium transition-all"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title}
            className="px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {task ? 'Spara' : 'Skapa'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <CrmLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
        </div>
      </CrmLayout>
    }>
      <TasksContent />
    </Suspense>
  );
}

