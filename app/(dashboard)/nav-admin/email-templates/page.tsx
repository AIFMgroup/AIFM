'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Eye, Edit2, Send, Copy, Check,
  FileText, Bell, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  type: 'NAV_DAILY' | 'NAV_APPROVAL' | 'NAV_APPROVED' | 'NAV_REJECTED' | 'NAV_ALERT';
  lastModified: string;
}

// ============================================================================
// Templates
// ============================================================================

const templates: EmailTemplate[] = [
  {
    id: 't1',
    name: 'Daglig NAV-rapport',
    description: 'Skickas dagligen efter NAV-godkännande',
    subject: 'NAV-rapport {date}',
    type: 'NAV_DAILY',
    lastModified: '2026-01-15',
  },
  {
    id: 't2',
    name: 'Godkännande krävs',
    description: 'Notifiering när NAV väntar på godkännande',
    subject: '[Åtgärd krävs] NAV {date} väntar på godkännande',
    type: 'NAV_APPROVAL',
    lastModified: '2026-01-10',
  },
  {
    id: 't3',
    name: 'NAV godkänd',
    description: 'Bekräftelse när NAV har slutgodkänts',
    subject: '[Info] NAV {date} - Godkänd',
    type: 'NAV_APPROVED',
    lastModified: '2026-01-10',
  },
  {
    id: 't4',
    name: 'NAV avvisad',
    description: 'Notifiering när NAV har avvisats',
    subject: '[OBS] NAV {date} - Avvisad',
    type: 'NAV_REJECTED',
    lastModified: '2026-01-10',
  },
  {
    id: 't5',
    name: 'NAV-varning',
    description: 'Varning vid stora förändringar eller fel',
    subject: '[VARNING] NAV {date} - Stor förändring detekterad',
    type: 'NAV_ALERT',
    lastModified: '2026-01-10',
  },
];

// ============================================================================
// Template Preview Component
// ============================================================================

