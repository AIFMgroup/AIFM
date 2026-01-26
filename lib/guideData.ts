/**
 * Comprehensive Guide Data for AIFM Platform
 * Detailed step-by-step instructions for all features
 */

export interface GuideStep {
  id: string;
  title: string;
  shortDescription: string;
  detailedContent: {
    overview: string;
    howItWorks: string[];
    useCases: string[];
    commonMistakes: string[];
    proTips: string[];
    relatedFeatures: string[];
    faq: { question: string; answer: string }[];
  };
}

export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  introduction: string;
  keyBenefits: string[];
  steps: GuideStep[];
  features: { title: string; description: string }[];
  tips: string[];
  link: string;
  hasVideo?: boolean;
}

export const guideSections: GuideSection[] = [
  {
    id: 'overview',
    title: 'Välkommen till AIFM',
    icon: 'Sparkles',
    description: 'AIFM är ett komplett fondadministrationssystem byggt för att automatisera ditt arbete med AI.',
    introduction: 'AIFM (Alternative Investment Fund Manager) är en modern plattform designad specifikt för fondförvaltare, family offices och investeringsbolag. Plattformen kombinerar kraftfull automatisering med intuitiv design för att effektivisera alla aspekter av fondadministration - från bokföring och compliance till säker dokumentdelning.',
    keyBenefits: [
      'Spara 70% av tiden på rutinuppgifter genom AI-automatisering',
      'Eliminera manuella fel med automatiska kontroller',
      'AI-driven bokföring med automatisk kontering',
      'Compliance-agent tränad på EU-regelverk',
      'Säkra datarum för känsliga dokument',
    ],
    steps: [
      {
        id: 'login',
        title: 'Logga in',
        shortDescription: 'Använd dina inloggningsuppgifter eller BankID för säker åtkomst',
        detailedContent: {
          overview: 'Inloggning till AIFM sker via en säker autentiseringsprocess som stödjer både traditionell inloggning och BankID för extra säkerhet.',
          howItWorks: [
            'Gå till inloggningssidan på app.aifm.se',
            'Välj inloggningsmetod: E-post/lösenord eller BankID',
            'För BankID: Öppna BankID-appen på din mobil och verifiera',
            'För e-post: Ange din e-postadress och lösenord',
            'Vid första inloggningen ombeds du sätta upp tvåfaktorsautentisering',
            'Efter lyckad inloggning dirigeras du till översiktssidan',
          ],
          useCases: [
            'Daglig inloggning för att granska status och uppgifter',
            'Snabb åtkomst via BankID när du är på språng',
            'Säker inloggning från delade arbetsstationer',
          ],
          commonMistakes: [
            'Glömmer att aktivera tvåfaktorsautentisering - viktigt för säkerheten',
            'Använder samma lösenord som på andra tjänster',
            'Delar inloggningsuppgifter med kollegor istället för att skapa separata konton',
          ],
          proTips: [
            'Aktivera "Kom ihåg mig" på betrodda enheter för snabbare inloggning',
            'Använd en lösenordshanterare för att generera starka, unika lösenord',
            'Om du arbetar med känslig data, logga alltid ut när du lämnar datorn',
          ],
          relatedFeatures: ['Inställningar > Säkerhet', 'Tvåfaktorsautentisering', 'Sessionshantering'],
          faq: [
            { question: 'Vad gör jag om jag glömt mitt lösenord?', answer: 'Klicka på "Glömt lösenord" på inloggningssidan. En återställningslänk skickas till din e-post.' },
            { question: 'Kan jag använda BankID på företagsdator?', answer: 'Ja, BankID fungerar oberoende av enhet så länge du har BankID-appen på din mobil.' },
            { question: 'Hur lång är en session aktiv?', answer: 'Sessioner är aktiva i 8 timmar vid inaktivitet, eller tills du loggar ut manuellt.' },
          ],
        },
      },
      {
        id: 'select-fund',
        title: 'Välj fond',
        shortDescription: 'Klicka på fondväljaren högst upp för att byta mellan dina fonder',
        detailedContent: {
          overview: 'Fondväljaren är navet i AIFM - härifrån styr du vilken fond du arbetar med. All data på plattformen uppdateras automatiskt baserat på vald fond.',
          howItWorks: [
            'Fondväljaren finns alltid synlig i sidhuvudet',
            'Klicka på den expanderbara knappen för att se alla tillgängliga fonder',
            'Sök efter fondnamn eller organisationsnummer',
            'Klicka på önskad fond för att byta',
            'En laddningsindikator visar att data uppdateras',
            'Alla sidor uppdateras automatiskt med den valda fondens data',
          ],
          useCases: [
            'Snabbt växla mellan fonder under arbetsdagen',
            'Jämföra nyckeltal mellan olika fonder',
            'Arbeta med specifik fond för bokföring eller compliance',
          ],
          commonMistakes: [
            'Glömmer att byta fond innan man skapar transaktioner',
            'Exporterar rapporter för fel fond',
            'Blandar ihop fonder med liknande namn',
          ],
          proTips: [
            'Varje fond har en unik färg för snabb identifiering',
            'Organisationsnumret visas för att undvika förväxling',
            'Den senast valda fonden sparas och väljs automatiskt vid nästa inloggning',
          ],
          relatedFeatures: ['Översikt', 'Alla sidor', 'Rapporter'],
          faq: [
            { question: 'Kan jag se data från flera fonder samtidigt?', answer: 'Nej, AIFM visar alltid data för en fond i taget för tydlighet. Använd exportfunktionen för att sammanställa data från flera fonder.' },
            { question: 'Hur lägger jag till en ny fond?', answer: 'Klicka på "Nytt bolag"-knappen i fondväljaren för att starta onboarding-guiden för nya fonder.' },
            { question: 'Vad händer med osparade ändringar vid fondbyte?', answer: 'Alla ändringar sparas automatiskt, så du kan tryggt byta fond utan att förlora data.' },
          ],
        },
      },
      {
        id: 'navigate',
        title: 'Navigera',
        shortDescription: 'Använd sidomenyn för att gå till olika funktioner',
        detailedContent: {
          overview: 'Sidomenyn ger dig tillgång till alla funktioner i AIFM, organiserade i logiska kategorier för snabb åtkomst.',
          howItWorks: [
            'Sidomenyn finns alltid till vänster på skärmen',
            'Klicka på en kategori för att expandera undermenyerna',
            'Aktiv sida markeras med guldmarkering',
            'På mobil: Klicka på hamburgermenyn för att öppna/stänga',
            'Undermenyerna förblir öppna tills du aktivt stänger dem',
          ],
          useCases: [
            'Snabb navigering mellan bokföring och compliance',
            'Åtkomst till datarum för dokumentdelning',
            'Öppna inställningar och användarguide',
          ],
          commonMistakes: [
            'Missar undermenyer genom att inte expandera kategorier',
            'Söker efter funktioner som finns under annan kategori',
          ],
          proTips: [
            'Lär dig tangentbordsgenvägar för snabbare navigering',
            'Bokföring innehåller allt relaterat till ekonomi',
            'Compliance-relaterade funktioner finns under "Compliance"',
          ],
          relatedFeatures: ['Alla funktioner', 'Snabbsök'],
          faq: [
            { question: 'Kan jag anpassa menyn?', answer: 'Menyn är standardiserad för konsekvens, men du kan använda bokmärken i webbläsaren för dina mest använda sidor.' },
            { question: 'Hur hittar jag en specifik funktion?', answer: 'Använd hjälp-assistenten nere till höger och fråga var du hittar det du söker.' },
          ],
        },
      },
      {
        id: 'get-help',
        title: 'Få hjälp',
        shortDescription: 'Klicka på hjälp-ikonen nere till höger för att chatta med AI-assistenten',
        detailedContent: {
          overview: 'Hjälp-assistenten är din personliga guide i AIFM. Den kan svara på frågor om alla funktioner, ge steg-för-steg instruktioner och hjälpa dig lösa problem.',
          howItWorks: [
            'Klicka på maskot-ikonen nere till höger',
            'Skriv din fråga i chattfältet',
            'AI-assistenten svarar med relevant information',
            'Använd snabbförslag för vanliga frågor',
            'Maximera fönstret för längre konversationer',
          ],
          useCases: [
            'Lära sig använda nya funktioner',
            'Felsöka problem',
            'Få förklaringar på finansiella termer',
            'Hitta rätt sida för en uppgift',
          ],
          commonMistakes: [
            'Ställer för vaga frågor - var specifik',
            'Förväntar sig att assistenten kan utföra åtgärder - den ger bara information',
          ],
          proTips: [
            'Börja frågor med "Hur gör jag..." för steg-för-steg guide',
            'Assistenten kan förklara branschtermer och begrepp',
            'Använd assistenten för att snabbt hitta rätt funktion',
          ],
          relatedFeatures: ['Alla funktioner', 'Användarguide'],
          faq: [
            { question: 'Sparas mina konversationer?', answer: 'Nej, konversationer sparas inte mellan sessioner av säkerhetsskäl.' },
            { question: 'Kan assistenten se min fonddata?', answer: 'Nej, assistenten har bara tillgång till dokumentation och hjälptexter, inte din faktiska data.' },
          ],
        },
      },
    ],
    features: [
      { title: 'AI-automatisering', description: 'Automatisk klassificering av dokument, konteringsförslag och OCR-avläsning.' },
      { title: 'Compliance-agent', description: 'AI-driven hjälp för regulatoriska frågor med källhänvisningar.' },
      { title: 'Säkra datarum', description: 'Krypterade utrymmen för känslig dokumentdelning.' },
      { title: 'Fortnox-integration', description: 'Automatisk export av bokföring till Fortnox.' },
      { title: 'Full spårbarhet', description: 'Komplett audit trail - vem gjorde vad och när.' },
      { title: 'Mobil-responsiv', description: 'Fungerar på alla enheter - dator, surfplatta och mobil.' },
    ],
    tips: [
      'Börja med att utforska Översiktssidan för att få en känsla för plattformen',
      'Använd hjälp-assistenten nere till höger för alla frågor',
      'Alla ändringar sparas automatiskt - du behöver aldrig trycka "Spara"',
      'Byt fond snabbt med dropdown-menyn högst upp',
    ],
    link: '/overview',
  },
  {
    id: 'accounting',
    title: 'Bokföring',
    icon: 'Calculator',
    description: 'AI-driven bokföring med automatisk dokumentklassificering och Fortnox-integration.',
    introduction: 'Bokföringsmodulen automatiserar hela bokföringsflödet med AI. Ladda upp fakturor och kvitton via drag-and-drop, få automatiska konteringsförslag enligt BAS-kontoplanen, hantera moms och skatt, och exportera direkt till Fortnox.',
    keyBenefits: [
      'AI läser och klassificerar dokument automatiskt med OCR',
      'Automatiska konteringsförslag enligt BAS-kontoplanen',
      'Stöd för flera valutor (SEK, EUR, USD, GBP m.fl.)',
      'Automatisk separation av flera kvitton i samma bild',
      'Direkt export till Fortnox',
      'Momsdeklaration och SRU-export för skattedeklaration',
    ],
    hasVideo: false,
    steps: [
      {
        id: 'upload-docs',
        title: 'Ladda upp dokument',
        shortDescription: 'Dra och släpp fakturor och kvitton för automatisk analys',
        detailedContent: {
          overview: 'Det första steget i bokföringsprocessen är att ladda upp verifikationer. AI läser dokumenten med OCR och extraherar relevant information automatiskt - leverantör, belopp, datum, valuta och moms.',
          howItWorks: [
            'Gå till Bokföring > Uppladdning',
            'Dra och släpp filer till uppladdningsytan, eller klicka för att välja filer',
            'AI analyserar dokumenten automatiskt med OCR',
            'Dokumenttyp identifieras (faktura, kvitto, kreditnota)',
            'Data extraheras: leverantör, belopp, datum, valuta, moms',
            'Om bilden innehåller flera kvitton separeras dessa automatiskt',
            'Varje dokument köas för kontering',
          ],
          useCases: [
            'Leverantörsfakturor i PDF-format',
            'Kvitton fotograferade med mobilen',
            'Kontoutdrag och bankdokument',
            'Kreditfakturor',
            'Utländska fakturor i EUR, USD eller GBP',
          ],
          commonMistakes: [
            'Laddar upp suddiga eller skeva bilder - kvalitet påverkar AI-resultat',
            'Laddar upp samma faktura flera gånger (systemet varnar för dubbletter)',
            'Fel period på dokumentet',
          ],
          proTips: [
            'Bättre bildkvalitet ger bättre AI-resultat',
            'Ladda upp flera filer samtidigt för effektivitet',
            'Fotografera kvitton rakt ovanifrån med bra belysning',
            'Kontrollera att alla sidor är med vid flersidiga fakturor',
            'Systemet upptäcker och separerar automatiskt om du har flera kvitton i samma bild',
          ],
          relatedFeatures: ['AI-klassificering', 'OCR', 'Kontering', 'Multi-kvitto separation'],
          faq: [
            { question: 'Vilka filformat stöds?', answer: 'PDF, JPG, PNG och HEIC stöds. Vi rekommenderar PDF för fakturor och JPG/PNG för kvitton.' },
            { question: 'Hur vet jag om AI läst rätt?', answer: 'Du kan alltid granska och korrigera AI:s förslag innan du godkänner kontorföringen.' },
            { question: 'Vad händer om jag har flera kvitton i samma bild?', answer: 'AI upptäcker automatiskt om bilden innehåller flera kvitton och separerar dem till individuella poster.' },
            { question: 'Stöds utländska valutor?', answer: 'Ja, systemet identifierar automatiskt valutor som USD ($), EUR (€), GBP (£) m.fl. och visar rätt valutasymbol.' },
          ],
        },
      },
      {
        id: 'review-booking',
        title: 'Granska kontering',
        shortDescription: 'AI föreslår kontering enligt BAS - du godkänner eller justerar',
        detailedContent: {
          overview: 'Efter uppladdning föreslår AI kontering enligt BAS-kontoplanen baserat på leverantör, belopp och dokumenttyp. Du granskar, justerar vid behov och godkänner.',
          howItWorks: [
            'Gå till Bokföring > Uppladdning för att se listan med verifikationer',
            'Klicka på en verifikation för att se detaljer och AI:s konteringsförslag',
            'Granska extraherad data: leverantör, fakturanummer, datum, belopp, moms',
            'Se AI:s föreslagna debet- och kreditkonton',
            'Justera vid behov genom att klicka på fälten',
            'Godkänn för att skicka till Fortnox eller spara lokalt',
          ],
          useCases: [
            'Daglig bokföring av inkomna fakturor',
            'Kvittohantering för utlägg',
            'Korrigering av felaktiga konteringar',
          ],
          commonMistakes: [
            'Godkänner utan att granska belopp och moms',
            'Väljer fel momssats',
            'Glömmer kontrollera att rätt valuta är vald',
          ],
          proTips: [
            'AI lär sig av dina korrigeringar och blir bättre över tid',
            'Kontrollera alltid momsbeloppet vid osäkerhet',
            'Dubbelkolla valutan vid utländska fakturor',
            'Använd leverantörens senaste kontering som mall för nya fakturor',
          ],
          relatedFeatures: ['BAS-kontoplan', 'Moms', 'Verifikationer', 'Fortnox'],
          faq: [
            { question: 'Kan jag ändra en bokföring efteråt?', answer: 'Ja, så länge den inte är skickad till Fortnox kan du redigera. Efter export skapas korrigeringsverifikationer.' },
            { question: 'Hur fungerar momsberäkningen?', answer: 'AI identifierar momssats (25%, 12%, 6%, 0%) baserat på dokumenttyp och beräknar momsbeloppet automatiskt.' },
          ],
        },
      },
      {
        id: 'fortnox-export',
        title: 'Exportera till Fortnox',
        shortDescription: 'Godkända verifikationer synkas automatiskt till Fortnox',
        detailedContent: {
          overview: 'När du godkänner en kontering kan den skickas direkt till Fortnox. Systemet skapar leverantörsfaktura eller verifikation automatiskt.',
          howItWorks: [
            'Anslut ditt Fortnox-konto under Inställningar > Integrationer',
            'När du godkänner en verifikation, välj "Skicka till Fortnox"',
            'Systemet skapar automatiskt leverantörsfaktura i Fortnox',
            'Verifikationsnummer från Fortnox visas i AIFM',
            'Status uppdateras till "Skickad till Fortnox"',
          ],
          useCases: [
            'Automatisera bokföring från AIFM till Fortnox',
            'Undvika dubbelarbete med manuell inmatning',
            'Säkerställa att alla verifikationer finns i Fortnox',
          ],
          commonMistakes: [
            'Glömmer ansluta Fortnox-konto först',
            'Skickar samma verifikation två gånger (systemet varnar)',
            'Fel räkenskapsår valt i Fortnox',
          ],
          proTips: [
            'Kontrollera att rätt räkenskapsår är aktivt i Fortnox',
            'Använd batch-export för att skicka flera verifikationer samtidigt',
            'Granska alltid i Fortnox efter export',
          ],
          relatedFeatures: ['Fortnox-integration', 'Verifikationer', 'Export'],
          faq: [
            { question: 'Behöver jag Fortnox-konto?', answer: 'Fortnox-integration är valfri. Du kan använda AIFM för bokföring och exportera till SIE-format istället.' },
            { question: 'Vad händer om exporten misslyckas?', answer: 'Du får ett felmeddelande med orsak. Vanligaste orsaken är att kontot inte finns i Fortnox kontoplan.' },
          ],
        },
      },
      {
        id: 'vat-tax',
        title: 'Moms & Skatt',
        shortDescription: 'Skapa momsdeklaration och SRU-export för skattedeklaration',
        detailedContent: {
          overview: 'Under Bokföring > Moms & Skatt kan du generera momsdeklaration (SKV 4700) och SRU-filer för inkomstdeklaration (INK2/INK4).',
          howItWorks: [
            'Gå till Bokföring > Moms & Skatt',
            'Välj period för momsdeklaration (månad eller kvartal)',
            'Systemet beräknar automatiskt alla momsrutor baserat på bokföringen',
            'Granska och justera vid behov',
            'Exportera till XML för uppladdning till Skatteverket',
            'För inkomstdeklaration: Välj räkenskapsår och generera SRU-fil',
          ],
          useCases: [
            'Kvartalsvis momsdeklaration',
            'Årlig inkomstdeklaration med INK2/INK4-bilagor',
            'Underlag för revision',
          ],
          commonMistakes: [
            'Fel period vald för momsdeklaration',
            'Alla verifikationer inte bokförda innan deklaration',
            'Glömmer periodiseringar',
          ],
          proTips: [
            'Stäm av bokföringen innan du skapar deklaration',
            'Spara alltid en kopia av exporten',
            'Kontrollera att alla konton är mappade till rätt SRU-koder',
          ],
          relatedFeatures: ['Momsdeklaration', 'SRU-export', 'Skatteverket'],
          faq: [
            { question: 'Vilka momsrutor fylls i automatiskt?', answer: 'Alla standardrutor (05-50) beräknas automatiskt baserat på BAS-kontoplanen och momssatser.' },
            { question: 'Kan jag använda SRU-filen direkt till Skatteverket?', answer: 'Ja, SRU-filen är i standardformat och kan laddas upp direkt till Skatteverkets e-tjänst.' },
          ],
        },
      },
      {
        id: 'period-closing',
        title: 'Periodavslut & Bokslut',
        shortDescription: 'Stäm av perioder och generera årsredovisning',
        detailedContent: {
          overview: 'Under Bokföring > Bokslut hittar du verktyg för periodavstämning, automatiskt bokslut och årsredovisning.',
          howItWorks: [
            'Gå till Bokföring > Bokslut',
            'Välj period att stämma av',
            'Kör automatiskt bokslut för att beräkna avskrivningar m.m.',
            'Granska resultat- och balansräkning',
            'Generera årsredovisning när alla perioder är avstämda',
            'Exportera till Word eller skicka direkt till revisor',
          ],
          useCases: [
            'Månadsavslut',
            'Kvartalsrapportering',
            'Årsbokslut och årsredovisning',
          ],
          commonMistakes: [
            'Glömmer stämma av alla perioder innan årsredovisning',
            'Saknade periodiseringar',
            'Fel på avskrivningar',
          ],
          proTips: [
            'Stäm av månadsvis för bättre kontroll',
            'Exportera rapport tidigt för revisorsgranskning',
            'Använd checklistan för att inte missa något',
          ],
          relatedFeatures: ['Bokslut', 'Årsredovisning', 'Revision'],
          faq: [
            { question: 'Kan revisorn få tillgång till systemet?', answer: 'Ja, du kan bjuda in revisorn med läsrättigheter via Inställningar > Team.' },
          ],
        },
      },
    ],
    features: [
      { title: 'AI-klassificering', description: 'Dokument läses och klassificeras automatiskt med OCR - leverantör, belopp, datum och moms.' },
      { title: 'Multi-kvitto separation', description: 'Om en bild innehåller flera kvitton separeras dessa automatiskt till individuella poster.' },
      { title: 'Flervalduta-stöd', description: 'Automatisk identifiering av SEK, EUR, USD, GBP och andra valutor med rätt valutasymbol.' },
      { title: 'BAS-kontering', description: 'Automatiska konteringsförslag enligt BAS-kontoplanen med momsberäkning.' },
      { title: 'Fortnox-integration', description: 'Export av godkända verifikationer direkt till Fortnox.' },
      { title: 'Moms & Skatt', description: 'Generera momsdeklaration (SKV 4700) och SRU-export för inkomstdeklaration.' },
    ],
    tips: [
      'Ladda upp dokument löpande för jämnare arbetsbelastning',
      'Granska alltid AI-förslag innan godkännande - särskilt moms och valuta',
      'Anslut Fortnox för automatisk export av bokföring',
      'Använd Moms & Skatt för att enkelt skapa deklarationer',
    ],
    link: '/accounting/upload',
  },
  {
    id: 'data-rooms',
    title: 'Datarum',
    icon: 'FolderLock',
    description: 'Säkra, krypterade utrymmen för känsliga dokument med granulär åtkomstkontroll.',
    introduction: 'Datarum ger dig möjlighet att dela känsliga dokument säkert med externa parter. Varje datarum har granulär åtkomstkontroll per användare och dokument, tidsbegränsning, automatisk vattenmärkning och komplett aktivitetslogg.',
    keyBenefits: [
      'Krypterad lagring av känsliga dokument',
      'Granulär åtkomstkontroll per användare och dokument',
      'Tidsbegränsad åtkomst med automatisk utgång',
      'Automatisk vattenmärkning med användarinfo',
      'Komplett aktivitetslogg - se vem som öppnat vad',
      'Mappstruktur för organisering av dokument',
    ],
    hasVideo: false,
    steps: [
      {
        id: 'create-room',
        title: 'Skapa datarum',
        shortDescription: 'Skapa ett nytt säkert datarum för dokumentdelning',
        detailedContent: {
          overview: 'Skapa ett datarum för att säkert dela dokument med investerare, due diligence-team, revisorer eller andra externa parter.',
          howItWorks: [
            'Gå till Datarum i sidomenyn',
            'Klicka på "Nytt datarum"',
            'Ange namn och beskrivning',
            'Sätt utgångsdatum om tillämpligt',
            'Aktivera vattenmärkning om önskat',
            'Spara för att skapa rummet',
          ],
          useCases: [
            'Due diligence vid fondinsamling eller förvärv',
            'Dela kvartalsrapporter med LPs',
            'Juridisk granskning med advokater',
            'Revisionsdokumentation',
          ],
          commonMistakes: [
            'För brett åtkomstbibliotek - ge bara nödvändig åtkomst',
            'Glömmer sätta utgångsdatum för externa användare',
            'Laddar upp fel dokument',
          ],
          proTips: [
            'Skapa separata datarum för olika processer',
            'Sätt alltid utgångsdatum för externa användare',
            'Använd mappar för att organisera dokument logiskt',
            'Aktivera vattenmärkning för känsliga dokument',
          ],
          relatedFeatures: ['Dokument', 'Åtkomst', 'Aktivitetslogg'],
          faq: [
            { question: 'Hur säkra är datarummen?', answer: 'Alla dokument är krypterade både vid lagring och överföring. Vi använder bankstandard AES-256 kryptering.' },
            { question: 'Kan jag begränsa åtkomst till specifika mappar?', answer: 'Ja, du kan sätta individuella rättigheter per mapp och per användare.' },
          ],
        },
      },
      {
        id: 'upload-documents',
        title: 'Ladda upp dokument',
        shortDescription: 'Lägg till dokument och organisera i mappar',
        detailedContent: {
          overview: 'Ladda upp dokument till datarummet och organisera dem i en logisk mappstruktur.',
          howItWorks: [
            'Öppna datarummet',
            'Skapa mappar för att organisera innehållet',
            'Dra och släpp filer till önskad mapp',
            'Eller klicka "Ladda upp" för att välja filer',
            'Filer laddas upp krypterat automatiskt',
          ],
          useCases: [
            'Organisera due diligence-material',
            'Dela finansiella rapporter',
            'Samla avtal och juridiska dokument',
          ],
          commonMistakes: [
            'Dålig mappstruktur gör det svårt att hitta',
            'Laddar upp för stora filer',
          ],
          proTips: [
            'Använd tydliga och beskrivande mappnamn',
            'Skapa en standard-mappstruktur för återkommande processer',
            'Håll filer organiserade - det sparar tid för alla',
          ],
          relatedFeatures: ['Mappar', 'Filuppladdning', 'Kryptering'],
          faq: [
            { question: 'Vilka filformat stöds?', answer: 'De flesta format stöds: PDF, Word, Excel, PowerPoint, bilder m.fl. Max filstorlek är 100 MB.' },
            { question: 'Kan jag ladda upp hela mappar?', answer: 'Ja, du kan dra och släppa hela mappar för att behålla strukturen.' },
          ],
        },
      },
      {
        id: 'invite-members',
        title: 'Bjud in medlemmar',
        shortDescription: 'Ge åtkomst till rätt personer med rätt rättigheter',
        detailedContent: {
          overview: 'Bjud in externa användare till datarummet med specifika rättigheter. Du kontrollerar vem som kan se, ladda ner eller redigera varje mapp.',
          howItWorks: [
            'Öppna datarummet',
            'Klicka på "Medlemmar" eller "Bjud in"',
            'Ange e-postadress för den du vill bjuda in',
            'Välj rättighet: Visa, Ladda ner, eller Redigera',
            'Sätt eventuell tidsbegränsning',
            'Skicka inbjudan - användaren får e-post med länk',
          ],
          useCases: [
            'Due diligence-team behöver granska material',
            'LP vill ladda ner kvartalsrapporter',
            'Revisor behöver tillgång till räkenskapsmaterial',
          ],
          commonMistakes: [
            'Ger för breda rättigheter - "Endast visa" räcker ofta',
            'Glömmer återkalla åtkomst efter processen är klar',
            'Bjuder in fel e-postadress',
          ],
          proTips: [
            'Använd "Endast visa" som standardrättighet',
            'Sätt alltid tidsbegränsning för externa - t.ex. 30 dagar',
            'Granska regelbundet vem som har åtkomst',
            'Stäng datarummet när processen är avslutad',
          ],
          relatedFeatures: ['Rättigheter', 'Inbjudningar', 'Åtkomstkontroll'],
          faq: [
            { question: 'Kan jag återkalla åtkomst?', answer: 'Ja, du kan när som helst ta bort en användares åtkomst med ett klick.' },
            { question: 'Ser användarna varandras aktivitet?', answer: 'Nej, endast administratörer ser aktivitetsloggen. Vanliga användare ser bara dokumenten.' },
          ],
        },
      },
      {
        id: 'monitor-activity',
        title: 'Följ aktivitet',
        shortDescription: 'Se vem som öppnat och laddat ner dokument',
        detailedContent: {
          overview: 'Aktivitetsloggen visar exakt vem som gjort vad i datarummet - visningar, nedladdningar, uppladdningar och ändringar.',
          howItWorks: [
            'Öppna datarummet',
            'Klicka på "Aktivitet" eller aktivitetsikonen',
            'Se kronologisk lista över alla händelser',
            'Filtrera på användare, dokumenttyp eller tidperiod',
            'Exportera loggen vid behov för dokumentation',
          ],
          useCases: [
            'Verifiera att rätt personer granskat material',
            'Spåra vilka dokument som är mest intressanta',
            'Dokumentation för compliance och revision',
          ],
          commonMistakes: [
            'Glömmer granska loggen regelbundet',
          ],
          proTips: [
            'Granska aktivitetsloggen efter viktiga möten',
            'Exportera loggen som dokumentation efter avslutad process',
            'Använd loggen för att förstå vilka dokument som är viktigast',
          ],
          relatedFeatures: ['Aktivitetslogg', 'Export', 'Compliance'],
          faq: [
            { question: 'Hur länge sparas aktivitetsloggen?', answer: 'Aktivitetsloggen sparas så länge datarummet finns kvar, plus 12 månader efter stängning.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Granulär åtkomst', description: 'Styr exakt vem som kan se, ladda ner eller redigera varje mapp och dokument.' },
      { title: 'Automatisk vattenmärkning', description: 'Dokument vattenmärks automatiskt med användarens e-post vid visning och nedladdning.' },
      { title: 'Aktivitetslogg', description: 'Komplett spårning av vem som gjort vad och när - visningar, nedladdningar m.m.' },
      { title: 'Tidsbegränsning', description: 'Sätt utgångsdatum för åtkomst så att den automatiskt återkallas.' },
      { title: 'Kryptering', description: 'AES-256 kryptering för alla dokument vid lagring och överföring.' },
      { title: 'Mappstruktur', description: 'Organisera dokument i logisk mappstruktur med individuella rättigheter.' },
    ],
    tips: [
      'Använd "Endast visa" som standardrättighet för känsliga dokument',
      'Sätt alltid utgångsdatum för externa användare',
      'Granska aktivitetsloggen regelbundet',
      'Stäng datarum när processen är avslutad',
    ],
    link: '/data-rooms',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: 'Shield',
    description: 'AI-driven compliance med regulatoriskt arkiv och intelligent frågeassistent.',
    introduction: 'Compliance-modulen hjälper dig säkerställa regelefterlevnad med en AI-agent tränad på AIFMD, SFDR, MiFID II och EU-regelverk. Agenten svarar på frågor med källhänvisningar och kan söka i över 450 regulatoriska dokument. Regelverksarkivet uppdateras automatiskt varje vecka från EUR-Lex.',
    keyBenefits: [
      'AI-agent tränad på AIFMD, SFDR, MiFID II och EU-regelverk',
      'Svar med exakta källhänvisningar till förordningar',
      'Regelverksarkiv med över 450 sökbara dokument',
      'Automatisk veckovis synkronisering från EUR-Lex',
      'Ladda upp egna compliance-dokument till kunskapsbasen',
      'Agenten erkänner när den inte kan svara - ingen gissning',
    ],
    hasVideo: false,
    steps: [
      {
        id: 'use-ai-agent',
        title: 'Använd AI-agenten',
        shortDescription: 'Ställ frågor om regelverk och få svar med källhänvisningar',
        detailedContent: {
          overview: 'Compliance AI-agenten är tränad på relevanta EU-regelverk och kan ge snabba svar på regulatoriska frågor med exakta källhänvisningar till förordningar och direktiv.',
          howItWorks: [
            'Gå till Compliance i sidomenyn',
            'Skriv din fråga i chattfältet',
            'AI-agenten svarar baserat på regulatoriska dokument',
            'Varje svar innehåller källhänvisningar med dokumentnamn och paragraf',
            'Klicka på källan för att läsa originaldokumentet',
            'Ställ följdfrågor för fördjupning',
          ],
          useCases: [
            'Frågor om AIFMD-krav för AIF-förvaltare',
            'SFDR-klassificering (Artikel 6, 8, 9)',
            'MiFID II tillståndskrav',
            'KYC/AML-processer och kundkategorisering',
            'Rapporteringskrav och tidsfrister',
          ],
          commonMistakes: [
            'Förlitar sig helt på AI utan att läsa källorna',
            'Ställer för vaga frågor - var specifik',
            'Förväntar sig juridisk rådgivning - AI ger information, inte juridisk bedömning',
          ],
          proTips: [
            'Var specifik i dina frågor - t.ex. "Vilka AIFMD-krav gäller för rapportering till tillsynsmyndigheten?"',
            'Följ alltid källhänvisningarna för att läsa originaltexten',
            'Agenten erkänner ärligt när den inte har svar - lita på detta',
            'Kombinera information från flera frågor för komplex analys',
          ],
          relatedFeatures: ['Regelverksarkiv', 'Dokument', 'Kunskapsbas'],
          faq: [
            { question: 'Vilka regelverk kan AI:n svara om?', answer: 'AI:n är tränad på AIFMD, SFDR, MiFID II, UCITS, KYC/AML-regelverk, EU-förordningar och delegerade akter relaterade till fondindustrin.' },
            { question: 'Hur aktuell är informationen?', answer: 'Regelverksarkivet synkroniseras automatiskt varje vecka från EUR-Lex med de senaste dokumenten.' },
            { question: 'Ersätter AI:n juridisk rådgivning?', answer: 'Nej, AI:n ger information baserat på regelverk men ersätter inte kvalificerad juridisk rådgivning för specifika situationer.' },
          ],
        },
      },
      {
        id: 'browse-archive',
        title: 'Sök i regelverksarkivet',
        shortDescription: 'Bläddra och sök bland alla regulatoriska dokument',
        detailedContent: {
          overview: 'Regelverksarkivet innehåller över 450 sökbara dokument inklusive EU-förordningar, direktiv, delegerade akter och riktlinjer. Sök fritt eller filtrera på kategori.',
          howItWorks: [
            'Gå till Compliance > Regelverksarkiv',
            'Använd sökfältet för att söka på nyckelord, förordningsnummer eller ämne',
            'Filtrera på kategori: AIFMD, SFDR, MiFID II, UCITS, m.fl.',
            'Klicka på ett dokument för att läsa det',
            'Ladda ner som PDF vid behov',
          ],
          useCases: [
            'Hitta specifik EU-förordning',
            'Läsa originaltext för att verifiera AI-svar',
            'Söka efter uppdateringar av regelverk',
            'Referera till specifika artiklar i dokumentation',
          ],
          commonMistakes: [
            'Söker på för generella termer',
            'Missar att filtrera på kategori för snabbare resultat',
          ],
          proTips: [
            'Sök på förordningsnummer (t.ex. "2011/61/EU") för exakt träff',
            'Använd kategorifilter för att begränsa sökresultat',
            'Bokmärk ofta använda dokument',
          ],
          relatedFeatures: ['AI-agent', 'Dokumentsökning', 'EUR-Lex'],
          faq: [
            { question: 'Hur ofta uppdateras arkivet?', answer: 'Arkivet synkroniseras automatiskt varje vecka med EUR-Lex för att inkludera nya och uppdaterade dokument.' },
            { question: 'Kan jag ladda ner dokument?', answer: 'Ja, alla dokument kan laddas ner som PDF.' },
          ],
        },
      },
      {
        id: 'upload-docs',
        title: 'Ladda upp egna dokument',
        shortDescription: 'Lägg till egna compliance-dokument till kunskapsbasen',
        detailedContent: {
          overview: 'Du kan ladda upp egna compliance-dokument till kunskapsbasen så att AI-agenten kan använda dem när den svarar på frågor.',
          howItWorks: [
            'Gå till Compliance > Inställningar',
            'Klicka på "Ladda upp dokument"',
            'Välj filer att ladda upp (PDF rekommenderas)',
            'Ange kategori och beskrivning',
            'Dokumentet processas och läggs till i kunskapsbasen',
            'AI-agenten kan nu använda dokumentet för att svara på frågor',
          ],
          useCases: [
            'Interna compliance-policies',
            'Godkända rutinbeskrivningar',
            'Specifika regulatoriska krav för din verksamhet',
            'Branschspecifika riktlinjer',
          ],
          commonMistakes: [
            'Laddar upp för stora eller skannade dokument utan OCR',
            'Glömmer kategorisera dokumentet korrekt',
          ],
          proTips: [
            'Använd PDF-format för bästa resultat',
            'Ge tydliga namn och beskrivningar',
            'Uppdatera dokument regelbundet när de revideras',
          ],
          relatedFeatures: ['Kunskapsbas', 'AI-agent', 'Dokumenthantering'],
          faq: [
            { question: 'Vilka format stöds?', answer: 'PDF är rekommenderat. Word-dokument (.docx) stöds också.' },
            { question: 'Hur lång tid tar det innan dokumentet är sökbart?', answer: 'Vanligtvis 5-10 minuter för processning, beroende på dokumentets storlek.' },
          ],
        },
      },
    ],
    features: [
      { title: 'AI-agent med källhänvisningar', description: 'Ställ frågor och få svar med exakta hänvisningar till förordningar och artiklar.' },
      { title: 'Regelverksarkiv', description: 'Över 450 sökbara dokument från EUR-Lex - AIFMD, SFDR, MiFID II m.fl.' },
      { title: 'Automatisk uppdatering', description: 'Arkivet synkroniseras automatiskt varje vecka med EUR-Lex.' },
      { title: 'Egen kunskapsbas', description: 'Ladda upp egna compliance-dokument som AI:n kan använda.' },
      { title: 'Ärliga svar', description: 'AI:n erkänner när den inte kan svara istället för att gissa.' },
      { title: 'Kategorisering', description: 'Filtrera på regelverk: AIFMD, SFDR, MiFID II, UCITS, KYC/AML.' },
    ],
    tips: [
      'Var specifik i dina frågor till AI-agenten för bästa resultat',
      'Klicka alltid på källhänvisningarna för att läsa originaltexten',
      'Använd regelverksarkivet för att verifiera och fördjupa dig',
      'Ladda upp egna policies så att AI:n kan referera till dem',
    ],
    link: '/compliance',
  },
  {
    id: 'settings',
    title: 'Inställningar',
    icon: 'Settings',
    description: 'Konfigurera ditt konto, integrationer och systeminställningar.',
    introduction: 'I inställningarna kan du hantera din profil, säkerhetsinställningar, teammedlemmar och integrationer med externa system som Fortnox.',
    keyBenefits: [
      'Personliga profilinställningar',
      'Säkerhet och tvåfaktorsautentisering',
      'Teamhantering och roller',
      'Fortnox-integration',
    ],
    hasVideo: false,
    steps: [
      {
        id: 'manage-profile',
        title: 'Hantera profil',
        shortDescription: 'Uppdatera dina personliga uppgifter och säkerhet',
        detailedContent: {
          overview: 'Håll din profil uppdaterad med korrekta kontaktuppgifter och säkerhetsinställningar.',
          howItWorks: [
            'Gå till Inställningar',
            'Klicka på Profil',
            'Uppdatera namn och kontaktuppgifter',
            'Ändra lösenord vid behov',
            'Aktivera tvåfaktorsautentisering för extra säkerhet',
          ],
          useCases: [
            'Uppdatera telefonnummer',
            'Ändra e-postadress',
            'Aktivera extra säkerhet',
          ],
          commonMistakes: [
            'Glömmer aktivera tvåfaktorsautentisering',
            'Använder svagt lösenord',
          ],
          proTips: [
            'Aktivera alltid tvåfaktorsautentisering',
            'Använd en lösenordshanterare',
            'Håll kontaktuppgifter aktuella',
          ],
          relatedFeatures: ['Säkerhet', '2FA', 'Lösenord'],
          faq: [
            { question: 'Är tvåfaktorsautentisering obligatoriskt?', answer: 'Det är starkt rekommenderat och kan vara obligatoriskt beroende på företagets policy.' },
          ],
        },
      },
      {
        id: 'connect-fortnox',
        title: 'Anslut Fortnox',
        shortDescription: 'Koppla ditt Fortnox-konto för automatisk export',
        detailedContent: {
          overview: 'Anslut ditt Fortnox-konto för att automatiskt exportera godkända verifikationer från AIFM.',
          howItWorks: [
            'Gå till Inställningar > Integrationer',
            'Klicka på "Anslut Fortnox"',
            'Logga in med dina Fortnox-uppgifter',
            'Godkänn åtkomst för AIFM',
            'Anslutningen bekräftas och är klar att använda',
          ],
          useCases: [
            'Automatisera bokföringsexport',
            'Undvika dubbelarbete med manuell inmatning',
            'Synka leverantörer och konton',
          ],
          commonMistakes: [
            'Fel räkenskapsår aktivt i Fortnox',
            'Glömmer godkänna åtkomst',
          ],
          proTips: [
            'Testa med en verifikation först innan batch-export',
            'Kontrollera att rätt räkenskapsår är aktivt i Fortnox',
            'Granska alltid exporterade verifikationer i Fortnox',
          ],
          relatedFeatures: ['Bokföring', 'Export', 'Integrationer'],
          faq: [
            { question: 'Kan jag koppla flera Fortnox-konton?', answer: 'Ja, du kan koppla olika Fortnox-konton till olika fonder/bolag i AIFM.' },
            { question: 'Vad exporteras till Fortnox?', answer: 'Godkända leverantörsfakturor skapas automatiskt med kontering, momsbelopp och verifikat.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Profil', description: 'Hantera dina personliga uppgifter och kontaktinfo.' },
      { title: 'Säkerhet', description: 'Lösenord och tvåfaktorsautentisering.' },
      { title: 'Team', description: 'Hantera teammedlemmar och deras roller.' },
      { title: 'Fortnox-integration', description: 'Anslut ditt Fortnox-konto för automatisk export.' },
    ],
    tips: [
      'Aktivera tvåfaktorsautentisering för extra säkerhet',
      'Anslut Fortnox för att automatisera bokföringsexport',
      'Granska teammedlemmars rättigheter regelbundet',
    ],
    link: '/settings',
  },
];

// Helper function to get section by ID
export function getGuideSection(id: string): GuideSection | undefined {
  return guideSections.find(s => s.id === id);
}

// Get all section IDs for navigation
export function getAllGuideSectionIds(): string[] {
  return guideSections.map(s => s.id);
}
