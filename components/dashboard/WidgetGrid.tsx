'use client';

import { useState, useCallback, ReactNode } from 'react';
import { 
  GripVertical, X, Settings, Plus, MoreHorizontal,
  TrendingUp, Users, DollarSign, Calendar, CheckSquare,
  AlertTriangle, Shield, FileText, PieChart, BarChart3,
  Activity, Building2, Briefcase, Target
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type WidgetType = 
  | 'stats' 
  | 'chart' 
  | 'list' 
  | 'calendar' 
  | 'tasks' 
  | 'compliance' 
  | 'deals' 
  | 'activities'
  | 'revenue'
  | 'contacts';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: number;
  config?: Record<string, unknown>;
  visible: boolean;
}

interface WidgetGridProps {
  widgets: Widget[];
  onWidgetsChange: (widgets: Widget[]) => void;
  renderWidget: (widget: Widget) => ReactNode;
  editable?: boolean;
}

// ============================================================================
// Widget Catalog
// ============================================================================

export const WIDGET_CATALOG: Array<{
  type: WidgetType;
  title: string;
  description: string;
  icon: typeof TrendingUp;
  defaultSize: WidgetSize;
}> = [
  { type: 'stats', title: 'Nyckeltal', description: 'KPI-översikt med viktiga mätvärden', icon: TrendingUp, defaultSize: 'medium' },
  { type: 'chart', title: 'Diagram', description: 'Visualisera data med diagram', icon: BarChart3, defaultSize: 'large' },
  { type: 'deals', title: 'Affärer', description: 'Pipeline och affärsöversikt', icon: DollarSign, defaultSize: 'medium' },
  { type: 'tasks', title: 'Uppgifter', description: 'Kommande och försenade uppgifter', icon: CheckSquare, defaultSize: 'medium' },
  { type: 'calendar', title: 'Kalender', description: 'Kommande möten och events', icon: Calendar, defaultSize: 'medium' },
  { type: 'compliance', title: 'Compliance', description: 'Regelefterlevnad och status', icon: Shield, defaultSize: 'small' },
  { type: 'activities', title: 'Aktiviteter', description: 'Senaste aktivitetsloggen', icon: Activity, defaultSize: 'medium' },
  { type: 'revenue', title: 'Intäkter', description: 'Intäktsöversikt och prognos', icon: PieChart, defaultSize: 'large' },
  { type: 'contacts', title: 'Kontakter', description: 'Senast tillagda kontakter', icon: Users, defaultSize: 'small' },
];

// ============================================================================
// Size Classes
// ============================================================================

const sizeClasses: Record<WidgetSize, string> = {
  small: 'col-span-12 sm:col-span-6 lg:col-span-3',
  medium: 'col-span-12 sm:col-span-6 lg:col-span-4',
  large: 'col-span-12 lg:col-span-6',
  full: 'col-span-12',
};

// ============================================================================
// Widget Wrapper Component
// ============================================================================

interface WidgetWrapperProps {
  widget: Widget;
  children: ReactNode;
  editable?: boolean;
  onRemove?: () => void;
  onResize?: (size: WidgetSize) => void;
  onSettings?: () => void;
}

