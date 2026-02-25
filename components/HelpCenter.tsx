'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  HelpCircle, X, ChevronRight, Search,
  Building2, Users, FolderOpen, Scale, Shield,
  BarChart3, FileText, Settings, Bell, Download, CheckSquare,
  Lightbulb, AlertTriangle, CheckCircle2, ArrowRight,
  Lock, Key, RefreshCw, Clock, 
  Mail, MessageSquare, Monitor, Filter,
  TrendingUp, BookOpen, Star,
  Layers, Target, Sparkles, Bot, ClipboardList, Eye,
  ClipboardCheck, ShieldCheck
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  color: string;
  content: HelpContent;
}

interface HelpContent {
  overview: string;
  features: Feature[];
  setup?: SetupStep[];
  tips?: string[];
  faq?: FAQ[];
}

interface Feature {
  title: string;
  description: string;
  icon?: React.ElementType;
}

interface SetupStep {
  step: number;
  title: string;
  description: string;
  details?: string[];
}

interface FAQ {
  question: string;
  answer: string;
}

const helpSections: HelpSection[] = [
  {
    id: 'overview',
    title: 'Om AIFM-plattformen',
    icon: Sparkles,
    description: 'Vad är AIFM och hur hjälper den din verksamhet',
    color: 'from-amber-500 to-orange-500',
    content: {
      overview: `AIFM är en komplett plattform för alternativa investeringsfonder. Den samlar alla verktyg du behöver för att hantera värdepappersgodkännanden, ESG-analys, compliance, investeringsanalys och dokumenthantering på ett ställe. Plattformen är designad för att spara tid, minska risker och ge dig full kontroll — med rollbaserad åtkomst för förvaltare, operations och administratörer.`,
      features: [
        { title: 'Rollbaserat system', description: 'Förvaltare, Operations och Admin med anpassade vyer och behörigheter', icon: Users },
        { title: 'Värdepappersgodkännande', description: 'Komplett flöde från ansökan till granskning och godkännande', icon: ClipboardCheck },
        { title: 'ESG & SFDR', description: 'Automatisk ESG-analys med Datia-integration, stöd för Artikel 6/8/9', icon: Scale },
        { title: 'AI-driven analys', description: 'Claude 4.6 Opus granskar ansökningar mot fondvillkor och ger rekommendationer', icon: Bot },
        { title: 'Säker multi-tenant', description: 'Varje användare ser bara data de har behörighet till', icon: Lock },
        { title: 'Automatisk arkivering', description: 'Analyser sparas automatiskt som PDF i ditt personliga datarum', icon: FolderOpen },
      ],
      tips: [
        'Använd ⌘K (Cmd+K) för snabb navigering i hela plattformen',
        'Pinna ofta använda sidor till favoriter för snabb åtkomst',
        'ESG-analysresultat bevaras om du navigerar bort och tillbaka',
        'Alla analyser arkiveras automatiskt i Dokument → Datarum',
      ],
    }
  },
  {
    id: 'securities',
    title: 'Ansök om nytt värdepapper',
    icon: ClipboardCheck,
    description: 'Komplett flöde för värdepappersansökan med automatisk analys',
    color: 'from-blue-500 to-indigo-500',
    content: {
      overview: `Värdepappersansökan är ett steg-för-steg-formulär där förvaltare söker godkännande för nya värdepapper. Systemet hämtar automatiskt data via Yahoo Finance och Datia ESG, kör kontroller mot fondvillkor (SFDR Artikel 6/8/9) och genererar en professionell PDF. Operations granskar sedan ansökan med AI-stöd.`,
      features: [
        { title: 'Automatisk datahämtning', description: 'Sök via ISIN eller ticker — Yahoo Finance fyller i pris, sektor, valuta m.m.', icon: TrendingUp },
        { title: 'ESG-screening via Datia', description: 'Realtidsdata för ESG-poäng, exkluderingskontroll och PAI-indikatorer', icon: Scale },
        { title: 'Fondvillkorskontroll', description: 'Automatisk kontroll mot fondens placeringsregler, koncentrationsgränser och exkluderingar', icon: ShieldCheck },
        { title: 'AI-ifyllning', description: 'Claude analyserar värdepappret och fyller i fondförensstämmelse, LVF-krav och likviditetsanalys', icon: Bot },
        { title: 'Summering & PDF', description: 'Sista steget visar en komplett sammanfattning med nedladdningsbar PDF', icon: FileText },
        { title: 'Skicka för granskning', description: 'Ansökan skickas till Operations för granskning och godkännande', icon: CheckSquare },
      ],
      setup: [
        { step: 1, title: 'Sök värdepapper', description: 'Ange ISIN-kod eller ticker i sökfältet', details: ['Yahoo Finance hämtar automatiskt namn, pris, sektor och land', 'Datia hämtar ESG-data om tillgängligt', 'Grundläggande information fylls i'] },
        { step: 2, title: 'Fyll i grundläggande info', description: 'Granska och komplettera automatiskt ifylld data', details: ['Välj fond att ansöka för', 'SFDR-artikel sätts automatiskt baserat på fonden', 'AI fyller i fondförensstämmelse'] },
        { step: 3, title: 'Gå igenom alla steg', description: 'Fondbestämmelse, FFFS, LVF, Likviditet, ESG, Summering', details: ['Varje steg har automatisk ifyllning från AI', 'Röda fält kräver manuell granskning', 'ESG-steget visar exkluderingskontroll och PAI'] },
        { step: 4, title: 'Granska summering & skicka', description: 'Sista steget visar en komplett sammanfattning', details: ['Ladda ner PDF med hela caset', 'Klicka "Skicka för granskning" för att skicka till Operations', 'Ansökan sparas automatiskt vid varje steg'] },
      ],
      tips: [
        'ISIN-sökning ger bäst resultat — ticker fungerar också men kan ge flera träffar',
        'ESG-varningar visas om värdepappret inte klarar fondens exkluderingskriterier',
        'Du kan spara och återkomma till ansökan senare via Godkända värdepapper',
        'PDF:en inkluderar all data och rekommendation — perfekt för arkivering',
      ],
      faq: [
        { question: 'Varför får jag ESG-varning?', answer: 'ESG-varningen visas om värdepappret inte klarar fondens exkluderingskriterier (t.ex. vapenexponering för Artikel 8/9-fonder). Du kan fortfarande skicka in ansökan med motivering.' },
        { question: 'Vad händer efter att jag skickat?', answer: 'Ansökan hamnar hos Operations för granskning. De använder AI-analys för att bedöma om värdepappret uppfyller fondvillkoren. Du får en notis när beslutet är fattat.' },
        { question: 'Kan jag redigera en inskickad ansökan?', answer: 'Nej, men om Operations begär komplettering kan du svara med ytterligare information direkt i ansökan.' },
        { question: 'Hur lång giltighetstid har godkännandet?', answer: 'Godkännanden gäller i 12 månader. Du får en notis 30 dagar innan utgång.' },
      ],
    }
  },
  {
    id: 'esg',
    title: 'ESG-analys',
    icon: Scale,
    description: 'SFDR-baserad ESG-analys med Datia-integration',
    color: 'from-emerald-500 to-teal-500',
    content: {
      overview: `ESG-modulen hjälper dig att genomföra en strukturerad hållbarhetsanalys enligt SFDR (Artikel 6, 8 eller 9). Ladda upp dokument, och AI:n analyserar automatiskt alla frågor kring normbaserad screening, exkludering, PAI-indikatorer, EU-taxonomi och Good Governance. Resultaten sparas automatiskt i ditt personliga datarum.`,
      features: [
        { title: 'SFDR Artikel 6/8/9', description: 'Anpassade frågor baserat på fondens hållbarhetsklassificering', icon: Target },
        { title: 'Normbaserad screening', description: 'Kontroll mot UNGC, OECD, mänskliga rättigheter och antikorruption', icon: Shield },
        { title: 'Exkluderingskontroll', description: 'Automatisk screening mot vapen, tobak, fossila bränslen m.m.', icon: AlertTriangle },
        { title: 'PAI-indikatorer', description: 'Principal Adverse Impact med historisk data och trender', icon: BarChart3 },
        { title: 'EU Taxonomi', description: 'Bedömning av taxonomianpassning och DNSH-kriterier', icon: CheckCircle2 },
        { title: 'Auto-arkivering', description: 'PDF genereras och sparas automatiskt i ditt datarum', icon: FolderOpen },
      ],
      setup: [
        { step: 1, title: 'Välj SFDR-artikel', description: 'Välj vilken artikelklassificering analysen gäller', details: ['Artikel 6: Grundläggande hållbarhetskrav', 'Artikel 8: Främjar miljö-/sociala egenskaper', 'Artikel 9: Hållbar investering som mål'] },
        { step: 2, title: 'Ladda upp dokument', description: 'Dra och släpp PDF:er med information om värdepappret', details: ['Hållbarhetsrapporter, årsredovisningar, ESG-data', 'AI analyserar dokumenten och fyller i alla frågor', 'Gula markeringar visar AI-ifyllda svar'] },
        { step: 3, title: 'Granska och justera', description: 'Gå igenom alla steg och korrigera vid behov', details: ['Normbaserad screening, exkludering, Good Governance', 'ESG-riskanalys, PAI-indikatorer, EU Taxonomi', 'Signera och slutför analysen'] },
      ],
      tips: [
        'Analysresultat sparas i sessionen — du kan navigera bort och tillbaka utan att förlora data',
        'Alla ESG-analyser arkiveras automatiskt som PDF i Dokument → Datarum',
        'Ladda ner PDF:en från steg 8 (Sammanfattning) för extern delning',
      ],
      faq: [
        { question: 'Hur får jag ESG-data automatiskt?', answer: 'Datia-integrationen hämtar ESG-poäng, exkluderingsflaggor och PAI-data automatiskt. Vid värdepappersansökan sker detta via ISIN-sökning.' },
        { question: 'Vilka SFDR-artiklar stöds?', answer: 'Alla tre: Artikel 6 (grundkrav), Artikel 8 (främjar E/S) och Artikel 9 (hållbarhetsmål). Frågorna anpassas automatiskt.' },
        { question: 'Sparas analysen automatiskt?', answer: 'Ja, vid avslutad analys genereras en PDF och sparas i ditt personliga datarum under "ESG-analyser".' },
      ],
    }
  },
  {
    id: 'operations',
    title: 'Operations & Granskning',
    icon: ShieldCheck,
    description: 'Granska och godkänn värdepappersansökningar',
    color: 'from-rose-500 to-red-500',
    content: {
      overview: `Operations-vyn ger full insyn i alla värdepappersansökningar. Granska ansökningar med AI-stöd (Claude 4.6 Opus analyserar mot fondvillkor), godkänn eller avslå med motivering, begär komplettering, och kommunicera med förvaltare via diskussionstrådar. Alla beslut loggas i en audit trail.`,
      features: [
        { title: 'Granska värdepapper', description: 'Översikt av alla inskickade ansökningar med status och detaljer', icon: ClipboardList },
        { title: 'AI-analys', description: 'Claude 4.6 Opus granskar ansökan mot fondvillkor och ger rekommendation (GODKÄNN/AVSLÅ)', icon: Bot },
        { title: 'Godkänn/Avslå/Komplettera', description: 'Tre handlingsalternativ med kommentarfält och motivering', icon: CheckSquare },
        { title: 'Diskussionstråd', description: 'Kommunicera direkt med förvaltaren om en specifik ansökan', icon: MessageSquare },
        { title: 'Audit trail', description: 'Fullständig tidslinje över alla händelser per ansökan', icon: Clock },
        { title: 'Alla godkända', description: 'Översikt av alla godkända värdepapper med utgångsdatum', icon: Star },
      ],
      faq: [
        { question: 'Hur fungerar AI-granskningen?', answer: 'Klicka "AI-analys" på en ansökan. Claude analyserar värdepappret mot fondens SFDR-klassificering, exkluderingsregler och placeringsregler, och ger en strukturerad rekommendation.' },
        { question: 'Vad händer vid "Begär komplettering"?', answer: 'Ansökan får status "needs_info" och förvaltaren får en notis med din fråga. De kan svara direkt i systemet.' },
        { question: 'Hur länge gäller ett godkännande?', answer: '12 månader. Systemet skickar automatiskt notis 30 dagar innan utgång.' },
      ],
    }
  },
  {
    id: 'approved',
    title: 'Godkända värdepapper',
    icon: CheckSquare,
    description: 'Se och hantera dina godkända värdepapper',
    color: 'from-green-500 to-emerald-500',
    content: {
      overview: `Här ser förvaltare sina godkända värdepapper med utgångsdatum. Godkännanden gäller i 12 månader. Systemet varnar 30 dagar innan utgång och du kan enkelt förnya genom att skapa en ny ansökan med förifylld data.`,
      features: [
        { title: 'Utgångsövervakning', description: 'Tydliga varningsbadges för godkännanden som snart löper ut', icon: AlertTriangle },
        { title: 'Förnya godkännande', description: 'Ett klick skapar ny ansökan med all data från det befintliga godkännandet', icon: RefreshCw },
        { title: 'Villkor & kommentarer', description: 'Se Operations kommentarer och eventuella villkor för godkännandet', icon: MessageSquare },
        { title: 'PDF-nedladdning', description: 'Ladda ner den kompletta ansökan som PDF', icon: Download },
      ],
      faq: [
        { question: 'Hur förnyar jag ett godkännande?', answer: 'Klicka "Förnya" på godkännandet. En ny ansökan skapas med all data förifylld — granska och skicka in.' },
        { question: 'Vad händer när ett godkännande löper ut?', answer: 'Du får en notis 30 dagar innan. Om det inte förnyas går det till status "expired" och värdepappret behöver ansökas på nytt.' },
      ],
    }
  },
  {
    id: 'investment-analysis',
    title: 'Investeringsanalys',
    icon: TrendingUp,
    description: 'AI-driven investeringsanalys med dokumentstöd',
    color: 'from-violet-500 to-purple-500',
    content: {
      overview: `Investeringsanalys-modulen ger dig djupgående analys av potentiella investeringar. Ladda upp dokument (årsredovisningar, prospekt, etc.) och få en strukturerad analys med finansiella nyckeltal, risker och möjligheter. Resultaten sparas automatiskt i ditt datarum.`,
      features: [
        { title: 'Dokumentanalys', description: 'Ladda upp PDF:er och få AI-driven analys av innehållet', icon: FileText },
        { title: 'Finansiella nyckeltal', description: 'Automatisk extraktion av omsättning, vinst, skuldsättning m.m.', icon: BarChart3 },
        { title: 'Risk & möjligheter', description: 'Strukturerad bedömning av risker och potentiella uppsidor', icon: AlertTriangle },
        { title: 'PDF-export', description: 'Professionell investeringsrapport som PDF', icon: Download },
      ],
      tips: [
        'Ladda upp årsredovisningar för bäst resultat — AI:n kan extrahera nyckeltal',
        'Kombinera flera dokument för en mer komplett analys',
        'Rapporten arkiveras automatiskt i ditt datarum',
      ],
    }
  },
  {
    id: 'delegation',
    title: 'Delegationsövervakning',
    icon: Eye,
    description: 'Övervaka och dokumentera delegerad portföljförvaltning',
    color: 'from-cyan-500 to-blue-500',
    content: {
      overview: `Delegationsövervakning hjälper dig att systematiskt dokumentera och övervaka delegerad portföljförvaltning. Fyll i frågeformulär om förvaltarens organisation, riskhantering och regelefterlevnad. AI assisterar med att fylla i baserat på uppladdade dokument.`,
      features: [
        { title: 'Strukturerat formulär', description: 'Frågor om organisation, kompetens, riskhantering och regelefterlevnad', icon: ClipboardList },
        { title: 'AI-assistans', description: 'Automatisk ifyllning baserat på uppladdade dokument', icon: Bot },
        { title: 'Underlagskontroll', description: 'Checklista för nödvändiga underlag och dokument', icon: CheckSquare },
        { title: 'PDF & arkivering', description: 'Exportera som PDF och automatisk arkivering i datarum', icon: FolderOpen },
      ],
    }
  },
  {
    id: 'documents',
    title: 'Dokument & Datarum',
    icon: FolderOpen,
    description: 'Säker dokumenthantering och automatisk arkivering',
    color: 'from-amber-500 to-yellow-500',
    content: {
      overview: `Dokumenthanteringen ger dig säker lagring och delning av alla dokument. Ditt personliga datarum ("Mina analyser") skapas automatiskt och samlar alla ESG-analyser, investeringsanalyser, värdepappersgodkännanden och delegationsövervakningar som PDF:er.`,
      features: [
        { title: 'Personligt datarum', description: 'Automatiskt arkiv med mappar per analystyp', icon: FolderOpen },
        { title: 'Auto-arkivering', description: 'Alla analyser sparas automatiskt som PDF vid slutförande', icon: RefreshCw },
        { title: 'Rapporter', description: 'Filtrera per fond, tidsperiod och dokumenttyp', icon: Filter },
        { title: 'Fondvillkor', description: 'Skrapade fondvillkor och hållbarhetsrapporter per fond', icon: BookOpen },
        { title: 'Behörighetsstyrning', description: 'Detaljerad åtkomst per mapp och dokument', icon: Lock },
        { title: 'Aktivitetslogg', description: 'Se vem som öppnat vilka dokument och när', icon: Clock },
      ],
      faq: [
        { question: 'Var hittar jag mina sparade analyser?', answer: 'Gå till Dokument → Datarum. Ditt personliga rum "Mina analyser" har mappar för ESG-analyser, Investeringsanalyser, Värdepappersgodkännanden och Delegationsövervakningar.' },
        { question: 'Sparas analyser automatiskt?', answer: 'Ja! Alla slutförda analyser genererar automatiskt en PDF som arkiveras i ditt personliga datarum.' },
        { question: 'Hur säker är dokumentlagringen?', answer: 'Alla dokument krypteras i vila och i transit. Lagring sker i AWS inom EU (Stockholm, eu-north-1).' },
      ],
    }
  },
  {
    id: 'nav-processes',
    title: 'NAV-processer',
    icon: BarChart3,
    description: 'Hantera NAV-beräkningar, rapporter och ägardata',
    color: 'from-violet-500 to-purple-500',
    content: {
      overview: `NAV-modulen automatiserar alla processer kring Net Asset Value — från beräkning till rapportering och distribution av prisdata. Hantera Notor & SubReds, ägardata och säkerställ att alla intressenter får korrekt information i rätt tid.`,
      features: [
        { title: 'NAV Dashboard', description: 'Överblick över alla fonder med AUM, NAV-utveckling och statistik', icon: BarChart3 },
        { title: 'NAV-rapporter', description: 'Generera och skicka fondblad, kvartalsrapporter och årsrapporter', icon: FileText },
        { title: 'Notor & SubReds', description: 'Automatisera hantering av insättningar och uttag', icon: RefreshCw },
        { title: 'Ägardata', description: 'Hantera ägarförteckning och förvaltarregistrerade', icon: Users },
      ],
      faq: [
        { question: 'Hur ofta uppdateras NAV?', answer: 'Du kan konfigurera beräkningsfrekvens — vanligtvis dagligen, veckovis eller månadsvis beroende på fondtyp.' },
        { question: 'Vad är skillnaden mellan Notor och SubReds?', answer: 'Notor är insättningsavier (nya investeringar) och SubReds är uttagsavier (uttag/inlösen). Båda hanteras i samma vy.' },
      ],
    }
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: Shield,
    description: 'Regelefterlevnad, AIFM-krav och rapportering',
    color: 'from-rose-500 to-red-500',
    content: {
      overview: `Compliance-modulen hjälper dig att uppfylla AIFMD-kraven och andra regulatoriska krav. Hantera KYC och AML, generera rapporter till Finansinspektionen, och använd AI-assistenten för regelverksfrågor.`,
      features: [
        { title: 'Regelverksassistent', description: 'AI-baserad hjälp med compliance-frågor', icon: Bot },
        { title: 'KYC/AML', description: 'Hantera kundkännedomskrav och penningtvättskontroller', icon: Shield },
        { title: 'FI-rapportering', description: 'Generera rapporter till Finansinspektionen', icon: FileText },
        { title: 'Riskhantering', description: 'Dokumentera och övervaka risker enligt AIFMD', icon: AlertTriangle },
        { title: 'Revision trail', description: 'Fullständig spårbarhet för alla compliance-åtgärder', icon: Clock },
      ],
    }
  },
  {
    id: 'security',
    title: 'Säkerhet & Roller',
    icon: Key,
    description: 'Rollhantering, behörigheter och säkerhet',
    color: 'from-slate-500 to-gray-600',
    content: {
      overview: `AIFM har rollbaserad åtkomstkontroll (RBAC) med tre huvudroller: Förvaltare (begränsad vy med värdepappersansökan och ESG), Operations (full vy plus granskning) och Admin (allt). Varje användare kopplas till specifika fonder via admin-panelen.`,
      features: [
        { title: 'Tre roller', description: 'Förvaltare, Operations och Admin med olika behörigheter', icon: Users },
        { title: 'Fondkoppling', description: 'Förvaltare kopplas till specifika fonder i admin-panelen', icon: Building2 },
        { title: 'Middleware-skydd', description: 'Rollbaserade sökvägsrestriktioner på server-nivå', icon: Shield },
        { title: 'Cognito-grupper', description: 'AWS Cognito hanterar autentisering och gruppmedlemskap', icon: Key },
        { title: 'Audit trail', description: 'Fullständig logg över alla åtgärder i systemet', icon: Clock },
        { title: 'Sessionshantering', description: 'Säkra sessioner med automatisk timeout', icon: Monitor },
      ],
      faq: [
        { question: 'Vilka roller finns?', answer: 'Förvaltare (ser bara ansök, ESG, godkända, investeringsanalys, delegationsövervakning), Operations (allt + granskning av värdepapper) och Admin (full tillgång inkl. användarhantering).' },
        { question: 'Hur kopplar jag en förvaltare till en fond?', answer: 'Gå till Administration → Användare, klicka på användaren och lägg till fondkopplingar i fliken "Fonder".' },
        { question: 'Kan en användare ha flera roller?', answer: 'En användare kan tillhöra flera Cognito-grupper, men den högst prioriterade rollen gäller (Admin > Operations > Förvaltare).' },
      ],
    }
  },
  {
    id: 'notifications',
    title: 'Notifikationer',
    icon: Bell,
    description: 'Händelsebaserade notiser och utgångsvarningar',
    color: 'from-pink-500 to-rose-500',
    content: {
      overview: `Systemet skickar automatiska notifikationer vid viktiga händelser: godkännanden/avslag av värdepapper, begäran om komplettering, diskussionsmeddelanden och utgångsvarningar 30 dagar innan värdepappersgodkännanden löper ut. Månatliga cron-jobb övervakar även portföljförändringar.`,
      features: [
        { title: 'Godkännande/Avslag', description: 'Notis när Operations fattar beslut om din ansökan', icon: CheckSquare },
        { title: 'Kompletteringsbegäran', description: 'Notis när Operations ställer frågor om din ansökan', icon: MessageSquare },
        { title: 'Utgångsvarningar', description: 'Automatisk varning 30 dagar innan godkännande löper ut', icon: AlertTriangle },
        { title: 'Månadsövervakning', description: 'AI-driven genomgång av godkända värdepapper varje månad', icon: RefreshCw },
      ],
    }
  },
];

