'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertTriangle, Calendar, Users,
  FileText, ArrowRight, ChevronRight, Bell, Filter,
  BarChart3, TrendingUp, Zap, Play, X, Star,
  CircleDot, CheckSquare, Square, RefreshCw, Eye,
  GitBranch, Activity, Target, Briefcase, ShieldCheck,
  Building2, DollarSign, FileCheck, ArrowUpRight
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type TaskPriority = 'high' | 'medium' | 'low';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
type TaskCategory = 'approval' | 'document' | 'report' | 'compliance' | 'meeting' | 'workflow' | 'other';

interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  entityName?: string;
  assignedBy?: string;
  link?: string;
  linkedEntity?: string;
}

interface Deadline {
  id: string;
  title: string;
  date: string;
  type: 'report' | 'filing' | 'meeting' | 'review';
  entity?: string;
}

interface WorkflowTask {
  id: string;
  workflowName: string;
  stepName: string;
  description: string;
  status: 'waiting' | 'active' | 'blocked';
  startedAt: string;
  dueDate?: string;
  progress: number;
  totalSteps: number;
  currentStep: number;
  assignedTo: string;
  link: string;
}

interface MonitoringItem {
  id: string;
  name: string;
  type: 'fund' | 'compliance' | 'threshold' | 'deadline';
  status: 'normal' | 'warning' | 'critical';
  value: string;
  change?: string;
  lastUpdated: string;
  link: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockTasks: Task[] = [
  { 
    id: 't1', 
    title: 'Godkänn faktura från KPMG', 
    description: 'Årsrevisionsavgift Q4 2024 - 245 000 kr',
    category: 'approval',
    priority: 'high',
    status: 'pending',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    entityName: 'Nordic Fund I',
    link: '/approvals'
  },
  { 
    id: 't2', 
    title: 'Granska NAV-beräkning', 
    description: 'Kvartalsvis NAV för Q4 2024',
    category: 'report',
    priority: 'high',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    entityName: 'Nordic Fund I',
    assignedBy: 'Erik Johansson',
    link: '/nav-calculation'
  },
  { 
    id: 't3', 
    title: 'Ladda upp portföljrapport', 
    description: 'Q4 2024 portföljöversikt till datarum',
    category: 'document',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    entityName: 'Baltic Real Estate',
    link: '/data-rooms'
  },
  { 
    id: 't4', 
    title: 'Godkänn distribution', 
    description: 'Vinstutdelning till 5 investerare - 15 MSEK',
    category: 'approval',
    priority: 'high',
    status: 'pending',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    entityName: 'Nordic Fund I',
    link: '/approvals'
  },
  { 
    id: 't5', 
    title: 'Compliance-checklista', 
    description: 'Kvartalsvis compliance-granskning',
    category: 'compliance',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    link: '/compliance'
  },
  { 
    id: 't6', 
    title: 'Signera avtal med ny investerare', 
    description: 'Pensionsstiftelsen X - Subscription Agreement',
    category: 'document',
    priority: 'medium',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    assignedBy: 'Anna Svensson',
    link: '/data-rooms'
  },
  { 
    id: 't7', 
    title: 'Förbereda styrelsematerial', 
    description: 'Underlag för styrelsemöte 15 januari',
    category: 'meeting',
    priority: 'low',
    status: 'pending',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    entityName: 'Nordic Fund I'
  },
  { 
    id: 't8', 
    title: 'Verifiera KYC-dokumentation', 
    description: 'Ny investerare - Familjen Andersson',
    category: 'compliance',
    priority: 'medium',
    status: 'overdue',
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    link: '/compliance'
  },
];

const mockDeadlines: Deadline[] = [
  { id: 'd1', title: 'FI-rapportering', date: '2025-01-15', type: 'filing', entity: 'Nordic Fund I' },
  { id: 'd2', title: 'Kvartalsrapport Q4', date: '2025-01-17', type: 'report', entity: 'Alla fonder' },
  { id: 'd3', title: 'Styrelsemöte', date: '2025-01-15', type: 'meeting', entity: 'Nordic Fund I' },
  { id: 'd4', title: 'Momsdeklaration', date: '2025-01-26', type: 'filing' },
  { id: 'd5', title: 'Compliance review', date: '2025-01-20', type: 'review' },
];

const mockWorkflowTasks: WorkflowTask[] = [
  {
    id: 'wf1',
    workflowName: 'NAV-beräkning Q4 2024',
    stepName: 'Granska värderingar',
    description: 'Verifiera portföljvärderingar innan NAV-beräkning',
    status: 'active',
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 60,
    totalSteps: 5,
    currentStep: 3,
    assignedTo: 'Du',
    link: '/admin/workflows'
  },
  {
    id: 'wf2',
    workflowName: 'Årsredovisning 2024',
    stepName: 'Samla underlag',
    description: 'Hämta alla nödvändiga dokument för årsredovisning',
    status: 'waiting',
    startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 20,
    totalSteps: 8,
    currentStep: 2,
    assignedTo: 'Väntar på Erik',
    link: '/admin/workflows'
  },
  {
    id: 'wf3',
    workflowName: 'KYC-uppdatering',
    stepName: 'Verifiera dokument',
    description: 'Granska inlämnade KYC-dokument för Pensionsstiftelsen X',
    status: 'active',
    startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 33,
    totalSteps: 6,
    currentStep: 2,
    assignedTo: 'Du',
    link: '/compliance'
  },
];

const mockMonitoringItems: MonitoringItem[] = [
  {
    id: 'm1',
    name: 'Nordic Fund I - NAV',
    type: 'fund',
    status: 'normal',
    value: '542.8 MSEK',
    change: '+2.3%',
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    link: '/nav-calculation'
  },
  {
    id: 'm2',
    name: 'AML-övervakning',
    type: 'compliance',
    status: 'warning',
    value: '2 ärenden',
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    link: '/compliance'
  },
  {
    id: 'm3',
    name: 'Likviditetströskel',
    type: 'threshold',
    status: 'normal',
    value: '15.2%',
    change: '-0.5%',
    lastUpdated: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    link: '/dashboard'
  },
  {
    id: 'm4',
    name: 'FI-rapportdeadline',
    type: 'deadline',
    status: 'warning',
    value: '6 dagar kvar',
    lastUpdated: new Date().toISOString(),
    link: '/compliance'
  },
  {
    id: 'm5',
    name: 'Baltic RE - NAV',
    type: 'fund',
    status: 'normal',
    value: '328.5 MSEK',
    change: '+1.1%',
    lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    link: '/nav-calculation'
  },
];

// ============================================================================
// Helper Components
// ============================================================================

const priorityConfig: Record<TaskPriority, { color: string; label: string }> = {
  high: { color: 'bg-red-100 text-red-700', label: 'Hög' },
  medium: { color: 'bg-amber-100 text-amber-700', label: 'Medium' },
  low: { color: 'bg-gray-100 text-gray-600', label: 'Låg' },
};

const categoryConfig: Record<TaskCategory, { icon: typeof CheckCircle2; color: string; label: string }> = {
  approval: { icon: CheckSquare, color: 'bg-purple-100 text-purple-600', label: 'Godkännande' },
  document: { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Dokument' },
  report: { icon: BarChart3, color: 'bg-emerald-100 text-emerald-600', label: 'Rapport' },
  compliance: { icon: ShieldCheck, color: 'bg-amber-100 text-amber-600', label: 'Compliance' },
  meeting: { icon: Users, color: 'bg-indigo-100 text-indigo-600', label: 'Möte' },
  workflow: { icon: GitBranch, color: 'bg-cyan-100 text-cyan-600', label: 'Arbetsflöde' },
  other: { icon: CircleDot, color: 'bg-gray-100 text-gray-600', label: 'Övrigt' },
};

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: `${Math.abs(days)}d försenad`, isOverdue: true };
  if (days === 0) return { text: 'Idag', isUrgent: true };
  if (days === 1) return { text: 'Imorgon', isUrgent: true };
  if (days <= 7) return { text: `${days} dagar kvar`, isUrgent: days <= 2 };
  return { text: date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) };
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return 'Just nu';
  if (minutes < 60) return `${minutes} min sedan`;
  if (hours < 24) return `${hours}h sedan`;
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function TaskCard({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const config = categoryConfig[task.category];
  const Icon = config.icon;
  const due = formatDueDate(task.dueDate);

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-lg group ${
      task.status === 'overdue' || due.isOverdue ? 'bg-red-50 border-red-200' :
      task.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
      'bg-white border-gray-100 hover:border-aifm-gold/30'
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(task.id)}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                     transition-all ${
                       task.status === 'completed'
                         ? 'bg-emerald-500 border-emerald-500'
                         : 'border-gray-300 hover:border-aifm-gold hover:bg-aifm-gold/10'
                     }`}
        >
          {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-white" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-aifm-charcoal'}`}>
                {task.title}
              </h3>
              <p className="text-xs text-aifm-charcoal/50 mt-0.5 line-clamp-1">{task.description}</p>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${priorityConfig[task.priority].color}`}>
              {priorityConfig[task.priority].label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs">
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.color}`}>
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </span>
            {task.entityName && (
              <span className="text-aifm-charcoal/40">{task.entityName}</span>
            )}
            <span className={`ml-auto font-medium ${
              due.isOverdue ? 'text-red-600' : due.isUrgent ? 'text-amber-600' : 'text-aifm-charcoal/40'
            }`}>
              <Clock className="w-3 h-3 inline mr-1" />
              {due.text}
            </span>
          </div>

          {task.link && task.status !== 'completed' && (
            <Link 
              href={task.link}
              className="mt-3 inline-flex items-center gap-1 text-xs text-aifm-gold hover:underline"
            >
              Öppna <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function DeadlineItem({ deadline }: { deadline: Deadline }) {
  const date = new Date(deadline.date);
  const now = new Date();
  const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysUntil <= 3;

  const typeColors: Record<string, string> = {
    report: 'bg-purple-100 text-purple-600',
    filing: 'bg-red-100 text-red-600',
    meeting: 'bg-blue-100 text-blue-600',
    review: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
        isUrgent ? 'bg-red-100' : 'bg-gray-100'
      }`}>
        <span className={`text-lg font-bold leading-none ${isUrgent ? 'text-red-600' : 'text-aifm-charcoal'}`}>
          {date.getDate()}
        </span>
        <span className={`text-[10px] uppercase ${isUrgent ? 'text-red-600/70' : 'text-aifm-charcoal/50'}`}>
          {date.toLocaleDateString('sv-SE', { month: 'short' })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-aifm-charcoal truncate">{deadline.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColors[deadline.type]}`}>
            {deadline.type === 'report' ? 'Rapport' : 
             deadline.type === 'filing' ? 'Inlämning' :
             deadline.type === 'meeting' ? 'Möte' : 'Granskning'}
          </span>
          {deadline.entity && (
            <span className="text-xs text-aifm-charcoal/40">{deadline.entity}</span>
          )}
        </div>
      </div>
      <span className={`text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-aifm-charcoal/40'}`}>
        {daysUntil <= 0 ? 'Idag' : `${daysUntil}d`}
      </span>
    </div>
  );
}

