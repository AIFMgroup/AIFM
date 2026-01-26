'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, Circle, 
  Search, Calendar, User, Tag,
  ArrowRight, Plus, MoreHorizontal, Bell,
  FileText, DollarSign, Users, Building2, Calculator
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskCategory = 'compliance' | 'accounting' | 'investor' | 'portfolio' | 'approval';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate?: Date;
  assignee?: string;
  linkedItem?: {
    type: string;
    name: string;
    href: string;
  };
  createdAt: Date;
}

// Mock tasks
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Godkänn Q4 utdelning',
    description: 'Vinstutdelning till 5 investerare - väntar på andra godkännande',
    status: 'in_progress',
    priority: 'high',
    category: 'approval',
    dueDate: new Date('2024-12-15'),
    assignee: 'Du',
    linkedItem: { type: 'Utdelning', name: 'Q4 2024', href: '/approvals' },
    createdAt: new Date('2024-11-25'),
  },
  {
    id: '2',
    title: 'Granska 30 transaktioner',
    description: 'AI-klassificerade transaktioner som behöver manuell granskning',
    status: 'todo',
    priority: 'medium',
    category: 'accounting',
    dueDate: new Date('2024-12-10'),
    assignee: 'Du',
    linkedItem: { type: 'Bokföring', name: 'November 2024', href: '/accounting/bookkeeping' },
    createdAt: new Date('2024-11-20'),
  },
  {
    id: '3',
    title: 'KYC-granskning krävs',
    description: 'Investor AB:s KYC-dokumentation har löpt ut',
    status: 'overdue',
    priority: 'high',
    category: 'compliance',
    dueDate: new Date('2024-11-30'),
    assignee: 'Anna Svensson',
    linkedItem: { type: 'Investerare', name: 'Investor AB', href: '/investors' },
    createdAt: new Date('2024-11-15'),
  },
  {
    id: '4',
    title: 'Uppdatera portföljvärdering',
    description: 'TechStartup AB behöver kvartalsvis värdering',
    status: 'todo',
    priority: 'medium',
    category: 'portfolio',
    dueDate: new Date('2024-12-20'),
    linkedItem: { type: 'Bolag', name: 'TechStartup AB', href: '/portfolio' },
    createdAt: new Date('2024-11-18'),
  },
  {
    id: '5',
    title: 'Skicka kvartalsrapport',
    description: 'Q3-rapporten ska skickas till alla investerare',
    status: 'done',
    priority: 'high',
    category: 'investor',
    assignee: 'Carl Johansson',
    linkedItem: { type: 'Rapport', name: 'Q3 2024', href: '/data-rooms' },
    createdAt: new Date('2024-10-01'),
  },
  {
    id: '6',
    title: 'Slutför bokslut',
    description: 'Förbered bokslut för räkenskapsåret 2024',
    status: 'todo',
    priority: 'low',
    category: 'accounting',
    dueDate: new Date('2024-12-31'),
    linkedItem: { type: 'Bokslut', name: '2024', href: '/accounting/closing' },
    createdAt: new Date('2024-11-01'),
  },
  {
    id: '7',
    title: 'Betala leverantörsfakturor',
    description: '3 fakturor förfaller inom 7 dagar',
    status: 'in_progress',
    priority: 'medium',
    category: 'accounting',
    dueDate: new Date('2024-12-08'),
    linkedItem: { type: 'Betalningar', name: 'December', href: '/accounting/payments' },
    createdAt: new Date('2024-12-01'),
  },
];

