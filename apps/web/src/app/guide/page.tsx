'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, Play, Building2, Users, DollarSign, ArrowLeftRight,
  Wallet, FolderLock, CheckSquare, FileText, Calculator, Settings,
  MessageSquare, Home, Shield, ClipboardList, HelpCircle, Sparkles,
  BarChart3, Upload, BookOpen, FileCheck, CreditCard
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

// Guide sections - all platform features with icons
const guideSections = [
  { id: 'overview', title: 'Välkommen till AIFM', icon: Sparkles },
  { id: 'dashboard', title: 'Översikt', icon: Home },
  { id: 'funds', title: 'Fondhantering', icon: Building2 },
  { id: 'portfolio', title: 'Portfölj', icon: BarChart3 },
  { id: 'investors', title: 'Investerare', icon: Users },
  { id: 'capital-calls', title: 'Kapitalanrop', icon: DollarSign },
  { id: 'distributions', title: 'Utdelningar', icon: ArrowLeftRight },
  { id: 'treasury', title: 'Likviditet', icon: Wallet },
  { id: 'accounting', title: 'Bokföring', icon: Calculator },
  { id: 'accounting-upload', title: '↳ Uppladdning', icon: Upload },
  { id: 'accounting-bookkeeping', title: '↳ Kontering', icon: BookOpen },
  { id: 'accounting-closing', title: '↳ Avstämning', icon: FileCheck },
  { id: 'accounting-payments', title: '↳ Betalningar', icon: CreditCard },
  { id: 'data-rooms', title: 'Datarum', icon: FolderLock },
  { id: 'compliance', title: 'Compliance', icon: Shield },
  { id: 'compliance-chat', title: '↳ AI-Agent', icon: MessageSquare },
  { id: 'compliance-documents', title: '↳ Dokument', icon: FileText },
  { id: 'tasks', title: 'Uppgifter', icon: ClipboardList },
  { id: 'approvals', title: 'Godkännanden', icon: CheckSquare },
  { id: 'settings', title: 'Inställningar', icon: Settings },
  { id: 'chat-widget', title: 'Hjälp-assistent', icon: HelpCircle },
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
    description: 'AIFM är ett komplett fondadministrationssystem byggt för att automatisera ditt arbete med AI, samtidigt som du behåller full kontroll. Plattformen hanterar allt från kapitalanrop till bokföring.',
    steps: [
      { title: 'Logga in', description: 'Använd dina inloggningsuppgifter eller BankID för säker åtkomst' },
      { title: 'Välj fond', description: 'Klicka på fondväljaren högst upp för att byta mellan dina fonder' },
      { title: 'Navigera', description: 'Använd sidomenyn för att gå till olika funktioner' },
      { title: 'Få hjälp', description: 'Klicka på hjälp-ikonen nere till höger för att chatta med AI-assistenten' },
    ],
    features: [
      'AI-automatisering för bokföring och dokument',
      '4-ögon princip för alla finansiella transaktioner',
      'Full spårbarhet - vem gjorde vad och när',
      'Säker delning via krypterade datarum',
      'Compliance Agent för regulatorisk hjälp',
      'Mobil-responsiv design',
    ],
    tips: [
      'Börja med att utforska Översiktssidan',
      'Använd hjälp-assistenten nere till höger för frågor',
      'Alla ändringar sparas automatiskt',
      'Byt fond snabbt med dropdown-menyn högst upp',
    ],
    link: '/overview',
  },
  'dashboard': {
    title: 'Översikt',
    description: 'Översiktssidan ger dig en komplett bild av fondens status med nyckeltal, grafer och senaste aktiviteter.',
    hasVideo: true,
    steps: [
      { title: 'Se nyckeltal', description: 'NAV, IRR, MOIC och DPI visas i hero-korten' },
      { title: 'Granska grafer', description: 'Klicka på NAV/IRR/MOIC-tabs för olika visningar' },
      { title: 'Expandera detaljer', description: 'Klicka på "Visa detaljer" för mer information' },
      { title: 'Se aktivitet', description: 'Senaste transaktioner och uppgifter i högerkolumnen' },
    ],
    features: [
      'Real-tids NAV-beräkning',
      'Interaktiva grafer med tidsserier',
      'KPI-jämförelse mot mål',
      'Snabbåtkomst till senaste händelser',
    ],
    tips: [
      'Klicka på graf-knapparna för att byta metriker',
      'Detaljsektionen kan expanderas/kollapsas',
      'Alla fonder har unika nyckeltal och historik',
    ],
    link: '/overview',
  },
  'funds': {
    title: 'Fondhantering',
    description: 'Hantera alla dina fonder från ett ställe. Byt enkelt mellan fonder med dropdown-menyn och se varje fonds unika data.',
    hasVideo: true,
    steps: [
      { title: 'Expandera fondväljaren', description: 'Klicka på pilen vid fondnamnet högst upp' },
      { title: 'Sök fond', description: 'Skriv namn eller organisationsnummer för att filtrera' },
      { title: 'Välj fond', description: 'Klicka på önskad fond för att byta' },
      { title: 'Lägg till ny', description: 'Klicka på "Nytt bolag" för att skapa en ny fond' },
    ],
    features: [
      'Snabbsök bland alla fonder',
      'Visuell identifiering med färgkodning',
      'Onboarding-wizard för nya fonder',
      'Automatisk datauppdatering vid byte',
    ],
    tips: [
      'Laddningsindikator visas vid fondbyte',
      'Alla sidor uppdateras automatiskt vid byte',
      'Använd kortnamn för snabb identifiering',
    ],
    link: '/overview',
  },
  'portfolio': {
    title: 'Portföljövervakning',
    description: 'Följ portföljbolags utveckling. Se värdering, sektor och status. AI extraherar data från uppladdade rapporter.',
    hasVideo: true,
    steps: [
      { title: 'Se översikt', description: 'Alla bolag med aktuell värdering och status' },
      { title: 'Filtrera', description: 'Använd tabs: Bolag / Sektorer / Statistik' },
      { title: 'Lägg till bolag', description: 'Klicka på "Lägg till bolag" för ny investering' },
      { title: 'Exportera', description: 'Klicka på "Exportera" för Excel/PDF-rapport' },
    ],
    features: [
      'Sektorsfördelning med visualisering',
      'AI-extraktion från PDF/Excel-rapporter',
      'Värderingshistorik per bolag',
      'Export i flera format (Excel, CSV, PDF)',
    ],
    tips: [
      'AI-förslag kan alltid justeras manuellt',
      'Ladda upp kvartalsrapporter för automatisk uppdatering',
      'Använd statistik-tab för aggregerad data',
    ],
    link: '/portfolio',
  },
  'investors': {
    title: 'Investerarhantering',
    description: 'Hantera investerare, åtaganden, KYC-status och kommunikation på ett ställe. Master-detail layout för effektiv översikt.',
    hasVideo: true,
    steps: [
      { title: 'Se investerarlista', description: 'Alla investerare med commitment och status' },
      { title: 'Välj investerare', description: 'Klicka för att se detaljer i högerkolumnen' },
      { title: 'Filtrera', description: 'Sök eller filtrera på status/typ' },
      { title: 'Granska KYC', description: 'Se KYC-status och eventuella flaggor' },
    ],
    features: [
      'KYC-statusövervakning med färgkodning',
      'Commitment-spårning med inbetalningsgrad',
      'Automatisk PEP-kontroll och riskbedömning',
      'Dokumenthantering per investerare',
    ],
    tips: [
      'Röda flaggor kräver omedelbar uppmärksamhet',
      'Filtrera på "Behöver uppmärksamhet" för att se problem',
      'Exportera investerarlista för LP-rapporter',
    ],
    link: '/investors',
  },
  'capital-calls': {
    title: 'Kapitalanrop',
    description: 'Skapa och hantera kapitalanrop. Systemet beräknar automatiskt varje investerares andel baserat på commitment.',
    hasVideo: true,
    steps: [
      { title: 'Skapa anrop', description: 'Klicka på "Nytt kapitalanrop"' },
      { title: 'Ange belopp', description: 'Fyll i totalbelopp och syfte med investeringen' },
      { title: 'Granska fördelning', description: 'Se hur beloppet fördelas per investerare' },
      { title: 'Skicka', description: 'Investerare notifieras automatiskt via e-post' },
    ],
    features: [
      'Automatisk beräkning per commitment-andel',
      'Status-spårning: Skickat, Delvis betalt, Betalt',
      'Automatiska påminnelser vid försenad betalning',
      'Bank-matchning för automatisk avstämning',
    ],
    tips: [
      'Använd tabs: Aktiva / Historik / Statistik',
      'Se grafer för visuell översikt av betalningsstatus',
      'Skicka påminnelser till investerare som inte betalat',
    ],
    link: '/capital-calls',
  },
  'distributions': {
    title: 'Utdelningar',
    description: 'Distribuera avkastning till investerare. Alla utdelningar kräver 4-ögon godkännande för extra säkerhet.',
    hasVideo: true,
    steps: [
      { title: 'Skapa utdelning', description: 'Klicka på "Ny utdelning"' },
      { title: 'Välj typ', description: 'Kapitalåterbäring, utdelning eller vinstdelning' },
      { title: 'Första godkännande', description: 'Du skapar, annan person granskar' },
      { title: 'Andra godkännande', description: 'Ytterligare en person bekräftar' },
    ],
    features: [
      '4-ögon princip för alla utdelningar',
      'Automatisk fördelning per commitment',
      'Full audit trail med tidsstämplar',
      'Kategorisering: Kapital, Utdelning, Vinst',
    ],
    tips: [
      'Använd tabs: Kommande / Genomförda',
      'Avslå med motivering vid tveksamheter',
      'Alla godkännanden loggas permanent',
    ],
    link: '/distributions',
  },
  'treasury': {
    title: 'Treasury & Likviditet',
    description: 'Hantera bankkonton, se transaktioner och initiera betalningar. AI matchar automatiskt inkommande betalningar.',
    hasVideo: true,
    steps: [
      { title: 'Se saldo', description: 'Totalt saldo och fördelning per konto' },
      { title: 'Granska transaktioner', description: 'Senaste listas automatiskt med status' },
      { title: 'Matcha betalningar', description: 'AI föreslår matchning - verifiera eller korrigera' },
      { title: 'Initiera betalning', description: 'Kräver 4-ögon godkännande' },
    ],
    features: [
      'Multi-bank integration',
      'AI-matchning av inkommande betalningar',
      'Kassaflödesprognos',
      'Automatisk kontoutdrag-import',
    ],
    tips: [
      'Grönt = matchat, Gult = behöver granskning',
      'Stora betalningar kräver dubbelt godkännande',
      'Sök på motpart, belopp eller referens',
    ],
    link: '/treasury',
  },
  'accounting': {
    title: 'Bokföring - Översikt',
    description: 'Komplett bokföringsflöde med AI-stöd. Från uppladdning till årsredovisning i fyra steg.',
    hasVideo: true,
    steps: [
      { title: 'Uppladdning', description: 'Ladda upp fakturor och kvitton' },
      { title: 'Kontering', description: 'AI klassificerar enligt BAS-kontoplanen' },
      { title: 'Avstämning', description: 'Stäm av perioder och granska' },
      { title: 'Årsredovisning', description: 'Generera rapporter och bokslut' },
    ],
    features: [
      'AI-driven OCR för dokumentläsning',
      'Automatisk BAS-kontering',
      'Momsberäkning och avstämning',
      'Export till Fortnox, Visma, SIE',
    ],
    tips: [
      'Följ progress-ringen för att se status',
      'Klicka på varje steg-kort för att gå dit',
      'Granska alltid AI-förslag innan godkännande',
    ],
    link: '/accounting',
  },
  'accounting-upload': {
    title: 'Bokföring - Uppladdning',
    description: 'Ladda upp fakturor, kvitton och andra verifikationer. AI klassificerar automatiskt dokumenttyp.',
    hasVideo: true,
    steps: [
      { title: 'Dra och släpp', description: 'Dra filer till uppladdningsytan eller klicka för att välja' },
      { title: 'AI analyserar', description: 'Dokumenttyp och data extraheras automatiskt' },
      { title: 'Granska', description: 'Kontrollera AI:s klassificering och data' },
      { title: 'Skicka vidare', description: 'Godkänn för kontering' },
    ],
    features: [
      'Stöd för PDF, bilder, Excel',
      'Automatisk dokumenttyps-klassificering',
      'OCR-extraktion av belopp och datum',
      'Batch-uppladdning av flera filer',
    ],
    tips: [
      'Bättre bildkvalitet = bättre AI-resultat',
      'Ladda upp flera filer samtidigt',
      'Korrigera AI vid behov genom att klicka på fälten',
    ],
    link: '/accounting/upload',
  },
  'accounting-bookkeeping': {
    title: 'Bokföring - Kontering',
    description: 'AI föreslår kontering enligt BAS-kontoplanen. Granska, justera och godkänn verifikationer.',
    hasVideo: true,
    steps: [
      { title: 'Se verifikationer', description: 'Lista med alla väntande verifikationer' },
      { title: 'Granska förslag', description: 'AI visar föreslagen kontering per rad' },
      { title: 'Justera vid behov', description: 'Ändra konton eller belopp' },
      { title: 'Godkänn', description: 'Bekräfta konteringen' },
    ],
    features: [
      'AI-förslag baserat på historik',
      'BAS-kontosök med autocomplete',
      'Automatisk momsberäkning',
      'Snabbgenvägar för vanliga konteringar',
    ],
    tips: [
      'Filtrera på status: Väntande, Granskat, Godkänt',
      'AI lär sig av dina korrigeringar',
      'Dubbelklicka för att redigera direkt i listan',
    ],
    link: '/accounting/bookkeeping',
  },
  'accounting-closing': {
    title: 'Bokföring - Avstämning',
    description: 'Stäm av perioder, granska balanser och förbered bokslut.',
    hasVideo: true,
    steps: [
      { title: 'Välj period', description: 'Välj månad eller kvartal att stämma av' },
      { title: 'Granska checklista', description: 'Gå igenom alla avstämningspunkter' },
      { title: 'Korrigera avvikelser', description: 'Justera vid behov' },
      { title: 'Godkänn period', description: 'Lås perioden när allt stämmer' },
    ],
    features: [
      'Automatisk balansavstämning',
      'Checklista för periodstängning',
      'Avvikelserapporter',
      'Periodlåsning med audit trail',
    ],
    tips: [
      'Följ checklistan punkt för punkt',
      'Låsta perioder kan inte ändras',
      'Dokumentera alla avvikelser',
    ],
    link: '/accounting/closing',
  },
  'accounting-payments': {
    title: 'Bokföring - Betalningar',
    description: 'Hantera leverantörsbetalningar, initiera betalfiler och följ upp utestående fakturor.',
    hasVideo: true,
    steps: [
      { title: 'Se betalningskö', description: 'Lista med fakturor redo att betalas' },
      { title: 'Välj fakturor', description: 'Markera vilka som ska betalas' },
      { title: 'Generera betalfil', description: 'Skapa fil för bankimport' },
      { title: 'Godkänn', description: 'Kräver 4-ögon godkännande' },
    ],
    features: [
      'Batch-betalning av flera fakturor',
      'Automatisk betalfilsgenerering (Pain.001)',
      'Förfallodatumspårning',
      'Leverantörshantering',
    ],
    tips: [
      'Sortera på förfallodatum för att prioritera',
      'Granska alltid totalsumma innan godkännande',
      'Exportera betalfil till din bank',
    ],
    link: '/accounting/payments',
  },
  'data-rooms': {
    title: 'Säkra Datarum',
    description: 'Skapa krypterade utrymmen för känsliga dokument med granulär åtkomstkontroll och aktivitetslogg.',
    hasVideo: true,
    steps: [
      { title: 'Skapa rum', description: 'Välj typ: Due Diligence, LP, Investerare, etc.' },
      { title: 'Ladda upp', description: 'Dra och släpp dokument' },
      { title: 'Bjud in', description: 'Lägg till medlemmar med specifika rättigheter' },
      { title: 'Övervaka', description: 'Se all aktivitet i realtid' },
    ],
    features: [
      'Granulär åtkomst: Visa, Ladda ner, Redigera',
      'Tidsbegränsad åtkomst',
      'Automatisk vattenmärkning',
      'Komplett aktivitetslogg',
    ],
    tips: [
      'Använd "Endast visa" för känsliga dokument',
      'Sätt utgångsdatum för externa användare',
      'Granska aktivitetsloggen regelbundet',
    ],
    link: '/data-rooms',
  },
  'compliance': {
    title: 'Compliance - Översikt',
    description: 'Säkerställ regelefterlevnad med AI-driven analys, dokumenthantering och automatiska kontroller.',
    hasVideo: true,
    steps: [
      { title: 'Se status', description: 'Översikt över compliance-läget' },
      { title: 'Granska flaggor', description: 'Hantera identifierade risker' },
      { title: 'Använd AI-agent', description: 'Fråga om regulatoriska frågor' },
      { title: 'Dokumentera', description: 'Spara compliance-dokumentation' },
    ],
    features: [
      'Automatisk riskbedömning',
      'KYC/AML-kontroller',
      'AIFMD-rapportering',
      'AI-agent för regulatoriska frågor',
    ],
    tips: [
      'Läs röda flaggor omedelbart',
      'Använd AI-agenten för snabba svar',
      'Dokumentera alla beslut',
    ],
    link: '/compliance',
  },
  'compliance-chat': {
    title: 'Compliance AI-Agent',
    description: 'Chatta med AI-agenten om regulatoriska frågor, AIFMD, KYC/AML och andra compliance-ärenden.',
    hasVideo: true,
    steps: [
      { title: 'Ställ fråga', description: 'Skriv din fråga i chattfältet' },
      { title: 'Få svar', description: 'AI-agenten svarar med relevanta källor' },
      { title: 'Följ upp', description: 'Ställ följdfrågor för att fördjupa' },
      { title: 'Spara', description: 'Exportera viktiga konversationer' },
    ],
    features: [
      'Tränad på AIFMD, SFDR, MiFID II',
      'Källhänvisningar i svaren',
      'Konversationshistorik',
      'Export av svar',
    ],
    tips: [
      'Var specifik i dina frågor',
      'Följ källhänvisningarna för mer info',
      'AI:n ersätter inte juridisk rådgivning',
    ],
    link: '/compliance/chat',
  },
  'compliance-documents': {
    title: 'Compliance-dokument',
    description: 'Hantera compliance-relaterade dokument med AI-driven klassificering och versionshantering.',
    hasVideo: true,
    steps: [
      { title: 'Ladda upp', description: 'Dra och släpp compliance-dokument' },
      { title: 'AI klassificerar', description: 'Dokumenttyp identifieras automatiskt' },
      { title: 'Organisera', description: 'Se dokument per kategori' },
      { title: 'Granska', description: 'Öppna och verifiera innehåll' },
    ],
    features: [
      'Automatisk dokumentklassificering',
      'Versionshantering',
      'Utgångsdatumspårning',
      'Sökning i dokumentinnehåll',
    ],
    tips: [
      'Sätt påminnelser för utgående dokument',
      'Använd master-detail vyn för snabb granskning',
      'Tagga dokument för enkel sökning',
    ],
    link: '/compliance/documents',
  },
  'tasks': {
    title: 'Uppgifter',
    description: 'Hantera och prioritera dina arbetsuppgifter. Se vad som behöver göras och följ progress.',
    hasVideo: true,
    steps: [
      { title: 'Se uppgifter', description: 'Lista med alla dina uppgifter' },
      { title: 'Filtrera', description: 'Välj: Mina / Alla / Slutförda' },
      { title: 'Prioritera', description: 'Se deadline och prioritet' },
      { title: 'Markera klar', description: 'Bocka av när du är färdig' },
    ],
    features: [
      'Prioriteringsnivåer: Hög, Medium, Låg',
      'Deadline-spårning',
      'Kategorisering per område',
      'Tilldelning till teammedlemmar',
    ],
    tips: [
      'Fokusera på röda (hög prioritet) först',
      'Filtrera på deadline för att se vad som är brådskande',
      'Klicka på uppgift för detaljer i högerkolumnen',
    ],
    link: '/tasks',
  },
  'approvals': {
    title: '4-Ögon Godkännande',
    description: 'Alla finansiella transaktioner kräver godkännande från två personer. Säkerställer intern kontroll.',
    hasVideo: true,
    steps: [
      { title: 'Se väntande', description: 'Ärenden som väntar på ditt godkännande' },
      { title: 'Granska', description: 'Klicka för att se fullständiga detaljer' },
      { title: 'Verifiera', description: 'Kontrollera belopp, mottagare, syfte' },
      { title: 'Besluta', description: 'Godkänn eller avslå med motivering' },
    ],
    features: [
      'Två-stegs godkännandeprocess',
      'Separation of duties - samma person kan inte både skapa och godkänna',
      'Komplett audit trail',
      'Avslag med obligatorisk motivering',
    ],
    tips: [
      'Använd tabs: Väntar / Godkända / Avslagna',
      'Kontrollera alltid belopp och mottagare noggrant',
      'Vid tveksamhet - avslå och efterfråga mer info',
    ],
    link: '/approvals',
  },
  'settings': {
    title: 'Inställningar',
    description: 'Konfigurera ditt konto, säkerhetsinställningar, integrationer och systeminställningar.',
    hasVideo: true,
    steps: [
      { title: 'Välj kategori', description: 'Klicka på önskat inställningsområde' },
      { title: 'Justera', description: 'Ändra inställningar efter behov' },
      { title: 'Spara', description: 'Ändringar sparas automatiskt' },
      { title: 'Verifiera', description: 'Testa att ändringarna fungerar' },
    ],
    features: [
      'Användarprofil och säkerhet',
      'Teamhantering och roller',
      'API-integrationer',
      'Notifikationsinställningar',
    ],
    tips: [
      'Aktivera tvåfaktorsautentisering',
      'Granska teammedlemmars rättigheter regelbundet',
      'Testa integrationer i sandbox först',
    ],
    link: '/settings',
  },
  'chat-widget': {
    title: 'Hjälp-assistent',
    description: 'Den smarta hjälp-assistenten finns alltid tillgänglig nere till höger. Fråga om allt som rör plattformen.',
    steps: [
      { title: 'Klicka på ikonen', description: 'Maskotsymbolen nere till höger' },
      { title: 'Ställ fråga', description: 'Skriv din fråga i chattfältet' },
      { title: 'Få svar', description: 'AI:n svarar baserat på plattformens dokumentation' },
      { title: 'Använd snabbval', description: 'Klicka på föreslagna frågor för snabb hjälp' },
    ],
    features: [
      'Tillgänglig på alla sidor',
      'Svar om alla plattformsfunktioner',
      'Snabbförslag för vanliga frågor',
      'Expanderbar till fullskärm',
    ],
    tips: [
      'Fråga "Hur gör jag..." för steg-för-steg guide',
      'Assistenten vet allt om plattformen',
      'Maximera fönstret för längre konversationer',
    ],
    link: '/overview',
  },
};

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('overview');
  const content = guideContent[activeSection];
  const activeSectionData = guideSections.find(s => s.id === activeSection);
  const ActiveIcon = activeSectionData?.icon || Sparkles;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-aifm-gold/20 to-aifm-gold/5 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-aifm-charcoal">Användarguide</h1>
              <p className="text-sm text-aifm-charcoal/50">Lär dig använda AIFM steg för steg</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Section Navigation */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-24 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-50 bg-gradient-to-r from-aifm-charcoal/5 to-transparent">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Innehåll</span>
              </div>
              <div className="py-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {guideSections.map((section) => {
                  const SectionIcon = section.icon;
                  const isSubsection = section.title.startsWith('↳');
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-all
                        ${isSubsection ? 'pl-8' : ''}
                        ${activeSection === section.id 
                          ? 'bg-aifm-gold/10 text-aifm-charcoal border-r-2 border-aifm-gold' 
                          : 'text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-50'}`}
                    >
                      <SectionIcon className={`w-4 h-4 flex-shrink-0 ${activeSection === section.id ? 'text-aifm-gold' : 'text-aifm-charcoal/40'}`} />
                      <span className="text-sm truncate">{section.title.replace('↳ ', '')}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Section Header */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-aifm-gold/20 to-aifm-gold/5 rounded-xl flex items-center justify-center">
                    <ActiveIcon className="w-5 h-5 text-aifm-gold" />
                  </div>
                  <h2 className="text-xl font-semibold text-aifm-charcoal">{content.title}</h2>
                </div>
                <p className="text-sm text-aifm-charcoal/60 max-w-2xl leading-relaxed">{content.description}</p>
              </div>

              {/* Video Placeholder */}
              {content.hasVideo && (
                <div className="px-6 py-5 bg-gradient-to-br from-gray-50/50 to-white">
                  <div className="aspect-video bg-gradient-to-br from-aifm-charcoal/5 to-aifm-charcoal/10 rounded-xl flex items-center justify-center border border-gray-100">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-aifm-charcoal/5">
                        <Play className="w-7 h-7 text-aifm-gold ml-1" />
                      </div>
                      <p className="text-sm font-medium text-aifm-charcoal/60">Video-guide</p>
                      <p className="text-xs text-aifm-charcoal/40 mt-1">Kommer snart</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Steps */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-50">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Steg för steg</span>
              </div>
              <div className="px-6 py-5">
                <div className="space-y-4">
                  {content.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-4 group">
                      <div className="w-8 h-8 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                        <span className="text-xs font-semibold text-white">{index + 1}</span>
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-medium text-aifm-charcoal">{step.title}</p>
                        <p className="text-sm text-aifm-charcoal/50 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-50">
                <span className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Funktioner</span>
              </div>
              <div className="px-6 py-5">
                <div className="grid md:grid-cols-2 gap-3">
                  {content.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-2 h-2 bg-aifm-gold rounded-full flex-shrink-0" />
                      <span className="text-sm text-aifm-charcoal/70">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-aifm-gold/10 to-aifm-gold/5 rounded-2xl px-6 py-5 border border-aifm-gold/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-aifm-gold" />
                <span className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Tips</span>
              </div>
              <ul className="space-y-2.5">
                {content.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-aifm-charcoal/70">
                    <span className="text-aifm-gold mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-aifm-charcoal/20">
              <div className="text-center sm:text-left">
                <p className="text-white font-medium">Redo att börja?</p>
                <p className="text-white/50 text-sm mt-0.5">Prova funktionen direkt</p>
              </div>
              <Link 
                href={content.link}
                className="px-6 py-2.5 bg-white text-aifm-charcoal rounded-xl text-sm font-medium 
                         hover:bg-aifm-gold hover:text-white transition-all duration-300 flex items-center gap-2 shadow-sm"
              >
                Öppna {activeSectionData?.title.replace('↳ ', '') || 'sidan'}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
