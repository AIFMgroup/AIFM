'use client';

import { useState } from 'react';
import { Button } from './Button';
import {
  ChevronLeft,
  CheckCircle,
  BarChart3,
  Users,
  Settings,
  X,
  ArrowRight,
} from 'lucide-react';

interface Step {
  title: string;
  description: string;
  action: string;
}

interface RoleGuide {
  title: string;
  icon: React.ReactNode;
  description: string;
  steps: Step[];
}

const guides: Record<string, RoleGuide> = {
  coordinator: {
    title: 'Quality Control Workflow',
    icon: <CheckCircle className="w-6 h-6" />,
    description: 'Review and approve pending quality checks',
    steps: [
      {
        title: 'Login to Portal',
        description: 'Access your account with your credentials',
        action: 'Sign in on the home page',
      },
      {
        title: 'Navigate to QC Inbox',
        description: 'Find the QC Inbox in the top navigation menu',
        action: 'Click "QC Inbox" to view pending tasks',
      },
      {
        title: 'View Tasks & Issues',
        description: 'See all tasks with identified errors and warnings',
        action: 'Each task card shows issues that need attention',
      },
      {
        title: 'Review Details',
        description: 'Examine the flagged issues on each task carefully',
        action: 'Read error and warning messages',
      },
      {
        title: 'Approve or Reject',
        description: 'Make your decision on each task',
        action: 'Click Approve to mark task as complete',
      },
      {
        title: 'Track Everything',
        description: 'All your actions are automatically logged',
        action: 'Audit trail maintained for compliance',
      },
    ],
  },
  specialist: {
    title: 'Report Delivery Workflow',
    icon: <BarChart3 className="w-6 h-6" />,
    description: 'Manage reports through approval stages',
    steps: [
      {
        title: 'Login to Portal',
        description: 'Access your account with your credentials',
        action: 'Sign in on the home page',
      },
      {
        title: 'Open Delivery Board',
        description: 'Navigate to your Kanban-style report board',
        action: 'Click "Delivery Board" in the menu',
      },
      {
        title: 'View Report Stages',
        description: 'See reports organized by workflow stage',
        action: 'Columns: Draft → QC → Approval → Published',
      },
      {
        title: 'Edit Drafts',
        description: 'Modify and improve draft reports',
        action: 'Click any draft report to edit',
      },
      {
        title: 'Submit for Review',
        description: 'Move report to next stage for approval',
        action: 'Click next button to advance',
      },
      {
        title: 'Sign & Publish',
        description: 'Finalize and publish approved reports',
        action: 'Reports sent to clients automatically',
      },
    ],
  },
  client: {
    title: 'Report Access Portal',
    icon: <Users className="w-6 h-6" />,
    description: 'View and download your reports',
    steps: [
      {
        title: 'Login to Portal',
        description: 'Access your client account',
        action: 'Sign in on the home page',
      },
      {
        title: 'View Dashboard',
        description: 'See your organization dashboard',
        action: 'Click "Dashboard" in the menu',
      },
      {
        title: 'Browse Reports',
        description: 'See all delivered reports for your organization',
        action: 'Reports listed with dates and status',
      },
      {
        title: 'Download Options',
        description: 'Choose your preferred file format',
        action: 'Available: PDF, Excel, JSON',
      },
      {
        title: 'Review History',
        description: 'Track all downloads and access',
        action: 'View audit trail for compliance',
      },
      {
        title: 'Secure Access',
        description: 'All data encrypted and access controlled',
        action: 'Full GDPR & compliance ready',
      },
    ],
  },
  admin: {
    title: 'System Administration',
    icon: <Settings className="w-6 h-6" />,
    description: 'Monitor and manage the system',
    steps: [
      {
        title: 'Login to Portal',
        description: 'Access with admin credentials',
        action: 'Sign in on the home page',
      },
      {
        title: 'Admin Dashboard',
        description: 'View system health and status',
        action: 'Click "Admin" in the menu',
      },
      {
        title: 'Monitor Health',
        description: 'Check database, queues, and services',
        action: 'See real-time system metrics',
      },
      {
        title: 'Manage Users',
        description: 'Create and configure user accounts',
        action: 'Assign roles to coordinators, specialists, clients',
      },
      {
        title: 'Configure Integrations',
        description: 'Setup Fortnox, Nordigen, and other APIs',
        action: 'Add credentials and API keys',
      },
      {
        title: 'Audit & Compliance',
        description: 'Review logs and ensure compliance',
        action: 'Full audit trail and reporting available',
      },
    ],
  },
};

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingGuide = ({ isOpen, onClose }: OnboardingGuideProps) => {
  const [selectedRole, setSelectedRole] = useState<string>('coordinator');
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const guide = guides[selectedRole];
  const step = guide.steps[currentStep];
  const totalSteps = guide.steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    setCurrentStep(0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-black text-white px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">See How It Works</h2>
            <p className="text-gray-400 text-sm mt-1">Step-by-step walkthrough for your role</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Role Selector */}
          <div className="border-b border-gray-200 bg-gray-50 px-8 py-6">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-4 tracking-wide">Select Your Role</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(guides).map(([key, g]) => (
                <button
                  key={key}
                  onClick={() => handleRoleChange(key)}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    selectedRole === key
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{g.icon}</div>
                  <div className="text-sm font-semibold capitalize">{key}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Role Title & Description */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-white text-xl">
                  {guide.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-black">{guide.title}</h3>
                  <p className="text-gray-600">{guide.description}</p>
                </div>
              </div>
            </div>

            {/* Current Step - Large & Clear */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-8 mb-8">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                    {currentStep + 1}
                  </div>
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Step {currentStep + 1} of {totalSteps}
                  </div>
                </div>
                <h4 className="text-3xl font-bold text-black mb-3">{step.title}</h4>
                <p className="text-lg text-gray-700 mb-4 leading-relaxed">{step.description}</p>
                <div className="bg-gray-100 border-l-4 border-black p-4 rounded">
                  <p className="text-sm font-semibold text-gray-900">What to do:</p>
                  <p className="text-gray-700 mt-1">{step.action}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-black h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Step Dots */}
              <div className="flex gap-2 flex-wrap">
                {guide.steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`w-10 h-10 rounded-full font-semibold text-xs transition-all flex items-center justify-center ${
                      idx === currentStep
                        ? 'bg-black text-white scale-110'
                        : idx < currentStep
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {idx < currentStep ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Navigation */}
        <div className="border-t border-gray-200 bg-gray-50 px-8 py-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="gap-2 border-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {currentStep + 1} / {totalSteps}
          </div>

          <Button
            onClick={handleNext}
            className="gap-2 bg-black text-white hover:bg-gray-900"
          >
            {currentStep === totalSteps - 1 ? (
              <>
                Got it
                <CheckCircle className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
