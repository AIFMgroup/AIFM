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
];

// Helper function to get section by ID
export function getGuideSection(id: string): GuideSection | undefined {
  return guideSections.find(s => s.id === id);
}

// Get all section IDs for navigation
export function getAllGuideSectionIds(): string[] {
  return guideSections.map(s => s.id);
}

