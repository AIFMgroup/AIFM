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
    introduction: 'AIFM (Alternative Investment Fund Manager) är en modern plattform designad specifikt för fondförvaltare, family offices och investeringsbolag. Plattformen kombinerar kraftfull automatisering med intuitiv design för att effektivisera alla aspekter av fondadministration - från investerarhantering och kapitalanrop till bokföring och compliance.',
    keyBenefits: [
      'Spara 70% av tiden på rutinuppgifter genom AI-automatisering',
      'Eliminera manuella fel med automatiska kontroller',
      '4-ögon princip säkerställer intern kontroll',
      'Full spårbarhet för revision och compliance',
      'Real-tids översikt över alla fonder och nyckeltal',
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
            'Arbeta med specifik fond för kapitalanrop eller utdelningar',
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
            'Aktiv sida markeras med gul markering',
            'På mobil: Klicka på hamburgermenyn för att öppna/stänga',
            'Undermenyerna förblir öppna tills du aktivt stänger dem',
          ],
          useCases: [
            'Snabb navigering mellan kapitalanrop och utdelningar',
            'Åtkomst till bokföringsfunktioner',
            'Öppna inställningar och användarguide',
          ],
          commonMistakes: [
            'Missar undermenyer genom att inte expandera kategorier',
            'Söker efter funktioner som finns under annan kategori',
          ],
          proTips: [
            'Lär dig tangentbordsgenvägar för snabbare navigering',
            'Kategorin "Kapital" innehåller allt relaterat till pengar',
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
      { title: 'AI-automatisering', description: 'Automatisk klassificering av dokument, konteringsförslag och matchning av betalningar.' },
      { title: '4-ögon princip', description: 'Alla finansiella transaktioner kräver godkännande från två personer.' },
      { title: 'Full spårbarhet', description: 'Komplett audit trail - vem gjorde vad och när.' },
      { title: 'Säker delning', description: 'Krypterade datarum med granulär åtkomstkontroll.' },
      { title: 'Compliance Agent', description: 'AI-driven hjälp för regulatoriska frågor.' },
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
    id: 'capital-calls',
    title: 'Kapitalanrop',
    icon: 'DollarSign',
    description: 'Skapa och hantera kapitalanrop. Systemet beräknar automatiskt varje investerares andel.',
    introduction: 'Kapitalanrop är processen där fonden begär in utlovat kapital från investerare. AIFM automatiserar hela flödet - från beräkning av varje investerares andel baserat på commitment, till utskick av anrop och spårning av betalningar.',
    keyBenefits: [
      'Automatisk beräkning av varje investerares andel',
      'Real-tids spårning av betalningsstatus',
      'Automatiska påminnelser vid försenade betalningar',
      'Bank-integration för automatisk matchning',
      'Komplett historik och rapportering',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'create-call',
        title: 'Skapa kapitalanrop',
        shortDescription: 'Klicka på "Nytt kapitalanrop" för att starta processen',
        detailedContent: {
          overview: 'Att skapa ett kapitalanrop i AIFM är en guidad process där du anger totalbelopp och syfte. Systemet beräknar automatiskt varje investerares andel baserat på deras commitment.',
          howItWorks: [
            'Klicka på "Nytt kapitalanrop"-knappen',
            'En modal öppnas med formulär för kapitalanropet',
            'Ange totalbeloppet som ska kallas in',
            'Välj typ: Investering, Förvaltningsavgift, eller Övrigt',
            'Ange syftet/beskrivningen (t.ex. "Serie A i TechStart AB")',
            'Välj förfallodatum (standard: 30 dagar)',
            'Granska den automatiska fördelningen per investerare',
            'Bekräfta för att skapa kapitalanropet som utkast',
          ],
          useCases: [
            'Ny investering i portföljbolag',
            'Kvartalsvis förvaltningsavgift',
            'Uppföljningsinvestering',
            'Täcka oväntade kostnader',
          ],
          commonMistakes: [
            'Glömmer att kontrollera att rätt fond är vald',
            'Sätter för kort förfallodatum',
            'Anger otydlig beskrivning som förvirrar investerare',
            'Skickar innan alla detaljer är korrekta',
          ],
          proTips: [
            'Använd beskrivande text som gör det tydligt för investerare vad pengarna ska användas till',
            'Planera kapitalanrop i förväg och skapa som utkast innan du skickar',
            'Kontrollera alltid den beräknade fördelningen före utskick',
            'Koordinera med treasury för att säkerställa att rätt bankkonto används',
          ],
          relatedFeatures: ['Investerare', 'Treasury', 'Godkännanden'],
          faq: [
            { question: 'Hur beräknas varje investerares andel?', answer: 'Andelen beräknas baserat på investerarens commitment i förhållande till fondens totala commitment. Om en investerare har 20% av totala commitments, kallas 20% av beloppet från den investeraren.' },
            { question: 'Kan jag ändra ett kapitalanrop efter att det skickats?', answer: 'Nej, skickade kapitalanrop kan inte ändras. Du kan dock skapa kompletterande anrop eller kreditera vid behov.' },
            { question: 'Vad händer om en investerare inte kan betala i tid?', answer: 'Systemet skickar automatiska påminnelser. Du kan även manuellt skicka påminnelser och i värsta fall flagga investeraren för uppföljning.' },
          ],
        },
      },
      {
        id: 'specify-amount',
        title: 'Ange belopp och syfte',
        shortDescription: 'Fyll i totalbelopp och syfte med investeringen',
        detailedContent: {
          overview: 'Korrekt angivelse av belopp och syfte är kritiskt för ett professionellt kapitalanrop. Beloppet bestämmer hur mycket som kallas in, och syftet kommuniceras till investerarna.',
          howItWorks: [
            'Ange totalbeloppet i fondens basvaluta',
            'Systemet visar direkt hur mycket som återstår av totala commitments',
            'Välj typ av anrop från dropdown-menyn',
            'Skriv en tydlig beskrivning av syftet',
            'Systemet validerar att beloppet inte överskrider tillgängliga commitments',
          ],
          useCases: [
            'Investering: "Serie A i CloudTech AB - 25 MSEK"',
            'Avgift: "Kvartalsvis förvaltningsavgift Q4 2024"',
            'Övrigt: "Juridiska kostnader för strukturering"',
          ],
          commonMistakes: [
            'Anropar mer än återstående commitment',
            'Vag eller otydlig beskrivning',
            'Fel valuta angivet',
          ],
          proTips: [
            'Var specifik i beskrivningen - det bygger förtroende hos investerare',
            'Inkludera relevanta detaljer som bolagsnamn vid investeringar',
            'Använd standardiserade format för regelbundna anrop som förvaltningsavgifter',
          ],
          relatedFeatures: ['Commitments', 'Investerare'],
          faq: [
            { question: 'Kan jag ange belopp i annan valuta?', answer: 'Kapitalanrop skapas alltid i fondens basvaluta. Omräkning sker automatiskt vid behov.' },
            { question: 'Vad är maxbelopp för ett anrop?', answer: 'Maxbeloppet är summan av alla investerares återstående commitment. Systemet varnar om du försöker överskrida detta.' },
          ],
        },
      },
      {
        id: 'review-distribution',
        title: 'Granska fördelning',
        shortDescription: 'Se hur beloppet fördelas per investerare',
        detailedContent: {
          overview: 'Innan du skickar kapitalanropet visar systemet exakt hur beloppet fördelas per investerare. Detta ger dig möjlighet att verifiera att allt stämmer.',
          howItWorks: [
            'Tabellen visar varje investerare med deras commitment',
            'Beräknad andel visas automatiskt',
            'Beloppet för varje investerare listas',
            'Återstående commitment efter anropet visas',
            'Totalsumma valideras mot angivet belopp',
          ],
          useCases: [
            'Verifiera att fördelningen är korrekt',
            'Identifiera investerare med lite återstående commitment',
            'Planera för framtida anrop',
          ],
          commonMistakes: [
            'Hoppar över granskningen',
            'Missar att investerare har begränsad återstående commitment',
          ],
          proTips: [
            'Ta tid att granska - det är din sista chans före utskick',
            'Kontrollera särskilt stora belopp',
            'Notera investerare med låg återstående commitment för framtida planering',
          ],
          relatedFeatures: ['Investerare', 'Commitments'],
          faq: [
            { question: 'Kan jag justera fördelningen manuellt?', answer: 'Nej, fördelningen beräknas automatiskt baserat på commitment. Detta säkerställer rättvisa och överensstämmelse med fonddokumenten.' },
            { question: 'Vad händer om en investerare inte har tillräcklig commitment?', answer: 'Investeraren kallas på hela sin återstående commitment och överskjutande belopp fördelas på övriga investerare.' },
          ],
        },
      },
      {
        id: 'send-call',
        title: 'Skicka kapitalanrop',
        shortDescription: 'Investerare notifieras automatiskt via e-post',
        detailedContent: {
          overview: 'När du skickar kapitalanropet notifieras alla berörda investerare automatiskt via e-post. De får detaljerad information om beloppet och instruktioner för betalning.',
          howItWorks: [
            'Klicka på "Skicka" för att bekräfta utskicket',
            'Systemet genererar individuella kapitalanrop-dokument',
            'E-post skickas till varje investerares registrerade adress',
            'Dokumentet innehåller belopp, syfte, bankuppgifter och förfallodatum',
            'Status ändras till "Skickad"',
            'Investerare kan se anropet i sin portal (om aktiv)',
          ],
          useCases: [
            'Officiellt skicka kapitalanrop till investerare',
            'Starta betalningsprocessen',
          ],
          commonMistakes: [
            'Skickar utan att dubbelkolla detaljer',
            'Skickar vid fel tidpunkt (t.ex. fredag kväll)',
          ],
          proTips: [
            'Skicka tidigt på veckan för att ge investerare tid',
            'Ge minst 20 bankdagar för betalning',
            'Var tillgänglig för frågor efter utskick',
            'Kontrollera att alla investerare har korrekta e-postadresser',
          ],
          relatedFeatures: ['E-postnotifikationer', 'Investerarportal', 'Treasury'],
          faq: [
            { question: 'Kan jag återkalla ett skickat anrop?', answer: 'Tekniskt kan du inte "ångra" ett skickat e-post, men du kan markera anropet som annullerat och kommunicera detta till investerarna.' },
            { question: 'Får alla investerare samma e-post?', answer: 'E-posten är personaliserad med varje investerares specifika belopp, men innehållet är i övrigt identiskt.' },
            { question: 'Vad händer om e-posten studsar?', answer: 'Du får en notifikation om misslyckade leveranser och kan uppdatera e-postadressen och skicka igen.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Automatisk beräkning', description: 'Varje investerares andel beräknas automatiskt baserat på commitment.' },
      { title: 'Status-spårning', description: 'Real-tids spårning: Skickat, Delvis betalt, Betalt, Förfallen.' },
      { title: 'Automatiska påminnelser', description: 'Systemet skickar påminnelser vid försenade betalningar.' },
      { title: 'Bank-matchning', description: 'Inkommande betalningar matchas automatiskt mot kapitalanrop.' },
    ],
    tips: [
      'Använd tabs för att växla mellan Aktiva, Historik och Statistik',
      'Grafer ger visuell översikt av betalningsstatus',
      'Skicka påminnelser till investerare som inte betalat i tid',
      'Exportera till Excel för rapportering',
    ],
    link: '/capital-calls',
  },
  {
    id: 'distributions',
    title: 'Utdelningar',
    icon: 'ArrowLeftRight',
    description: 'Distribuera avkastning till investerare med 4-ögon godkännande.',
    introduction: 'Utdelningar är processen där fonden distribuerar avkastning tillbaka till investerare. Detta kan vara kapitalåterbäring, utdelning av vinst, eller exit-intäkter. AIFM säkerställer att alla utdelningar följer 4-ögon principen för intern kontroll.',
    keyBenefits: [
      '4-ögon princip för säker hantering',
      'Automatisk fördelning baserat på ägarandelar',
      'Komplett audit trail',
      'Stöd för olika utdelningstyper',
      'Integration med bokföring',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'create-distribution',
        title: 'Skapa utdelning',
        shortDescription: 'Klicka på "Ny utdelning" för att starta',
        detailedContent: {
          overview: 'Att skapa en utdelning initierar en kontrollerad process där två personer måste godkänna innan medel kan distribueras till investerare.',
          howItWorks: [
            'Klicka på "Ny utdelning"-knappen',
            'Välj typ av utdelning',
            'Ange totalbelopp att distribuera',
            'Lägg till beskrivning och ursprung (t.ex. "Exit TechStart AB")',
            'Granska automatisk fördelning per investerare',
            'Skicka för godkännande',
          ],
          useCases: [
            'Exit-intäkter från försäljning av portföljbolag',
            'Utdelning från portföljbolag',
            'Återbetalning av outnyttjat kapital',
            'Vinstdelning enligt fondavtal',
          ],
          commonMistakes: [
            'Väljer fel utdelningstyp',
            'Glömmer att ange ursprung',
            'Distribuerar mer än tillgängligt kapital',
          ],
          proTips: [
            'Dokumentera alltid ursprunget tydligt för revision',
            'Koordinera med bokföring innan utdelning',
            'Planera utdelningstidpunkt med hänsyn till investerarnas skatteår',
          ],
          relatedFeatures: ['Godkännanden', 'Treasury', 'Bokföring'],
          faq: [
            { question: 'Vad är skillnaden mellan utdelningstyper?', answer: 'Kapitalåterbäring är återbetalning av investerat kapital (inte skattepliktig för investerare tills kapitalet är återbetalt). Vinstdelning är avkastning utöver investerat kapital.' },
            { question: 'Kan jag göra partiella utdelningar?', answer: 'Ja, du kan distribuera valfritt belopp upp till tillgängligt kapital.' },
          ],
        },
      },
      {
        id: 'select-type',
        title: 'Välj utdelningstyp',
        shortDescription: 'Kapitalåterbäring, utdelning eller vinstdelning',
        detailedContent: {
          overview: 'Utdelningstypen påverkar hur transaktionen bokförs och rapporteras till investerare. Korrekt klassificering är viktig för skattemässig hantering.',
          howItWorks: [
            'Välj typ från dropdown-menyn',
            'Kapitalåterbäring: Återbetalning av investerat kapital',
            'Utdelning: Löpande avkastning från portföljbolag',
            'Vinstdelning: Realiserad vinst från exits',
          ],
          useCases: [
            'Kapitalåterbäring: Partiell exit där en del av investeringen säljs',
            'Utdelning: Portföljbolag delar ut vinst',
            'Vinstdelning: Full exit med vinst',
          ],
          commonMistakes: [
            'Klassificerar vinst som kapitalåterbäring',
            'Blandar typer i samma utdelning',
          ],
          proTips: [
            'Konsultera revisor vid osäkerhet om klassificering',
            'Kapitalåterbäring ska alltid matchas mot ursprunglig investering',
            'Dokumentera beräkningsgrunden för vinstdelning',
          ],
          relatedFeatures: ['Bokföring', 'Rapporter'],
          faq: [
            { question: 'Påverkar typen beskattningen?', answer: 'Ja, kapitalåterbäring är skattefri tills investeraren fått tillbaka sitt investerade kapital. Utdelning och vinst beskattas som kapitalinkomst.' },
          ],
        },
      },
      {
        id: 'first-approval',
        title: 'Första godkännande',
        shortDescription: 'Du skapar, annan person granskar',
        detailedContent: {
          overview: 'Den som skapar utdelningen kan inte själv godkänna den. En annan behörig person måste granska och godkänna som första steg i 4-ögon principen.',
          howItWorks: [
            'Efter att du skapat utdelningen skickas den för godkännande',
            'En notifikation går till användare med godkännanderätt',
            'Granskaren ser alla detaljer: belopp, typ, fördelning',
            'Granskaren kan godkänna eller avslå med kommentar',
            'Vid godkännande går ärendet vidare till andra godkännandet',
          ],
          useCases: [
            'Säkerställa att rätt belopp distribueras',
            'Verifiera att klassificering är korrekt',
            'Kontrollera att timing är lämplig',
          ],
          commonMistakes: [
            'Godkänner utan att granska noggrant',
            'Avslår utan tydlig motivering',
          ],
          proTips: [
            'Ta alltid tid att granska detaljer noggrant',
            'Kontrollera originalunderlaget vid stora belopp',
            'Kommunicera direkt med skaparen vid frågor',
          ],
          relatedFeatures: ['Godkännanden', 'Notifikationer'],
          faq: [
            { question: 'Kan skaparen och granskaren vara samma person?', answer: 'Nej, systemet förhindrar detta. Det är kärnan i 4-ögon principen.' },
            { question: 'Vad händer vid avslag?', answer: 'Utdelningen returneras till skaparen med granskarens kommentar. Skaparen kan korrigera och skicka igen.' },
          ],
        },
      },
      {
        id: 'second-approval',
        title: 'Andra godkännande',
        shortDescription: 'Ytterligare en person bekräftar',
        detailedContent: {
          overview: 'Efter första godkännandet krävs ett andra godkännande från en tredje person. Detta säkerställer att minst tre ögon har sett transaktionen.',
          howItWorks: [
            'Efter första godkännandet notifieras nästa godkännare',
            'Den andra granskaren ser både originaldata och första granskarens godkännande',
            'Samma granskningsprocess - godkänn eller avslå',
            'Vid godkännande blir utdelningen verkställbar',
            'Medel kan nu distribueras till investerare',
          ],
          useCases: [
            'Extra kontroll vid stora belopp',
            'Säkerställa compliance med fonddokument',
            'Verifiera att alla formalia är på plats',
          ],
          commonMistakes: [
            'Antar att första godkännandet räcker',
            'Rusar igenom andra granskningen',
          ],
          proTips: [
            'Andra godkännandet bör göras av någon med helhetsperspektiv',
            'Kontrollera att utdelningen är i linje med fondstrategi',
            'Verifiera likviditet innan godkännande',
          ],
          relatedFeatures: ['Godkännanden', 'Treasury'],
          faq: [
            { question: 'Kan första och andra godkännaren vara samma person?', answer: 'Nej, alla tre (skapare + två godkännare) måste vara olika personer.' },
            { question: 'Vad händer efter andra godkännandet?', answer: 'Utdelningen blir verkställbar. Beroende på inställningar kan utbetalning ske automatiskt eller manuellt.' },
          ],
        },
      },
    ],
    features: [
      { title: '4-ögon princip', description: 'Alla utdelningar kräver godkännande från två personer utöver skaparen.' },
      { title: 'Automatisk fördelning', description: 'Systemet beräknar varje investerares andel baserat på ägarandel.' },
      { title: 'Audit trail', description: 'Komplett logg över vem som gjorde vad och när.' },
      { title: 'Typkategorisering', description: 'Stöd för kapitalåterbäring, utdelning och vinstdelning.' },
    ],
    tips: [
      'Använd tabs för att växla mellan Kommande och Genomförda utdelningar',
      'Avslå alltid med tydlig motivering',
      'Alla godkännanden loggas permanent för revision',
      'Koordinera timing med treasury för likviditet',
    ],
    link: '/distributions',
  },
  {
    id: 'investors',
    title: 'Investerare',
    icon: 'Users',
    description: 'Hantera investerare, åtaganden, KYC-status och kommunikation.',
    introduction: 'Investerarmodulen är centrum för all LP-hantering. Här har du fullständig överblick över alla investerare, deras commitments, betalningshistorik, KYC-status och dokument.',
    keyBenefits: [
      'Central överblick över alla investerare',
      'Automatisk KYC-statusövervakning',
      'Commitment-spårning med inbetalningsgrad',
      'Integrerad dokumenthantering',
      'Riskindikatorer och flaggor',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'view-list',
        title: 'Se investerarlista',
        shortDescription: 'Alla investerare med commitment och status',
        detailedContent: {
          overview: 'Investerarlistan ger dig en komplett överblick över alla LPs i fonden. Varje rad visar nyckelinformation som commitment, inbetalt belopp och KYC-status.',
          howItWorks: [
            'Navigera till Investerare i sidomenyn',
            'Listan visar alla investerare i vald fond',
            'Varje rad visar: Namn, Typ, Commitment, Inbetalt, KYC-status',
            'Färgkodning indikerar status (grön = OK, gul = uppmärksamhet, röd = problem)',
            'Klicka på en rad för att se detaljpanel till höger',
          ],
          useCases: [
            'Snabb överblick över fondens LP-bas',
            'Identifiera investerare som behöver uppmärksamhet',
            'Planera kommunikation',
          ],
          commonMistakes: [
            'Ignorerar varningsflaggor',
            'Missar att uppdatera kontaktuppgifter',
          ],
          proTips: [
            'Sortera på KYC-status för att snabbt hitta problem',
            'Granska regelbundet investerare med gul flagg',
            'Håll e-postadresser uppdaterade för kommunikation',
          ],
          relatedFeatures: ['KYC', 'Commitments', 'Dokument'],
          faq: [
            { question: 'Kan jag exportera investerarlistan?', answer: 'Ja, använd Exportera-knappen för att ladda ner som Excel eller PDF.' },
            { question: 'Hur lägger jag till en ny investerare?', answer: 'Klicka på "Lägg till investerare" och följ onboarding-guiden.' },
          ],
        },
      },
      {
        id: 'select-investor',
        title: 'Välj investerare',
        shortDescription: 'Klicka för att se detaljer i högerkolumnen',
        detailedContent: {
          overview: 'När du klickar på en investerare visas en detaljerad profil i högerkolumnen. Här ser du all information samlad på ett ställe.',
          howItWorks: [
            'Klicka på investeraren i listan',
            'Detaljpanelen öppnas till höger',
            'Panelen visar: Kontaktinfo, Commitment-detaljer, Transaktionshistorik, Dokument',
            'Tabs låter dig navigera mellan olika informationssektioner',
          ],
          useCases: [
            'Förbereda för möte med investerare',
            'Besvara investerarfrågor',
            'Granska betalningshistorik',
          ],
          commonMistakes: [
            'Missar viktiga flaggor i detaljvyn',
            'Glömmer att uppdatera information efter kommunikation',
          ],
          proTips: [
            'Använd anteckningsfältet för att dokumentera viktiga samtal',
            'Granska dokument-tab för att säkerställa att allt är komplett',
            'Kontrollera transaktionshistorik vid frågor om betalningar',
          ],
          relatedFeatures: ['Kontakthantering', 'Dokument', 'Historik'],
          faq: [
            { question: 'Kan jag redigera investerarinformation?', answer: 'Ja, klicka på redigera-ikonen i detaljpanelen för att uppdatera information.' },
          ],
        },
      },
      {
        id: 'filter-search',
        title: 'Filtrera och sök',
        shortDescription: 'Sök eller filtrera på status/typ',
        detailedContent: {
          overview: 'Filtrera och sök för att snabbt hitta specifika investerare eller grupper av investerare.',
          howItWorks: [
            'Använd sökfältet för att söka på namn eller organisation',
            'Filterknapparna låter dig filtrera på status',
            'Kombinera flera filter för att begränsa listan',
            'Filtren sparas under sessionen',
          ],
          useCases: [
            'Hitta specifik investerare snabbt',
            'Visa endast investerare som behöver KYC-uppdatering',
            'Filtrera på investerartyp (institutioner, family offices, etc.)',
          ],
          commonMistakes: [
            'Glömmer att rensa filter och undrar var investerare försvunnit',
          ],
          proTips: [
            'Sök på organisationsnummer för exakt träff',
            'Använd "Behöver uppmärksamhet"-filter för att prioritera',
            'Filtrera på typ för att segmentera kommunikation',
          ],
          relatedFeatures: ['Sök', 'Export'],
          faq: [
            { question: 'Kan jag spara filterinställningar?', answer: 'Filter sparas under sessionen. Du kan använda URL-bokmärken för permanenta filter.' },
          ],
        },
      },
      {
        id: 'review-kyc',
        title: 'Granska KYC',
        shortDescription: 'Se KYC-status och eventuella flaggor',
        detailedContent: {
          overview: 'KYC (Know Your Customer) är kritiskt för compliance. AIFM visar tydligt varje investerares KYC-status och flaggar eventuella problem.',
          howItWorks: [
            'KYC-status visas som ikon i investerarlistan',
            'Grön bock = Godkänd och aktuell',
            'Gul varning = Behöver uppmärksamhet (närmar sig utgång)',
            'Röd flagg = Problem (utgången eller underkänd)',
            'Klicka på investerare för att se detaljer',
            'KYC-tab visar alla KYC-dokument och status',
          ],
          useCases: [
            'Daglig översyn av KYC-status',
            'Planera för förnyelse av utgående KYC',
            'Identifiera investerare med hög risk',
          ],
          commonMistakes: [
            'Ignorerar varningar om utgående KYC',
            'Missar PEP-flaggor',
            'Gör inte regelbundna genomgångar',
          ],
          proTips: [
            'Sätt kalenderpåminnelser för KYC som närmar sig utgång',
            'Granska PEP-status kvartalsvis',
            'Dokumentera alla KYC-granskningar',
          ],
          relatedFeatures: ['Compliance', 'Dokument', 'Riskhantering'],
          faq: [
            { question: 'Hur ofta ska KYC uppdateras?', answer: 'Enligt AIFMD ska KYC uppdateras minst årligen, eller oftare vid förändringar.' },
            { question: 'Vad är PEP?', answer: 'PEP (Politically Exposed Person) är en person med framträdande offentlig funktion. Dessa kräver förstärkt due diligence.' },
            { question: 'Kan jag automatisera KYC-påminnelser?', answer: 'Ja, systemet skickar automatiska påminnelser när KYC närmar sig utgång.' },
          ],
        },
      },
    ],
    features: [
      { title: 'KYC-övervakning', description: 'Automatisk spårning av KYC-status med varningar.' },
      { title: 'Commitment-spårning', description: 'Fullständig överblick över commitment och inbetalningar.' },
      { title: 'Riskbedömning', description: 'Automatisk riskklassificering och PEP-kontroll.' },
      { title: 'Dokumenthantering', description: 'Alla investerardokument samlade på ett ställe.' },
    ],
    tips: [
      'Röda flaggor kräver omedelbar uppmärksamhet',
      'Filtrera på "Behöver uppmärksamhet" för att se problem',
      'Exportera investerarlista för LP-rapporter',
      'Håll kontaktuppgifter uppdaterade',
    ],
    link: '/investors',
  },
  {
    id: 'nav-calculation',
    title: 'NAV-beräkning',
    icon: 'Calculator',
    description: 'Beräkna och visualisera fondens nettotillgångsvärde med interaktiv kalkylator.',
    introduction: 'NAV-beräkningsmodulen ger dig fullständig kontroll över fondens nettotillgångsvärde (Net Asset Value). Med interaktiv kalkylator, waterfall-visualisering och per-investerare breakdown kan du enkelt se hur NAV beräknas och fördelas.',
    keyBenefits: [
      'Real-tids NAV-beräkning baserat på tillgångar och skulder',
      'Visuell waterfall-graf som visar beräkningsstegen',
      'Historisk NAV-utveckling över tid',
      'Per-investerare NAV-breakdown med TVPI',
      'Interaktiv kalkylator för what-if analyser',
    ],
    hasVideo: false,
    steps: [
      {
        id: 'view-nav',
        title: 'Se aktuellt NAV',
        shortDescription: 'Överblick av fondens nettotillgångsvärde',
        detailedContent: {
          overview: 'NAV-översikten visar fondens aktuella nettotillgångsvärde tillsammans med förändring sedan förra perioden och nyckeltal som tillgångar och skulder.',
          howItWorks: [
            'Navigera till Fond > NAV-beräkning i sidomenyn',
            'Hero-sektionen visar aktuellt NAV med trend',
            'Totala tillgångar och skulder visas som separata kort',
            'Antal investerare och deras totala ägarandel visas',
            'Välj flik för att se olika vyer: Översikt, Kalkylator, Investerare',
          ],
          useCases: [
            'Kvartalsrapportering till investerare',
            'Intern uppföljning av fondvärdering',
            'Due diligence och revision',
          ],
          commonMistakes: [
            'Glömmer att uppdatera portföljvärderingar innan NAV-beräkning',
            'Missar att inkludera upplupna avgifter',
            'Använder föråldrade valuteringar',
          ],
          proTips: [
            'Kör NAV-beräkning i slutet av varje månad för konsekvent historik',
            'Använd kalkylatorn för att simulera olika värderingsscenarier',
            'Exportera rapporten för dokumentation',
          ],
          relatedFeatures: ['Portfölj', 'Treasury', 'Rapporter'],
          faq: [
            { question: 'Hur ofta uppdateras NAV automatiskt?', answer: 'NAV beräknas baserat på de senaste inmatade värdena. Uppdatera portföljvärderingar manuellt för att se aktuellt NAV.' },
            { question: 'Kan jag exportera NAV-rapporten?', answer: 'Ja, använd Exportera-knappen för att ladda ner som PDF eller Excel.' },
          ],
        },
      },
      {
        id: 'waterfall-view',
        title: 'Waterfall-visualisering',
        shortDescription: 'Se hur tillgångar minus skulder blir NAV',
        detailedContent: {
          overview: 'Waterfall-diagrammet visualiserar steg-för-steg hur fondens NAV beräknas, från bruttotillgångar till nettotillgångsvärde.',
          howItWorks: [
            'Klicka på fliken Översikt',
            'Waterfall-diagrammet visas till vänster',
            'Gröna staplar representerar tillgångar',
            'Röda staplar representerar skulder (avdrag)',
            'Slutresultatet visar beräknat NAV',
            'Hover över staplar för att se exakta belopp',
          ],
          useCases: [
            'Förklara NAV-beräkning för investerare',
            'Identifiera stora poster som påverkar NAV',
            'Presentationer för styrelsen',
          ],
          commonMistakes: [
            'Fokuserar bara på totalen utan att förstå komponenterna',
            'Ignorerar carried interest-reservens påverkan',
          ],
          proTips: [
            'Använd waterfall-vyn när du förklarar NAV för nya investerare',
            'Jämför med tidigare perioder för att se trender',
            'Notera förändringar i förvaltningsavgift och carried interest',
          ],
          relatedFeatures: ['Rapporter', 'Bokföring', 'Historik'],
          faq: [
            { question: 'Vad ingår i portföljvärdering?', answer: 'Portföljvärderingen inkluderar fair value på alla aktiva investeringar baserat på senaste värdering.' },
            { question: 'Hur beräknas carried interest-reserv?', answer: 'Carried interest beräknas baserat på överavkastning enligt fondavtalet, vanligtvis 20% av vinst över en hurdle rate.' },
          ],
        },
      },
      {
        id: 'interactive-calculator',
        title: 'Interaktiv kalkylator',
        shortDescription: 'Simulera olika scenarier med editerbara värden',
        detailedContent: {
          overview: 'Den interaktiva kalkylatorn låter dig justera tillgångar och skulder för att se hur NAV påverkas i olika scenarier.',
          howItWorks: [
            'Klicka på fliken Kalkylator',
            'Tillgångar visas till vänster: Portföljvärdering, Kassa, Fordringar, etc.',
            'Skulder visas till höger: Leverantörsskulder, Förvaltningsavgift, etc.',
            'Ändra valfritt värde genom att skriva i fältet',
            'Klicka på "Beräkna NAV" för att se uppdaterat resultat',
            'Det beräknade NAV visas längst ner med guldfärgad highlight',
          ],
          useCases: [
            'What-if analyser för potentiella investeringar',
            'Scenario-planering för olika utfall',
            'Förstå känsligheten i NAV-beräkningen',
          ],
          commonMistakes: [
            'Glömmer att klicka Beräkna NAV efter ändringar',
            'Ändrar för många värden samtidigt och tappar bort sig',
          ],
          proTips: [
            'Ändra ett värde i taget för att förstå påverkan',
            'Notera utgångsvärdet innan du börjar justera',
            'Använd kalkylatorn för att planera framtida kapitalanrop',
          ],
          relatedFeatures: ['Kapitalanrop', 'Treasury', 'Rapporter'],
          faq: [
            { question: 'Sparas mina ändringar i kalkylatorn?', answer: 'Nej, kalkylatorn är för simulering. Ändringar påverkar inte den officiella NAV-beräkningen.' },
            { question: 'Kan jag spara ett scenario?', answer: 'För närvarande kan du exportera rapporten med dina simulerade värden.' },
          ],
        },
      },
      {
        id: 'investor-breakdown',
        title: 'Per-investerare breakdown',
        shortDescription: 'Se varje investerares NAV-andel och TVPI',
        detailedContent: {
          overview: 'Investerare-vyn visar hur fondens NAV fördelas mellan alla limited partners (LPs) baserat på deras ägarandel.',
          howItWorks: [
            'Klicka på fliken Investerare',
            'Listan visar alla investerare med deras NAV-andel',
            'Varje rad visar: Namn, Typ, NAV-andel, Ägarandel %',
            'Klicka på en investerare för att expandera och se detaljer',
            'Detaljerna visar: Commitment, Inbetalt kapital, Utdelningar, TVPI',
            'TVPI (Total Value to Paid-In) beräknas automatiskt',
          ],
          useCases: [
            'Kvartalsrapporter till individuella investerare',
            'Beräkna utdelningsbelopp per LP',
            'Analysera avkastning per investerartyp',
          ],
          commonMistakes: [
            'Blandar ihop commitment och inbetalt kapital',
            'Glömmer att inkludera tidigare utdelningar i TVPI',
          ],
          proTips: [
            'Exportera listan före varje utdelning för dokumentation',
            'Jämför TVPI mellan investerare för att se om alla behandlas lika',
            'Använd typer (Pension, Family Office, etc.) för analys',
          ],
          relatedFeatures: ['Investerare', 'Utdelningar', 'Rapporter'],
          faq: [
            { question: 'Hur beräknas TVPI?', answer: 'TVPI = (NAV-andel + Utdelningar) / Inbetalt kapital. Ett TVPI på 1.5x betyder 50% avkastning.' },
            { question: 'Varför stämmer inte summorna exakt?', answer: 'Avrundningar kan ge små differenser. Den officiella NAV-beräkningen använder exakta tal.' },
          ],
        },
      },
      {
        id: 'historical-nav',
        title: 'Historisk utveckling',
        shortDescription: 'Se NAV-trend över tid med graf',
        detailedContent: {
          overview: 'Den historiska grafen visar hur fondens NAV har utvecklats över tid, med trendanalys och jämförelsepunkter.',
          howItWorks: [
            'Gå till fliken Översikt',
            'Grafen till höger visar NAV per månad',
            'Staplar visar absolut NAV för varje period',
            'Den senaste perioden markeras med guld',
            'Under grafen visas: Startvärde, Nuvarande värde, Förändring',
            'YTD-förändring visas i procent',
          ],
          useCases: [
            'Årsrapporter och investerarpresentationer',
            'Identifiera trender och säsongsmönster',
            'Jämföra utveckling med benchmark',
          ],
          commonMistakes: [
            'Drar slutsatser från för kort tidsperiod',
            'Ignorerar engångshändelser som påverkat NAV',
          ],
          proTips: [
            'Lägg in noter för stora NAV-förändringar',
            'Jämför med marknadsindex för kontext',
            'Använd grafen i investerarkommunikation',
          ],
          relatedFeatures: ['Rapporter', 'Översikt', 'Dashboard'],
          faq: [
            { question: 'Hur långt tillbaka går historiken?', answer: 'Historiken går tillbaka till fondens start, eller så långt som data har matats in.' },
            { question: 'Kan jag exportera grafdata?', answer: 'Ja, exportera rapporten för att få all underliggande data.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Waterfall-diagram', description: 'Visuell representation av NAV-beräkningen steg för steg' },
      { title: 'Interaktiv kalkylator', description: 'What-if analyser med editerbara fält' },
      { title: 'Investerare-breakdown', description: 'NAV per LP med TVPI-beräkning' },
      { title: 'Historisk graf', description: 'Trend över tid med YTD-jämförelse' },
      { title: 'Export', description: 'Exportera rapport som PDF eller Excel' },
    ],
    tips: [
      'Kör NAV-beräkning i slutet av varje månad för konsekvent rapportering',
      'Använd kalkylatorn för att simulera effekten av nya investeringar',
      'Jämför TVPI mellan investerare för att säkerställa rättvisa',
      'Exportera alltid en rapport före utdelningar för dokumentation',
    ],
    link: '/nav-calculation',
  },
  {
    id: 'portfolio',
    title: 'Portfölj',
    icon: 'BarChart3',
    description: 'Överblick och hantering av alla portföljbolag med värdering och nyckeltal.',
    introduction: 'Portföljmodulen ger dig fullständig kontroll över alla dina investeringar. Se aktuella värderingar, sektorsfördelning och bolagsspecifika nyckeltal. AI-funktioner hjälper till att extrahera data automatiskt från uppladdade rapporter.',
    keyBenefits: [
      'Samlad överblick över alla portföljbolag',
      'Automatisk värderingsuppdatering',
      'Sektorsanalys och diversifiering',
      'AI-extraktion från kvartalsrapporter',
      'Export för LP-rapportering',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'view-portfolio',
        title: 'Se portföljöversikt',
        shortDescription: 'Granska alla bolag med aktuell värdering',
        detailedContent: {
          overview: 'Portföljöversikten visar alla dina investeringar med aktuell värdering, ägarandel och status. Använd tabs för att växla mellan olika vyer.',
          howItWorks: [
            'Navigera till Portfölj i sidomenyn',
            'Översikten visar alla portföljbolag i kort-format',
            'Varje kort visar: Bolagsnamn, Sektor, Värdering, Ägarandel',
            'Använd tabs: Bolag / Sektorer / Statistik för olika vyer',
            'Klicka på ett bolag för detaljerad information',
          ],
          useCases: [
            'Daglig överblick av portföljvärde',
            'Förberedelse inför styrelsemöte',
            'LP-rapportering och uppdateringar',
          ],
          commonMistakes: [
            'Glömmer uppdatera värderingar regelbundet',
            'Missar att ladda upp nya kvartalsrapporter',
          ],
          proTips: [
            'Använd Sektorer-tab för att se diversifiering',
            'Statistik-tab ger aggregerade nyckeltal',
            'Exportera regelbundet för dokumentation',
          ],
          relatedFeatures: ['Rapporter', 'Export', 'Värdering'],
          faq: [
            { question: 'Hur ofta uppdateras värderingar?', answer: 'Värderingar uppdateras manuellt eller automatiskt när du laddar upp nya rapporter. AI kan extrahera värden från PDF-rapporter.' },
            { question: 'Kan jag se historiska värderingar?', answer: 'Ja, klicka på ett bolag för att se värderingshistorik över tid.' },
          ],
        },
      },
      {
        id: 'add-company',
        title: 'Lägg till bolag',
        shortDescription: 'Registrera nya portföljbolag',
        detailedContent: {
          overview: 'När fonden gör en ny investering behöver du registrera portföljbolaget i systemet med grundläggande information och investeringsdetaljer.',
          howItWorks: [
            'Klicka på "Lägg till bolag"',
            'Fyll i bolagsnamn och organisationsnummer',
            'Välj sektor och land',
            'Ange investeringsbelopp och datum',
            'Ange initial värdering och ägarandel',
            'Spara för att registrera bolaget',
          ],
          useCases: [
            'Ny investering har genomförts',
            'Uppföljningsinvestering i befintligt bolag',
            'Import av historiska investeringar',
          ],
          commonMistakes: [
            'Fel ägarandel anges',
            'Glömmer ange investeringsdatum',
            'Väljer fel sektor',
          ],
          proTips: [
            'Dubbelkolla ägarandel mot aktieägaravtal',
            'Använd samma sektorindelning konsekvent',
            'Lägg till kontaktperson direkt',
          ],
          relatedFeatures: ['Investeringar', 'Dokument', 'Kontakter'],
          faq: [
            { question: 'Kan jag lägga till flera investeringar i samma bolag?', answer: 'Ja, systemet spårar varje investering separat och summerar totalt investerat belopp.' },
          ],
        },
      },
      {
        id: 'export-portfolio',
        title: 'Exportera portföljdata',
        shortDescription: 'Ladda ner rapporter i olika format',
        detailedContent: {
          overview: 'Exportfunktionen låter dig ladda ner portföljdata i olika format för rapportering, analys eller delning med investerare.',
          howItWorks: [
            'Klicka på "Exportera"-knappen',
            'Välj format: Excel, CSV eller PDF',
            'Välj vilka kolumner/data som ska inkluderas',
            'Klicka på "Ladda ner"',
            'Filen laddas ner till din dator',
          ],
          useCases: [
            'Kvartalsrapport till LPs',
            'Styrelsepresentation',
            'Extern analys i Excel',
          ],
          commonMistakes: [
            'Exporterar fel period',
            'Glömmer filtrera innan export',
          ],
          proTips: [
            'PDF är bäst för delning med investerare',
            'Excel för vidare analys',
            'Skapa standardmallar för återkommande rapporter',
          ],
          relatedFeatures: ['Rapporter', 'LP-kommunikation'],
          faq: [
            { question: 'Kan jag schemalägga automatisk export?', answer: 'Inte ännu, men detta är planerat för framtida versioner.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Värderingsöversikt', description: 'Se aktuell värdering för varje bolag och totalt portföljvärde.' },
      { title: 'Sektorsfördelning', description: 'Visualisering av hur portföljen är fördelad över sektorer.' },
      { title: 'AI-extraktion', description: 'Ladda upp rapporter och låt AI extrahera nyckeltal automatiskt.' },
      { title: 'Export', description: 'Exportera data till Excel, CSV eller PDF för rapportering.' },
    ],
    tips: [
      'Håll värderingar uppdaterade - det påverkar NAV-beräkningen',
      'Använd sektorsöversikten för att analysera diversifiering',
      'Ladda upp kvartalsrapporter för automatisk dataextraktion',
    ],
    link: '/portfolio',
  },
  {
    id: 'treasury',
    title: 'Treasury',
    icon: 'Wallet',
    description: 'Hantera likviditet, bankkonton och kassaflöde.',
    introduction: 'Treasury-modulen ger dig fullständig kontroll över fondens likviditet. Se saldo på alla bankkonton, granska transaktioner och initiera betalningar - allt med 4-ögon godkännande för säkerhet.',
    keyBenefits: [
      'Samlad överblick över alla bankkonton',
      'Real-tids saldon och transaktioner',
      'AI-matchning av inkommande betalningar',
      'Säker betalningshantering med 4-ögon princip',
      'Kassaflödesprognos',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'view-accounts',
        title: 'Se bankkonton',
        shortDescription: 'Överblick av alla konton och saldon',
        detailedContent: {
          overview: 'Treasury-sidan visar alla fondens bankkonton med aktuella saldon, senaste transaktioner och status.',
          howItWorks: [
            'Navigera till Treasury i sidomenyn',
            'Totalsaldo visas överst',
            'Varje konto visas som ett kort med saldo och bankinfo',
            'Klicka på ett konto för att se transaktioner',
            'Status visar när saldot senast uppdaterades',
          ],
          useCases: [
            'Daglig likviditetskontroll',
            'Verifiera att kapitalanrop har betalats in',
            'Planera för kommande utbetalningar',
          ],
          commonMistakes: [
            'Glömmer kontrollera att saldon är uppdaterade',
            'Missar omatchade transaktioner',
          ],
          proTips: [
            'Kontrollera "Senast synkad"-tiden för varje konto',
            'Gröna transaktioner är matchade, gula behöver granskning',
            'Använd sökning för att hitta specifika transaktioner',
          ],
          relatedFeatures: ['Kapitalanrop', 'Utdelningar', 'Betalningar'],
          faq: [
            { question: 'Hur ofta uppdateras saldon?', answer: 'Saldon synkas automatiskt flera gånger per dag, eller manuellt vid behov.' },
            { question: 'Vilka banker stöds?', answer: 'Vi stödjer de flesta nordiska banker via Open Banking-API:er.' },
          ],
        },
      },
      {
        id: 'match-payments',
        title: 'Matcha betalningar',
        shortDescription: 'AI hjälper till att matcha inkommande betalningar',
        detailedContent: {
          overview: 'När betalningar kommer in försöker AI automatiskt matcha dem mot kapitalanrop eller fakturor. Du granskar och bekräftar matchningen.',
          howItWorks: [
            'Inkommande betalningar visas med status "Ej matchad"',
            'AI föreslår matchning baserat på belopp och referens',
            'Du granskar förslaget',
            'Bekräfta om korrekt, eller korrigera manuellt',
            'Matchad betalning uppdaterar kapitalanropets status',
          ],
          useCases: [
            'Investerare betalar kapitalanrop',
            'Portföljbolag betalar utdelning',
            'Återbetalning av kostnader',
          ],
          commonMistakes: [
            'Bekräftar matchning utan att granska',
            'Missar delbetalningar',
          ],
          proTips: [
            'Granska alltid belopp och avsändare före bekräftelse',
            'Delbetalningar kan matchas manuellt',
            'Kontakta investerare vid oklara betalningar',
          ],
          relatedFeatures: ['Kapitalanrop', 'Bokföring'],
          faq: [
            { question: 'Vad händer om AI matchar fel?', answer: 'Du kan alltid korrigera matchningen manuellt. AI lär sig av dina korrigeringar.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Multi-bank', description: 'Se alla bankkonton på ett ställe.' },
      { title: 'AI-matchning', description: 'Automatisk matchning av betalningar.' },
      { title: 'Kassaflödesprognos', description: 'Se förväntade in- och utbetalningar.' },
      { title: '4-ögon betalningar', description: 'Säker betalningshantering med dubbelt godkännande.' },
    ],
    tips: [
      'Granska omatchade transaktioner dagligen',
      'Använd kassaflödesprognosen för planering',
      'Stora betalningar kräver extra godkännande',
    ],
    link: '/treasury',
  },
  {
    id: 'accounting',
    title: 'Bokföring',
    icon: 'Calculator',
    description: 'AI-driven bokföring från uppladdning till årsredovisning.',
    introduction: 'Bokföringsmodulen automatiserar hela bokföringsflödet med AI. Ladda upp fakturor och kvitton, få automatiska konteringsförslag enligt BAS-kontoplanen, stäm av perioder och generera årsredovisning.',
    keyBenefits: [
      'AI läser och klassificerar dokument automatiskt',
      'Automatiska konteringsförslag enligt BAS',
      'Momsberäkning och avstämning',
      'Export till Fortnox, Visma, SIE',
      'Komplett audit trail',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'upload-docs',
        title: 'Ladda upp dokument',
        shortDescription: 'Dra och släpp fakturor och kvitton',
        detailedContent: {
          overview: 'Det första steget i bokföringsprocessen är att ladda upp verifikationer. AI läser dokumenten och extraherar relevant information automatiskt.',
          howItWorks: [
            'Gå till Bokföring > Uppladdning',
            'Dra och släpp filer till uppladdningsytan',
            'AI analyserar dokumenten automatiskt',
            'Dokumenttyp identifieras (faktura, kvitto, etc.)',
            'Data extraheras: belopp, datum, leverantör',
            'Dokument köas för kontering',
          ],
          useCases: [
            'Leverantörsfakturor',
            'Kvitton från utlägg',
            'Kontoutdrag',
            'Kreditfakturor',
          ],
          commonMistakes: [
            'Laddar upp suddiga bilder',
            'Laddar upp samma faktura flera gånger',
            'Fel period på dokumentet',
          ],
          proTips: [
            'Bättre bildkvalitet ger bättre AI-resultat',
            'Ladda upp flera filer samtidigt för effektivitet',
            'Kontrollera att alla sidor är med vid flersidiga fakturor',
          ],
          relatedFeatures: ['AI-klassificering', 'OCR', 'Kontering'],
          faq: [
            { question: 'Vilka filformat stöds?', answer: 'PDF, JPG, PNG och Excel-filer stöds.' },
            { question: 'Hur vet jag om AI läst rätt?', answer: 'Du kan alltid granska och korrigera AI:s förslag i nästa steg.' },
          ],
        },
      },
      {
        id: 'review-booking',
        title: 'Granska kontering',
        shortDescription: 'AI föreslår kontering - du godkänner',
        detailedContent: {
          overview: 'Efter uppladdning föreslår AI kontering enligt BAS-kontoplanen. Du granskar, justerar vid behov och godkänner.',
          howItWorks: [
            'Gå till Bokföring > Kontering',
            'Se lista med väntande verifikationer',
            'Klicka på en verifikation för att se AI:s förslag',
            'Granska debet- och kreditkonton',
            'Justera vid behov genom att klicka på fälten',
            'Godkänn för att bokföra',
          ],
          useCases: [
            'Daglig bokföring av inkomna fakturor',
            'Kvartalsavstämning',
            'Korrigering av felaktiga bokningar',
          ],
          commonMistakes: [
            'Godkänner utan att granska',
            'Fel period valt',
            'Glömmer momsavdrag',
          ],
          proTips: [
            'AI lär sig av dina korrigeringar',
            'Använd snabbsök för att hitta rätt konto',
            'Dubbelkolla momskonto vid osäkerhet',
          ],
          relatedFeatures: ['BAS-kontoplan', 'Moms', 'Verifikationer'],
          faq: [
            { question: 'Kan jag ändra en bokföring efteråt?', answer: 'Ja, genom att skapa en korrigeringsverifikation. Låsta perioder kan inte ändras.' },
          ],
        },
      },
      {
        id: 'close-period',
        title: 'Stäm av period',
        shortDescription: 'Stäng månaden och verifiera balanser',
        detailedContent: {
          overview: 'Periodavstämning säkerställer att alla bokningar är korrekta innan perioden låses. En checklista guidar dig genom processen.',
          howItWorks: [
            'Gå till Bokföring > Avstämning',
            'Välj period att stämma av',
            'Gå igenom checklistan punkt för punkt',
            'Verifiera balanser mot kontoutdrag',
            'Korrigera eventuella avvikelser',
            'Lås perioden när allt stämmer',
          ],
          useCases: [
            'Månadsavslut',
            'Kvartalsrapportering',
            'Förberedelse för revision',
          ],
          commonMistakes: [
            'Låser period med kända avvikelser',
            'Glömmer stämma av alla konton',
            'Missar periodiseringar',
          ],
          proTips: [
            'Följ checklistan i ordning',
            'Dokumentera alltid avvikelser',
            'Låsta perioder går inte att ändra',
          ],
          relatedFeatures: ['Checklista', 'Balanser', 'Revision'],
          faq: [
            { question: 'Kan jag låsa upp en period?', answer: 'Nej, låsta perioder kan inte ändras. Korrigeringar görs i ny period.' },
          ],
        },
      },
      {
        id: 'annual-report',
        title: 'Årsredovisning',
        shortDescription: 'Generera årsredovisning och bokslut',
        detailedContent: {
          overview: 'När räkenskapsåret är slut hjälper systemet dig att ta fram årsredovisning med resultat- och balansräkning.',
          howItWorks: [
            'Gå till Bokföring > Årsredovisning',
            'Välj räkenskapsår',
            'Systemet genererar resultaträkning',
            'Balansräkning skapas automatiskt',
            'Granska och justera vid behov',
            'Exportera till PDF eller skicka direkt till revisor',
          ],
          useCases: [
            'Årsbokslut',
            'Delårsrapport',
            'Underlag för revision',
          ],
          commonMistakes: [
            'Alla perioder är inte avstämda',
            'Saknade periodiseringar',
          ],
          proTips: [
            'Stäm av alla perioder innan årsboksut',
            'Exportera tidigt för revisorsgranskning',
            'Spara alltid en kopia',
          ],
          relatedFeatures: ['Resultaträkning', 'Balansräkning', 'Revision'],
          faq: [
            { question: 'Kan revisorn få tillgång till systemet?', answer: 'Ja, du kan bjuda in revisorn med läsrättigheter.' },
          ],
        },
      },
    ],
    features: [
      { title: 'AI-klassificering', description: 'Dokument klassificeras automatiskt av AI.' },
      { title: 'BAS-kontering', description: 'Automatiska konteringsförslag enligt BAS.' },
      { title: 'Periodavstämning', description: 'Strukturerad process för att stänga perioder.' },
      { title: 'Export', description: 'Export till Fortnox, Visma, SIE-format.' },
    ],
    tips: [
      'Ladda upp dokument löpande för jämnare arbetsbelastning',
      'Granska alltid AI-förslag innan godkännande',
      'Stäm av månadsvis för bättre kontroll',
    ],
    link: '/accounting',
  },
  {
    id: 'data-rooms',
    title: 'Datarum',
    icon: 'FolderLock',
    description: 'Säkra, krypterade utrymmen för känsliga dokument.',
    introduction: 'Datarum ger dig möjlighet att dela känsliga dokument säkert med externa parter. Varje datarum har granulär åtkomstkontroll, tidsbegränsning och komplett aktivitetslogg.',
    keyBenefits: [
      'Krypterad lagring av känsliga dokument',
      'Granulär åtkomstkontroll per användare',
      'Tidsbegränsad åtkomst',
      'Automatisk vattenmärkning',
      'Komplett aktivitetslogg',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'create-room',
        title: 'Skapa datarum',
        shortDescription: 'Skapa ett nytt säkert datarum',
        detailedContent: {
          overview: 'Skapa ett datarum för att säkert dela dokument med investerare, due diligence-team eller andra externa parter.',
          howItWorks: [
            'Klicka på "Nytt datarum"',
            'Ange namn och beskrivning',
            'Välj typ: Due Diligence, LP-rapporter, Investor Relations, etc.',
            'Sätt utgångsdatum om tillämpligt',
            'Aktivera vattenmärkning om önskat',
            'Spara för att skapa rummet',
          ],
          useCases: [
            'Due diligence vid fondinsamling',
            'Dela kvartalsrapporter med LPs',
            'Exit-process med köpare',
          ],
          commonMistakes: [
            'För brett åtkomstbibliotek',
            'Glömmer sätta utgångsdatum',
            'Laddar upp fel dokument',
          ],
          proTips: [
            'Skapa separata rum för olika processer',
            'Sätt alltid utgångsdatum för externa användare',
            'Använd mappar för att organisera dokument',
          ],
          relatedFeatures: ['Dokument', 'Åtkomst', 'Aktivitetslogg'],
          faq: [
            { question: 'Hur säkra är datarummen?', answer: 'Alla dokument är krypterade både vid lagring och överföring. Vi använder bankstandard för säkerhet.' },
          ],
        },
      },
      {
        id: 'invite-members',
        title: 'Bjud in medlemmar',
        shortDescription: 'Ge åtkomst till rätt personer',
        detailedContent: {
          overview: 'Bjud in externa användare till datarummet med specifika rättigheter. Du kontrollerar vem som kan se, ladda ner eller redigera.',
          howItWorks: [
            'Öppna datarummet',
            'Klicka på "Bjud in"',
            'Ange e-postadress',
            'Välj rättighet: Visa, Ladda ner, eller Redigera',
            'Sätt eventuell tidsbegränsning',
            'Skicka inbjudan',
          ],
          useCases: [
            'Due diligence-team behöver tillgång',
            'LP vill granska rapporter',
            'Juridisk rådgivare behöver dokument',
          ],
          commonMistakes: [
            'Ger för breda rättigheter',
            'Glömmer återkalla åtkomst efter process',
          ],
          proTips: [
            'Använd "Endast visa" för känsliga dokument',
            'Sätt alltid tidsbegränsning för externa',
            'Granska regelbundet vem som har åtkomst',
          ],
          relatedFeatures: ['Rättigheter', 'Inbjudningar', 'Åtkomstkontroll'],
          faq: [
            { question: 'Kan jag återkalla åtkomst?', answer: 'Ja, du kan när som helst ta bort en användares åtkomst.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Granulär åtkomst', description: 'Styr exakt vem som kan se vad.' },
      { title: 'Vattenmärkning', description: 'Automatisk vattenmärkning med användarinfo.' },
      { title: 'Aktivitetslogg', description: 'Se vem som gjort vad och när.' },
      { title: 'Tidsbegränsning', description: 'Sätt utgångsdatum för åtkomst.' },
    ],
    tips: [
      'Använd "Endast visa" för extra känsliga dokument',
      'Granska aktivitetsloggen regelbundet',
      'Stäng datarum när processen är klar',
    ],
    link: '/data-rooms',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: 'Shield',
    description: 'AI-driven compliance med dokumenthantering och regulatorisk hjälp.',
    introduction: 'Compliance-modulen hjälper dig säkerställa regelefterlevnad. AI-agenten kan svara på regulatoriska frågor, och dokumenthanteringen håller ordning på alla compliance-dokument.',
    keyBenefits: [
      'AI-agent tränad på AIFMD, SFDR, MiFID II',
      'Automatisk dokumentklassificering',
      'KYC/AML-övervakning',
      'Regulatorisk rapportering',
      'Utgångsdatumspårning',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'use-ai-agent',
        title: 'Använd AI-agenten',
        shortDescription: 'Ställ frågor om regelverk och compliance',
        detailedContent: {
          overview: 'Compliance AI-agenten är tränad på relevanta regelverk och kan ge snabba svar på regulatoriska frågor.',
          howItWorks: [
            'Gå till Compliance > AI-Agent',
            'Skriv din fråga i chattfältet',
            'AI-agenten svarar med relevant information',
            'Källor och hänvisningar visas',
            'Ställ följdfrågor för fördjupning',
          ],
          useCases: [
            'Frågor om AIFMD-krav',
            'SFDR-klassificering',
            'KYC-processer',
            'Rapporteringskrav',
          ],
          commonMistakes: [
            'Förlitar sig helt på AI utan egen bedömning',
            'Ställer för vaga frågor',
          ],
          proTips: [
            'Var specifik i dina frågor',
            'Följ källhänvisningarna för detaljer',
            'AI ersätter inte juridisk rådgivning vid komplexa frågor',
          ],
          relatedFeatures: ['Compliance-dokument', 'Rapportering'],
          faq: [
            { question: 'Vilka regelverk kan AI:n?', answer: 'AI:n är tränad på AIFMD, SFDR, MiFID II, KYC/AML-regelverk och svensk fondlagstiftning.' },
          ],
        },
      },
      {
        id: 'manage-docs',
        title: 'Hantera compliance-dokument',
        shortDescription: 'Ladda upp och organisera dokument',
        detailedContent: {
          overview: 'Håll alla compliance-relaterade dokument organiserade med automatisk klassificering och utgångsdatumspårning.',
          howItWorks: [
            'Gå till Compliance > Dokument',
            'Ladda upp dokument genom att dra och släppa',
            'AI klassificerar dokumenttypen automatiskt',
            'Sätt utgångsdatum för dokument som behöver förnyas',
            'Organisera i mappar efter typ',
          ],
          useCases: [
            'KYC-dokument för investerare',
            'Policydokument',
            'Regulatoriska rapporter',
            'Avtal och tillstånd',
          ],
          commonMistakes: [
            'Glömmer uppdatera utgående dokument',
            'Dålig mappstruktur',
          ],
          proTips: [
            'Sätt påminnelser för dokument som snart utgår',
            'Använd konsekvent namngivning',
            'Granska regelbundet dokumentstatus',
          ],
          relatedFeatures: ['Dokumenthantering', 'Påminnelser', 'KYC'],
          faq: [
            { question: 'Får jag påminnelser om utgående dokument?', answer: 'Ja, systemet skickar automatiskt påminnelser när dokument närmar sig utgångsdatum.' },
          ],
        },
      },
    ],
    features: [
      { title: 'AI-agent', description: 'Ställ frågor om regelverk och få snabba svar.' },
      { title: 'Dokumenthantering', description: 'Organisera alla compliance-dokument.' },
      { title: 'Utgångsdatum', description: 'Spåra och få påminnelser om dokument som utgår.' },
      { title: 'Rapportering', description: 'Generera regulatoriska rapporter.' },
    ],
    tips: [
      'Använd AI-agenten för snabba svar på vanliga frågor',
      'Håll KYC-dokument uppdaterade',
      'Granska compliance-status regelbundet',
    ],
    link: '/compliance',
  },
  {
    id: 'tasks',
    title: 'Uppgifter',
    icon: 'ClipboardList',
    description: 'Hantera och prioritera arbetsuppgifter.',
    introduction: 'Uppgiftsmodulen hjälper dig hålla koll på allt som behöver göras. Se dina uppgifter, deadlines och prioriteringar på ett ställe.',
    keyBenefits: [
      'Samlad överblick över alla uppgifter',
      'Prioritering och deadline-spårning',
      'Kategorisering per område',
      'Tilldelning till teammedlemmar',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'view-tasks',
        title: 'Se uppgifter',
        shortDescription: 'Överblick av alla dina uppgifter',
        detailedContent: {
          overview: 'Uppgiftslistan visar allt du behöver göra, sorterat efter prioritet och deadline.',
          howItWorks: [
            'Gå till Uppgifter i sidomenyn',
            'Se alla uppgifter i en lista',
            'Filtrera på status: Att göra, Pågående, Klart',
            'Sortera på deadline eller prioritet',
            'Klicka på en uppgift för detaljer',
          ],
          useCases: [
            'Daglig planering',
            'Veckoöversikt',
            'Teamkoordinering',
          ],
          commonMistakes: [
            'Ignorerar hög-prioritet uppgifter',
            'Glömmer uppdatera status',
          ],
          proTips: [
            'Börja dagen med att granska uppgiftslistan',
            'Markera uppgifter klara direkt när de är gjorda',
            'Använd filter för att fokusera',
          ],
          relatedFeatures: ['Notifikationer', 'Kalender'],
          faq: [
            { question: 'Kan jag skapa egna uppgifter?', answer: 'Ja, klicka på "Ny uppgift" för att skapa en uppgift.' },
          ],
        },
      },
    ],
    features: [
      { title: 'Prioritering', description: 'Hög, medium, låg prioritet.' },
      { title: 'Deadline-spårning', description: 'Se och hantera deadlines.' },
      { title: 'Kategorisering', description: 'Organisera uppgifter per område.' },
      { title: 'Tilldelning', description: 'Tilldela uppgifter till teammedlemmar.' },
    ],
    tips: [
      'Fokusera på röda (hög prioritet) uppgifter först',
      'Uppdatera status löpande',
      'Granska uppgiftslistan dagligen',
    ],
    link: '/tasks',
  },
  {
    id: 'approvals',
    title: 'Godkännanden',
    icon: 'CheckSquare',
    description: '4-ögon godkännande för finansiella transaktioner.',
    introduction: '4-ögon principen säkerställer att alla finansiella transaktioner granskas av minst två personer. Godkännandemodulen visar alla ärenden som väntar på din granskning.',
    keyBenefits: [
      'Separation of duties',
      'Komplett audit trail',
      'Säker hantering av finansiella transaktioner',
      'Tydlig översikt av väntande ärenden',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'review-pending',
        title: 'Granska väntande',
        shortDescription: 'Se ärenden som väntar på ditt godkännande',
        detailedContent: {
          overview: 'Godkännandesidan visar alla ärenden som väntar på din granskning - utdelningar, betalningar och andra transaktioner.',
          howItWorks: [
            'Gå till Godkännanden i sidomenyn',
            'Se lista med väntande ärenden',
            'Klicka på ett ärende för detaljer',
            'Granska belopp, mottagare, syfte',
            'Godkänn eller avslå med motivering',
          ],
          useCases: [
            'Godkänna utdelningar',
            'Granska betalningar',
            'Verifiera transaktioner',
          ],
          commonMistakes: [
            'Godkänner utan att granska noggrant',
            'Avslår utan motivering',
          ],
          proTips: [
            'Ta alltid tid att granska detaljer',
            'Kontrollera originalunderlag vid stora belopp',
            'Avslå med tydlig motivering',
          ],
          relatedFeatures: ['Utdelningar', 'Betalningar', 'Audit trail'],
          faq: [
            { question: 'Kan jag godkänna mina egna ärenden?', answer: 'Nej, du kan inte godkänna ärenden du själv skapat. Det är kärnan i 4-ögon principen.' },
          ],
        },
      },
    ],
    features: [
      { title: '4-ögon princip', description: 'Minst två personer måste granska.' },
      { title: 'Audit trail', description: 'Komplett logg över alla godkännanden.' },
      { title: 'Motivering', description: 'Avslag kräver alltid motivering.' },
      { title: 'Notifikationer', description: 'Få notis när nya ärenden väntar.' },
    ],
    tips: [
      'Granska väntande ärenden dagligen',
      'Kontrollera alltid belopp och mottagare',
      'Vid tveksamhet - avslå och efterfråga mer info',
    ],
    link: '/approvals',
  },
  {
    id: 'settings',
    title: 'Inställningar',
    icon: 'Settings',
    description: 'Konfigurera ditt konto och systeminställningar.',
    introduction: 'I inställningarna kan du hantera din profil, säkerhetsinställningar, teammedlemmar och integrationer.',
    keyBenefits: [
      'Personliga profilinställningar',
      'Säkerhet och tvåfaktorsautentisering',
      'Teamhantering och roller',
      'API-integrationer',
    ],
    hasVideo: true,
    steps: [
      {
        id: 'manage-profile',
        title: 'Hantera profil',
        shortDescription: 'Uppdatera dina personliga uppgifter',
        detailedContent: {
          overview: 'Håll din profil uppdaterad med korrekta kontaktuppgifter och inställningar.',
          howItWorks: [
            'Gå till Inställningar',
            'Klicka på Profil',
            'Uppdatera namn och kontaktuppgifter',
            'Ändra lösenord om behov',
            'Aktivera tvåfaktorsautentisering',
          ],
          useCases: [
            'Uppdatera telefonnummer',
            'Ändra e-postadress',
            'Aktivera extra säkerhet',
          ],
          commonMistakes: [
            'Glömmer aktivera 2FA',
            'Svagt lösenord',
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
    ],
    features: [
      { title: 'Profil', description: 'Hantera dina personliga uppgifter.' },
      { title: 'Säkerhet', description: 'Lösenord och tvåfaktorsautentisering.' },
      { title: 'Team', description: 'Hantera teammedlemmar och roller.' },
      { title: 'Integrationer', description: 'Anslut externa system.' },
    ],
    tips: [
      'Aktivera tvåfaktorsautentisering för extra säkerhet',
      'Granska teammedlemmars rättigheter regelbundet',
      'Testa integrationer i sandbox-läge först',
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

