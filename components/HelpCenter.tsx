'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  HelpCircle, X, ChevronRight, ExternalLink, Search,
  Building2, Users, Calculator, FolderOpen, Scale, Shield,
  BarChart3, FileText, Settings, Bell, Download, CheckSquare,
  Zap, Lightbulb, AlertTriangle, CheckCircle2, Play, ArrowRight,
  Database, Link2, Globe, Lock, Key, RefreshCw, Clock, 
  Mail, MessageSquare, Smartphone, Monitor, Upload, Filter,
  PieChart, TrendingUp, Wallet, CreditCard, BookOpen, Star,
  Layers, GitBranch, Target, Sparkles, Bot, ClipboardList
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Help Content Data
// ============================================================================

const helpSections: HelpSection[] = [
  {
    id: 'overview',
    title: 'Om AIFM-plattformen',
    icon: Sparkles,
    description: 'Vad är AIFM och hur hjälper den din verksamhet',
    color: 'from-amber-500 to-orange-500',
    content: {
      overview: `AIFM är en komplett plattform för alternativa investeringsfonder. Den samlar alla verktyg du behöver för att hantera bokföring, compliance, investerare, rapportering och dokument på ett ställe. Plattformen är designad för att spara tid, minska risker och ge dig full kontroll över alla dina fonder och bolag.`,
      features: [
        { title: 'Tre huvudpelare', description: 'Bolag (förvaltning), CRM (relationer), Compliance (regelefterlevnad)', icon: Layers },
        { title: 'Säker multi-tenant', description: 'Varje användare ser bara data de har behörighet till', icon: Lock },
        { title: 'Realtidsintegration', description: 'Automatisk synkronisering med Fortnox, banker och mer', icon: RefreshCw },
        { title: 'AI-assistans', description: 'Smart kategorisering, compliance-rådgivning och automatisk bokföring', icon: Bot },
      ],
      tips: [
        'Börja med att koppla Fortnox för att importera befintlig bokföring',
        'Sätt upp notifikationer för viktiga deadlines och händelser',
        'Använd ⌘K (Cmd+K) för snabb navigering i hela plattformen',
        'Pinna ofta använda sidor till favoriter för snabb åtkomst',
      ],
    }
  },
  {
    id: 'bolag',
    title: 'Bolag & Fonder',
    icon: Building2,
    description: 'Hantera dina fonder, NAV och portfölj',
    color: 'from-blue-500 to-indigo-500',
    content: {
      overview: `Under Bolag hanterar du alla dina fonder och bolag. Här ser du NAV-beräkningar, portföljinnehav, investerare och all finansiell data samlad på ett ställe. Varje bolag har sin egen dashboard med nyckeltal och status.`,
      features: [
        { title: 'NAV-beräkning', description: 'Automatisk beräkning av NAV med fullständig historik och revision trail', icon: Calculator },
        { title: 'Portföljöversikt', description: 'Se alla tillgångar, värderingar och allokering i realtid', icon: PieChart },
        { title: 'Investerarregister', description: 'Hantera investerare, åtaganden och kapitalanrop', icon: Users },
        { title: 'Kapitalflöden', description: 'Spåra kapitalanrop, utdelningar och likviditet', icon: Wallet },
        { title: 'Rapporter', description: 'Generera fondblad, kvartalsrapporter och årsbokslut', icon: FileText },
        { title: 'Bolagsstruktur', description: 'Visualisera ägarstruktur och koncernrelationer', icon: GitBranch },
      ],
      setup: [
        { step: 1, title: 'Skapa bolag', description: 'Klicka på "+ Lägg till bolag" i företagsväljaren', details: ['Fyll i namn, org.nummer och fondtyp', 'Välj räkenskapsår och valuta', 'Ange primär kontaktperson'] },
        { step: 2, title: 'Koppla Fortnox', description: 'Gå till Inställningar → Integrationer → Fortnox', details: ['Logga in med Fortnox-kontot', 'Välj vilka data som ska synkas', 'Kör initial import'] },
        { step: 3, title: 'Sätt upp kontoplan', description: 'Anpassa kontoplanen för din fondstruktur', details: ['Importera befintlig kontoplan från Fortnox', 'Lägg till fondspecifika konton', 'Mappa till rapportstruktur'] },
        { step: 4, title: 'Konfigurera NAV', description: 'Ställ in parametrar för NAV-beräkning', details: ['Definiera tillgångsklasser och värderingsmetoder', 'Sätt upp benchmark och avgiftsstrukturer', 'Aktivera automatisk beräkning'] },
      ],
      tips: [
        'Använd bolagsväljaren i headern för att snabbt byta mellan bolag',
        'Sätt upp automatiska NAV-beräkningar på månadsbasis',
        'Exportera data till Excel för egen analys via Export-sidan',
      ],
      faq: [
        { question: 'Hur byter jag mellan olika bolag?', answer: 'Klicka på bolagsväljaren i headern (bredvid "Bolag") och välj det bolag du vill arbeta med.' },
        { question: 'Kan jag hantera flera fonder under samma bolag?', answer: 'Ja, du kan skapa flera fonder/subfonder under samma bolag och växla mellan dem.' },
        { question: 'Hur uppdateras NAV?', answer: 'NAV kan beräknas automatiskt enligt schema eller manuellt. Systemet hämtar värderingar från kopplade källor.' },
      ],
    }
  },
  {
    id: 'accounting',
    title: 'Bokföring',
    icon: Calculator,
    description: 'Löpande bokföring, fakturor och ekonomisk rapportering',
    color: 'from-emerald-500 to-teal-500',
    content: {
      overview: `Bokföringsmodulen hanterar hela flödet från faktura till bokslut. Ladda upp leverantörsfakturor som automatiskt kategoriseras av AI, hantera betalningar, och generera rapporter. Allt synkas i realtid med Fortnox.`,
      features: [
        { title: 'AI-kategorisering', description: 'Fakturor kategoriseras automatiskt med 95%+ träffsäkerhet', icon: Bot },
        { title: 'Fortnox-synk', description: 'Tvåvägssynkronisering med Fortnox i realtid', icon: RefreshCw },
        { title: 'Bankavstämning', description: 'Automatisk matchning av banktransaktioner', icon: CreditCard },
        { title: 'Betalningar', description: 'Skapa betalfiler och hantera leverantörsbetalningar', icon: Wallet },
        { title: 'Momshantering', description: 'Automatisk momsberäkning och SKV-rapportering', icon: FileText },
        { title: 'Periodiseringar', description: 'Hantera förutbetalda kostnader och upplupna intäkter', icon: Clock },
        { title: 'Bokslut', description: 'Guidad bokslutsprocess med checklistor', icon: CheckSquare },
        { title: 'Årsredovisning', description: 'Generera K2/K3-kompatibla årsredovisningar', icon: BookOpen },
      ],
      setup: [
        { step: 1, title: 'Koppla Fortnox', description: 'Gå till Bokföring → Fortnox-koppling', details: ['Klicka "Anslut Fortnox"', 'Logga in och ge behörighet', 'Vänta på initial synk (kan ta några minuter)'] },
        { step: 2, title: 'Koppla bank', description: 'Gå till Bokföring → Integrationer → Bank', details: ['Välj din bank (Tink-integration)', 'Logga in med BankID', 'Välj vilka konton som ska kopplas'] },
        { step: 3, title: 'Konfigurera autokategorisering', description: 'Gå till Bokföring → Inställningar', details: ['Granska föreslagna konteringsregler', 'Justera tröskelvärden för auto-godkännande', 'Lägg till leverantörspecifika regler'] },
        { step: 4, title: 'Sätt upp godkännanden', description: 'Under Admin → Arbetsflöden', details: ['Definiera beloppsintervall för godkännande', 'Tilldela godkännare per kategori', 'Aktivera 4-ögon-principen för stora belopp'] },
      ],
      tips: [
        'Låt AI kategorisera först, granska sedan - mycket snabbare!',
        'Använd massimport för historisk data',
        'Kör bankavstämning dagligen för bäst resultat',
        'Sätt upp automatiska påminnelser för förfallna fakturor',
      ],
      faq: [
        { question: 'Hur laddar jag upp fakturor?', answer: 'Gå till Bokföring → Ladda upp. Dra och släpp filer eller klicka för att välja. Stöder PDF, bilder och e-faktura.' },
        { question: 'Vad händer om AI kategoriserar fel?', answer: 'Du kan enkelt korrigera och systemet lär sig. Nästa gång samma leverantör dyker upp blir det rätt.' },
        { question: 'Hur hanterar jag moms?', answer: 'Gå till Bokföring → Moms & Skatt. Systemet beräknar automatiskt moms och du kan exportera underlag till SKV.' },
        { question: 'Kan jag importera från Fortnox?', answer: 'Ja! Vid Fortnox-koppling kan du välja att importera historik. Sedan synkas allt automatiskt.' },
      ],
    }
  },
  {
    id: 'crm',
    title: 'CRM',
    icon: Users,
    description: 'Hantera kontakter, företag och affärsmöjligheter',
    color: 'from-purple-500 to-pink-500',
    content: {
      overview: `CRM-modulen hjälper dig att hantera alla relationer - investerare, prospects, rådgivare och partners. Spåra interaktioner, hantera pipeline och håll koll på alla dina kontakter på ett ställe.`,
      features: [
        { title: 'Kontakthantering', description: 'Samla alla kontakter med fullständig historik', icon: Users },
        { title: 'Företagsregister', description: 'Hantera organisationer och deras relationer', icon: Building2 },
        { title: 'Pipeline', description: 'Visualisera och hantera affärsmöjligheter', icon: TrendingUp },
        { title: 'Aktiviteter', description: 'Logga samtal, möten och e-post', icon: MessageSquare },
        { title: 'Uppgifter', description: 'Skapa och tilldela uppgifter med deadlines', icon: CheckSquare },
        { title: 'Kalender', description: 'Planera möten och se teamets schema', icon: Clock },
      ],
      setup: [
        { step: 1, title: 'Importera kontakter', description: 'Gå till CRM → Kontakter → Import', details: ['Ladda upp Excel/CSV med befintliga kontakter', 'Mappa kolumner till fält', 'Granska och bekräfta import'] },
        { step: 2, title: 'Skapa pipeline-steg', description: 'Gå till CRM → Pipeline → Inställningar', details: ['Definiera dina försäljningssteg', 'Sätt upp automatiska övergångar', 'Konfigurera notifikationer'] },
        { step: 3, title: 'Koppla e-post', description: 'Under Inställningar → Integrationer', details: ['Anslut Microsoft 365 eller Google', 'Aktivera e-postspårning', 'Sätt upp e-postsynkronisering'] },
      ],
      tips: [
        'Använd taggar för att segmentera kontakter (t.ex. "LP", "Prospect", "Rådgivare")',
        'Logga alltid aktiviteter efter möten för att bygga historik',
        'Sätt upp automatiska påminnelser för uppföljning',
      ],
      faq: [
        { question: 'Hur kopplar jag en kontakt till ett företag?', answer: 'Öppna kontakten och välj företag i fältet "Organisation". Du kan också skapa nytt företag därifrån.' },
        { question: 'Kan jag importera från LinkedIn?', answer: 'Vi stödjer import via CSV. Exportera från LinkedIn och ladda upp i CRM → Import.' },
        { question: 'Hur delar jag kontakter med teamet?', answer: 'Alla kontakter är teamdelade som standard. Använd behörigheter för att begränsa åtkomst.' },
      ],
    }
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: Scale,
    description: 'Regelefterlevnad, AIFM-krav och myndighetskontakt',
    color: 'from-rose-500 to-red-500',
    content: {
      overview: `Compliance-modulen hjälper dig att uppfylla AIFMD-kraven och andra regulatoriska krav. Chatta med vår AI-assistent för regelverksfrågor, hantera KYC och AML, och generera rapporter till Finansinspektionen.`,
      features: [
        { title: 'Regelverksassistent', description: 'AI-baserad hjälp med compliance-frågor dygnet runt', icon: Bot },
        { title: 'KYC/AML', description: 'Hantera kundkännedomskrav och penningtvättskontroller', icon: Shield },
        { title: 'Regelverksarkiv', description: 'Tillgång till uppdaterade regelverk och vägledningar', icon: BookOpen },
        { title: 'FI-rapportering', description: 'Generera och skicka rapporter till Finansinspektionen', icon: FileText },
        { title: 'Riskhantering', description: 'Dokumentera och övervaka risker enligt AIFMD', icon: AlertTriangle },
        { title: 'Revision trail', description: 'Fullständig spårbarhet för alla compliance-åtgärder', icon: Clock },
      ],
      setup: [
        { step: 1, title: 'Konfigurera bolag', description: 'Se till att alla bolag har korrekt information', details: ['Ange FI-registreringsnummer', 'Fyll i LEI-kod', 'Sätt upp ansvariga personer'] },
        { step: 2, title: 'Importera regelverk', description: 'Gå till Compliance → Ladda upp dokument', details: ['Ladda upp interna policyer', 'Systemet indexerar automatiskt för sökning', 'AI-assistenten lär sig från dokumenten'] },
        { step: 3, title: 'Aktivera checklistor', description: 'Under Admin → Arbetsflöden', details: ['Aktivera compliance-playbooks', 'Tilldela ansvariga för varje område', 'Sätt upp deadlines och påminnelser'] },
      ],
      tips: [
        'Ställ frågor till regelverksassistenten istället för att leta manuellt',
        'Använd checklistor för att säkerställa att inget missas',
        'Exportera revision trail inför FI-granskningar',
      ],
      faq: [
        { question: 'Vilka AIFM-rapporter kan systemet generera?', answer: 'Vi stödjer AIFMD Annex IV-rapportering, kvartalsrapporter och årsrapporter till FI.' },
        { question: 'Hur fungerar AI-assistenten?', answer: 'Assistenten är tränad på svensk och EU-reglering för AIF. Den kan svara på frågor och ge vägledning.' },
        { question: 'Kan jag exportera KYC-dokumentation?', answer: 'Ja, gå till CRM → KYC och välj "Exportera" för att få komplett KYC-paket per kund.' },
      ],
    }
  },
  {
    id: 'nav-processes',
    title: 'NAV-processer',
    icon: TrendingUp,
    description: 'Hantera NAV-beräkningar, rapporter och ägardata',
    color: 'from-violet-500 to-purple-500',
    content: {
      overview: `NAV-modulen automatiserar alla processer kring Net Asset Value - från daglig beräkning till rapportering och distribution av prisdata. Hantera Notor & SubReds, ägardata och säkerställ att alla intressenter får korrekt information i rätt tid.`,
      features: [
        { title: 'NAV Dashboard', description: 'Överblick över alla fonder med AUM, NAV-utveckling och effektivitetsstatistik', icon: BarChart3 },
        { title: 'NAV-rapporter', description: 'Generera och skicka fondblad, kvartalsrapporter och årsrapporter', icon: FileText },
        { title: 'Notor & SubReds', description: 'Automatisera hantering av insättningar och uttag', icon: RefreshCw },
        { title: 'Prisdata-utskick', description: 'Distribuera NAV-kurser till investerare, FI och hemsida', icon: Globe },
        { title: 'Ägardata', description: 'Hantera ägarförteckning, Clearstream-rapportering och förvaltarregistrerade', icon: Users },
        { title: 'Historik & Audit', description: 'Fullständig spårbarhet för alla NAV-relaterade händelser', icon: Clock },
      ],
      setup: [
        { step: 1, title: 'Konfigurera NAV-beräkning', description: 'Ställ in parametrar för automatisk NAV-beräkning', details: ['Definiera värderingsmetoder per tillgångsklass', 'Sätt upp avgiftsstruktur (förvaltningsavgift, carried interest)', 'Välj beräkningsfrekvens (daglig/vecka/månad)'] },
        { step: 2, title: 'Sätt upp rapportmottagare', description: 'Konfigurera vem som ska få vilka rapporter', details: ['Lägg till investerare och deras e-postadresser', 'Välj rapportformat per mottagare (PDF, Excel)', 'Aktivera automatiskt utskick'] },
        { step: 3, title: 'Koppla datakällor', description: 'Integrera med externa system', details: ['Anslut till LSEG för priser och referensdata', 'Konfigurera bankintegration (SEB/Swedbank) för flöden', 'Sätt upp hemsideuppladdning'] },
        { step: 4, title: 'Aktivera automation', description: 'Automatisera återkommande processer', details: ['Schemalägg daglig NAV-publicering', 'Aktivera påminnelser för Notor/SubReds', 'Sätt upp Clearstream-rapportering'] },
      ],
      tips: [
        'Använd batch-utskick för att skicka rapporter till flera mottagare samtidigt',
        'Sätt upp automatisk publicering av prisdata för att spara tid',
        'Granska Notor & SubReds dagligen för att undvika förseningar',
        'Exportera ägardata regelbundet som backup',
      ],
      faq: [
        { question: 'Hur ofta uppdateras NAV automatiskt?', answer: 'Du kan konfigurera beräkningsfrekvens - vanligtvis dagligen, veckovis eller månadsvis beroende på fondtyp.' },
        { question: 'Kan jag skicka olika rapporter till olika mottagare?', answer: 'Ja, varje mottagare kan konfigureras med specifika rapporttyper, format och frekvens.' },
        { question: 'Hur fungerar Clearstream-integrationen?', answer: 'Systemet genererar automatiskt rapporter i Clearstream-format som kan laddas upp manuellt eller skickas automatiskt.' },
        { question: 'Vad är skillnaden mellan Notor och SubReds?', answer: 'Notor är insättningsavier (nya investeringar) och SubReds är uttagsavier (uttag/inlösen). Båda hanteras i samma vy.' },
      ],
    }
  },
  {
    id: 'documents',
    title: 'Dokument & Datarum',
    icon: FolderOpen,
    description: 'Säker dokumenthantering och datarum',
    color: 'from-cyan-500 to-blue-500',
    content: {
      overview: `Dokumenthanteringen ger dig säker lagring och delning av alla dokument. Skapa datarum för investerare med detaljerad behörighetsstyrning, vattenmärkning och aktivitetslogg.`,
      features: [
        { title: 'Datarum', description: 'Skapa professionella datarum för due diligence', icon: FolderOpen },
        { title: 'Behörighetsstyrning', description: 'Detaljerad åtkomst per mapp och dokument', icon: Lock },
        { title: 'Vattenmärkning', description: 'Automatisk vattenmärkning av nedladdade dokument', icon: Shield },
        { title: 'Aktivitetslogg', description: 'Se vem som öppnat vilka dokument och när', icon: Clock },
        { title: 'Versionshantering', description: 'Spåra och återställ tidigare versioner', icon: GitBranch },
        { title: 'Delningslänkar', description: 'Skapa säkra länkar med tidsbegränsning', icon: Link2 },
      ],
      setup: [
        { step: 1, title: 'Skapa datarum', description: 'Gå till Dokument → Datarum → Skapa nytt', details: ['Namnge datarummet (t.ex. "Fund III Due Diligence")', 'Välj säkerhetsnivå och inställningar', 'Skapa mappstruktur'] },
        { step: 2, title: 'Ladda upp dokument', description: 'Dra och släpp eller klicka för att ladda upp', details: ['Stöd för alla filformat', 'Automatisk virusscanning', 'OCR för sökbarhet i PDF'] },
        { step: 3, title: 'Bjud in användare', description: 'Klicka "Bjud in" och ange e-post', details: ['Välj behörighetsnivå per användare', 'Skicka anpassad inbjudan', 'Kräv NDA om önskat'] },
      ],
      tips: [
        'Använd mappmallar för återkommande datarumstrukturer',
        'Aktivera vattenmärkning för känsliga dokument',
        'Granska aktivitetsloggen regelbundet',
      ],
      faq: [
        { question: 'Hur säker är dokumentlagringen?', answer: 'Alla dokument krypteras i vila och i transit. Lagring sker i AWS inom EU (Stockholm).' },
        { question: 'Kan externa användare se andra användare?', answer: 'Nej, varje användare ser bara dokument de har behörighet till och kan inte se andra användare.' },
        { question: 'Hur fungerar vattenmärkning?', answer: 'Vid nedladdning läggs användarens namn, datum och tid automatiskt till som vattenstämpel.' },
      ],
    }
  },
  {
    id: 'export',
    title: 'Exportera data',
    icon: Download,
    description: 'Ladda ner och exportera företagsdata',
    color: 'from-amber-500 to-yellow-500',
    content: {
      overview: `Export-funktionen låter dig ladda ner all data du behöver i valfritt format. Välj kategorier, format och tidsperiod för att få exakt den data du behöver.`,
      features: [
        { title: 'Flexibla format', description: 'Exportera till PDF, Excel, CSV eller JSON', icon: FileText },
        { title: 'Kategorier', description: 'Välj specifika delar av data att exportera', icon: Filter },
        { title: 'SIE-export', description: 'Standard Interchange Format för bokföring', icon: Database },
        { title: 'Datumintervall', description: 'Filtrera på tidsperiod för relevant data', icon: Clock },
        { title: 'Batch-export', description: 'Ladda ner flera filer på en gång', icon: Download },
        { title: 'Schemaläggning', description: 'Automatiska exporter på regelbunden basis', icon: RefreshCw },
      ],
      tips: [
        'Använd PDF för dokument som ska delas externt',
        'Excel fungerar bäst för data som ska bearbetas vidare',
        'SIE-filer kan importeras i andra bokföringssystem',
      ],
    }
  },
  {
    id: 'security',
    title: 'Säkerhet & Behörigheter',
    icon: Shield,
    description: 'Rollhantering, MFA och säkerhetsinställningar',
    color: 'from-slate-500 to-gray-600',
    content: {
      overview: `AIFM har företagsklassad säkerhet med MFA, rollbaserad åtkomstkontroll (RBAC) och fullständig audit trail. Varje användare ser bara det de har behörighet till.`,
      features: [
        { title: 'MFA/2FA', description: 'Tvåfaktorsautentisering med app eller SMS', icon: Smartphone },
        { title: 'SSO', description: 'Single Sign-On med Azure AD eller Google', icon: Key },
        { title: 'Roller', description: 'Admin, Manager, Accountant, Viewer och fler', icon: Users },
        { title: 'Behörighetsmatris', description: '30+ granulära behörigheter per roll', icon: Layers },
        { title: 'Audit trail', description: 'Fullständig logg över alla åtgärder', icon: Clock },
        { title: 'Sessionshantering', description: 'Kontrollera aktiva sessioner och enheter', icon: Monitor },
      ],
      setup: [
        { step: 1, title: 'Aktivera MFA', description: 'Gå till Inställningar → Säkerhet → MFA', details: ['Ladda ner authenticator-app', 'Skanna QR-kod', 'Verifiera med engångskod'] },
        { step: 2, title: 'Skapa roller', description: 'Admin → Behörigheter', details: ['Använd färdiga roller eller skapa egna', 'Välj behörigheter per kategori', 'Spara och tilldela till användare'] },
        { step: 3, title: 'Bjud in användare', description: 'Admin → Användare → Ny användare', details: ['Ange namn och e-post', 'Välj roll och bolagsbehörighet', 'Användaren får inbjudan via e-post'] },
      ],
      tips: [
        'Aktivera alltid MFA för admin-användare',
        'Använd principen om minsta behörighet',
        'Granska audit-loggen regelbundet',
      ],
      faq: [
        { question: 'Vilka MFA-metoder stöds?', answer: 'Vi stödjer TOTP-appar (Google Authenticator, Microsoft Authenticator) och SMS.' },
        { question: 'Kan jag skapa egna roller?', answer: 'Ja, gå till Admin → Behörigheter och klicka "Skapa roll". Välj sedan behörigheter.' },
        { question: 'Hur ser jag vem som gjort vad?', answer: 'Gå till Admin → Granskningslogg för fullständig audit trail med filter.' },
      ],
    }
  },
  {
    id: 'integrations',
    title: 'Integrationer',
    icon: Link2,
    description: 'Koppla externa system och tjänster',
    color: 'from-indigo-500 to-violet-500',
    content: {
      overview: `AIFM integrerar med de system du redan använder. Koppla Fortnox för bokföring, banker för transaktioner, och Microsoft 365/Google för e-post och kalender.`,
      features: [
        { title: 'Fortnox', description: 'Tvåvägssynk av bokföring och fakturor', icon: Calculator },
        { title: 'Bank (Tink)', description: 'Automatisk import av banktransaktioner', icon: CreditCard },
        { title: 'Microsoft 365', description: 'E-post, kalender och Teams-integration', icon: Mail },
        { title: 'Google Workspace', description: 'Gmail och Google Calendar', icon: Globe },
        { title: 'Slack', description: 'Notifikationer och godkännanden i Slack', icon: MessageSquare },
        { title: 'API', description: 'REST API för anpassade integrationer', icon: Database },
      ],
      setup: [
        { step: 1, title: 'Koppla Fortnox', description: 'Bokföring → Integrationer → Fortnox', details: ['Klicka "Anslut"', 'Logga in på Fortnox', 'Ge behörighet och vänta på synk'] },
        { step: 2, title: 'Koppla bank', description: 'Bokföring → Integrationer → Bank', details: ['Välj din bank från listan', 'Verifiera med BankID', 'Välj konton att synka'] },
        { step: 3, title: 'Koppla Microsoft/Google', description: 'Inställningar → Integrationer', details: ['Välj tjänst', 'Logga in och ge behörighet', 'Välj vad som ska synkas'] },
      ],
      faq: [
        { question: 'Vilka banker stöds?', answer: 'Vi stödjer alla svenska storbanker via Tink: Swedbank, SEB, Nordea, Handelsbanken med flera.' },
        { question: 'Kostar integrationerna extra?', answer: 'Nej, alla integrationer ingår i din AIFM-licens.' },
        { question: 'Kan jag bygga egen integration?', answer: 'Ja, vi har ett REST API. Kontakta oss för API-dokumentation.' },
      ],
    }
  },
  {
    id: 'notifications',
    title: 'Notifikationer & Påminnelser',
    icon: Bell,
    description: 'Håll koll på viktiga händelser och deadlines',
    color: 'from-pink-500 to-rose-500',
    content: {
      overview: `Missa aldrig en viktig deadline. AIFM skickar notifikationer via app, e-post och Slack för godkännanden, förfallodatum, systemhändelser och mer.`,
      features: [
        { title: 'In-app notiser', description: 'Realtidsnotifikationer i plattformen', icon: Bell },
        { title: 'E-postmeddelanden', description: 'Sammanfattningar och viktiga händelser', icon: Mail },
        { title: 'Slack/Teams', description: 'Pushnotiser till dina kanaler', icon: MessageSquare },
        { title: 'Deadlines', description: 'Automatiska påminnelser före förfallodatum', icon: Clock },
        { title: 'Godkännanden', description: 'Notis när något väntar på din åtgärd', icon: CheckSquare },
        { title: 'Eskalering', description: 'Automatisk eskalering vid förseningar', icon: AlertTriangle },
      ],
      setup: [
        { step: 1, title: 'Konfigurera notiser', description: 'Inställningar → Notifikationer', details: ['Välj vilka händelser du vill få notis om', 'Välj kanal per händelsetyp', 'Ställ in tysta timmar'] },
        { step: 2, title: 'Koppla Slack', description: 'Admin → Integrationer → Slack', details: ['Installera AIFM-appen i Slack', 'Välj vilken kanal notiser ska gå till', 'Testa med en testnotis'] },
      ],
      tips: [
        'Använd tysta timmar för att undvika notiser efter arbetstid',
        'Prioritera godkännanden med push, rutinmässiga med e-post',
        'Sätt upp eskalering för kritiska deadlines',
      ],
    }
  },
  {
    id: 'workflows',
    title: 'Arbetsflöden & Automation',
    icon: GitBranch,
    description: 'Automatisera processer och godkännanden',
    color: 'from-teal-500 to-emerald-500',
    content: {
      overview: `Automatisera repetitiva uppgifter med arbetsflöden. Sätt upp godkännandeflöden, automatiska påminnelser och checklistor för standardiserade processer.`,
      features: [
        { title: 'Godkännandeflöden', description: '4-ögon-princip för fakturor och transaktioner', icon: CheckSquare },
        { title: 'Playbooks', description: 'Checklistor för NAV, bokslut och compliance', icon: ClipboardList },
        { title: 'Automation', description: 'Händelse → Uppgift → Påminnelse → Eskalering', icon: Zap },
        { title: 'Bulk-operationer', description: 'Massuppdateringar och återkommande jobb', icon: Layers },
        { title: 'Mallar', description: 'Återanvändbara mallar för dokument och uppgifter', icon: FileText },
        { title: 'Schemaläggning', description: 'Automatisera återkommande processer', icon: Clock },
      ],
      setup: [
        { step: 1, title: 'Aktivera playbook', description: 'Admin → Arbetsflöden → Playbooks', details: ['Välj en mall (t.ex. "Månadsbokslut")', 'Anpassa steg och ansvariga', 'Aktivera och schemalägg'] },
        { step: 2, title: 'Skapa godkännandeflöde', description: 'Admin → Arbetsflöden → Godkännanden', details: ['Definiera beloppsintervall', 'Ange vem som godkänner vad', 'Sätt upp eskalering'] },
      ],
      tips: [
        'Börja med färdiga playbooks och anpassa sedan',
        'Använd beloppsbaserade godkännanden för effektivitet',
        'Automatisera påminnelser 3 dagar innan deadline',
      ],
    }
  },
];

