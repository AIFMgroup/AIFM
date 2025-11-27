'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Play } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

// Guide sections - minimalist, no colors
const guideSections = [
  { id: 'overview', title: 'Översikt' },
  { id: 'funds', title: 'Fonder' },
  { id: 'capital-calls', title: 'Kapitalanrop' },
  { id: 'distributions', title: 'Utdelningar' },
  { id: 'investors', title: 'Investerare' },
  { id: 'treasury', title: 'Likviditet' },
  { id: 'data-rooms', title: 'Datarum' },
  { id: 'approvals', title: 'Godkännanden' },
  { id: 'portfolio', title: 'Portfölj' },
  { id: 'bookkeeping', title: 'Bokföring' },
];

// Content for each section
const guideContent: Record<string, {
  title: string;
  description: string;
  hasVideo?: boolean;
  steps: { title: string; description: string }[];
  features: string[];
  tips: string[];
  link: string;
}> = {
  'overview': {
    title: 'Välkommen till AIFM',
    description: 'AIFM är ett komplett fondadministrationssystem byggt för att automatisera ditt arbete med AI, samtidigt som du behåller full kontroll.',
    steps: [
      { title: 'Logga in', description: 'Använd dina inloggningsuppgifter eller BankID för säker åtkomst' },
      { title: 'Välj fond', description: 'Välj vilken fond du vill arbeta med i dropdown-menyn' },
      { title: 'Navigera', description: 'Använd menyn för att gå till olika funktioner' },
      { title: 'Få hjälp', description: 'Klicka på ? vid varje funktion för att få förklaring' },
    ],
    features: [
      'AI-automatisering för bokföring och dokument',
      '4-ögon princip för alla transaktioner',
      'Full spårbarhet - vem gjorde vad och när',
      'Säker delning med kontrollerad åtkomst',
    ],
    tips: [
      'Börja med att utforska Fondöversikten',
      'Använd ?-symbolen för snabb hjälp',
      'Alla ändringar sparas automatiskt',
    ],
    link: '/overview',
  },
  'funds': {
    title: 'Fondhantering',
    description: 'Fondöversikten ger dig en komplett bild av fondens status, NAV, avkastning och portföljbolag.',
    hasVideo: true,
    steps: [
      { title: 'Välj fond', description: 'Använd dropdown-menyn högst upp för att välja fond' },
      { title: 'Se nyckeltal', description: 'NAV, IRR, TVPI och DPI visas i översiktskorten' },
      { title: 'Granska portfölj', description: 'Scrolla ner för att se alla portföljbolag' },
      { title: 'Exportera', description: 'Klicka på Export för att ladda ner rapporter' },
    ],
    features: [
      'Real-tids NAV beräknas automatiskt',
      'IRR enligt branschstandard',
      'Commitment-spårning',
      'Historik med grafer',
    ],
    tips: [
      'IRR uppdateras vid nya transaktioner',
      'Klicka på portföljbolag för detaljer',
      'Jämför fonder genom dropdown-menyn',
    ],
    link: '/overview',
  },
  'capital-calls': {
    title: 'Kapitalanrop',
    description: 'Kalla in pengar från investerare. Systemet beräknar automatiskt varje investerares andel.',
    hasVideo: true,
    steps: [
      { title: 'Skapa anrop', description: 'Klicka på "New Capital Call"' },
      { title: 'Ange belopp', description: 'Fyll i totalbelopp och syfte' },
      { title: 'Granska', description: 'Se fördelning per investerare' },
      { title: 'Skicka', description: 'Investerare notifieras automatiskt' },
    ],
    features: [
      'Automatisk beräkning per commitment',
      'Status-spårning i realtid',
      'Automatiska påminnelser',
      'Bank-matchning',
    ],
    tips: [
      'Se historik över tidigare anrop',
      'Skicka påminnelser till de som inte betalat',
      'Exportera till Excel',
    ],
    link: '/capital-calls',
  },
  'distributions': {
    title: 'Utdelningar',
    description: 'Distribuera avkastning till investerare. Alla utdelningar kräver dubbelt godkännande.',
    hasVideo: true,
    steps: [
      { title: 'Skapa', description: 'Klicka på "New Distribution"' },
      { title: 'Välj typ', description: 'Utdelning, kapitalåterbäring, eller vinst' },
      { title: 'Första godkännande', description: 'Du skapar, annan godkänner' },
      { title: 'Andra godkännande', description: 'Ytterligare en person granskar' },
    ],
    features: [
      '4-ögon princip',
      'Automatisk fördelning',
      'Full spårbarhet',
      'Typ-kategorisering',
    ],
    tips: [
      'Avslå med motivering vid behov',
      'Alla godkännanden loggas',
      'Se approval trail för historik',
    ],
    link: '/distributions',
  },
  'investors': {
    title: 'Investerarhantering',
    description: 'Hantera investerare, åtaganden, KYC-status och kommunikation på ett ställe.',
    hasVideo: true,
    steps: [
      { title: 'Se översikt', description: 'Alla investerare med status' },
      { title: 'Filtrera', description: 'Sök på status, typ eller namn' },
      { title: 'Visa detaljer', description: 'Klicka för full information' },
      { title: 'Granska KYC', description: 'Se status och flaggor' },
    ],
    features: [
      'KYC-övervakning',
      'Commitment-spårning',
      'Automatisk riskbedömning',
      'Dokumenthantering',
    ],
    tips: [
      'Röda flaggor kräver uppmärksamhet',
      'Exportera till Excel',
      'PEP-status visas automatiskt',
    ],
    link: '/investors',
  },
  'treasury': {
    title: 'Treasury & Likviditet',
    description: 'Hantera bankkonton, se transaktioner och initiera betalningar.',
    hasVideo: true,
    steps: [
      { title: 'Se saldo', description: 'Totalt saldo och per konto' },
      { title: 'Transaktioner', description: 'Senaste listas automatiskt' },
      { title: 'Matcha', description: 'AI matchar - verifiera eller korrigera' },
      { title: 'Betala', description: 'Kräver 4-ögon godkännande' },
    ],
    features: [
      'Bank-integration',
      'AI-matchning',
      'Fakturahantering',
      'Kassaflödesprognos',
    ],
    tips: [
      'Grönt = matchat, gult = granskning',
      'Stora betalningar kräver dubbelt godkännande',
      'Sök på motpart, belopp eller referens',
    ],
    link: '/treasury',
  },
  'data-rooms': {
    title: 'Säkra Datarum',
    description: 'Skapa krypterade utrymmen för känsliga dokument med åtkomstkontroll.',
    hasVideo: true,
    steps: [
      { title: 'Skapa rum', description: 'Välj typ av datarum' },
      { title: 'Ladda upp', description: 'Dra och släpp dokument' },
      { title: 'Bjud in', description: 'Lägg till medlemmar' },
      { title: 'Övervaka', description: 'Se all aktivitet' },
    ],
    features: [
      'Granulär åtkomst per person',
      'Tidsbegränsning',
      'Automatisk vattenmärkning',
      'Full aktivitetslogg',
    ],
    tips: [
      'Viewer för endast läsning',
      'Vattenmärkning för känsligt material',
      'Stäng rum när process är klar',
    ],
    link: '/data-rooms',
  },
  'approvals': {
    title: '4-Ögon Godkännande',
    description: 'Alla finansiella transaktioner kräver godkännande från två personer.',
    hasVideo: true,
    steps: [
      { title: 'Se väntande', description: 'Pending visar dina ärenden' },
      { title: 'Granska', description: 'Klicka för detaljer' },
      { title: 'Verifiera', description: 'Kontrollera information' },
      { title: 'Besluta', description: 'Godkänn eller avslå' },
    ],
    features: [
      'Två-stegs godkännande',
      'Separation of duties',
      'Audit trail',
      'Avslå med motivering',
    ],
    tips: [
      'Kontrollera alltid belopp och mottagare',
      'Avslå vid tveksamhet',
      'Se vem som gjorde första godkännandet',
    ],
    link: '/approvals',
  },
  'portfolio': {
    title: 'Portföljövervakning',
    description: 'Följ portföljbolags utveckling. AI extraherar data från rapporter.',
    hasVideo: true,
    steps: [
      { title: 'Se översikt', description: 'Alla bolag med värdering' },
      { title: 'Filtrera', description: 'Sektor, land eller status' },
      { title: 'Ladda upp', description: 'Dra kvartalsrapport' },
      { title: 'AI extraherar', description: 'Nyckeltal fylls i' },
    ],
    features: [
      'AI-extraktion från PDF/Excel',
      'Värderingshistorik',
      'KPI-dashboard',
      'Ägarandelsspårning',
    ],
    tips: [
      'AI-förslag kan justeras',
      'Ladda upp flera rapporter',
      'Exportera för LP-rapporter',
    ],
    link: '/portfolio',
  },
  'bookkeeping': {
    title: 'AI-Bokföring',
    description: 'Ladda upp fakturor - AI klassificerar och konterar enligt BAS-kontoplanen.',
    hasVideo: true,
    steps: [
      { title: 'Välj klient', description: 'Välj bolag' },
      { title: 'Ladda upp', description: 'Dra faktura eller kvitto' },
      { title: 'AI analyserar', description: 'Klassificering sker' },
      { title: 'Godkänn', description: 'Bekräfta kontering' },
    ],
    features: [
      'OCR + AI läser dokument',
      'BAS-kontoplan',
      'Automatisk momsberäkning',
      'Fortnox-export',
    ],
    tips: [
      'Bättre bildkvalitet = bättre resultat',
      'Korrigera AI vid behov',
      'Fakturor kategoriseras automatiskt',
    ],
    link: '/clients',
  },
};

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('overview');
  const content = guideContent[activeSection];
  const activeTitle = guideSections.find(s => s.id === activeSection)?.title || 'Översikt';

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Användarguide</h1>
          <p className="text-aifm-charcoal/50 mt-1">
            Lär dig använda AIFM steg för steg
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Section Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-24">
              <div className="px-4 py-3 border-b border-gray-50">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Innehåll</span>
              </div>
              <div className="py-1">
                {guideSections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-all
                      ${activeSection === section.id 
                        ? 'bg-aifm-charcoal/5 text-aifm-charcoal font-medium' 
                        : 'text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-gray-50'}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-aifm-charcoal/30 w-4">{index + 1}.</span>
                      <span className="text-sm">{section.title}</span>
                    </span>
                    {activeSection === section.id && (
                      <ChevronRight className="w-4 h-4 text-aifm-charcoal/30" />
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Section Header */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-6 border-b border-gray-50">
                <h2 className="text-xl font-medium text-aifm-charcoal">{content.title}</h2>
                <p className="text-sm text-aifm-charcoal/50 mt-2 max-w-2xl">{content.description}</p>
              </div>

              {/* Video Placeholder */}
              {content.hasVideo && (
                <div className="px-6 py-5 bg-gray-50/50">
                  <div className="aspect-video bg-aifm-charcoal/5 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-14 h-14 bg-aifm-charcoal/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Play className="w-6 h-6 text-aifm-charcoal/40 ml-0.5" />
                      </div>
                      <p className="text-sm text-aifm-charcoal/40">Video kommer snart</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Steg för steg</span>
              </div>
              <div className="px-6 py-5">
                <div className="space-y-4">
                  {content.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="w-7 h-7 bg-aifm-charcoal rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-white">{index + 1}</span>
                      </div>
                      <div className="pt-0.5">
                        <p className="text-sm font-medium text-aifm-charcoal">{step.title}</p>
                        <p className="text-sm text-aifm-charcoal/50 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Funktioner</span>
              </div>
              <div className="px-6 py-5">
                <div className="grid md:grid-cols-2 gap-3">
                  {content.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 py-2">
                      <div className="w-1.5 h-1.5 bg-aifm-charcoal/30 rounded-full" />
                      <span className="text-sm text-aifm-charcoal/70">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-aifm-charcoal/5 rounded-xl px-6 py-5">
              <span className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider">Tips</span>
              <ul className="mt-3 space-y-2">
                {content.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-aifm-charcoal/70">
                    <span className="text-aifm-charcoal/30 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="bg-aifm-charcoal rounded-xl px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Redo att börja?</p>
                <p className="text-white/50 text-sm mt-0.5">Prova funktionen direkt</p>
              </div>
              <Link 
                href={content.link}
                className="px-5 py-2.5 bg-white text-aifm-charcoal rounded-lg text-sm font-medium 
                         hover:bg-white/90 transition-colors flex items-center gap-2"
              >
                Öppna {activeTitle}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