// ============================================================================
// Subcomponents
// ============================================================================

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all rounded-lg
        ${active ? 'bg-aifm-charcoal text-white' : 'text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}

function SectionNav({ sections, activeSection, onSelect }: { sections: HelpSection[]; activeSection: string; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="sm:hidden flex-shrink-0 border-b border-gray-100 overflow-x-auto scrollbar-none">
        <div className="flex p-2 gap-2 min-w-max">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button key={section.id} onClick={() => onSelect(section.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all
                  ${isActive ? 'bg-aifm-gold/10 text-aifm-charcoal' : 'text-aifm-charcoal/60 hover:bg-gray-50'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all
                  ${isActive ? `bg-gradient-to-br ${section.color} text-white` : 'bg-gray-100 text-gray-500'}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium">{section.title}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden sm:block w-64 flex-shrink-0 border-r border-gray-100 overflow-y-auto">
        <div className="p-4 space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button key={section.id} onClick={() => onSelect(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                  ${isActive ? 'bg-aifm-gold/10 text-aifm-charcoal' : 'text-aifm-charcoal/60 hover:bg-gray-50 hover:text-aifm-charcoal'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${isActive ? `bg-gradient-to-br ${section.color} text-white` : 'bg-gray-100 text-gray-500'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium truncate">{section.title}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-aifm-gold ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon || CheckCircle2;
  return (
    <div className="p-4 bg-gray-50 rounded-xl hover:bg-aifm-gold/5 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 group-hover:border-aifm-gold/30 transition-colors">
          <Icon className="w-4.5 h-4.5 text-aifm-charcoal/60 group-hover:text-aifm-gold transition-colors" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-aifm-charcoal">{feature.title}</h4>
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">{feature.description}</p>
        </div>
      </div>
    </div>
  );
}

function SetupStepCard({ step }: { step: SetupStep }) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-aifm-charcoal flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">{step.step}</span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-aifm-charcoal">{step.title}</h4>
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">{step.description}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-aifm-charcoal/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>
      {isExpanded && step.details && (
        <div className="px-4 pb-4 pl-16">
          <ul className="space-y-2">
            {step.details.map((detail, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-aifm-charcoal/70">
                <ArrowRight className="w-3 h-3 text-aifm-gold flex-shrink-0 mt-0.5" />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FAQItem({ faq }: { faq: FAQ }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-start gap-3 py-3 text-left">
        <HelpCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-colors ${isOpen ? 'text-aifm-gold' : 'text-aifm-charcoal/40'}`} />
        <span className={`text-sm transition-colors ${isOpen ? 'text-aifm-charcoal font-medium' : 'text-aifm-charcoal/70'}`}>{faq.question}</span>
        <ChevronRight className={`w-4 h-4 text-aifm-charcoal/30 ml-auto transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-3 pl-7">
          <p className="text-sm text-aifm-charcoal/60">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

function SectionContent({ section }: { section: HelpSection }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'setup' | 'faq'>('overview');
  const Icon = section.icon;
  const hasSetup = section.content.setup && section.content.setup.length > 0;
  const hasFaq = section.content.faq && section.content.faq.length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-semibold text-aifm-charcoal">{section.title}</h2>
            <p className="text-xs sm:text-sm text-aifm-charcoal/50 mt-0.5">{section.description}</p>
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-2 sm:py-3 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-none">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Översikt</TabButton>
        {hasSetup && <TabButton active={activeTab === 'setup'} onClick={() => setActiveTab('setup')}>Kom igång</TabButton>}
        {hasFaq && <TabButton active={activeTab === 'faq'} onClick={() => setActiveTab('faq')}>Vanliga frågor</TabButton>}
      </div>
      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-aifm-gold/5 rounded-2xl p-5 border border-aifm-gold/10">
              <p className="text-sm text-aifm-charcoal/70 leading-relaxed">{section.content.overview}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">Funktioner</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {section.content.features.map((feature, i) => <FeatureCard key={i} feature={feature} />)}
              </div>
            </div>
            {section.content.tips && section.content.tips.length > 0 && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-emerald-800">Tips</h3>
                </div>
                <ul className="space-y-2">
                  {section.content.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                      <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {activeTab === 'setup' && hasSetup && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">Steg-för-steg guide</h3>
            {section.content.setup!.map((step, i) => <SetupStepCard key={i} step={step} />)}
          </div>
        )}
        {activeTab === 'faq' && hasFaq && (
          <div>
            <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">Vanliga frågor</h3>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              {section.content.faq!.map((faq, i) => <FAQItem key={i} faq={faq} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HelpCenterButton() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-400 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-colors"
        title="Hjälpcenter"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
      {isOpen && <HelpCenterModal onClose={() => setIsOpen(false)} />}
    </>
  );
}

export function HelpCenterModal({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const currentSection = helpSections.find(s => s.id === activeSection) || helpSections[0];

  const filteredSections = searchQuery
    ? helpSections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : helpSections;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-5xl h-[90vh] sm:h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-aifm-gold to-amber-500 flex items-center justify-center">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-aifm-charcoal">Hjälpcenter</h1>
              <p className="text-[10px] sm:text-xs text-aifm-charcoal/50">Allt du behöver veta om AIFM</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök i hjälpen..."
                className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl w-64 focus:outline-none focus:border-aifm-gold focus:ring-1 focus:ring-aifm-gold/20"
              />
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-aifm-charcoal/50" />
            </button>
          </div>
        </div>
        <div className="sm:hidden px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök i hjälpen..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-aifm-gold focus:ring-1 focus:ring-aifm-gold/20"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          <SectionNav sections={filteredSections} activeSection={activeSection} onSelect={setActiveSection} />
          <SectionContent section={currentSection} />
        </div>
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <p className="text-[10px] sm:text-xs text-aifm-charcoal/40">
            <span className="hidden sm:inline">Tryck <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">ESC</kbd> för att stänga</span>
            <span className="sm:hidden">Svep ner för att stänga</span>
          </p>
          <a href="mailto:support@aifmgroup.se" className="text-xs text-aifm-charcoal/50 hover:text-aifm-gold transition-colors">
            Kontakta support
          </a>
        </div>
      </div>
    </div>
  );
}

export default HelpCenterButton;