export function WidgetWrapper({ 
  widget, 
  children, 
  editable, 
  onRemove,
  onResize,
  onSettings 
}: WidgetWrapperProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${sizeClasses[widget.size]} ${
        editable ? 'ring-2 ring-[#c0a280]/20 ring-offset-2' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {editable && (
            <button className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <h3 className="font-medium text-gray-900">{widget.title}</h3>
        </div>
        
        {editable && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
                  <button
                    onClick={() => { onSettings?.(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4" />
                    Inställningar
                  </button>
                  <div className="px-3 py-2">
                    <p className="text-xs text-gray-500 mb-2">Storlek</p>
                    <div className="flex gap-1">
                      {(['small', 'medium', 'large', 'full'] as WidgetSize[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => { onResize?.(size); setShowMenu(false); }}
                          className={`flex-1 px-2 py-1 text-xs rounded ${
                            widget.size === size
                              ? 'bg-[#c0a280] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {size === 'small' ? 'S' : size === 'medium' ? 'M' : size === 'large' ? 'L' : 'XL'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { onRemove?.(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                      Ta bort widget
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Add Widget Modal
// ============================================================================

interface AddWidgetModalProps {
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
  existingTypes: WidgetType[];
}

export function AddWidgetModal({ onClose, onAdd, existingTypes }: AddWidgetModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Lägg till widget</h2>
          <p className="text-sm text-gray-500">Välj en widget att lägga till på din dashboard</p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WIDGET_CATALOG.map((widget) => {
              const isAdded = existingTypes.includes(widget.type);
              return (
                <button
                  key={widget.type}
                  onClick={() => !isAdded && onAdd(widget.type)}
                  disabled={isAdded}
                  className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    isAdded 
                      ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 hover:border-[#c0a280] hover:shadow-md'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isAdded ? 'bg-gray-200 text-gray-400' : 'bg-[#c0a280]/10 text-[#c0a280]'
                  }`}>
                    <widget.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{widget.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{widget.description}</p>
                    {isAdded && (
                      <span className="inline-block mt-2 text-xs text-gray-400">Redan tillagd</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Widget Grid Component
// ============================================================================

export function WidgetGrid({ widgets, onWidgetsChange, renderWidget, editable = false }: WidgetGridProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  
  const visibleWidgets = widgets
    .filter(w => w.visible)
    .sort((a, b) => a.position - b.position);

  const handleRemove = (widgetId: string) => {
    onWidgetsChange(widgets.map(w => 
      w.id === widgetId ? { ...w, visible: false } : w
    ));
  };

  const handleResize = (widgetId: string, size: WidgetSize) => {
    onWidgetsChange(widgets.map(w => 
      w.id === widgetId ? { ...w, size } : w
    ));
  };

  const handleAdd = (type: WidgetType) => {
    const catalogItem = WIDGET_CATALOG.find(c => c.type === type);
    if (!catalogItem) return;

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type,
      title: catalogItem.title,
      size: catalogItem.defaultSize,
      position: widgets.length,
      visible: true,
    };

    onWidgetsChange([...widgets, newWidget]);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Edit Mode Toggle */}
      {editable && (
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Dra och släpp för att ordna om widgets
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#c0a280] border border-[#c0a280] rounded-lg hover:bg-[#c0a280]/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Lägg till widget
          </button>
        </div>
      )}

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-4">
        {visibleWidgets.map((widget) => (
          <WidgetWrapper
            key={widget.id}
            widget={widget}
            editable={editable}
            onRemove={() => handleRemove(widget.id)}
            onResize={(size) => handleResize(widget.id, size)}
          >
            {renderWidget(widget)}
          </WidgetWrapper>
        ))}
      </div>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Plus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Inga widgets tillagda</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] rounded-lg hover:bg-[#3d3a36] transition-colors"
          >
            Lägg till din första widget
          </button>
        </div>
      )}

      {/* Add Widget Modal */}
      {showAddModal && (
        <AddWidgetModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
          existingTypes={widgets.filter(w => w.visible).map(w => w.type)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Pre-built Widget Components
// ============================================================================

export function StatsWidget() {
  const stats = [
    { label: 'Aktiva kunder', value: '47', change: '+12%', positive: true },
    { label: 'Månadens intäkter', value: '2.4M', change: '+8%', positive: true },
    { label: 'Pipeline-värde', value: '5.8M', change: '-3%', positive: false },
    { label: 'Försenade uppgifter', value: '3', change: '-2', positive: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900">{stat.value}</span>
            <span className={`text-xs font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
              {stat.change}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TasksWidget() {
  const tasks = [
    { title: 'Granska KYC för Nordic AB', due: 'Idag', priority: 'high' },
    { title: 'Skicka kvartalsrapport', due: 'I morgon', priority: 'medium' },
    { title: 'Uppdatera investerarregister', due: '3 dagar', priority: 'low' },
  ];

  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
          <div className={`w-2 h-2 rounded-full ${
            task.priority === 'high' ? 'bg-red-500' :
            task.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{task.title}</p>
            <p className="text-xs text-gray-500">{task.due}</p>
          </div>
          <CheckSquare className="w-4 h-4 text-gray-300" />
        </div>
      ))}
    </div>
  );
}

export function DealsWidget() {
  const deals = [
    { name: 'Enterprise License', company: 'Nordic AB', value: '500k', stage: 'Förhandling' },
    { name: 'Konsultuppdrag', company: 'Tech Solutions', value: '250k', stage: 'Offert' },
    { name: 'Partnerskap Q2', company: 'Global Capital', value: '1.2M', stage: 'Kvalificerad' },
  ];

  return (
    <div className="space-y-2">
      {deals.map((deal, i) => (
        <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{deal.name}</p>
            <p className="text-xs text-gray-500">{deal.company}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{deal.value}</p>
            <p className="text-xs text-gray-500">{deal.stage}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComplianceWidget() {
  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto mb-3">
        <svg className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle 
            cx="40" cy="40" r="36" fill="none" stroke="#c0a280" strokeWidth="8"
            strokeDasharray={`${87 * 2.26} 226`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-900">
          87%
        </span>
      </div>
      <p className="text-sm text-gray-600">Compliance Score</p>
      <div className="flex items-center justify-center gap-1 mt-1 text-xs text-amber-600">
        <AlertTriangle className="w-3 h-3" />
        2 uppgifter förfallna
      </div>
    </div>
  );
}

export function ActivitiesWidget() {
  const activities = [
    { type: 'call', title: 'Samtal med Anna Svensson', time: '14:30' },
    { type: 'email', title: 'E-post till Tech Solutions', time: '11:15' },
    { type: 'meeting', title: 'Möte: Kvartalsgenomgång', time: '09:00' },
  ];

  return (
    <div className="space-y-3">
      {activities.map((activity, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <Activity className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{activity.title}</p>
            <p className="text-xs text-gray-500">{activity.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}



