'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, ChevronRight, ChevronDown, ChevronUp,
  User, Building2, Link2, Bell, Shield, Calendar,
  Sparkles, Rocket, CircleDashed, CheckCircle2, Circle
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface OnboardingTask {
  id: string;
  category: string;
  title: string;
  description: string;
  href?: string;
  isCompleted: boolean;
  isRequired: boolean;
  order: number;
}

export interface OnboardingProgress {
  userId: string;
  completedTasks: string[];
  startedAt: string;
  completedAt?: string;
  lastActivity: string;
  dismissed: boolean;
}

interface OnboardingContextType {
  progress: OnboardingProgress | null;
  tasks: OnboardingTask[];
  completeTask: (taskId: string) => Promise<void>;
  dismissChecklist: () => void;
  showChecklist: boolean;
  setShowChecklist: (show: boolean) => void;
  completionPercentage: number;
  isFullyCompleted: boolean;
}

// ============================================================================
// Default Tasks
// ============================================================================

const defaultTasks: OnboardingTask[] = [
  // Profile
  {
    id: 'profile-complete',
    category: 'Profil',
    title: 'Fyll i din profil',
    description: 'Lägg till namn, titel och profilbild',
    href: '/settings',
    isCompleted: false,
    isRequired: true,
    order: 1,
  },
  {
    id: 'profile-mfa',
    category: 'Profil',
    title: 'Aktivera tvåfaktorsautentisering',
    description: 'Säkra ditt konto med MFA',
    href: '/settings',
    isCompleted: false,
    isRequired: true,
    order: 2,
  },

  // Company Access
  {
    id: 'company-select',
    category: 'Bolag',
    title: 'Välj ett bolag',
    description: 'Välj vilket bolag du vill arbeta med',
    href: '/overview',
    isCompleted: false,
    isRequired: true,
    order: 3,
  },
  {
    id: 'company-explore',
    category: 'Bolag',
    title: 'Utforska bolagssidan',
    description: 'Bekanta dig med översikten för ett bolag',
    href: '/fund',
    isCompleted: false,
    isRequired: false,
    order: 4,
  },

  // Integrations
  {
    id: 'integration-fortnox',
    category: 'Integrationer',
    title: 'Anslut till Fortnox',
    description: 'Koppla ditt första bolag till Fortnox',
    href: '/accounting/integrations',
    isCompleted: false,
    isRequired: false,
    order: 5,
  },
  {
    id: 'integration-bank',
    category: 'Integrationer',
    title: 'Koppla bankkonto',
    description: 'Anslut Tink för automatisk bankimport',
    href: '/accounting/integrations',
    isCompleted: false,
    isRequired: false,
    order: 6,
  },
  {
    id: 'integration-calendar',
    category: 'Integrationer',
    title: 'Synka kalender',
    description: 'Koppla Microsoft 365 eller Google Calendar',
    href: '/settings/integrations/microsoft',
    isCompleted: false,
    isRequired: false,
    order: 7,
  },

  // Features
  {
    id: 'feature-crm',
    category: 'Funktioner',
    title: 'Utforska CRM',
    description: 'Lägg till din första kontakt eller affär',
    href: '/crm',
    isCompleted: false,
    isRequired: false,
    order: 8,
  },
  {
    id: 'feature-compliance',
    category: 'Funktioner',
    title: 'Testa Compliance AI',
    description: 'Ställ en fråga till compliance-assistenten',
    href: '/compliance/chat',
    isCompleted: false,
    isRequired: false,
    order: 9,
  },
  {
    id: 'feature-dataroom',
    category: 'Funktioner',
    title: 'Skapa ett datarum',
    description: 'Förbered för att dela dokument externt',
    href: '/data-rooms',
    isCompleted: false,
    isRequired: false,
    order: 10,
  },

  // Notifications
  {
    id: 'notifications-setup',
    category: 'Notifikationer',
    title: 'Konfigurera notifikationer',
    description: 'Välj hur du vill bli notifierad',
    href: '/settings',
    isCompleted: false,
    isRequired: false,
    order: 11,
  },

  // Complete
  {
    id: 'onboarding-complete',
    category: 'Slutför',
    title: 'Klart! Du är redo',
    description: 'Du har slutfört alla obligatoriska steg',
    isCompleted: false,
    isRequired: false,
    order: 12,
  },
];

