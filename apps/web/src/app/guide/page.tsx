'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, ChevronRight, Play, CheckCircle2,
  DollarSign, Users, FolderLock, Wallet, Shield, Building2,
  FileText, BarChart3, ArrowUpRight, ArrowDownRight,
  Lightbulb, Target, Clock, Lock, Eye, Download,
  Upload, Brain, Settings, Bell, Search, HelpCircle
} from 'lucide-react';

// Guide sections
const guideSections = [
  {
    id: 'overview',
    title: 'Översikt',
    icon: BookOpen,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'funds',
    title: 'Fonder',
    icon: Building2,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    id: 'capital-calls',
    title: 'Kapitalanrop',
    icon: ArrowUpRight,
    color: 'bg-green-100 text-green-600',
  },
  {
    id: 'distributions',
    title: 'Utdelningar',
    icon: ArrowDownRight,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'investors',
    title: 'Investerare',
    icon: Users,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    id: 'treasury',
    title: 'Treasury',
    icon: Wallet,
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    id: 'data-rooms',
    title: 'Datarum',
    icon: FolderLock,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'approvals',
    title: 'Godkännanden',
    icon: Shield,
    color: 'bg-rose-100 text-rose-600',
  },
  {
    id: 'portfolio',
    title: 'Portfölj',
    icon: BarChart3,
    color: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'bookkeeping',
    title: 'Bokföring',
    icon: FileText,
    color: 'bg-teal-100 text-teal-600',
  },
];

