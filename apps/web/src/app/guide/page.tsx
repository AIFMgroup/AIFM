'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, Play, Building2, Users, DollarSign, ArrowLeftRight,
  Wallet, FolderLock, CheckSquare, FileText, Calculator, Settings,
  MessageSquare, Home, Shield, ClipboardList, HelpCircle, Sparkles,
  BarChart3, Upload, BookOpen, FileCheck, CreditCard, X, ChevronDown,
  AlertTriangle, Lightbulb, CheckCircle2, HelpCircle as QuestionIcon,
  ArrowRight, ExternalLink, Target, Zap
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { guideSections, GuideSection, GuideStep } from '@/lib/guideData';

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  Sparkles, Home, Building2, BarChart3, Users, DollarSign, ArrowLeftRight,
  Wallet, Calculator, Upload, BookOpen, FileCheck, CreditCard, FolderLock,
  Shield, MessageSquare, FileText, ClipboardList, CheckSquare, Settings, HelpCircle,
};

// Navigation sections for sidebar
const navSections = [
  { id: 'overview', title: 'Välkommen till AIFM', icon: 'Sparkles' },
  { id: 'capital-calls', title: 'Kapitalanrop', icon: 'DollarSign' },
  { id: 'distributions', title: 'Utdelningar', icon: 'ArrowLeftRight' },
  { id: 'investors', title: 'Investerare', icon: 'Users' },
];

