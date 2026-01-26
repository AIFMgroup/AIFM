'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  action?: {
    label: string;
    href?: string;
  };
}

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// ============================================================================
// Onboarding Steps
// ============================================================================

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Välkommen till AIFM Platform!',
    description: 'Den här guiden hjälper dig att komma igång med plattformen. Vi går igenom de viktigaste funktionerna tillsammans.',
    position: 'center',
  },
  {
    id: 'dashboard',
    title: 'Översikt & Dashboard',
    description: 'Här ser du en sammanfattning av alla dina fonder, nyckeltal och senaste aktiviteter. Perfekt för att få en snabb överblick.',
    position: 'center',
    action: { label: 'Gå till Dashboard', href: '/overview' },
  },
  {
    id: 'crm',
    title: 'CRM & Kundhantering',
    description: 'Hantera kontakter, företag och affärsmöjligheter. Följ upp leads i pipelinen och håll koll på alla kundinteraktioner.',
    position: 'center',
    action: { label: 'Utforska CRM', href: '/crm' },
  },
  {
    id: 'accounting',
    title: 'Bokföring & Fakturor',
    description: 'Ladda upp fakturor, låt AI klassificera dem automatiskt, och skicka godkända transaktioner direkt till Fortnox.',
    position: 'center',
    action: { label: 'Till Bokföring', href: '/accounting/dashboard' },
  },
  {
    id: 'compliance',
    title: 'Compliance & Regelverk',
    description: 'Använd AI-assistenten för att få svar på regelfrågor. Ladda upp dokument för att bygga din kunskapsbas.',
    position: 'center',
    action: { label: 'Öppna Compliance', href: '/compliance' },
  },
  {
    id: 'dataroom',
    title: 'Datarum & Dokument',
    description: 'Säkra datarum för att dela dokument med investerare och externa parter. Spåra vem som laddat ner vad.',
    position: 'center',
    action: { label: 'Se Datarum', href: '/data-rooms' },
  },
  {
    id: 'tasks',
    title: 'Mina Uppgifter',
    description: '"Vad ska jag göra idag?" - Se alla dina uppgifter, godkännanden och deadlines på ett ställe.',
    position: 'center',
    action: { label: 'Mina Uppgifter', href: '/my-tasks' },
  },
  {
    id: 'search',
    title: 'Global Sökning',
    description: 'Använd sökfältet i headern för att snabbt hitta dokument, kontakter, transaktioner och mer.',
    position: 'center',
  },
  {
    id: 'notifications',
    title: 'Notifikationer',
    description: 'Klockikonen visar viktiga händelser - godkännanden som väntar, deadlines och systemmeddelanden.',
    position: 'center',
  },
  {
    id: 'favorites',
    title: 'Favoriter',
    description: 'Klicka på stjärnikonen bredvid menypunkter för att lägga till dem som favoriter. De visas överst i sidomenyn!',
    position: 'center',
  },
  {
    id: 'help',
    title: 'Behöver du hjälp?',
    description: 'Klicka på hjälpikonen (?) längst ner i sidomenyn för att starta guiden igen eller kontakta support.',
    position: 'center',
  },
  {
    id: 'complete',
    title: 'Du är redo!',
    description: 'Nu har du koll på grunderna. Utforska plattformen och tveka inte att kontakta oss om du har frågor.',
    position: 'center',
  },
];

// ============================================================================
// Progress Indicator
// ============================================================================

function ProgressIndicator({ 
  currentStep, 
  totalSteps 
}: { 
  currentStep: number; 
  totalSteps: number; 
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            index === currentStep
              ? 'w-6 bg-aifm-gold'
              : index < currentStep
              ? 'w-1.5 bg-aifm-gold/60'
              : 'w-1.5 bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OnboardingGuide({ isOpen, onClose, onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const step = onboardingSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
      onClose();
      return;
    }
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 150);
  }, [isLastStep, onComplete, onClose]);

  const handlePrev = useCallback(() => {
    if (isFirstStep) return;
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 150);
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-lg bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/95 
                    rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
                      isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                    }`}
      >
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-aifm-gold via-amber-400 to-aifm-gold" />
        
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 pt-10">
          {/* Title */}
          <h2 className="text-2xl font-semibold mb-3" style={{ color: '#ffffff' }}>
            {step.title}
          </h2>

          {/* Description */}
          <p className="leading-relaxed mb-6" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {step.description}
          </p>

          {/* Action button (optional) */}
          {step.action && (
            <a
              href={step.action.href}
              onClick={(e) => {
                e.preventDefault();
                handleNext();
                if (step.action?.href) {
                  window.location.href = step.action.href;
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 
                        text-sm rounded-lg transition-colors mb-6"
              style={{ color: '#ffffff' }}
            >
              {step.action.label}
              <ChevronRight className="w-4 h-4" />
            </a>
          )}

          {/* Progress */}
          <div className="flex items-center justify-between pt-6 border-t border-white/10">
            <ProgressIndicator 
              currentStep={currentStep} 
              totalSteps={onboardingSteps.length} 
            />

            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-4 py-2 hover:bg-white/10 
                            text-sm rounded-lg transition-colors"
                  style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Tillbaka
                </button>
              )}
              
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 bg-aifm-gold hover:bg-aifm-gold/90 
                          text-sm font-medium rounded-xl transition-colors"
                style={{ color: '#1a1a1a' }}
              >
                {isLastStep ? 'Kom igång!' : 'Nästa'}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Step counter */}
        <div className="absolute bottom-4 left-8 text-xs" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
          {currentStep + 1} / {onboardingSteps.length}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ============================================================================
// Hook for managing onboarding state
// ============================================================================

const ONBOARDING_KEY = 'aifm-onboarding-completed';

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay to let the page load
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
    setHasChecked(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
    setHasChecked(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setShowOnboarding(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    // Mark as completed even if skipped
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  return {
    showOnboarding,
    hasChecked,
    completeOnboarding,
    resetOnboarding,
    closeOnboarding,
    startOnboarding: () => setShowOnboarding(true),
  };
}
