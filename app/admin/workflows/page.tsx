'use client';

import { useState } from 'react';
import { 
  Workflow, Plus, Play, Pause, Settings, Trash2,
  CheckCircle2, Clock, AlertTriangle, Users, FileText,
  Calendar, Bell, ArrowRight, ChevronRight, X,
  BarChart3, RefreshCw, Copy, Edit, Eye, Zap
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type WorkflowStatus = 'active' | 'paused' | 'draft';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  assigneeRole: string;
  dueOffset: number; // days from workflow start
  dependencies: string[]; // step ids
  actions: string[];
}

interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'reporting' | 'compliance' | 'closing' | 'audit';
  steps: WorkflowStep[];
  estimatedDays: number;
  status: WorkflowStatus;
  createdAt: string;
  lastModified: string;
  usageCount: number;
}

interface ActiveWorkflow {
  id: string;
  templateId: string;
  templateName: string;
  entityName: string; // e.g., "Nordic Fund I" or "Q4 2024"
  startedAt: string;
  dueDate: string;
  progress: number;
  currentStep: string;
  assignee: string;
  status: TaskStatus;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockTemplates: PlaybookTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Kvartalsrapportering',
    description: 'Standardprocess för kvartalsvis rapportering till FI och investerare',
    category: 'reporting',
    steps: [
      { id: 's1', title: 'Samla in data från portföljbolag', description: 'Begär kvartalsdata från alla portföljbolag', assigneeRole: 'analyst', dueOffset: 5, dependencies: [], actions: ['Skicka datainsamlingsmall', 'Följ upp med påminnelser'] },
      { id: 's2', title: 'Validera och konsolidera data', description: 'Granska inkommande data för korrekthet', assigneeRole: 'accountant', dueOffset: 10, dependencies: ['s1'], actions: ['Kör valideringsregler', 'Flagga avvikelser'] },
      { id: 's3', title: 'NAV-beräkning', description: 'Beräkna och verifiera NAV för perioden', assigneeRole: 'manager', dueOffset: 12, dependencies: ['s2'], actions: ['Beräkna NAV', 'Dokumentera antaganden'] },
      { id: 's4', title: 'Första godkännande', description: 'Manager granskar och godkänner', assigneeRole: 'manager', dueOffset: 14, dependencies: ['s3'], actions: ['Granska rapport', 'Godkänn eller returnera'] },
      { id: 's5', title: 'Andra godkännande', description: 'CFO/VD slutgodkänner', assigneeRole: 'executive', dueOffset: 15, dependencies: ['s4'], actions: ['Slutgiltigt godkännande'] },
      { id: 's6', title: 'Publicera rapport', description: 'Distribuera till investerare och FI', assigneeRole: 'admin', dueOffset: 16, dependencies: ['s5'], actions: ['Publicera i datarum', 'Skicka notifiering'] },
    ],
    estimatedDays: 16,
    status: 'active',
    createdAt: '2024-01-15',
    lastModified: '2024-11-01',
    usageCount: 12,
  },
  {
    id: 'tpl-2',
    name: 'Ny kund-onboarding',
    description: 'Komplett onboarding-process för nya fondkunder',
    category: 'onboarding',
    steps: [
      { id: 's1', title: 'Inledande möte och behovsanalys', description: 'Möte för att förstå kundens behov', assigneeRole: 'manager', dueOffset: 0, dependencies: [], actions: ['Boka möte', 'Dokumentera behov'] },
      { id: 's2', title: 'KYC och due diligence', description: 'Samla in och verifiera kundinformation', assigneeRole: 'compliance', dueOffset: 5, dependencies: ['s1'], actions: ['Begär KYC-dokumentation', 'Verifiera identitet'] },
      { id: 's3', title: 'Avtalsgranskning', description: 'Upprätta och granska avtal', assigneeRole: 'legal', dueOffset: 10, dependencies: ['s2'], actions: ['Upprätta avtal', 'Skicka för signering'] },
      { id: 's4', title: 'Systemkonfiguration', description: 'Skapa konton och konfigurera system', assigneeRole: 'admin', dueOffset: 12, dependencies: ['s3'], actions: ['Skapa användarkonton', 'Konfigurera behörigheter'] },
      { id: 's5', title: 'Utbildning', description: 'Genomför utbildning för kunden', assigneeRole: 'support', dueOffset: 14, dependencies: ['s4'], actions: ['Boka utbildning', 'Skicka dokumentation'] },
    ],
    estimatedDays: 14,
    status: 'active',
    createdAt: '2024-02-01',
    lastModified: '2024-10-15',
    usageCount: 8,
  },
  {
    id: 'tpl-3',
    name: 'Årsbokslut',
    description: 'Fullständig process för årsbokslut och årsredovisning',
    category: 'closing',
    steps: [
      { id: 's1', title: 'Periodstängning december', description: 'Stäng alla poster för räkenskapsåret', assigneeRole: 'accountant', dueOffset: 10, dependencies: [], actions: ['Stäng period', 'Verifiera saldon'] },
      { id: 's2', title: 'Avstämningar', description: 'Genomför alla erforderliga avstämningar', assigneeRole: 'accountant', dueOffset: 15, dependencies: ['s1'], actions: ['Bank', 'Fordringar', 'Skulder'] },
      { id: 's3', title: 'Värderingar', description: 'Slutliga värderingar av innehav', assigneeRole: 'analyst', dueOffset: 20, dependencies: ['s2'], actions: ['Marknadsvärdering', 'Nedskrivningsbedömning'] },
      { id: 's4', title: 'Upprätta årsredovisning', description: 'Färdigställ årsredovisning', assigneeRole: 'accountant', dueOffset: 30, dependencies: ['s3'], actions: ['Resultaträkning', 'Balansräkning', 'Noter'] },
      { id: 's5', title: 'Revision', description: 'Extern revisor granskar', assigneeRole: 'external', dueOffset: 45, dependencies: ['s4'], actions: ['Revisionsmöten', 'Besvara frågor'] },
      { id: 's6', title: 'Styrelsegodkännande', description: 'Styrelsen godkänner årsredovisningen', assigneeRole: 'board', dueOffset: 50, dependencies: ['s5'], actions: ['Styrelseprotokoll'] },
    ],
    estimatedDays: 50,
    status: 'active',
    createdAt: '2023-12-01',
    lastModified: '2024-09-01',
    usageCount: 4,
  },
  {
    id: 'tpl-4',
    name: 'Compliance-granskning',
    description: 'Kvartalsvis intern compliance-granskning',
    category: 'compliance',
    steps: [
      { id: 's1', title: 'Planering', description: 'Definiera granskningsomfång', assigneeRole: 'compliance', dueOffset: 2, dependencies: [], actions: ['Välj områden', 'Tilldela resurser'] },
      { id: 's2', title: 'Datainsamling', description: 'Samla in underlag för granskning', assigneeRole: 'compliance', dueOffset: 5, dependencies: ['s1'], actions: ['Begär dokumentation'] },
      { id: 's3', title: 'Granskning', description: 'Genomför detaljerad granskning', assigneeRole: 'compliance', dueOffset: 10, dependencies: ['s2'], actions: ['Kontrollpunkter', 'Dokumentera fynd'] },
      { id: 's4', title: 'Rapport', description: 'Sammanställ granskningsrapport', assigneeRole: 'compliance', dueOffset: 12, dependencies: ['s3'], actions: ['Skriv rapport', 'Rekommendationer'] },
      { id: 's5', title: 'Presentation för ledning', description: 'Presentera resultat', assigneeRole: 'compliance', dueOffset: 14, dependencies: ['s4'], actions: ['Möte med ledning'] },
    ],
    estimatedDays: 14,
    status: 'active',
    createdAt: '2024-03-01',
    lastModified: '2024-08-01',
    usageCount: 6,
  },
];