// Step Detail Modal Component
function StepDetailModal({ 
  step, 
  stepNumber,
  sectionTitle,
  onClose 
}: { 
  step: GuideStep; 
  stepNumber: number;
  sectionTitle: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'howItWorks' | 'useCases' | 'tips' | 'faq'>('howItWorks');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-aifm-charcoal/5 to-transparent flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-aifm-gold to-aifm-gold/80 rounded-xl flex items-center justify-center shadow-lg shadow-aifm-gold/30">
              <span className="text-lg font-bold text-white">{stepNumber}</span>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">{sectionTitle}</p>
              <h2 className="text-xl font-semibold text-aifm-charcoal">{step.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-aifm-charcoal/50" />
          </button>
        </div>

        {/* Overview */}
        <div className="px-6 py-5 border-b border-gray-100 bg-aifm-gold/5 flex-shrink-0">
          <p className="text-sm text-aifm-charcoal/70 leading-relaxed">{step.detailedContent.overview}</p>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto flex-shrink-0">
          {[
            { id: 'howItWorks', label: 'Hur det fungerar', icon: Zap },
            { id: 'useCases', label: 'Användningsfall', icon: Target },
            { id: 'tips', label: 'Tips & Vanliga misstag', icon: Lightbulb },
            { id: 'faq', label: 'Vanliga frågor', icon: QuestionIcon },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${activeTab === tab.id 
                    ? 'bg-aifm-charcoal text-white' 
                    : 'text-aifm-charcoal/60 hover:bg-gray-100'}`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* How It Works Tab */}
          {activeTab === 'howItWorks' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-aifm-gold" />
                Steg-för-steg guide
              </h3>
              <div className="space-y-3">
                {step.detailedContent.howItWorks.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 bg-aifm-charcoal rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-white">{index + 1}</span>
                    </div>
                    <p className="text-sm text-aifm-charcoal/70 pt-1.5">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Use Cases Tab */}
          {activeTab === 'useCases' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-aifm-gold" />
                Typiska användningsfall
              </h3>
              <div className="grid gap-3">
                {step.detailedContent.useCases.map((useCase, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-aifm-charcoal/70">{useCase}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips Tab */}
          {activeTab === 'tips' && (
            <div className="space-y-6">
              {/* Common Mistakes */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Vanliga misstag att undvika
                </h3>
                <div className="space-y-3">
                  {step.detailedContent.commonMistakes.map((mistake, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-aifm-charcoal/70">{mistake}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tips */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-aifm-gold" />
                  Proffstips
                </h3>
                <div className="space-y-3">
                  {step.detailedContent.proTips.map((tip, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 bg-aifm-gold/10 rounded-xl border border-aifm-gold/20">
                      <Sparkles className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-aifm-charcoal/70">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider flex items-center gap-2">
                <QuestionIcon className="w-4 h-4 text-aifm-gold" />
                Vanliga frågor
              </h3>
              <div className="space-y-4">
                {step.detailedContent.faq.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50">
                      <p className="text-sm font-medium text-aifm-charcoal flex items-start gap-2">
                        <span className="text-aifm-gold font-bold">Q:</span>
                        {item.question}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-aifm-charcoal/70 flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">A:</span>
                        {item.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Features */}
          {step.detailedContent.relatedFeatures.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-3">Relaterade funktioner</h3>
              <div className="flex flex-wrap gap-2">
                {step.detailedContent.relatedFeatures.map((feature, index) => (
                  <span key={index} className="px-3 py-1.5 bg-gray-100 text-aifm-charcoal/60 text-xs rounded-full">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-aifm-charcoal/60 hover:text-aifm-charcoal transition-colors"
          >
            Stäng
          </button>
          <div className="text-xs text-aifm-charcoal/40">
            Tryck ESC för att stänga
          </div>
        </div>
      </div>
    </div>
  );
}

// Clickable Step Card
function StepCard({ 
  step, 
  index, 
  sectionTitle,
  onClick 
}: { 
  step: GuideStep; 
  index: number; 
  sectionTitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 
                 hover:border-aifm-gold/30 hover:shadow-lg hover:shadow-aifm-gold/10 
                 transition-all duration-300 text-left group"
    >
      <div className="w-10 h-10 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 rounded-xl 
                      flex items-center justify-center flex-shrink-0 shadow-sm 
                      group-hover:from-aifm-gold group-hover:to-aifm-gold/80 transition-all duration-300">
        <span className="text-sm font-semibold text-white">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">
            {step.title}
          </p>
          <ArrowRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
        </div>
        <p className="text-sm text-aifm-charcoal/50 mt-1 line-clamp-2">{step.shortDescription}</p>
        <p className="text-xs text-aifm-gold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Klicka för detaljerad guide →
        </p>
      </div>
    </button>
  );
}

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedStep, setSelectedStep] = useState<{ step: GuideStep; index: number; sectionTitle: string } | null>(null);
  
  const section = guideSections.find(s => s.id === activeSection);
  const Icon = section ? iconMap[section.icon] || Sparkles : Sparkles;

  if (!section) {
    return <div>Section not found</div>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-aifm-gold/20 to-aifm-gold/5 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-aifm-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-aifm-charcoal">Användarguide</h1>
              <p className="text-sm text-aifm-charcoal/50">Klicka på varje steg för detaljerad information</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Section Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-24 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-50 bg-gradient-to-r from-aifm-charcoal/5 to-transparent">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Guider</span>
              </div>
              <div className="py-2">
                {navSections.map((nav) => {
                  const NavIcon = iconMap[nav.icon] || Sparkles;
                  return (
                    <button
                      key={nav.id}
                      onClick={() => setActiveSection(nav.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all
                        ${activeSection === nav.id 
                          ? 'bg-aifm-gold/10 text-aifm-charcoal border-r-2 border-aifm-gold' 
                          : 'text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-50'}`}
                    >
                      <NavIcon className={`w-5 h-5 flex-shrink-0 ${activeSection === nav.id ? 'text-aifm-gold' : 'text-aifm-charcoal/40'}`} />
                      <span className="text-sm font-medium">{nav.title}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Quick Help */}
              <div className="px-4 py-4 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-aifm-charcoal/40 mb-2">Behöver du hjälp?</p>
                <p className="text-xs text-aifm-charcoal/60">
                  Använd hjälp-assistenten nere till höger för snabba svar.
                </p>
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Section Header with Introduction */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-6 border-b border-gray-50">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-aifm-gold/20 to-aifm-gold/5 rounded-2xl flex items-center justify-center">
                    <Icon className="w-7 h-7 text-aifm-gold" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-aifm-charcoal">{section.title}</h2>
                    <p className="text-sm text-aifm-charcoal/50 mt-1">{section.description}</p>
                  </div>
                </div>
              </div>
              
              {/* Introduction */}
              <div className="px-6 py-5 bg-gradient-to-br from-aifm-gold/5 to-white">
                <p className="text-sm text-aifm-charcoal/70 leading-relaxed">{section.introduction}</p>
              </div>
              
              {/* Key Benefits */}
              <div className="px-6 py-5 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">Huvudfördelar</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {section.keyBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-aifm-charcoal/70">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Steps */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">
                  Steg-för-steg guide
                </span>
                <span className="text-xs text-aifm-gold">Klicka för detaljer</span>
              </div>
              <div className="p-4 space-y-3">
                {section.steps.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    sectionTitle={section.title}
                    onClick={() => setSelectedStep({ step, index, sectionTitle: section.title })}
                  />
                ))}
              </div>
            </div>

            {/* Features Grid */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-50">
                <span className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Funktioner</span>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-4">
                {section.features.map((feature, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl hover:bg-aifm-gold/5 transition-colors">
                    <h4 className="text-sm font-medium text-aifm-charcoal mb-1">{feature.title}</h4>
                    <p className="text-xs text-aifm-charcoal/50">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-aifm-gold/10 to-aifm-gold/5 rounded-2xl px-6 py-5 border border-aifm-gold/20">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-aifm-gold" />
                <span className="text-sm font-semibold text-aifm-charcoal">Tips för att komma igång</span>
              </div>
              <ul className="space-y-3">
                {section.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-aifm-charcoal/70">
                    <Sparkles className="w-4 h-4 text-aifm-gold flex-shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-aifm-charcoal/20">
              <div className="text-center sm:text-left">
                <p className="text-white font-semibold text-lg">Redo att börja?</p>
                <p className="text-white/50 text-sm mt-1">Testa funktionen direkt i AIFM</p>
              </div>
              <Link 
                href={section.link}
                className="px-6 py-3 bg-white text-aifm-charcoal rounded-xl text-sm font-medium 
                         hover:bg-aifm-gold hover:text-white transition-all duration-300 
                         flex items-center gap-2 shadow-sm"
              >
                Öppna {section.title}
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Step Detail Modal */}
      {selectedStep && (
        <StepDetailModal
          step={selectedStep.step}
          stepNumber={selectedStep.index + 1}
          sectionTitle={selectedStep.sectionTitle}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </DashboardLayout>
  );
}
