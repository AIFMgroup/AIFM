'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Download, Eye, Edit3,
  Send, Sparkles, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface ReportSection {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'not_started';
  lastEdited?: string;
  aiGenerated?: boolean;
}

const reportSections: ReportSection[] = [
  { id: '1', title: 'Förvaltningsberättelse', description: 'Beskrivning av verksamheten och väsentliga händelser', status: 'completed', lastEdited: '2024-11-20', aiGenerated: true },
  { id: '2', title: 'Resultaträkning', description: 'Intäkter, kostnader och årets resultat', status: 'completed', lastEdited: '2024-11-22' },
  { id: '3', title: 'Balansräkning', description: 'Tillgångar, skulder och eget kapital', status: 'completed', lastEdited: '2024-11-22' },
  { id: '4', title: 'Kassaflödesanalys', description: 'In- och utbetalningar under året', status: 'in_progress', lastEdited: '2024-11-25' },
  { id: '5', title: 'Noter', description: 'Förklaringar och specifikationer', status: 'in_progress', aiGenerated: true },
  { id: '6', title: 'Revisionsberättelse', description: 'Revisorns granskning', status: 'pending' },
  { id: '7', title: 'Underskrifter', description: 'Signering av styrelse och VD', status: 'not_started' },
];

const timeline = [
  { date: '2024-12-31', event: 'Räkenskapsårets slut', status: 'upcoming' },
  { date: '2025-02-28', event: 'Utkast till årsredovisning klart', status: 'upcoming' },
  { date: '2025-03-15', event: 'Revision genomförd', status: 'upcoming' },
  { date: '2025-04-30', event: 'Styrelsemöte för godkännande', status: 'upcoming' },
  { date: '2025-05-31', event: 'Årsstämma', status: 'upcoming' },
  { date: '2025-06-30', event: 'Inlämning till Bolagsverket', status: 'upcoming' },
];

function getStatusBadge(status: ReportSection['status']) {
  switch (status) {
    case 'completed':
      return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Klar</span>;
    case 'in_progress':
      return <span className="px-2 py-0.5 rounded-full bg-aifm-gold/20 text-aifm-gold text-xs font-medium">Pågår</span>;
    case 'pending':
      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Väntar</span>;
    case 'not_started':
      return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">Ej påbörjad</span>;
  }
}

export default function AnnualReportPage() {
  const [sections] = useState<ReportSection[]>(reportSections);
  const [selectedYear, setSelectedYear] = useState('2024');

  const completedSections = sections.filter(s => s.status === 'completed').length;
  const totalSections = sections.length;

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-aifm-charcoal/40 mb-2">
          <Link href="/accounting" className="hover:text-aifm-gold transition-colors">Bokföring</Link>
          <span>/</span>
          <span className="text-aifm-charcoal">Årsredovisning</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
              Årsredovisning
            </h1>
            <p className="text-aifm-charcoal/60">
              Generera och granska årsredovisningen för räkenskapsåret {selectedYear}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
            >
              <option value="2024">Räkenskapsår 2024</option>
              <option value="2023">Räkenskapsår 2023</option>
            </select>
            <button className="px-4 py-2 bg-aifm-charcoal text-white rounded-lg text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportera PDF
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-aifm-charcoal">Årsredovisning {selectedYear}</h2>
            <p className="text-xs text-aifm-charcoal/50 mt-1">{completedSections} av {totalSections} avsnitt klara</p>
          </div>
          <span className="text-2xl font-medium text-aifm-charcoal">{Math.round((completedSections / totalSections) * 100)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-aifm-gold rounded-full transition-all duration-500"
            style={{ width: `${(completedSections / totalSections) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Report Sections */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                Innehåll
              </h2>
              <button className="text-sm text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Generera med AI
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {sections.map((section, index) => (
                <div key={section.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                      ${section.status === 'completed' ? 'bg-green-100' : 
                        section.status === 'in_progress' ? 'bg-aifm-gold/20' : 
                        'bg-gray-100'}`}
                    >
                      {section.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-aifm-charcoal">{section.title}</h3>
                        {getStatusBadge(section.status)}
                        {section.aiGenerated && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-aifm-gold/10 rounded text-xs text-aifm-gold">
                            <Sparkles className="w-3 h-3" />
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-aifm-charcoal/50">{section.description}</p>
                      {section.lastEdited && (
                        <p className="text-xs text-aifm-charcoal/40 mt-1">Senast redigerad: {section.lastEdited}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-gray-400 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors" title="Förhandsgranska">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors" title="Redigera">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                Tidsplan
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {timeline.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        item.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                      {index < timeline.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs text-aifm-charcoal/50">{item.date}</p>
                      <p className="text-sm text-aifm-charcoal">{item.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-aifm-charcoal rounded-xl p-6">
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
              Åtgärder
            </h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors">
                <span className="text-sm">Förhandsgranska hela</span>
                <Eye className="w-4 h-4 text-white/50" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors">
                <span className="text-sm">Exportera till Word</span>
                <Download className="w-4 h-4 text-white/50" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors">
                <span className="text-sm">Skicka till revisor</span>
                <Send className="w-4 h-4 text-white/50" />
              </button>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Observera</p>
                <p className="text-xs text-amber-700 mt-1">
                  Kassaflödesanalysen behöver slutföras innan årsredovisningen kan färdigställas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