// ============================================================================
// Subcomponents
// ============================================================================

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all rounded-lg
        ${active 
          ? 'bg-aifm-charcoal text-white' 
          : 'text-aifm-charcoal/60 hover:text-aifm-charcoal hover:bg-gray-100'
        }`}
    >
      {children}
    </button>
  );
}

function SectionNav({ 
  sections, 
  activeSection, 
  onSelect 
}: { 
  sections: HelpSection[];
  activeSection: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {/* Mobile: Horizontal scrollable tabs */}
      <div className="sm:hidden flex-shrink-0 border-b border-gray-100 overflow-x-auto scrollbar-none">
        <div className="flex p-2 gap-2 min-w-max">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSelect(section.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all
                  ${isActive 
                    ? 'bg-aifm-gold/10 text-aifm-charcoal' 
                    : 'text-aifm-charcoal/60 hover:bg-gray-50'
                  }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all
                  ${isActive 
                    ? `bg-gradient-to-br ${section.color} text-white` 
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                  <Icon className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium">{section.title}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Desktop: Vertical sidebar */}
      <div className="hidden sm:block w-64 flex-shrink-0 border-r border-gray-100 overflow-y-auto">
        <div className="p-4 space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSelect(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                  ${isActive 
                    ? 'bg-aifm-gold/10 text-aifm-charcoal' 
                    : 'text-aifm-charcoal/60 hover:bg-gray-50 hover:text-aifm-charcoal'
                  }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${isActive 
                    ? `bg-gradient-to-br ${section.color} text-white` 
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium truncate">{section.title}</span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-aifm-gold ml-auto flex-shrink-0" />
                )}
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
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
      >
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-3 py-3 text-left"
      >
        <HelpCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-colors ${isOpen ? 'text-aifm-gold' : 'text-aifm-charcoal/40'}`} />
        <span className={`text-sm transition-colors ${isOpen ? 'text-aifm-charcoal font-medium' : 'text-aifm-charcoal/70'}`}>
          {faq.question}
        </span>
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
      {/* Header */}
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

      {/* Tabs */}
      <div className="px-4 sm:px-6 py-2 sm:py-3 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-none">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
          Översikt
        </TabButton>
        {hasSetup && (
          <TabButton active={activeTab === 'setup'} onClick={() => setActiveTab('setup')}>
            Kom igång
          </TabButton>
        )}
        {hasFaq && (
          <TabButton active={activeTab === 'faq'} onClick={() => setActiveTab('faq')}>
            Vanliga frågor
          </TabButton>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Overview text */}
            <div className="bg-aifm-gold/5 rounded-2xl p-5 border border-aifm-gold/10">
              <p className="text-sm text-aifm-charcoal/70 leading-relaxed">{section.content.overview}</p>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">
                Funktioner
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {section.content.features.map((feature, i) => (
                  <FeatureCard key={i} feature={feature} />
                ))}
              </div>
            </div>

            {/* Tips */}
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
            <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">
              Steg-för-steg guide
            </h3>
            {section.content.setup!.map((step, i) => (
              <SetupStepCard key={i} step={step} />
            ))}
          </div>
        )}

        {activeTab === 'faq' && hasFaq && (
          <div>
            <h3 className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider mb-4">
              Vanliga frågor
            </h3>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              {section.content.faq!.map((faq, i) => (
                <FAQItem key={i} faq={faq} />
              ))}
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

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const currentSection = helpSections.find(s => s.id === activeSection) || helpSections[0];

  // Filter sections based on search
  const filteredSections = searchQuery
    ? helpSections.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : helpSections;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-5xl h-[90vh] sm:h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Header */}
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
          
          {/* Search */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök i hjälpen..."
                className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl w-64
                          focus:outline-none focus:border-aifm-gold focus:ring-1 focus:ring-aifm-gold/20"
              />
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-aifm-charcoal/50" />
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="sm:hidden px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök i hjälpen..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl
                        focus:outline-none focus:border-aifm-gold focus:ring-1 focus:ring-aifm-gold/20"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          <SectionNav 
            sections={filteredSections} 
            activeSection={activeSection} 
            onSelect={setActiveSection}
          />
          <SectionContent section={currentSection} />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <p className="text-[10px] sm:text-xs text-aifm-charcoal/40">
            <span className="hidden sm:inline">Tryck <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">ESC</kbd> för att stänga</span>
            <span className="sm:hidden">Svep ner för att stänga</span>
          </p>
          <div className="flex items-center gap-4">
            <a 
              href="mailto:support@aifmgroup.se" 
              className="text-xs text-aifm-charcoal/50 hover:text-aifm-gold transition-colors"
            >
              Kontakta support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpCenterButton;