const mockActiveWorkflows: ActiveWorkflow[] = [
  { id: 'aw-1', templateId: 'tpl-1', templateName: 'Kvartalsrapportering', entityName: 'Q4 2024 - Nordic Fund I', startedAt: '2024-12-01', dueDate: '2024-12-17', progress: 65, currentStep: 'NAV-beräkning', assignee: 'Erik Johansson', status: 'in_progress' },
  { id: 'aw-2', templateId: 'tpl-1', templateName: 'Kvartalsrapportering', entityName: 'Q4 2024 - Baltic Real Estate', startedAt: '2024-12-01', dueDate: '2024-12-17', progress: 40, currentStep: 'Validera data', assignee: 'Maria Lindgren', status: 'in_progress' },
  { id: 'aw-3', templateId: 'tpl-2', templateName: 'Ny kund-onboarding', entityName: 'Pensionsstiftelsen X', startedAt: '2024-11-20', dueDate: '2024-12-04', progress: 80, currentStep: 'Utbildning', assignee: 'Anna Svensson', status: 'in_progress' },
  { id: 'aw-4', templateId: 'tpl-4', templateName: 'Compliance-granskning', entityName: 'Q3 2024 Granskning', startedAt: '2024-10-01', dueDate: '2024-10-15', progress: 100, currentStep: 'Slutförd', assignee: 'Carl Berg', status: 'completed' },
  { id: 'aw-5', templateId: 'tpl-3', templateName: 'Årsbokslut', entityName: '2023 - Nordic Fund I', startedAt: '2024-01-15', dueDate: '2024-03-05', progress: 100, currentStep: 'Slutförd', assignee: 'Anna Svensson', status: 'completed' },
];