function TemplatePreview({ template }: { template: EmailTemplate }) {
  const getPreviewContent = () => {
    switch (template.type) {
      case 'NAV_DAILY':
        return (
          <div className="font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-aifm-gold to-amber-500 p-6 text-center rounded-t-lg">
              <h1 className="text-white text-xl font-bold">NAV-rapport</h1>
              <p className="text-white/80 text-sm mt-1">Måndag 2 februari 2026</p>
            </div>
            
            {/* Summary */}
            <div className="p-6 bg-white">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-aifm-gold">15.4 Mdr</div>
                  <div className="text-xs text-gray-500 mt-1">Totalt AUM</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-emerald-600">+0.31%</div>
                  <div className="text-xs text-gray-500 mt-1">Genomsnitt</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900">7</div>
                  <div className="text-xs text-gray-500 mt-1">Andelsklasser</div>
                </div>
              </div>
              
              {/* Table Preview */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="p-2 text-left">Fond</th>
                    <th className="p-2 text-right">NAV</th>
                    <th className="p-2 text-right">Förändring</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-2">AuAg Silver Bullet A</td>
                    <td className="p-2 text-right font-medium">378.33</td>
                    <td className="p-2 text-right text-emerald-600">+0.31%</td>
                  </tr>
                  <tr>
                    <td className="p-2">AuAg Gold Rush A</td>
                    <td className="p-2 text-right font-medium">208.71</td>
                    <td className="p-2 text-right text-emerald-600">+0.15%</td>
                  </tr>
                  <tr className="text-gray-400">
                    <td className="p-2" colSpan={3}>... fler rader ...</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-900 p-4 text-center rounded-b-lg">
              <p className="text-white/60 text-xs">
                Genererad {new Date().toLocaleString('sv-SE')} | AIFM AB
              </p>
            </div>
          </div>
        );
        
      case 'NAV_APPROVAL':
        return (
          <div className="font-sans">
            <div className="bg-gray-900 p-6 text-center rounded-t-lg">
              <h1 className="text-white text-xl font-bold">NAV Godkännande</h1>
              <p className="text-white/60 text-sm mt-1">2 februari 2026</p>
            </div>
            <div className="p-6 bg-white">
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6">
                <p className="text-amber-800 font-medium">En ny NAV-beräkning väntar på godkännande</p>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span>AuAg Silver Bullet A</span>
                  <span className="font-medium">378.33 <span className="text-emerald-600 text-sm">+0.31%</span></span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span>AuAg Gold Rush A</span>
                  <span className="font-medium">208.71 <span className="text-emerald-600 text-sm">+0.15%</span></span>
                </div>
              </div>
              <a href="#" className="inline-block bg-aifm-gold text-white px-6 py-3 rounded-lg font-medium">
                Granska NAV
              </a>
            </div>
            <div className="bg-gray-100 p-4 text-center rounded-b-lg">
              <p className="text-gray-500 text-xs">AIFM AB | Automatiskt meddelande</p>
            </div>
          </div>
        );
        
      case 'NAV_APPROVED':
        return (
          <div className="font-sans">
            <div className="bg-gray-900 p-6 text-center rounded-t-lg">
              <h1 className="text-white text-xl font-bold">NAV Godkänd</h1>
            </div>
            <div className="p-6 bg-white">
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-emerald-800 font-medium">NAV har godkänts och publicerats</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Godkänd av: Christopher Genberg</p>
                <p>Tidpunkt: 2026-02-02 15:32</p>
              </div>
            </div>
            <div className="bg-gray-100 p-4 text-center rounded-b-lg">
              <p className="text-gray-500 text-xs">AIFM AB</p>
            </div>
          </div>
        );
        
      case 'NAV_REJECTED':
        return (
          <div className="font-sans">
            <div className="bg-gray-900 p-6 text-center rounded-t-lg">
              <h1 className="text-white text-xl font-bold">NAV Avvisad</h1>
            </div>
            <div className="p-6 bg-white">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800 font-medium">NAV har avvisats av granskare</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600 font-medium mb-1">Anledning:</p>
                <p className="text-sm text-gray-800">Prisdata saknas för 3 positioner</p>
              </div>
              <a href="#" className="inline-block bg-aifm-gold text-white px-6 py-3 rounded-lg font-medium">
                Åtgärda och beräkna om
              </a>
            </div>
            <div className="bg-gray-100 p-4 text-center rounded-b-lg">
              <p className="text-gray-500 text-xs">AIFM AB</p>
            </div>
          </div>
        );
        
      case 'NAV_ALERT':
        return (
          <div className="font-sans">
            <div className="bg-red-600 p-6 text-center rounded-t-lg">
              <h1 className="text-white text-xl font-bold">⚠️ NAV-varning</h1>
            </div>
            <div className="p-6 bg-white">
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
                <p className="text-red-800 font-medium">Stor NAV-förändring detekterad</p>
                <p className="text-red-700 text-sm mt-1">AuAg Silver Bullet A: +8.5% (tröskel: ±5%)</p>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Denna förändring överskrider den konfigurerade tröskeln och kräver manuell granskning innan godkännande.
              </p>
              <a href="#" className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg font-medium">
                Granska omedelbart
              </a>
            </div>
            <div className="bg-gray-100 p-4 text-center rounded-b-lg">
              <p className="text-gray-500 text-xs">AIFM AB | Prioriterat meddelande</p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden max-w-md mx-auto">
      {getPreviewContent()}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function EmailTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(templates[0]);
  const [copied, setCopied] = useState(false);

  const getTypeIcon = (type: EmailTemplate['type']) => {
    switch (type) {
      case 'NAV_DAILY': return FileText;
      case 'NAV_APPROVAL': return Clock;
      case 'NAV_APPROVED': return CheckCircle2;
      case 'NAV_REJECTED': return AlertTriangle;
      case 'NAV_ALERT': return Bell;
      default: return Mail;
    }
  };

  const getTypeColor = (type: EmailTemplate['type']) => {
    switch (type) {
      case 'NAV_DAILY': return 'bg-blue-100 text-blue-600';
      case 'NAV_APPROVAL': return 'bg-amber-100 text-amber-600';
      case 'NAV_APPROVED': return 'bg-emerald-100 text-emerald-600';
      case 'NAV_REJECTED': return 'bg-red-100 text-red-600';
      case 'NAV_ALERT': return 'bg-orange-100 text-orange-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(selectedTemplate.subject);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/nav-admin/settings"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-aifm-charcoal">E-postmallar</h1>
          <p className="text-aifm-charcoal/60 mt-1">
            Förhandsgranska och anpassa NAV-relaterade e-postmeddelanden
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-aifm-charcoal">Mallar</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {templates.map((template) => {
                const Icon = getTypeIcon(template.type);
                const isSelected = selectedTemplate.id === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full p-4 text-left transition-colors ${
                      isSelected ? 'bg-aifm-gold/5 border-l-2 border-aifm-gold' : 'hover:bg-gray-50 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeColor(template.type)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-aifm-charcoal text-sm">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{template.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Template Info */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-aifm-charcoal">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <Edit2 className="w-4 h-4" />
                  Redigera
                </button>
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-aifm-gold rounded-lg hover:bg-aifm-gold/90 transition-colors">
                  <Send className="w-4 h-4" />
                  Testa
                </button>
              </div>
            </div>
            
            {/* Subject */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">Ämne:</span>
              <span className="text-sm font-medium text-gray-900 flex-1">{selectedTemplate.subject}</span>
              <button 
                onClick={handleCopySubject}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
              </button>
            </div>
          </div>

          {/* Email Preview */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-gray-500" />
              <h4 className="font-medium text-gray-700">Förhandsgranskning</h4>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <TemplatePreview template={selectedTemplate} />
            </div>
          </div>

          {/* Variables */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 mb-3">Tillgängliga variabler</h4>
            <div className="flex flex-wrap gap-2">
              {['{date}', '{fundName}', '{navPerShare}', '{change}', '{approverName}', '{reason}', '{aum}'].map((variable) => (
                <code key={variable} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-mono">
                  {variable}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