// Content for each section
const guideContent: Record<string, {
  title: string;
  description: string;
  videoPlaceholder?: boolean;
  steps: { title: string; description: string; icon: React.ElementType }[];
  features: { title: string; description: string }[];
  tips: string[];
  link: string;
}> = {
  'overview': {
    title: 'Välkommen till AIFM',
    description: 'AIFM är ett komplett fondadministrationssystem byggt för att automatisera ditt arbete med AI, samtidigt som du behåller full kontroll. Systemet är designat för att vara enkelt att använda - komplexiteten sköts i bakgrunden.',
    steps: [
      { title: 'Logga in', description: 'Använd dina inloggningsuppgifter eller BankID för säker åtkomst', icon: Lock },
      { title: 'Välj fond', description: 'Välj vilken fond du vill arbeta med i dropdown-menyn', icon: Building2 },
      { title: 'Navigera', description: 'Använd menyn för att gå till olika funktioner', icon: ChevronRight },
      { title: 'Få hjälp', description: 'Klicka på ? vid varje funktion för att få förklaring', icon: HelpCircle },
    ],
    features: [
      { title: 'AI-automatisering', description: 'AI hjälper dig med bokföring, dokumenttolkning och rapporter' },
      { title: '4-ögon princip', description: 'Alla finansiella transaktioner kräver dubbelt godkännande' },
      { title: 'Full spårbarhet', description: 'Allt loggas - vem gjorde vad och när' },
      { title: 'Säker delning', description: 'Dela dokument säkert med kontrollerad åtkomst' },
    ],
    tips: [
      'Börja med att utforska Fondöversikten för att få en överblick',
      'Använd ?-symbolen för snabb hjälp på varje sida',
      'Alla ändringar sparas automatiskt',
    ],
    link: '/fund',
  },
  'funds': {
    title: 'Fondhantering',
    description: 'Fondöversikten ger dig en komplett bild av fondens status, NAV, avkastning och portföljbolag. Här ser du allt viktigt på ett ställe.',
    videoPlaceholder: true,
    steps: [
      { title: 'Välj fond', description: 'Använd dropdown-menyn högst upp för att välja fond', icon: Building2 },
      { title: 'Se nyckeltal', description: 'NAV, IRR, TVPI och DPI visas i översiktskorten', icon: BarChart3 },
      { title: 'Granska portfölj', description: 'Scrolla ner för att se alla portföljbolag', icon: Target },
      { title: 'Exportera', description: 'Klicka på Export för att ladda ner rapporter', icon: Download },
    ],
    features: [
      { title: 'Real-tids NAV', description: 'Fondens värde beräknas automatiskt baserat på portföljvärderingar' },
      { title: 'Automatisk IRR', description: 'Avkastning beräknas enligt branschstandard' },
      { title: 'Commitment-spårning', description: 'Se hur mycket som kallats in vs. kvarvarande' },
      { title: 'Historik', description: 'Följ utvecklingen över tid med grafer' },
    ],
    tips: [
      'IRR uppdateras automatiskt när nya transaktioner registreras',
      'Klicka på ett portföljbolag för att se detaljerad information',
      'Du kan jämföra flera fonder genom att byta i dropdown-menyn',
    ],
    link: '/fund',
  },
  'capital-calls': {
    title: 'Kapitalanrop',
    description: 'Kapitalanrop används för att kalla in pengar från investerare. Systemet beräknar automatiskt varje investerares andel baserat på deras åtaganden och skickar notifikationer.',
    videoPlaceholder: true,
    steps: [
      { title: 'Skapa anrop', description: 'Klicka på "New Capital Call" för att starta', icon: ArrowUpRight },
      { title: 'Ange belopp', description: 'Fyll i totalbelopp och syfte för anropet', icon: DollarSign },
      { title: 'Granska fördelning', description: 'Systemet visar hur mycket varje investerare ska betala', icon: Users },
      { title: 'Skicka', description: 'Klicka på Skapa - investerare notifieras automatiskt', icon: Bell },
      { title: 'Följ upp', description: 'Se status för betalningar i realtid', icon: Eye },
    ],
    features: [
      { title: 'Automatisk beräkning', description: 'Varje investerares andel beräknas enligt commitment' },
      { title: 'Status-spårning', description: 'Se vem som betalat, delvis betalat, eller inte alls' },
      { title: 'Påminnelser', description: 'Skicka automatiska påminnelser till de som inte betalat' },
      { title: 'Bank-matching', description: 'Inbetalningar matchas automatiskt mot anrop' },
    ],
    tips: [
      'Du kan se historik över alla tidigare kapitalanrop',
      'Använd "Send Reminder" för att skicka påminnelser',
      'Exportera till Excel för egna analyser',
    ],
    link: '/capital-calls',
  },
  'distributions': {
    title: 'Utdelningar',
    description: 'Utdelningar används för att distribuera avkastning till investerare. Alla utdelningar kräver godkännande från två personer enligt 4-ögon principen.',
    videoPlaceholder: true,
    steps: [
      { title: 'Skapa utdelning', description: 'Klicka på "New Distribution"', icon: ArrowDownRight },
      { title: 'Välj typ', description: 'Utdelning, kapitalåterbäring, eller vinstfördelning', icon: Settings },
      { title: 'Ange belopp', description: 'Systemet beräknar varje investerares andel', icon: DollarSign },
      { title: 'Första godkännande', description: 'Du skapar - någon annan måste godkänna', icon: Shield },
      { title: 'Andra godkännande', description: 'En annan person granskar och godkänner', icon: CheckCircle2 },
    ],
    features: [
      { title: '4-ögon princip', description: 'Ingen kan göra utbetalningar ensam' },
      { title: 'Automatisk fördelning', description: 'Belopp fördelas enligt ägarandelar' },
      { title: 'Full spårbarhet', description: 'Se vem som godkänt vad och när' },
      { title: 'Typ-kategorisering', description: 'Håll koll på olika typer av utdelningar' },
    ],
    tips: [
      'Du kan avslå utdelningar med motivering',
      'Alla godkännanden loggas permanent',
      'Se approval trail för full historik',
    ],
    link: '/distributions',
  },
  'investors': {
    title: 'Investerarhantering',
    description: 'Hantera alla investerare (LPs), deras åtaganden, KYC-status och kommunikation på ett ställe. Systemet varnar automatiskt för investerare som behöver uppmärksamhet.',
    videoPlaceholder: true,
    steps: [
      { title: 'Se översikt', description: 'Alla investerare visas med status och commitment', icon: Users },
      { title: 'Filtrera', description: 'Sök och filtrera på status, typ, eller namn', icon: Search },
      { title: 'Visa detaljer', description: 'Klicka på en investerare för full information', icon: Eye },
      { title: 'Granska KYC', description: 'Se KYC/AML-status och eventuella flaggor', icon: Shield },
      { title: 'Kommunicera', description: 'Skicka meddelanden direkt från systemet', icon: Bell },
    ],
    features: [
      { title: 'KYC-övervakning', description: 'Status uppdateras automatiskt vid förändringar' },
      { title: 'Commitment-spårning', description: 'Se varje investerares åtagande och inbetalningar' },
      { title: 'Riskbedömning', description: 'Automatisk riskklassificering (låg/medium/hög)' },
      { title: 'Dokumenthantering', description: 'Alla investerardokument samlade på ett ställe' },
    ],
    tips: [
      'Röda flaggor indikerar investerare som behöver uppmärksamhet',
      'Du kan exportera investerarlistan till Excel',
      'PEP-status (politiskt exponerade personer) visas automatiskt',
    ],
    link: '/investors',
  },
  'treasury': {
    title: 'Treasury & Likviditet',
    description: 'Hantera fondens bankkonton, se transaktioner i realtid, och initiera betalningar. Systemet matchar automatiskt inbetalningar mot kapitalanrop och fakturor.',
    videoPlaceholder: true,
    steps: [
      { title: 'Se saldo', description: 'Totalt saldo visas högst upp, per konto nedanför', icon: Wallet },
      { title: 'Granska transaktioner', description: 'Senaste transaktioner listas automatiskt', icon: FileText },
      { title: 'Matcha', description: 'AI matchar transaktioner - verifiera eller korrigera', icon: Brain },
      { title: 'Fakturor', description: 'Se och godkänn leverantörsfakturor', icon: FileText },
      { title: 'Betala', description: 'Initiera betalningar (kräver 4-ögon godkännande)', icon: ArrowDownRight },
    ],
    features: [
      { title: 'Bank-integration', description: 'Transaktioner synkas automatiskt från banken' },
      { title: 'AI-matchning', description: 'Inbetalningar matchas automatiskt mot förväntade' },
      { title: 'Fakturahantering', description: 'Ladda upp, godkänn och betala fakturor' },
      { title: 'Kassaflöde', description: 'Se projicerat kassaflöde framåt' },
    ],
    tips: [
      'Gröna transaktioner är matchade, gula behöver granskning',
      'Stora betalningar kräver alltid dubbelt godkännande',
      'Du kan söka på motpart, belopp eller referens',
    ],
    link: '/treasury',
  },
  'data-rooms': {
    title: 'Säkra Datarum',
    description: 'Skapa krypterade utrymmen för att dela känsliga dokument med specifika personer. Varje rum har egen åtkomstkontroll och full aktivitetslogg.',
    videoPlaceholder: true,
    steps: [
      { title: 'Skapa rum', description: 'Klicka på "New Data Room" och välj typ', icon: FolderLock },
      { title: 'Ladda upp', description: 'Dra och släpp dokument i rummet', icon: Upload },
      { title: 'Bjud in', description: 'Lägg till medlemmar med specifika behörigheter', icon: Users },
      { title: 'Sätt behörigheter', description: 'View, Download, Upload - individuellt per person', icon: Lock },
      { title: 'Övervaka', description: 'Se vem som öppnat vilka dokument och när', icon: Eye },
    ],
    features: [
      { title: 'Granulär åtkomst', description: 'Olika behörigheter för olika personer' },
      { title: 'Tidsbegränsning', description: 'Sätt utgångsdatum för åtkomst' },
      { title: 'Vattenmärkning', description: 'Dokument kan vattenmärkas automatiskt' },
      { title: 'Aktivitetslogg', description: 'Full spårbarhet av all aktivitet' },
    ],
    tips: [
      'Använd "Viewer" för personer som bara ska läsa',
      'Vattenmärkning rekommenderas för känsliga dokument',
      'Du kan stänga ett rum när processen är klar',
    ],
    link: '/data-rooms',
  },
  'approvals': {
    title: '4-Ögon Godkännande',
    description: 'Alla finansiella transaktioner kräver godkännande från två separata personer. Detta förhindrar fel och bedrägerier och säkerställer compliance.',
    videoPlaceholder: true,
    steps: [
      { title: 'Se väntande', description: 'Pending-fliken visar ärenden som väntar på dig', icon: Clock },
      { title: 'Granska', description: 'Klicka på ett ärende för att se alla detaljer', icon: Eye },
      { title: 'Verifiera', description: 'Kontrollera att informationen är korrekt', icon: CheckCircle2 },
      { title: 'Besluta', description: 'Godkänn eller avslå med motivering', icon: Shield },
      { title: 'Logga', description: 'Ditt beslut loggas permanent i systemet', icon: FileText },
    ],
    features: [
      { title: 'Två-stegs godkännande', description: 'Först skapas, sedan godkänns av annan person' },
      { title: 'Separation of duties', description: 'Du kan inte godkänna det du själv skapat' },
      { title: 'Audit trail', description: 'Full historik över alla beslut' },
      { title: 'Avslå med motivering', description: 'Dokumentera varför du avslår' },
    ],
    tips: [
      'Kontrollera alltid belopp och mottagare innan godkännande',
      'Vid tveksamheter, avslå och begär mer information',
      'Du kan se vem som gjorde första godkännandet',
    ],
    link: '/approvals',
  },
  'portfolio': {
    title: 'Portföljövervakning',
    description: 'Följ alla portföljbolags utveckling, värderingar och nyckeltal. Ladda upp rapporter så extraherar AI relevant data automatiskt.',
    videoPlaceholder: true,
    steps: [
      { title: 'Se översikt', description: 'Alla bolag visas med värdering och status', icon: Building2 },
      { title: 'Filtrera', description: 'Filtrera på sektor, land eller status', icon: Search },
      { title: 'Visa detaljer', description: 'Klicka på ett bolag för full information', icon: Eye },
      { title: 'Ladda upp rapport', description: 'Dra och släpp kvartalsrapport', icon: Upload },
      { title: 'AI extraherar', description: 'Nyckeltal fylls i automatiskt', icon: Brain },
    ],
    features: [
      { title: 'AI-extraktion', description: 'Ladda upp PDF/Excel så läser AI ut siffror' },
      { title: 'Värderingsspårning', description: 'Se historisk utveckling för varje bolag' },
      { title: 'KPI-dashboard', description: 'Revenue, EBITDA, anställda, tillväxt' },
      { title: 'Ägarandel', description: 'Håll koll på fondens ägarandel över tid' },
    ],
    tips: [
      'AI:s förslag kan alltid justeras innan sparande',
      'Du kan ladda upp flera rapporter samtidigt',
      'Exportera portföljdata för LP-rapporter',
    ],
    link: '/portfolio',
  },
  'bookkeeping': {
    title: 'AI-Bokföring',
    description: 'Ladda upp fakturor och kvitton - AI klassificerar och konterar automatiskt enligt BAS-kontoplanen. Redo för export till Fortnox.',
    videoPlaceholder: true,
    steps: [
      { title: 'Välj klient', description: 'Välj vilket bolag dokumentet tillhör', icon: Building2 },
      { title: 'Ladda upp', description: 'Dra och släpp faktura eller kvitto', icon: Upload },
      { title: 'AI analyserar', description: 'Dokumentet skannas och klassificeras', icon: Brain },
      { title: 'Granska', description: 'Kontrollera AI:s förslag på kontering', icon: Eye },
      { title: 'Godkänn', description: 'Bekräfta eller korrigera innan bokföring', icon: CheckCircle2 },
    ],
    features: [
      { title: 'OCR + AI', description: 'Läser text från bilder och PDF:er' },
      { title: 'BAS-kontoplan', description: 'Svensk standard för kontering' },
      { title: 'Momsberäkning', description: 'Moms beräknas automatiskt (25/12/6%)' },
      { title: 'Fortnox-export', description: 'Synka verifikationer till Fortnox' },
    ],
    tips: [
      'Bättre bildkvalitet ger bättre AI-resultat',
      'Du kan alltid korrigera AI:s förslag',
      'Fakturor kategoriseras efter typ automatiskt',
    ],
    link: '/clients',
  },
};

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('overview');
  const content = guideContent[activeSection];
  const ActiveIcon = guideSections.find(s => s.id === activeSection)?.icon || BookOpen;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-aifm-gold rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="font-medium tracking-widest text-aifm-charcoal uppercase text-sm">AIFM</span>
              </Link>
            </div>
            <Link href="/" className="btn-outline py-2 px-4 text-sm">
              Tillbaka till app
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-aifm-gold" />
            <h1 className="heading-2">Användarguide</h1>
          </div>
          <p className="text-aifm-charcoal/60 max-w-2xl">
            Lär dig använda AIFM steg för steg. Varje funktion förklaras med enkla instruktioner och praktiska tips.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-24">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Innehåll</h3>
              </div>
              <nav className="divide-y divide-gray-50">
                {guideSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                        activeSection === section.id 
                          ? 'bg-aifm-gold/5 border-l-2 border-aifm-gold' 
                          : 'hover:bg-gray-50 border-l-2 border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-sm ${
                        activeSection === section.id 
                          ? 'font-medium text-aifm-gold' 
                          : 'text-aifm-charcoal/70'
                      }`}>
                        {section.title}
                      </span>
                      {activeSection === section.id && (
                        <ChevronRight className="w-4 h-4 ml-auto text-aifm-gold" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Section Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-aifm-gold/10 to-aifm-gold/5 px-6 py-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    guideSections.find(s => s.id === activeSection)?.color || 'bg-blue-100 text-blue-600'
                  }`}>
                    <ActiveIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-aifm-charcoal">{content.title}</h2>
                    <p className="text-sm text-aifm-charcoal/60 mt-1 max-w-xl">{content.description}</p>
                  </div>
                </div>
              </div>

              {/* Video Placeholder */}
              {content.videoPlaceholder && (
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-aifm-gold/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Play className="w-8 h-8 text-aifm-gold ml-1" />
                      </div>
                      <p className="text-aifm-charcoal/60">Video kommer snart</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Steg för Steg</h3>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {content.steps.map((step, index) => {
                    const StepIcon = step.icon;
                    return (
                      <div key={index} className="flex items-start gap-4">
                        <div className="flex-shrink-0 relative">
                          <div className="w-10 h-10 bg-aifm-gold/10 rounded-xl flex items-center justify-center">
                            <span className="text-aifm-gold font-bold">{index + 1}</span>
                          </div>
                          {index < content.steps.length - 1 && (
                            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-aifm-gold/20" />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <StepIcon className="w-4 h-4 text-aifm-charcoal/40" />
                            <h4 className="font-medium text-aifm-charcoal">{step.title}</h4>
                          </div>
                          <p className="text-sm text-aifm-charcoal/60">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Funktioner</h3>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {content.features.map((feature, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5 text-aifm-gold" />
                        <h4 className="font-medium text-aifm-charcoal">{feature.title}</h4>
                      </div>
                      <p className="text-sm text-aifm-charcoal/60 ml-7">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-medium text-amber-800 uppercase tracking-wider">Tips & Tricks</h3>
              </div>
              <ul className="space-y-2">
                {content.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span className="text-sm text-amber-800">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-lg mb-1">Redo att börja?</h3>
                  <p className="text-white/70 text-sm">Prova funktionen direkt i appen</p>
                </div>
                <Link 
                  href={content.link}
                  className="bg-aifm-gold text-white px-6 py-3 rounded-xl font-medium hover:bg-aifm-gold/90 transition-colors flex items-center gap-2"
                >
                  Öppna {guideSections.find(s => s.id === activeSection)?.title}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