// ============================================================================
// Helper Components
// ============================================================================

const categoryLabels: Record<string, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: 'bg-blue-100 text-blue-700' },
  reporting: { label: 'Rapportering', color: 'bg-purple-100 text-purple-700' },
  compliance: { label: 'Compliance', color: 'bg-amber-100 text-amber-700' },
  closing: { label: 'Bokslut', color: 'bg-emerald-100 text-emerald-700' },
  audit: { label: 'Revision', color: 'bg-red-100 text-red-700' },
};

function CategoryBadge({ category }: { category: string }) {
  const config = categoryLabels[category] || { label: category, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: WorkflowStatus | TaskStatus }) {
  const config = {
    active: { label: 'Aktiv', color: 'bg-emerald-100 text-emerald-700', icon: Play },
    paused: { label: 'Pausad', color: 'bg-amber-100 text-amber-700', icon: Pause },
    draft: { label: 'Utkast', color: 'bg-gray-100 text-gray-600', icon: FileText },
    pending: { label: 'Väntar', color: 'bg-gray-100 text-gray-600', icon: Clock },
    in_progress: { label: 'Pågår', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
    completed: { label: 'Klar', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    overdue: { label: 'Försenad', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  }[status];

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-500 ${
          progress === 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ============================================================================
// Template Card
// ============================================================================

function TemplateCard({ 
  template, 
  onStart,
  onEdit,
  onDuplicate,
  onDelete
}: { 
  template: PlaybookTemplate;
  onStart: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center">
            <Workflow className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-aifm-charcoal">{template.name}</h3>
            <CategoryBadge category={template.category} />
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-aifm-charcoal/40 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          {showActions && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-gray-100 shadow-xl py-1 z-10">
              <button onClick={() => { onEdit(); setShowActions(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-aifm-charcoal hover:bg-gray-50">
                <Edit className="w-4 h-4" /> Redigera
              </button>
              <button onClick={() => { onDuplicate(); setShowActions(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-aifm-charcoal hover:bg-gray-50">
                <Copy className="w-4 h-4" /> Duplicera
              </button>
              <button onClick={() => { onDelete(); setShowActions(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Ta bort
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-aifm-charcoal/60 mb-4 line-clamp-2">{template.description}</p>

      <div className="flex items-center gap-4 mb-4 text-xs text-aifm-charcoal/40">
        <span className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" />
          {template.steps.length} steg
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          ~{template.estimatedDays} dagar
        </span>
        <span className="flex items-center gap-1">
          <BarChart3 className="w-3.5 h-3.5" />
          Använd {template.usageCount}x
        </span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <StatusBadge status={template.status} />
        <button
          onClick={onStart}
          className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                     hover:bg-aifm-charcoal/90 transition-all group-hover:shadow-lg"
        >
          <Play className="w-4 h-4" />
          Starta
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Active Workflow Card
// ============================================================================

function ActiveWorkflowCard({ workflow }: { workflow: ActiveWorkflow }) {
  const dueDate = new Date(workflow.dueDate);
  const now = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0 && workflow.status !== 'completed';

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${
      isOverdue ? 'bg-red-50 border-red-200' : 
      workflow.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 
      'bg-white border-gray-100'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-aifm-charcoal">{workflow.entityName}</p>
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">{workflow.templateName}</p>
        </div>
        <StatusBadge status={isOverdue ? 'overdue' : workflow.status} />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-aifm-charcoal/60 mb-1">
          <span>Framsteg</span>
          <span className="font-medium">{workflow.progress}%</span>
        </div>
        <ProgressBar progress={workflow.progress} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-aifm-charcoal/40">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {workflow.assignee}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {workflow.currentStep}
          </span>
        </div>
        <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-aifm-charcoal/60'}`}>
          {daysUntilDue === 0 ? 'Idag' : 
           daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d försenad` : 
           `${daysUntilDue}d kvar`}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Start Workflow Modal
// ============================================================================

function StartWorkflowModal({ 
  template, 
  onClose,
  onStart 
}: { 
  template: PlaybookTemplate;
  onClose: () => void;
  onStart: (entityName: string, assignee: string) => void;
}) {
  const [entityName, setEntityName] = useState('');
  const [assignee, setAssignee] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-aifm-charcoal">Starta arbetsflöde</h2>
            <p className="text-xs text-aifm-charcoal/50 mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-aifm-charcoal/50" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-2">
              Namn/Referens
            </label>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="t.ex. Q4 2024 - Nordic Fund I"
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                         focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-2">
              Huvudansvarig
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="t.ex. Anna Svensson"
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                         focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
            />
          </div>

          <div className="bg-aifm-charcoal/5 rounded-xl p-4">
            <p className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-3">Sammanfattning</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-aifm-charcoal/60">Antal steg</span>
                <span className="font-medium text-aifm-charcoal">{template.steps.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aifm-charcoal/60">Estimerad tid</span>
                <span className="font-medium text-aifm-charcoal">~{template.estimatedDays} dagar</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aifm-charcoal/60">Deadline</span>
                <span className="font-medium text-aifm-charcoal">
                  {new Date(Date.now() + template.estimatedDays * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-aifm-charcoal/70 hover:bg-white rounded-xl transition-colors">
            Avbryt
          </button>
          <button 
            onClick={() => onStart(entityName, assignee)}
            disabled={!entityName || !assignee}
            className="flex-1 py-3 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                       hover:bg-aifm-charcoal/90 transition-all flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Starta
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Navigation
// ============================================================================

type WorkflowTab = 'templates' | 'active' | 'completed';

function TabNav({ activeTab, onTabChange, counts }: { 
  activeTab: WorkflowTab; 
  onTabChange: (tab: WorkflowTab) => void;
  counts: Record<WorkflowTab, number>;
}) {
  const tabs: { id: WorkflowTab; label: string }[] = [
    { id: 'templates', label: 'Mallar' },
    { id: 'active', label: 'Aktiva' },
    { id: 'completed', label: 'Avslutade' },
  ];

  return (
    <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-white text-aifm-charcoal shadow-sm'
              : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
          }`}
        >
          {tab.label}
          {counts[tab.id] > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeTab === tab.id ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-200 text-gray-600'
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

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('templates');
  const [templates] = useState<PlaybookTemplate[]>(mockTemplates);
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>(mockActiveWorkflows);
  const [selectedTemplate, setSelectedTemplate] = useState<PlaybookTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const activeCount = activeWorkflows.filter(w => w.status === 'in_progress' || w.status === 'pending').length;
  const completedCount = activeWorkflows.filter(w => w.status === 'completed').length;

  const filteredTemplates = categoryFilter === 'all' 
    ? templates 
    : templates.filter(t => t.category === categoryFilter);

  const filteredWorkflows = activeTab === 'active'
    ? activeWorkflows.filter(w => w.status === 'in_progress' || w.status === 'pending')
    : activeWorkflows.filter(w => w.status === 'completed');

  const handleStartWorkflow = (entityName: string, assignee: string) => {
    if (!selectedTemplate) return;
    
    const newWorkflow: ActiveWorkflow = {
      id: `aw-${Date.now()}`,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      entityName,
      startedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + selectedTemplate.estimatedDays * 24 * 60 * 60 * 1000).toISOString(),
      progress: 0,
      currentStep: selectedTemplate.steps[0].title,
      assignee,
      status: 'in_progress',
    };
    
    setActiveWorkflows(prev => [newWorkflow, ...prev]);
    setSelectedTemplate(null);
    alert(`Arbetsflöde "${entityName}" startat!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Workflow className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Arbetsflöden</h1>
            <p className="text-sm text-aifm-charcoal/50">Playbooks och standardiserade processer</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl
                     text-sm font-medium hover:bg-aifm-charcoal/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Ny mall
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Mallar</p>
          <p className="text-2xl font-semibold text-aifm-charcoal mt-1">{templates.length}</p>
        </div>
        <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/90 rounded-2xl p-5 text-white">
          <p className="text-xs text-white/70 uppercase tracking-wider">Pågående</p>
          <p className="text-2xl font-semibold mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Slutförda</p>
          <p className="text-2xl font-semibold text-aifm-charcoal mt-1">{completedCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Totalt körda</p>
          <p className="text-2xl font-semibold text-aifm-charcoal mt-1">
            {templates.reduce((sum, t) => sum + t.usageCount, 0)}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <TabNav 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          counts={{ templates: templates.length, active: activeCount, completed: completedCount }}
        />

        {activeTab === 'templates' && (
          <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
            {['all', 'onboarding', 'reporting', 'compliance', 'closing'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === cat
                    ? 'bg-white text-aifm-charcoal shadow-sm'
                    : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
                }`}
              >
                {cat === 'all' ? 'Alla' : categoryLabels[cat]?.label || cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onStart={() => setSelectedTemplate(template)}
              onEdit={() => alert('Redigera mall (demo)')}
              onDuplicate={() => alert('Duplicera mall (demo)')}
              onDelete={() => alert('Ta bort mall (demo)')}
            />
          ))}
        </div>
      )}

      {(activeTab === 'active' || activeTab === 'completed') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkflows.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <Workflow className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-aifm-charcoal/50">Inga {activeTab === 'active' ? 'aktiva' : 'avslutade'} arbetsflöden</p>
            </div>
          ) : (
            filteredWorkflows.map(workflow => (
              <ActiveWorkflowCard key={workflow.id} workflow={workflow} />
            ))
          )}
        </div>
      )}

      {/* Start Workflow Modal */}
      {selectedTemplate && (
        <StartWorkflowModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onStart={handleStartWorkflow}
        />
      )}
    </div>
  );
}