function WorkflowTaskCard({ task }: { task: WorkflowTask }) {
  const statusColors = {
    waiting: 'bg-gray-100 text-gray-600',
    active: 'bg-emerald-100 text-emerald-600',
    blocked: 'bg-red-100 text-red-600'
  };

  const statusLabels = {
    waiting: 'Väntar',
    active: 'Aktiv',
    blocked: 'Blockerad'
  };

  return (
    <Link 
      href={task.link}
      className="block p-4 bg-white border border-gray-100 rounded-xl hover:border-aifm-gold/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs text-aifm-charcoal/40 mb-1">{task.workflowName}</p>
          <h4 className="font-medium text-aifm-charcoal">{task.stepName}</h4>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[task.status]}`}>
          {statusLabels[task.status]}
        </span>
      </div>
      
      <p className="text-xs text-aifm-charcoal/50 mb-3 line-clamp-2">{task.description}</p>
      
      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-aifm-charcoal/40 mb-1">
          <span>Steg {task.currentStep} av {task.totalSteps}</span>
          <span>{task.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-aifm-gold rounded-full transition-all"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-aifm-charcoal/40">{task.assignedTo}</span>
        {task.dueDate && (
          <span className={`font-medium ${
            new Date(task.dueDate) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) 
              ? 'text-amber-600' 
              : 'text-aifm-charcoal/40'
          }`}>
            {formatDueDate(task.dueDate).text}
          </span>
        )}
      </div>
    </Link>
  );
}

function MonitoringCard({ item }: { item: MonitoringItem }) {
  const statusConfig = {
    normal: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
    critical: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' }
  };

  const typeIcons = {
    fund: DollarSign,
    compliance: ShieldCheck,
    threshold: Target,
    deadline: Clock
  };

  const Icon = typeIcons[item.type];
  const config = statusConfig[item.status];

  return (
    <Link 
      href={item.link}
      className={`block p-4 ${config.bg} border ${config.border} rounded-xl hover:shadow-md transition-all group`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-aifm-charcoal/60" />
          </div>
          <div>
            <p className="font-medium text-sm text-aifm-charcoal">{item.name}</p>
            <p className="text-xs text-aifm-charcoal/40">{formatTimeAgo(item.lastUpdated)}</p>
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${config.dot} animate-pulse`} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xl font-semibold text-aifm-charcoal">{item.value}</p>
          {item.change && (
            <span className={`text-xs font-medium ${
              item.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {item.change}
            </span>
          )}
        </div>
        <ArrowUpRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold transition-colors" />
      </div>
    </Link>
  );
}

// ============================================================================
// Filter Tabs
// ============================================================================

type FilterTab = 'all' | 'pending' | 'in_progress' | 'overdue';

function FilterTabs({ activeTab, onTabChange, counts }: {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  const tabs: { id: FilterTab; label: string; color?: string }[] = [
    { id: 'all', label: 'Alla' },
    { id: 'pending', label: 'Att göra' },
    { id: 'in_progress', label: 'Pågående' },
    { id: 'overdue', label: 'Försenade', color: 'text-red-600' },
  ];

  return (
    <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-white text-aifm-charcoal shadow-sm'
              : `text-aifm-charcoal/50 hover:text-aifm-charcoal ${tab.color || ''}`
          }`}
        >
          {tab.label}
          {counts[tab.id] > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeTab === tab.id 
                ? tab.id === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-aifm-gold/20 text-aifm-gold'
                : tab.id === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeSection, setActiveSection] = useState<'tasks' | 'workflows' | 'monitoring'>('tasks');

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    if (!showCompleted) {
      filtered = filtered.filter(t => t.status !== 'completed');
    }

    if (activeTab === 'pending') {
      filtered = filtered.filter(t => t.status === 'pending');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status === 'in_progress');
    } else if (activeTab === 'overdue') {
      filtered = filtered.filter(t => t.status === 'overdue' || 
        (t.status !== 'completed' && new Date(t.dueDate) < new Date()));
    }

    // Sort by priority and due date
    return filtered.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, activeTab, showCompleted]);

  const counts: Record<FilterTab, number> = useMemo(() => ({
    all: tasks.filter(t => t.status !== 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.status === 'overdue' || 
      (t.status !== 'completed' && new Date(t.dueDate) < new Date())).length,
  }), [tasks]);

  const handleComplete = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
        : t
    ));
  };

  const urgentCount = tasks.filter(t => 
    t.status !== 'completed' && 
    (t.priority === 'high' || new Date(t.dueDate) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
  ).length;

  const activeWorkflows = mockWorkflowTasks.filter(w => w.status === 'active').length;
  const warningMonitoring = mockMonitoringItems.filter(m => m.status === 'warning' || m.status === 'critical').length;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <CheckSquare className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Mina uppgifter</h1>
            <p className="text-sm text-aifm-charcoal/50">Vad behöver du göra idag?</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl
                          text-sm font-medium hover:bg-aifm-charcoal/90 transition-all">
          <RefreshCw className="w-4 h-4" />
          Uppdatera
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/90 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-white/70" />
            <span className="text-xs text-white/70 uppercase tracking-wider font-semibold">Brådskande</span>
          </div>
          <p className="text-3xl font-bold">{urgentCount}</p>
          <p className="text-xs text-white/60 mt-1">uppgifter kräver åtgärd</p>
        </div>
        <button 
          onClick={() => setActiveSection('workflows')}
          className={`text-left rounded-2xl border p-5 transition-all ${
            activeSection === 'workflows' 
              ? 'bg-cyan-50 border-cyan-200' 
              : 'bg-white border-gray-100 hover:border-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-5 h-5 text-cyan-500" />
            <span className="text-xs text-aifm-charcoal/40 uppercase tracking-wider font-semibold">Arbetsflöden</span>
          </div>
          <p className="text-3xl font-semibold text-aifm-charcoal">{activeWorkflows}</p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">aktiva uppgifter</p>
        </button>
        <button 
          onClick={() => setActiveSection('monitoring')}
          className={`text-left rounded-2xl border p-5 transition-all ${
            activeSection === 'monitoring' 
              ? 'bg-amber-50 border-amber-200' 
              : 'bg-white border-gray-100 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-amber-500" />
            <span className="text-xs text-aifm-charcoal/40 uppercase tracking-wider font-semibold">Övervakning</span>
          </div>
          <p className="text-3xl font-semibold text-amber-600">{warningMonitoring}</p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">varningar</p>
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-xs text-aifm-charcoal/40 uppercase tracking-wider font-semibold">Slutförda</span>
          </div>
          <p className="text-3xl font-semibold text-emerald-600">
            {tasks.filter(t => t.status === 'completed').length}
          </p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">denna vecka</p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="bg-gray-100/80 rounded-xl p-1 inline-flex mb-6">
        <button
          onClick={() => setActiveSection('tasks')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeSection === 'tasks' ? 'bg-white text-aifm-charcoal shadow-sm' : 'text-aifm-charcoal/50'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Uppgifter
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeSection === 'tasks' ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-200 text-gray-600'
          }`}>{counts.all}</span>
        </button>
        <button
          onClick={() => setActiveSection('workflows')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeSection === 'workflows' ? 'bg-white text-aifm-charcoal shadow-sm' : 'text-aifm-charcoal/50'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          Arbetsflöden
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            activeSection === 'workflows' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-200 text-gray-600'
          }`}>{mockWorkflowTasks.length}</span>
        </button>
        <button
          onClick={() => setActiveSection('monitoring')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeSection === 'monitoring' ? 'bg-white text-aifm-charcoal shadow-sm' : 'text-aifm-charcoal/50'
          }`}
        >
          <Eye className="w-4 h-4" />
          Övervakning
          {warningMonitoring > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeSection === 'monitoring' ? 'bg-amber-100 text-amber-700' : 'bg-amber-100 text-amber-700'
            }`}>{warningMonitoring}</span>
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tasks Section */}
          {activeSection === 'tasks' && (
            <>
              <div className="flex items-center justify-between">
                <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
                <label className="flex items-center gap-2 text-sm text-aifm-charcoal/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                  Visa avklarade
                </label>
              </div>

              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                    <p className="text-aifm-charcoal/60 font-medium">Inga uppgifter att visa</p>
                    <p className="text-sm text-aifm-charcoal/40 mt-1">
                      {activeTab === 'overdue' ? 'Inga försenade uppgifter - bra jobbat!' : 'Alla uppgifter är avklarade'}
                    </p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete} />
                  ))
                )}
              </div>
            </>
          )}

          {/* Workflows Section */}
          {activeSection === 'workflows' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-aifm-charcoal">Aktiva arbetsflöden</h3>
                <Link href="/admin/workflows" className="text-sm text-aifm-gold hover:underline">
                  Se alla →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {mockWorkflowTasks.map(task => (
                  <WorkflowTaskCard key={task.id} task={task} />
                ))}
              </div>
            </>
          )}

          {/* Monitoring Section */}
          {activeSection === 'monitoring' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-aifm-charcoal">Övervakade objekt</h3>
                <Link href="/dashboard" className="text-sm text-aifm-gold hover:underline">
                  Dashboard →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {mockMonitoringItems.map(item => (
                  <MonitoringCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-aifm-charcoal/50 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Kommande deadlines
              </h3>
              <Link href="/crm/calendar" className="text-xs text-aifm-gold hover:underline">
                Kalender →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {mockDeadlines.slice(0, 5).map(deadline => (
                <DeadlineItem key={deadline.id} deadline={deadline} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">
              Snabbåtgärder
            </h3>
            <div className="space-y-2">
              <Link 
                href="/approvals"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-aifm-gold/10 
                          hover:border-aifm-gold/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center
                              group-hover:bg-aifm-gold/20 transition-colors">
                  <CheckSquare className="w-5 h-5 text-purple-600 group-hover:text-aifm-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-aifm-charcoal">Godkännanden</p>
                  <p className="text-xs text-aifm-charcoal/40">3 väntar på dig</p>
                </div>
                <ChevronRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold" />
              </Link>
              <Link 
                href="/accounting"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-aifm-gold/10 
                          hover:border-aifm-gold/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center
                              group-hover:bg-aifm-gold/20 transition-colors">
                  <FileText className="w-5 h-5 text-blue-600 group-hover:text-aifm-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-aifm-charcoal">Bokföring</p>
                  <p className="text-xs text-aifm-charcoal/40">12 nya fakturor</p>
                </div>
                <ChevronRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold" />
              </Link>
              <Link 
                href="/admin/workflows"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-aifm-gold/10 
                          hover:border-aifm-gold/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center
                              group-hover:bg-aifm-gold/20 transition-colors">
                  <GitBranch className="w-5 h-5 text-cyan-600 group-hover:text-aifm-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-aifm-charcoal">Arbetsflöden</p>
                  <p className="text-xs text-aifm-charcoal/40">{activeWorkflows} aktiva</p>
                </div>
                <ChevronRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold" />
              </Link>
              <Link 
                href="/compliance"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-aifm-gold/10 
                          hover:border-aifm-gold/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center
                              group-hover:bg-aifm-gold/20 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 group-hover:text-aifm-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-aifm-charcoal">Compliance</p>
                  <p className="text-xs text-aifm-charcoal/40">Allt i ordning</p>
                </div>
                <ChevronRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
