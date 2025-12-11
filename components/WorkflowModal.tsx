'use client';

import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Users, Database, Zap, FileCheck, Download } from 'lucide-react';
import { Modal } from './Modal';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  roles: string[];
}

const workflowSteps: WorkflowStep[] = [
  {
    id: 'connect',
    title: 'CONNECT & SYNC',
    description: 'Seamlessly integrate your data sources',
    icon: <Database className="w-8 h-8" />,
    details: [
      'Connect Fortnox accounting system via secure API',
      'Link bank accounts through Nordigen (PSD2 compliant)',
      'Manual upload option for additional documents',
      'Automatic daily synchronization at midnight',
      'Real-time validation and error reporting'
    ],
    roles: ['Admin', 'Client']
  },
  {
    id: 'process',
    title: 'AI PROCESSING',
    description: 'Intelligent automation at work',
    icon: <Zap className="w-8 h-8" />,
    details: [
      'AI reconciles bank transactions with accounting entries',
      'Identifies discrepancies and missing transactions',
      'Analyzes financial patterns and trends',
      'Generates draft reports with key insights',
      'Learns from historical data and corrections'
    ],
    roles: ['System']
  },
  {
    id: 'review',
    title: 'QUALITY CONTROL',
    description: 'Human expertise ensures accuracy',
    icon: <Users className="w-8 h-8" />,
    details: [
      'Coordinators review AI-generated results in inbox',
      'Flag issues or approve for specialist review',
      'Specialists refine reports with domain expertise',
      'Add professional commentary and recommendations',
      'Multi-level approval process ensures quality'
    ],
    roles: ['Coordinator', 'Specialist']
  },
  {
    id: 'deliver',
    title: 'FINAL DELIVERY',
    description: 'Professional reports ready for clients',
    icon: <FileCheck className="w-8 h-8" />,
    details: [
      'Generate polished PDF reports with branding',
      'Secure client portal for report access',
      'Email notifications when reports are ready',
      'Historical archive of all reports',
      'Export options for further analysis'
    ],
    roles: ['Client', 'Specialist']
  }
];

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkflowModal({ isOpen, onClose }: WorkflowModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const step = workflowSteps[currentStep];

  const nextStep = () => {
    if (currentStep < workflowSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const roles = ['Admin', 'Coordinator', 'Specialist', 'Client', 'System'];

  return (
    <Modal isOpen={isOpen} onCancel={onClose} title="How It Works" onConfirm={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-scaleIn">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-gray-50 to-white p-8 border-b border-gray-100">
            <button
              onClick={onClose}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
            
            <h2 className="heading-2 text-center mb-2">HOW IT WORKS</h2>
            <p className="text-center text-gray-600">Experience the future of fund accounting</p>
          </div>

          {/* Progress Bar */}
          <div className="px-8 pt-6">
            <div className="flex items-center justify-between mb-8">
              {workflowSteps.map((s, index) => (
                <div key={s.id} className="flex items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                      index <= currentStep
                        ? 'bg-black text-white scale-110'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition-all duration-500 ${
                        index < currentStep ? 'bg-black' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            <div className="text-center mb-8 animate-fadeIn">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-4">
                {step.icon}
              </div>
              <h3 className="heading-3 mb-2">{step.title}</h3>
              <p className="text-gray-600 text-lg">{step.description}</p>
            </div>

            {/* Details */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <h4 className="heading-4 mb-4">KEY FEATURES</h4>
              <ul className="space-y-3">
                {step.details.map((detail, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 animate-fadeInUp"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-700">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Roles */}
            <div className="mb-8">
              <h4 className="heading-4 mb-4">INVOLVED ROLES</h4>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(selectedRole === role ? null : role)}
                    className={`px-4 py-2 rounded-full text-sm font-medium uppercase tracking-wide transition-all duration-300 ${
                      step.roles.includes(role)
                        ? selectedRole === role
                          ? 'bg-black text-white scale-105'
                          : 'bg-gray-900 text-white hover:bg-black'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!step.roles.includes(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
              {selectedRole && step.roles.includes(selectedRole) && (
                <div className="mt-4 p-4 bg-gray-100 rounded-xl animate-fadeIn">
                  <p className="text-sm text-gray-700">
                    {selectedRole === 'Admin' && 'Administrators configure data sources, manage user access, and monitor system health.'}
                    {selectedRole === 'Coordinator' && 'Coordinators ensure quality by reviewing AI-processed tasks before specialist refinement.'}
                    {selectedRole === 'Specialist' && 'Specialists add professional expertise, refine reports, and provide strategic insights.'}
                    {selectedRole === 'Client' && 'Clients access their reports securely and can provide feedback for continuous improvement.'}
                    {selectedRole === 'System' && 'The AI system automatically processes data, identifies patterns, and generates insights.'}
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                  currentStep === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:scale-105'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                PREVIOUS
              </button>

              <div className="flex gap-2">
                {workflowSteps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentStep ? 'w-8 bg-black' : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              {currentStep < workflowSteps.length - 1 ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-medium hover:bg-gray-900 transition-all duration-300 hover:scale-105"
                >
                  NEXT
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-medium hover:bg-green-700 transition-all duration-300 hover:scale-105"
                >
                  GET STARTED
                  <Download className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