// Hero Metric Card
function HeroMetricCard({ 
  label, value, icon: Icon, variant = 'default', onClick
}: { 
  label: string; value: number; icon: React.ElementType; variant?: 'default' | 'primary' | 'warning' | 'danger'; onClick?: () => void;
}) {
  const styles = {
    default: 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50',
    primary: 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/30',
    danger: 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl shadow-red-500/30',
  };
  const isPrimary = variant !== 'default';

  return (
    <>
    <button 
      onClick={onClick}
      className={`group relative rounded-xl sm:rounded-2xl p-4 sm:p-5 transition-all duration-500 hover:-translate-y-0.5 w-full text-left ${styles[variant]}`}
    >
      <div className="relative">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors duration-300 ${isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'}`}>
            <Icon className={`w-4 h-4 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold'}`} />
          </div>
        </div>
        <p className={`text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-1 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>{label}</p>
        <p className={`text-2xl sm:text-3xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>{value}</p>
      </div>
    </button>
    </>  );
}

// Task Row Component
function TaskRow({ task, isSelected, onClick }: { task: Task; isSelected: boolean; onClick: () => void }) {
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'overdue': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'bg-red-50 text-red-600';
      case 'medium': return 'bg-amber-50 text-amber-600';
      case 'low': return 'bg-gray-100 text-gray-600';
    }
  };

  const getCategoryIcon = (category: TaskCategory) => {
    switch (category) {
      case 'compliance': return FileText;
      case 'accounting': return Calculator;
      case 'investor': return Users;
      case 'portfolio': return Building2;
      case 'approval': return DollarSign;
    }
  };

  const CategoryIcon = getCategoryIcon(task.category);
  const isOverdue = task.dueDate && task.dueDate < new Date() && task.status !== 'done';

  return (
    <>
    <div 
      onClick={onClick}
      className={`p-4 sm:p-5 cursor-pointer transition-all duration-300 ${
        isSelected ? 'bg-aifm-gold/5 border-l-4 border-aifm-gold' : 'hover:bg-gray-50/80 border-l-4 border-transparent'
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getStatusIcon(task.status)}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-medium ${task.status === 'done' ? 'text-aifm-charcoal/50 line-through' : 'text-aifm-charcoal'}`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-aifm-charcoal/50 mt-1 line-clamp-1">{task.description}</p>
              )}
            </div>
            <span className={`hidden sm:inline-flex px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
              {task.priority === 'high' ? 'Hög' : task.priority === 'medium' ? 'Medium' : 'Låg'}
            </span>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
            {/* Category */}
            <span className="flex items-center gap-1.5 text-xs text-aifm-charcoal/40">
              <CategoryIcon className="w-3.5 h-3.5" />
              {task.category === 'compliance' ? 'Compliance' :
               task.category === 'accounting' ? 'Bokföring' :
               task.category === 'investor' ? 'Investerare' :
               task.category === 'portfolio' ? 'Portfölj' : 'Godkännande'}
            </span>

            {/* Due Date */}
            {task.dueDate && (
              <span className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-aifm-charcoal/40'}`}>
                <Calendar className="w-3.5 h-3.5" />
                {task.dueDate.toLocaleDateString('sv-SE')}
                {isOverdue && ' (försenad)'}
              </span>
            )}

            {/* Assignee */}
            {task.assignee && (
              <span className="flex items-center gap-1.5 text-xs text-aifm-charcoal/40">
                <User className="w-3.5 h-3.5" />
                {task.assignee}
              </span>
            )}

            {/* Linked Item */}
            {task.linkedItem && (
              <Link 
                href={task.linkedItem.href}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-aifm-gold hover:text-aifm-gold/80"
              >
                <Tag className="w-3.5 h-3.5" />
                {task.linkedItem.name}
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
    </>  );
}

// Filter Tab
function FilterTab({ 
  label, count, isActive, onClick, variant = 'default' 
}: { 
  label: string; count: number; isActive: boolean; onClick: () => void; variant?: 'default' | 'warning' | 'danger';
}) {
  const baseStyles = isActive 
    ? 'bg-white shadow-lg text-aifm-charcoal' 
    : 'text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-white/50';
  
  const countStyles = variant === 'danger' 
    ? 'bg-red-100 text-red-600' 
    : variant === 'warning' 
      ? 'bg-amber-100 text-amber-600' 
      : isActive ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-100 text-aifm-charcoal/50';

  return (
    <>
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 ${baseStyles}`}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${countStyles}`}>
        {count}
      </span>
    </button>
    
    </>  );
}