// ============================================================================
// Context
// ============================================================================

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function useOnboardingChecklist(): OnboardingContextType {
  const context = useContext(OnboardingContext);
  // Return a no-op implementation if used outside provider (e.g., during static rendering)
  if (!context) {
    return {
      progress: null,
      tasks: [],
      completeTask: async () => {},
      dismissChecklist: () => {},
      showChecklist: false,
      setShowChecklist: () => {},
      completionPercentage: 0,
      isFullyCompleted: false,
    };
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function OnboardingChecklistProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [tasks, setTasks] = useState<OnboardingTask[]>(defaultTasks);
  const [showChecklist, setShowChecklist] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const res = await fetch('/api/onboarding/progress');
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress);
        
        // Update tasks with completed status
        if (data.progress?.completedTasks) {
          setTasks(prev => prev.map(task => ({
            ...task,
            isCompleted: data.progress.completedTasks.includes(task.id)
          })));
        }

        // Show checklist if not dismissed and not fully completed
        if (!data.progress?.dismissed && !data.progress?.completedAt) {
          setShowChecklist(true);
        }
      }
    } catch (error) {
      console.error('Failed to load onboarding progress:', error);
    }
  };

  const completeTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action: 'complete' }),
      });

      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress);
        setTasks(prev => prev.map(task => ({
          ...task,
          isCompleted: task.id === taskId ? true : task.isCompleted
        })));
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  }, []);

  const dismissChecklist = useCallback(async () => {
    try {
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      setShowChecklist(false);
    } catch (error) {
      console.error('Failed to dismiss checklist:', error);
    }
  }, []);

  const completedCount = tasks.filter(t => t.isCompleted).length;
  const completionPercentage = Math.round((completedCount / tasks.length) * 100);
  const requiredTasks = tasks.filter(t => t.isRequired);
  const isFullyCompleted = requiredTasks.every(t => t.isCompleted);

  if (!mounted) return <>{children}</>;

  return (
    <OnboardingContext.Provider value={{
      progress,
      tasks,
      completeTask,
      dismissChecklist,
      showChecklist,
      setShowChecklist,
      completionPercentage,
      isFullyCompleted,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

// ============================================================================
// Checklist Widget (Floating)
// ============================================================================

export function OnboardingChecklistWidget() {
  const { 
    tasks, 
    completeTask, 
    dismissChecklist, 
    showChecklist, 
    setShowChecklist,
    completionPercentage,
    isFullyCompleted 
  } = useOnboardingChecklist();
  
  const [isExpanded, setIsExpanded] = useState(true);

  // Safety check - don't render if tasks is not properly initialized
  if (!tasks || tasks.length === 0) {
    return null;
  }
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Profil', 'Bolag']));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !showChecklist) return null;

  // Group tasks by category
  const tasksByCategory = tasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {} as Record<string, OnboardingTask[]>);

  const categories = Object.keys(tasksByCategory);
  const completedCount = tasks.filter(t => t.isCompleted).length;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Profil': return User;
      case 'Bolag': return Building2;
      case 'Integrationer': return Link2;
      case 'Funktioner': return Sparkles;
      case 'Notifikationer': return Bell;
      case 'Slutför': return Rocket;
      default: return Circle;
    }
  };

  const getCategoryProgress = (category: string) => {
    const categoryTasks = tasksByCategory[category];
    const completed = categoryTasks.filter(t => t.isCompleted).length;
    return { completed, total: categoryTasks.length };
  };

  const widget = (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Collapsed state - just a button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-3 px-4 py-3 bg-aifm-charcoal text-white rounded-2xl shadow-2xl 
                     hover:bg-aifm-charcoal/90 transition-all group"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-aifm-gold/20 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-aifm-gold" />
            </div>
            {/* Progress ring */}
            <svg className="absolute inset-0 w-10 h-10 -rotate-90">
              <circle
                cx="20" cy="20" r="18"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="2"
              />
              <circle
                cx="20" cy="20" r="18"
                fill="none"
                stroke="#C9A227"
                strokeWidth="2"
                strokeDasharray={`${completionPercentage * 1.13} 113`}
                className="transition-all duration-500"
              />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">Kom igång</p>
            <p className="text-xs text-white/60">{completedCount}/{tasks.length} klara</p>
          </div>
          <ChevronUp className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
        </button>
      )}

      {/* Expanded state - full checklist */}
      {isExpanded && (
        <div className="w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 p-5 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-aifm-gold/20 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-aifm-gold" />
                </div>
                <div>
                  <h3 className="font-semibold">Kom igång med AIFM</h3>
                  <p className="text-sm text-white/60">Din personliga checklista</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ChevronDown className="w-4 h-4 text-white/60" />
                </button>
                <button
                  onClick={dismissChecklist}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-white/60">{completedCount} av {tasks.length} steg klara</span>
                <span className="font-medium text-aifm-gold">{completionPercentage}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-aifm-gold to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="max-h-[400px] overflow-y-auto">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category);
              const { completed, total } = getCategoryProgress(category);
              const isOpen = expandedCategories.has(category);
              const allComplete = completed === total;

              return (
                <div key={category} className="border-b border-gray-100 last:border-0">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        allComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {allComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className={`text-sm font-medium ${allComplete ? 'text-emerald-600' : 'text-aifm-charcoal'}`}>
                        {category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{completed}/{total}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Tasks */}
                  {isOpen && (
                    <div className="px-5 pb-3 space-y-2">
                      {tasksByCategory[category].map((task) => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onComplete={() => completeTask(task.id)} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {isFullyCompleted && (
            <div className="p-4 bg-emerald-50 border-t border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-800">Bra jobbat!</p>
                  <p className="text-xs text-emerald-600">Du har slutfört alla obligatoriska steg</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(widget, document.body);
}

// ============================================================================
// Task Item
// ============================================================================

function TaskItem({ task, onComplete }: { task: OnboardingTask; onComplete: () => void }) {
  const handleClick = () => {
    if (!task.isCompleted) {
      onComplete();
    }
    if (task.href) {
      window.location.href = task.href;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
        task.isCompleted 
          ? 'bg-emerald-50/50' 
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      {/* Checkbox */}
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
        task.isCompleted 
          ? 'bg-emerald-500 border-emerald-500' 
          : 'border-gray-300 hover:border-aifm-gold'
      }`}>
        {task.isCompleted && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${
            task.isCompleted ? 'text-emerald-700 line-through' : 'text-aifm-charcoal'
          }`}>
            {task.title}
          </p>
          {task.isRequired && !task.isCompleted && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
              Obligatorisk
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${
          task.isCompleted ? 'text-emerald-600/70' : 'text-gray-500'
        }`}>
          {task.description}
        </p>
      </div>

      {/* Action */}
      {task.href && !task.isCompleted && (
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
      )}
    </button>
  );
}

// ============================================================================
// CSS Animation (add to globals.css if needed)
// ============================================================================

// @keyframes slide-up {
//   from { opacity: 0; transform: translateY(20px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// .animate-slide-up { animation: slide-up 0.3s ease-out; }

