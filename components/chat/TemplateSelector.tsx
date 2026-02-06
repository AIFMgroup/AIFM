'use client';

import { FileText, Shield, BarChart3, Scale } from 'lucide-react';

export type TemplateId = 'nav' | 'compliance' | 'dokument' | 'regulatorisk';

export interface ChatTemplate {
  id: TemplateId;
  title: string;
  description: string;
  initialMessage: string;
  icon: React.ReactNode;
}

export const CHAT_TEMPLATES: ChatTemplate[] = [
  {
    id: 'nav',
    title: 'NAV-beräkning steg-för-steg',
    description: 'Gå igenom metodik, komponenter och rapportering',
    initialMessage: 'Jag vill gå igenom NAV-beräkning steg-för-steg. Kan du förklara metodik, vilka komponenter som ingår och hur rapporteringen ser ut?',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    id: 'compliance',
    title: 'Compliance-granskning',
    description: 'Krav, kontrollpunkter och rekommendationer',
    initialMessage: 'Jag behöver hjälp med en compliance-granskning. Vilka krav och kontrollpunkter bör jag ta med, och hur dokumenterar jag rekommendationer?',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 'dokument',
    title: 'Dokumentanalys',
    description: 'Analysera och sammanfatta dokument',
    initialMessage: 'Jag vill analysera ett dokument. Kan du hjälpa mig att sammanfatta innehåll, identifiera nyckelpunkter och eventuella åtgärdsbehov?',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 'regulatorisk',
    title: 'Regulatorisk fråga',
    description: 'Lagar, föreskrifter och källhänvisning',
    initialMessage: 'Jag har en regulatorisk fråga. Vilka lagar och föreskrifter (t.ex. LAIF, FFFS, AIFMD) är relevanta och hur tolkas de i praktiken?',
    icon: <Scale className="w-5 h-5" />,
  },
];

interface TemplateSelectorProps {
  onSelect: (template: ChatTemplate) => void;
  isDarkMode?: boolean;
}

export function TemplateSelector({ onSelect, isDarkMode = false }: TemplateSelectorProps) {
  return (
    <div className="w-full max-w-lg mx-auto">
      <p className={`text-xs sm:text-sm mb-3 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Välj en mall för att komma igång
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {CHAT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className={`text-left p-3 sm:p-4 rounded-xl border transition-all touch-manipulation active:scale-[0.98] ${
              isDarkMode
                ? 'border-gray-600 bg-gray-800/80 hover:bg-gray-700/80 hover:border-[#c0a280]/40 text-gray-100'
                : 'border-gray-200 bg-white hover:bg-[#c0a280]/5 hover:border-[#c0a280]/30 text-[#2d2a26] shadow-sm'
            }`}
          >
            <div className={`flex items-center gap-2 mb-1.5 ${isDarkMode ? 'text-[#c0a280]' : 'text-[#8b7355]'}`}>
              {template.icon}
              <span className="font-semibold text-sm">{template.title}</span>
            </div>
            <p className={`text-xs leading-snug ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {template.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