export default function TasksPage() {
  const { selectedCompany } = useCompany();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Stats
  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const overdueCount = tasks.filter(t => t.status === 'overdue' || (t.dueDate && t.dueDate < new Date() && t.status !== 'done')).length;

  // Filter tasks
  const filteredTasks = tasks
    .filter(task => {
      if (filter === 'all') return true;
      if (filter === 'overdue') return task.status === 'overdue' || (task.dueDate && task.dueDate < new Date() && task.status !== 'done');
      return task.status === filter;
    })
    .filter(task => 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const markAsDone = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'done' as TaskStatus } : t));
    setSelectedTask(null);
  };

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-aifm-charcoal tracking-tight">Uppgifter</h1>
          <p className="text-aifm-charcoal/40 mt-1 text-sm">Hantera uppgifter för {selectedCompany.shortName}</p>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                           shadow-lg shadow-aifm-charcoal/20 transition-all self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Ny uppgift</span>
        </button>
      </div>

      {/* Hero Stats */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <HeroMetricCard 
          label="Alla uppgifter" 
          value={tasks.length}
          icon={CheckCircle2}
          variant="primary"
          onClick={() => setFilter('all')}
        />
        <HeroMetricCard 
          label="Att göra" 
          value={todoCount}
          icon={Circle}
          onClick={() => setFilter('todo')}
        />
        <HeroMetricCard 
          label="Pågående" 
          value={inProgressCount}
          icon={Clock}
          onClick={() => setFilter('in_progress')}
        />
        <HeroMetricCard 
          label="Försenade" 
          value={overdueCount}
          icon={AlertCircle}
          variant={overdueCount > 0 ? 'danger' : 'default'}
          onClick={() => setFilter('overdue')}
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-2">
          {/* Search & Filter */}
          <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Sök uppgifter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2.5 pl-11 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm
                             placeholder:text-aifm-charcoal/30 focus:outline-none focus:bg-white focus:border-aifm-gold/30 
                             focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2 bg-gray-100/80 rounded-xl p-1.5">
                <FilterTab label="Alla" count={tasks.length} isActive={filter === 'all'} onClick={() => setFilter('all')} />
                <FilterTab label="Att göra" count={todoCount} isActive={filter === 'todo'} onClick={() => setFilter('todo')} />
                <FilterTab label="Pågående" count={inProgressCount} isActive={filter === 'in_progress'} onClick={() => setFilter('in_progress')} />
                <FilterTab label="Försenade" count={overdueCount} isActive={filter === 'overdue'} onClick={() => setFilter('overdue')} variant="danger" />
                <FilterTab label="Klara" count={doneCount} isActive={filter === 'done'} onClick={() => setFilter('done')} />
              </div>
            </div>

            {/* Task List */}
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                  <p className="text-aifm-charcoal/50 font-medium">Inga uppgifter hittades</p>
                  <p className="text-aifm-charcoal/30 text-sm mt-1">Prova ett annat filter</p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <TaskRow 
                    key={task.id} 
                    task={task} 
                    isSelected={selectedTask?.id === task.id}
                    onClick={() => setSelectedTask(task)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Task Detail / Quick Actions */}
        <div className="space-y-6">
          {/* Selected Task Detail */}
          {selectedTask ? (
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5 sm:p-6 sticky top-24">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-aifm-charcoal">{selectedTask.title}</h3>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-aifm-charcoal/40" />
                </button>
              </div>

              {selectedTask.description && (
                <p className="text-sm text-aifm-charcoal/60 mb-6">{selectedTask.description}</p>
              )}

              <div className="space-y-4 mb-6">
                {selectedTask.dueDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-aifm-charcoal/40" />
                    <div>
                      <p className="text-xs text-aifm-charcoal/40">Deadline</p>
                      <p className="text-sm font-medium text-aifm-charcoal">{selectedTask.dueDate.toLocaleDateString('sv-SE')}</p>
                    </div>
                  </div>
                )}
                {selectedTask.assignee && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-aifm-charcoal/40" />
                    <div>
                      <p className="text-xs text-aifm-charcoal/40">Tilldelad</p>
                      <p className="text-sm font-medium text-aifm-charcoal">{selectedTask.assignee}</p>
                    </div>
                  </div>
                )}
                {selectedTask.linkedItem && (
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-aifm-charcoal/40" />
                    <div>
                      <p className="text-xs text-aifm-charcoal/40">Kopplad till</p>
                      <Link href={selectedTask.linkedItem.href} className="text-sm font-medium text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1">
                        {selectedTask.linkedItem.name} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {selectedTask.status !== 'done' && (
                <button 
                  onClick={() => markAsDone(selectedTask.id)}
                  className="w-full py-3 px-4 bg-emerald-500 text-white rounded-xl text-sm font-medium 
                             hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Markera som klar
                </button>
              )}
            </div>
          ) : (
            /* Quick Links */
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-4">Snabblänkar</h3>
              <div className="space-y-2">
                {[
                  { label: 'Godkännanden', href: '/approvals', icon: DollarSign, count: 3 },
                  { label: 'Bokföring', href: '/accounting/bookkeeping', icon: Calculator, count: 30 },
                  { label: 'Compliance', href: '/compliance/documents', icon: FileText, count: 2 },
                ].map((link) => (
                  <Link 
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-aifm-gold/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-aifm-charcoal/5 rounded-lg flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
                        <link.icon className="w-4 h-4 text-aifm-charcoal/50 group-hover:text-aifm-gold transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">{link.label}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-aifm-gold/10 text-aifm-gold rounded-full text-xs font-semibold">{link.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Notifications */}
          <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-5 sm:p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Bell className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h3 className="font-semibold">Påminnelser</h3>
                <p className="text-xs text-white/50">Aktivera notiser</p>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-4">
              Få påminnelser om förfallna uppgifter direkt i din e-post.
            </p>
            <button className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">
              Aktivera
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
