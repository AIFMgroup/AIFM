/**
 * Comprehensive Compliance Seed Data
 * 
 * Alla viktiga regelverk för svenska AIF-förvaltare.
 */

import { ComplianceDocument, ComplianceCategory, DocumentType, DocumentSource } from './types';
import { v4 as uuidv4 } from 'uuid';

const now = new Date().toISOString();

type SeedDoc = Omit<ComplianceDocument, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// FFFS - FINANSINSPEKTIONENS FÖRFATTNINGSSAMLING
// ============================================================================

const FFFS_DOCUMENTS: SeedDoc[] = [
  // === AIFMD / Fondreglering ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['aifmd', 'general'],
    title: 'Finansinspektionens föreskrifter om förvaltare av alternativa investeringsfonder',
    shortTitle: 'FFFS 2013:10',
    documentNumber: 'FFFS 2013:10',
    publishDate: '2013-06-22',
    effectiveDate: '2013-07-22',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2013/201310/',
    summary: 'Huvudföreskriften för AIF-förvaltare i Sverige. Implementerar AIFMD.',
    fullText: `FFFS 2013:10 - Förvaltare av alternativa investeringsfonder

KAPITEL 1 - TILLÄMPNINGSOMRÅDE
Dessa föreskrifter gäller för AIF-förvaltare med tillstånd enligt lagen om förvaltare av alternativa investeringsfonder.

En AIF-förvaltare ska:
- Ha tillstånd från Finansinspektionen
- Uppfylla organisatoriska krav
- Ha adekvat riskhantering
- Följa regler om intressekonflikter
- Tillämpa korrekta värderingsrutiner

KAPITEL 2 - TILLSTÅNDSKRAV
Ansökan om tillstånd ska innehålla:
- Verksamhetsplan med beskrivning av planerade strategier
- Information om styrelse, ledning och ägare
- Beskrivning av riskhanteringssystem
- Beskrivning av värderingsprocesser
- Uppgifter om förvaringsinstitut
- Information om delegerade funktioner

Kapitalkrav:
- Startkapital: minst 125 000 euro
- Tilläggskapital: 0,02% av förvaltat kapital över 250 miljoner euro
- Maxtak: 10 miljoner euro i tilläggskapital
- Alternativ: ansvarsförsäkring kan ersätta tilläggskapital

KAPITEL 3 - ORGANISATORISKA KRAV

3.1 Ledning och styrelse
- Ledningen ska ha tillräcklig kunskap och erfarenhet
- Minst två personer i den faktiska ledningen
- Styrelsen ansvarar för verksamheten
- Tydlig ansvarsfördelning ska dokumenteras

3.2 Interna funktioner
Förvaltaren ska ha:
- Oberoende riskhanteringsfunktion
- Compliancefunktion
- Internrevision (proportionellt)
- Värderingsfunktion

3.3 Riskhantering
Riskhanteringsfunktionen ska:
- Vara funktionellt oberoende från portföljförvaltning
- Implementera riskhanteringspolicy
- Övervaka riskprofil och limiter
- Utföra stresstester
- Rapportera till ledning och styrelse

3.4 Likviditetshantering
- Övervaka likviditetsrisk i varje fond
- Likviditetsstresstester minst årligen
- Säkerställa att inlösenvillkor matchar likviditet
- Ha lämpliga likviditetshanteringsverktyg (gates, swing pricing)

KAPITEL 4 - INTRESSEKONFLIKTER
Förvaltaren ska identifiera konflikter mellan:
- Förvaltaren och fonderna
- Olika fonder
- Fonderna och investerarna
- Förvaltaren och dess personal

Åtgärder:
- Dokumentera policy för intressekonflikter
- Föra register över identifierade konflikter
- Informera investerare om konflikter som inte kan hanteras

KAPITEL 5 - VÄRDERING

Värdering ska ske:
- Med lämplig frekvens, minst årligen
- Enligt dokumenterad värderingspolicy
- Oberoende från portföljförvaltningen

Värderingspolicyn ska innehålla:
- Kompetenskrav för värderare
- Värderingsmetoder per tillgångsslag
- Rutiner för illikvida tillgångar
- Prövning av extern värderare

Extern värderare:
- Ska vara oberoende
- Ska ha tillräckliga resurser och kompetens
- Ansvar kvarstår hos förvaltaren

KAPITEL 6 - DELEGERING

Delegering tillåts om:
- Det finns objektiva skäl
- Mottagaren har resurser och kompetens
- Effektiv tillsyn kan upprätthållas
- Förvaltaren kan återkalla delegering omedelbart

Begränsningar:
- Både portföljförvaltning och riskhantering får inte delegeras till samma enhet
- Kan inte delegeras så att förvaltaren blir en brevlåda
- FI ska underrättas om väsentlig delegering

KAPITEL 7 - FÖRVARINGSINSTITUT

Varje AIF ska ha ett förvaringsinstitut som:
- Förvarar fondens tillgångar
- Övervakar kassaflöden
- Verifierar äganderätt
- Utövar tillsyn över förvaltaren

Förvaringsinstitutet ansvarar för:
- Förlust av förvarade tillgångar (strikt ansvar)
- Tillsyn att förvaltaren följer regler

KAPITEL 8 - RAPPORTERING (ANNEX IV)

Rapporteringsfrekvens:
- Förvaltare under 100 MEUR: årligen
- Förvaltare 100-500 MEUR: halvårsvis
- Förvaltare över 500 MEUR: kvartalsvis
- Hävstångsfonder över 500 MEUR: kvartalsvis

Rapportinnehåll:
- Huvudmarknader och instrument
- Portföljkoncentration
- Geografisk fördelning
- Likviditetsprofil
- Riskmått (VaR, stresstester)
- Hävstång (brutto och åtagande)`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'fi',
    type: 'fffs',
    categories: ['aifmd'],
    title: 'Ändringsföreskrifter till FFFS 2013:10',
    shortTitle: 'FFFS 2014:7',
    documentNumber: 'FFFS 2014:7',
    publishDate: '2014-03-25',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2014/20147/',
    summary: 'Ändringar i föreskrifterna om AIF-förvaltare.',
    fullText: `FFFS 2014:7 - Ändringar i FFFS 2013:10

Denna föreskrift innehåller ändringar avseende:
- Tillståndsansökan och krav
- Rapporteringsskyldigheter
- Korrigeringar av hänvisningar`,
    status: 'scraped',
    lastScraped: now,
  },

  // === AML / Penningtvätt ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['aml'],
    title: 'Finansinspektionens föreskrifter om åtgärder mot penningtvätt och finansiering av terrorism',
    shortTitle: 'FFFS 2017:11',
    documentNumber: 'FFFS 2017:11',
    publishDate: '2017-08-01',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2017/201711/',
    summary: 'Föreskrifter om penningtvätt för finansiella företag inklusive AIF-förvaltare.',
    fullText: `FFFS 2017:11 - Åtgärder mot penningtvätt och finansiering av terrorism

KAPITEL 1 - TILLÄMPNINGSOMRÅDE
Dessa föreskrifter gäller för verksamhetsutövare enligt penningtvättslagen.

KAPITEL 2 - ALLMÄN RISKBEDÖMNING

Företaget ska:
- Identifiera och bedöma risker för penningtvätt och terrorfinansiering
- Dokumentera riskbedömningen
- Hålla riskbedömningen uppdaterad
- Beakta branschspecifika risker

Riskfaktorer att beakta:
- Geografisk risk (högriskländer)
- Kundkategorier
- Produkt- och tjänsterisker
- Distributionskanaler
- Transaktionsmönster

KAPITEL 3 - KUNDKÄNNEDOM (KYC)

3.1 Grundläggande åtgärder
- Identifiera kunden
- Kontrollera kundens identitet med tillförlitliga dokument
- Identifiera verklig huvudman
- Inhämta information om affärsförbindelsens syfte och art
- Löpande uppföljning

3.2 Skärpta åtgärder (vid högre risk)
Tillämpas vid:
- Politiskt exponerade personer (PEP)
- Högriskländer enligt EU-lista
- Komplexa eller ovanliga transaktioner
- Högriskkunder

Åtgärder inkluderar:
- Utökad bakgrundskontroll
- Inhämtande av medlens ursprung
- Godkännande av ledande befattningshavare
- Förstärkt övervakning

3.3 Förenklade åtgärder (vid lägre risk)
Kan tillämpas vid:
- Börsnoterade bolag
- Myndigheter
- Pensionsfonder med låg risk

KAPITEL 4 - ÖVERVAKNING OCH RAPPORTERING

4.1 Löpande övervakning
- Granska transaktioner mot kundens profil
- Identifiera avvikande transaktioner
- Uppdatera kundkännedom regelbundet

4.2 Rapportering
- Rapportera misstänkta transaktioner till Finanspolisen
- Rapportera utan dröjsmål
- Dokumentera rapporter och icke-rapporter

KAPITEL 5 - INTERN STYRNING

Företaget ska:
- Utse centralt funktionsansvarig
- Ha skriftliga rutiner och riktlinjer
- Utbilda personalen regelbundet
- Ha lämpliga IT-system för övervakning
- Genomföra oberoende granskning

Funktionsansvarig ska:
- Ansvara för regelefterlevnad
- Ha direkt tillgång till ledning och styrelse
- Kunna rapportera oberoende`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'fi',
    type: 'fffs',
    categories: ['aml'],
    title: 'Finansinspektionens föreskrifter om åtgärder mot penningtvätt (konsoliderad)',
    shortTitle: 'FFFS 2024:3',
    documentNumber: 'FFFS 2024:3',
    publishDate: '2024-01-15',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2024/20243/',
    summary: 'Uppdaterade föreskrifter om åtgärder mot penningtvätt med nya EU-krav.',
    fullText: `FFFS 2024:3 - Uppdaterade AML-föreskrifter

Nya krav inkluderar:
- Skärpta krav på kundkännedom
- Utökade krav på distansidentifiering
- Nya riskfaktorer för kryptoaktörer
- Förtydligade krav på verklig huvudman
- Uppdaterad lista över högriskländer`,
    status: 'scraped',
    lastScraped: now,
  },

  // === Kapitalkrav ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['risk', 'general'],
    title: 'Finansinspektionens föreskrifter om tillsynskrav och kapitalbuffertar',
    shortTitle: 'FFFS 2014:12',
    documentNumber: 'FFFS 2014:12',
    publishDate: '2014-09-15',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2014/201412/',
    summary: 'Föreskrifter om kapitalkrav och tillsyn.',
    fullText: `FFFS 2014:12 - Tillsynskrav och kapitalbuffertar

KAPITALKRAV
Företag under tillsyn ska:
- Uppfylla minimikapitalkrav
- Ha kapitalbuffertar enligt regelverket
- Rapportera kapitalstatus regelbundet

TILLSYNSPROCESS (SREP)
FI genomför regelbundet:
- Bedömning av affärsmodell
- Bedömning av intern styrning
- Bedömning av kapital
- Bedömning av likviditet`,
    status: 'scraped',
    lastScraped: now,
  },

  // === Riskhantering ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['risk'],
    title: 'Finansinspektionens föreskrifter om hantering av operativa risker',
    shortTitle: 'FFFS 2014:4',
    documentNumber: 'FFFS 2014:4',
    publishDate: '2014-04-01',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2014/20144/',
    summary: 'Föreskrifter om hantering av operativa risker.',
    fullText: `FFFS 2014:4 - Hantering av operativa risker

DEFINITION
Operativ risk är risken för förlust till följd av:
- Bristfälliga eller felaktiga interna processer
- Mänskliga fel
- Systemfel
- Externa händelser

KRAV PÅ HANTERING

1. Identifiering
- Kartlägg operativa risker
- Kategorisera efter typ och allvarlighet

2. Mätning och bedömning
- Kvantifiera risker där möjligt
- Scenarioanalyser
- Historisk förlustdata

3. Övervakning
- Nyckelindikatorer (KRI)
- Incidentrapportering
- Regelbunden uppföljning

4. Kontroll och begränsning
- Interna kontroller
- Kontinuitetsplanering
- Försäkringar

IT-RISK
Särskilda krav för:
- Informationssäkerhet
- Kontinuitetsplanering
- Outsourcing av IT
- Incidenthantering`,
    status: 'scraped',
    lastScraped: now,
  },

  // === Outsourcing ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['general'],
    title: 'Finansinspektionens föreskrifter om utkontraktering',
    shortTitle: 'FFFS 2024:1',
    documentNumber: 'FFFS 2024:1',
    publishDate: '2024-01-01',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2024/20241/',
    summary: 'Föreskrifter om utkontraktering av verksamhet.',
    fullText: `FFFS 2024:1 - Utkontraktering

TILLÄMPLIGHET
Gäller när företag under tillsyn utkontrakterar:
- Kritiska eller viktiga funktioner
- IT-tjänster
- Andra väsentliga funktioner

KRAV VID UTKONTRAKTERING

1. Riskbedömning
- Bedöm risker före utkontraktering
- Dokumentera bedömningen
- Uppdatera regelbundet

2. Due diligence
- Utvärdera leverantörens kapacitet
- Kontrollera finansiell stabilitet
- Verifiera kompetens

3. Avtal
- Skriftligt avtal
- Tydlig beskrivning av tjänsten
- Revisionsrätt
- Uppsägningsklausuler
- Kontinuitetsplanering

4. Tillsyn
- Löpande övervakning
- Regelbunden rapportering
- Eskaleringsrutiner

MOLNTJÄNSTER
Särskilda krav för molnutkontraktering:
- Dataplacering
- Säkerhetskrav
- Exit-strategi`,
    status: 'scraped',
    lastScraped: now,
  },

  // === Hållbarhet ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['sfdr'],
    title: 'Finansinspektionens föreskrifter om hållbarhetsrelaterade upplysningar',
    shortTitle: 'FFFS 2021:3',
    documentNumber: 'FFFS 2021:3',
    publishDate: '2021-03-10',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2021/20213/',
    summary: 'Föreskrifter om hållbarhetsupplysningar enligt SFDR.',
    fullText: `FFFS 2021:3 - Hållbarhetsrelaterade upplysningar

TILLÄMPNINGSOMRÅDE
Gäller för:
- AIF-förvaltare
- Fondbolag
- Finansiella rådgivare

KRAV PÅ UPPLYSNINGAR

1. På företagsnivå (webbplats)
- Policy för integrering av hållbarhetsrisker
- Beaktande av negativa konsekvenser (PAI)
- Ersättningspolicy kopplad till hållbarhet

2. På produktnivå
- Förhandsinformation om hållbarhetsrisker
- Information om produktens hållbarhetskaraktär
- Periodisk rapportering

PRODUKTKLASSIFICERING

Artikel 6-produkter:
- Ingen särskild hållbarhetsprofil
- Måste ändå beakta hållbarhetsrisker

Artikel 8-produkter (ljusgrön):
- Främjar miljömässiga eller sociala egenskaper
- Måste följa god bolagsstyrning
- Upplysningskrav i bilaga II

Artikel 9-produkter (mörkgrön):
- Hållbar investering som mål
- Strängare krav
- Upplysningskrav i bilaga III`,
    status: 'scraped',
    lastScraped: now,
  },

  // === Marknadsföring ===
  {
    source: 'fi',
    type: 'fffs',
    categories: ['marketing'],
    title: 'Finansinspektionens föreskrifter om marknadsföring av fonder',
    shortTitle: 'FFFS 2022:5',
    documentNumber: 'FFFS 2022:5',
    publishDate: '2022-02-01',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2022/20225/',
    summary: 'Föreskrifter om marknadsföring av fonder till icke-professionella investerare.',
    fullText: `FFFS 2022:5 - Marknadsföring av fonder

ALLMÄNNA KRAV
All marknadsföring ska:
- Vara rättvisande och inte vilseledande
- Vara tydlig och begriplig
- Visa risker balanserat med möjligheter

SPECIFIKA KRAV

1. Historisk avkastning
- Visa minst 5 års historik om tillgänglig
- Ange att historisk avkastning inte garanterar framtida
- Ange om avkastningen påverkats av valutakurser

2. Avgifter
- Tydligt ange totala avgifter
- Visa påverkan på avkastning

3. Risk
- Ange risknivå
- Beskriv väsentliga risker
- Använd inte garantier felaktigt

GRÄNSÖVERSKRIDANDE MARKNADSFÖRING
Enligt CBDF-förordningen:
- Notifiera värdland
- Följa lokala marknadsföringsregler
- Möjlighet till förhandsmarknadsföring`,
    status: 'scraped',
    lastScraped: now,
  },
];

// ============================================================================
// ESMA DOKUMENT - GUIDELINES, Q&As, OPINIONS
// ============================================================================

const ESMA_DOCUMENTS: SeedDoc[] = [
  // === AIFMD Q&A ===
  {
    source: 'esma',
    type: 'qa',
    categories: ['aifmd', 'general'],
    title: 'Questions and Answers on the application of the AIFMD',
    shortTitle: 'AIFMD Q&A',
    documentNumber: 'ESMA34-32-352',
    publishDate: '2023-07-21',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-32-352_qa_on_aifmd.pdf',
    summary: 'ESMAs samlade frågor och svar om AIFMD-tillämpning.',
    fullText: `ESMA Q&A on AIFMD

SECTION I - GENERAL

Q1: What is an AIF?
An alternative investment fund (AIF) is any collective investment undertaking which:
- Raises capital from a number of investors
- Invests according to a defined investment policy
- For the benefit of those investors
- Does not require UCITS authorisation

Q2: When is an entity considered a "manager"?
An entity manages an AIF when it performs at least:
- Portfolio management, OR
- Risk management

Q3: What is the definition of "marketing"?
Marketing means a direct or indirect offering or placement of units or shares of an AIF at the initiative of, or on behalf of, the AIFM to investors domiciled in the EU.

SECTION II - AUTHORISATION

Q4: Initial capital requirements?
- Internally managed AIF: EUR 300,000
- External AIFM: EUR 125,000
- Additional capital for AUM > EUR 250 million: 0.02% (max EUR 10 million)

Q5: Professional liability insurance requirements?
Alternative to own funds:
- Cover at least EUR 10 million per claim
- EUR 15 million aggregate per year

SECTION III - OPERATING CONDITIONS

Q6: Separation of functions
The portfolio management function must be functionally and hierarchically separated from the risk management function. This means:
- Different reporting lines (at least up to board level)
- Different remuneration determination
- No person can be responsible for both functions

Q7: Liquidity management
AIFMs must:
- Employ appropriate liquidity management systems
- Identify, monitor and manage liquidity risk
- Ensure consistency between redemption policy and liquidity profile
- Conduct stress tests at least annually

Q8: Valuation procedures
- Valuation at least annually for closed-end AIFs
- More frequently for open-end AIFs (based on redemption frequency)
- Independence from portfolio management
- Appropriate professional guarantees from external valuers

SECTION IV - DELEGATION

Q9: Delegation conditions
Delegation is permitted if:
- Justified by objective reasons
- Delegatee has sufficient resources
- Effective supervision is ensured
- AIFM remains liable
- AIFM can give instructions and terminate immediately

Q10: Letter-box entity prohibition
An AIFM cannot delegate to the extent that it becomes a "letter-box" entity. Indicators include:
- No longer retaining necessary expertise
- No longer retaining decision-making powers
- No ability to supervise delegates

SECTION V - DEPOSITARY

Q11: Depositary duties
- Safe-keeping of AIF assets
- Cash flow monitoring
- Oversight of AIFM compliance
- Verification of AIF ownership of assets

Q12: Depositary liability
- Strict liability for loss of financial instruments held in custody
- Liability for other losses caused by negligence
- Cannot exclude liability through contractual arrangements

SECTION VI - TRANSPARENCY

Q13: Information to investors (Article 23)
Prior to investment:
- Investment strategy and objectives
- Description of types of assets
- Investment restrictions
- Circumstances for use of leverage
- Fees, charges and expenses
- Redemption rights and procedures

Annual report requirements:
- Balance sheet and income statement
- Report on activities
- Material changes in information
- Total remuneration paid

Q14: Reporting to competent authorities (Annex IV)
Report includes:
- Main instruments and markets
- Portfolio concentration
- Leverage (gross and commitment)
- Liquidity profile
- Risk profile`,
    status: 'scraped',
    lastScraped: now,
  },

  // === ESMA Guidelines ===
  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'valuation'],
    title: 'Guidelines on performance fees in UCITS and certain types of AIFs',
    shortTitle: 'Performance Fee Guidelines',
    documentNumber: 'ESMA34-39-992',
    publishDate: '2020-11-03',
    effectiveDate: '2021-01-05',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-39-992_guidelines_on_performance_fees.pdf',
    summary: 'Riktlinjer för prestationsbaserade avgifter.',
    fullText: `ESMA Guidelines on Performance Fees

SCOPE
These guidelines apply to:
- UCITS management companies
- Self-managed UCITS
- AIFMs managing open-end AIFs marketed to retail investors

GUIDELINE 1 - PERFORMANCE FEE CALCULATION

Acceptable models:
1. High Water Mark (HWM)
   - Performance fee only when NAV exceeds previous high
   - HWM never resets (permanent)

2. High-on-High with reference period
   - Minimum 5-year reference period
   - Crystallisation at least annually
   - Negative performance carried forward

Unacceptable practices:
- Frequent resets of reference level
- No crystallisation period
- Daily performance fee accrual without claw-back

GUIDELINE 2 - CONSISTENCY WITH INVESTMENT OBJECTIVES

The reference benchmark must:
- Be consistent with the fund's investment strategy
- Not be changed to benefit the manager
- Be clearly disclosed to investors

GUIDELINE 3 - FREQUENCY OF CRYSTALLISATION

Performance fees should crystallise:
- At least annually
- More frequently if beneficial for investors
- With clear disclosure of crystallisation dates

GUIDELINE 4 - NEGATIVE PERFORMANCE

Before charging new performance fees:
- Any negative performance must be recovered
- Recovery period of at least 5 years
- No payment of performance fee during underperformance

GUIDELINE 5 - DISCLOSURE

Disclosure requirements:
- Clear explanation of calculation method
- Examples of fee impact
- Historical performance fee amounts
- Simulation of fee under different scenarios`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'risk'],
    title: 'Guidelines on Article 25 of AIFMD - Assessment of leverage',
    shortTitle: 'Leverage Guidelines',
    documentNumber: 'ESMA34-43-1203',
    publishDate: '2020-12-17',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-43-1203_final_report_guidelines_on_art_25_aifmd.pdf',
    summary: 'Riktlinjer för bedömning av systemrisker från hävstång.',
    fullText: `ESMA Guidelines on AIFMD Article 25

PURPOSE
Article 25 of AIFMD allows NCAs to impose leverage limits on AIFMs to address systemic risks.

LEVERAGE CALCULATION

Gross Method:
- Sum of absolute values of all positions
- Includes cash and cash equivalents
- No netting or hedging recognition
- Derivatives converted to equivalent underlying

Commitment Method:
- Netting and hedging recognised
- Conversion of derivatives to equivalent underlying
- Provides economic leverage measure

STEP 1 - IDENTIFYING LEVERAGE

Thresholds for closer examination:
- Commitment method leverage > 300%
- Gross method leverage > 500%
- Significant increase in leverage

Quantitative indicators:
- Leverage relative to NAV
- Leverage relative to market segment
- Concentration of leverage

STEP 2 - RISK ASSESSMENT

Systemic risk indicators:
- Size of AIF relative to market
- Investment strategy risk
- Interconnectedness with financial system
- Counterparty concentration
- Quality of collateral
- Redemption terms vs asset liquidity

Amplification mechanisms:
- Fire sale risk
- Margin spiral risk
- Counterparty contagion
- Market disruption potential

STEP 3 - MEASURES

Available measures:
- Leverage limits
- Enhanced reporting
- Additional stress testing
- Liquidity requirements

Proportionality:
- Measures should be proportionate to risk
- Consider impact on market functioning
- Coordinate with other NCAs if cross-border`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'marketing'],
    title: 'Guidelines on marketing communications under CBDF',
    shortTitle: 'Marketing Communications Guidelines',
    documentNumber: 'ESMA34-45-1648',
    publishDate: '2021-08-02',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/document/guidelines-marketing-communications',
    summary: 'Riktlinjer för marknadsföringskommunikation enligt CBDF-förordningen.',
    fullText: `ESMA Guidelines on Marketing Communications

SCOPE
Apply to marketing communications for:
- AIFs marketed to retail investors
- UCITS
- EuVECAs and EuSEFs

GENERAL PRINCIPLES

1. Fair, Clear and Not Misleading
- Balanced presentation of benefits and risks
- No misleading or promotional statements
- Use clear, jargon-free language

2. Identification
- Clearly identifiable as marketing
- Distinction from regulatory documents
- Clear source attribution

3. Consistency
- Consistent with legal documents
- No contradictory information
- Reference to prospectus/KIID

SPECIFIC REQUIREMENTS

Performance Presentation:
- Based on actual results (not simulated)
- Include at least 5 years if available
- Show impact of fees
- Clear disclaimer about past performance

Risk Disclosure:
- Balanced risk presentation
- Description of main risks
- Risk-reward profile
- Capital loss warning

Fees and Costs:
- Clear fee disclosure
- Impact on returns
- Reference to detailed cost information

Sustainability Claims:
- Substantiated and accurate
- Consistent with SFDR classification
- No greenwashing`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'general'],
    title: 'Guidelines on stress test scenarios under the MMF Regulation',
    shortTitle: 'MMF Stress Test Guidelines',
    documentNumber: 'ESMA34-49-446',
    publishDate: '2022-03-21',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/document/guidelines-stress-test-scenarios-mmf',
    summary: 'Riktlinjer för stresstestscenarier för penningmarknadsfonder.',
    fullText: `ESMA Guidelines on MMF Stress Tests

APPLICABLE STRESS SCENARIOS

1. Interest Rate Shocks
- Parallel shift scenarios
- Twist scenarios (steepening/flattening)
- Magnitude: historical worst cases

2. Credit Spread Shocks
- Investment grade widening
- Downgrade scenarios
- Default scenarios

3. Redemption Shocks
- Normal redemption stress
- Extreme redemption stress (10-50% NAV)
- Combined redemption and market stress

4. Liquidity Stress
- Reduction in market liquidity
- Widening bid-ask spreads
- Market closure scenarios

REPORTING
Results must be reported to NCAs including:
- Scenario parameters
- Impact on NAV
- Impact on liquidity
- Management actions`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'reporting'],
    title: 'Guidelines on reporting under Article 24 of AIFMD',
    shortTitle: 'Annex IV Reporting Guidelines',
    documentNumber: 'ESMA/2014/869',
    publishDate: '2014-08-08',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2014-869.pdf',
    summary: 'Riktlinjer för Annex IV-rapportering.',
    fullText: `ESMA Guidelines on AIFMD Reporting

REPORTING FREQUENCY

Based on AUM at fund level:
- Under EUR 100 million: Annual
- EUR 100-500 million: Semi-annual  
- Over EUR 500 million: Quarterly
- Leveraged funds over EUR 500 million: Quarterly

Deadline: One month after reporting period end

REPORT SECTIONS

Section 1: Identification
- AIFM identification code (LEI)
- AIF identification
- Reporting period dates
- Report type (initial, update, amendment)

Section 2: Principal Markets and Instruments
- Top 5 markets traded (by notional)
- Main instrument types (top 5)
- Asset class breakdown

Section 3: Portfolio Concentration
- Geographical focus
- Top 5 beneficial owners
- Industry concentration

Section 4: Investor Information
- Breakdown by investor type
- Beneficial ownership percentage
- Redemption frequency
- Lock-up arrangements

Section 5: Liquidity Management
- Portfolio liquidity profile
  - % liquidatable in 1 day
  - % liquidatable in 2-7 days
  - % liquidatable in 8-30 days
  - % liquidatable in 31-90 days
  - % liquidatable in 91-180 days
  - % liquidatable in 181-365 days
  - % liquidatable in >365 days

- Investor liquidity profile (same buckets)
- Liquidity stress test results

Section 6: Risk Profile
- Net equity exposure
- Net DV01
- Net CS01  
- VaR (99% 1-month)
- Stress test results

Section 7: Leverage
- Gross method exposure
- Commitment method exposure
- Leverage calculation breakdown
- Sources of leverage (securities lending, repo, derivatives)
- Derivative notional by type

SPECIAL PROVISIONS

Leveraged funds:
- Additional information required
- More granular derivative breakdown
- Counterparty exposure details

Master-feeder structures:
- Report at both levels
- Identify relationship`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'depositary'],
    title: 'Guidelines on key concepts of the AIFMD - Depositary',
    shortTitle: 'Depositary Guidelines',
    documentNumber: 'ESMA/2016/575',
    publishDate: '2016-04-30',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/document/guidelines-key-concepts-aifmd',
    summary: 'Riktlinjer om förvaringsinstitutets roll och ansvar.',
    fullText: `ESMA Guidelines on Depositary Functions

SAFE-KEEPING DUTIES

Financial instruments held in custody:
- Segregated from depositary's own assets
- Recorded in separate account
- Reconciliation procedures required
- Cannot be re-used without consent

Other assets (verification):
- Verify AIF ownership
- Record keeping requirements
- Reconciliation with AIFM records

CASH FLOW MONITORING

The depositary must:
- Ensure all cash flows are properly monitored
- Reconcile cash movements
- Monitor subscriptions and redemptions
- Verify cash at prime brokers

OVERSIGHT DUTIES

The depositary must verify:
- NAV calculation
- Compliance with investment restrictions
- Legal documentation
- Subscription/redemption procedures

LIABILITY

Strict liability for:
- Loss of financial instruments in custody
- Sub-custodian losses (unless contractually transferred)

Negligence liability for:
- Failure of oversight duties
- Other losses caused by negligence

DELEGATION

Sub-custody allowed if:
- Objective reason
- Due diligence performed
- Ongoing monitoring
- Segregation maintained
- Written agreement`,
    status: 'scraped',
    lastScraped: now,
  },

  // === SFDR Documents ===
  {
    source: 'esma',
    type: 'qa',
    categories: ['sfdr'],
    title: 'Questions and Answers on the SFDR Delegated Regulation',
    shortTitle: 'SFDR Q&A',
    documentNumber: 'JC 2023 18',
    publishDate: '2023-11-17',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/2023-11/JC_2023_18_-_Consolidated_JC_SFDR_QAs.pdf',
    summary: 'Gemensamt Q&A om SFDR från ESA:erna.',
    fullText: `Joint ESA Q&A on SFDR

SECTION I - GENERAL APPLICATION

Q1: When does SFDR apply?
Level 1 (SFDR): From 10 March 2021
Level 2 (RTS): From 1 January 2023

Q2: Which entities are covered?
- Fund managers (UCITS, AIFM)
- Insurance undertakings offering IBIPs
- Investment firms providing portfolio management
- Pension providers
- Financial advisers

Q3: What is "sustainable investment"?
An investment in an economic activity that:
- Contributes to environmental OR social objective
- Does not significantly harm any objective
- Investee follows good governance

SECTION II - ENTITY-LEVEL DISCLOSURES

Q4: Website disclosures
Must publish:
- Integration of sustainability risks (Art. 3)
- Principal adverse impacts (Art. 4) - comply or explain
- Remuneration policy (Art. 5)

Q5: PAI Statement content
14 mandatory indicators + at least one optional from each table:
- Environmental (Tables 1 & 2)
- Social (Table 3)

Calculation based on weighted average.

SECTION III - PRODUCT DISCLOSURES

Q6: Article 6 products
All products must:
- Explain how sustainability risks are integrated
- Describe expected impact on returns
- State if sustainability risks not relevant (with explanation)

Q7: Article 8 products (Light Green)
Must additionally:
- Describe environmental/social characteristics promoted
- Explain how characteristics are met
- If benchmark used, explain alignment
- Pre-contractual: Annex II template
- Periodic: Annex IV template

Q8: Article 9 products (Dark Green)
Must additionally:
- State sustainable investment objective
- Explain how objective is achieved
- If benchmark used, explain Paris-alignment
- Pre-contractual: Annex III template
- Periodic: Annex V template

SECTION IV - PRINCIPAL ADVERSE IMPACTS

Q9: Mandatory PAI indicators (Table 1)

Climate:
1. GHG emissions (Scope 1, 2, 3 separate)
2. Carbon footprint
3. GHG intensity of investee companies
4. Exposure to fossil fuel companies
5. Non-renewable energy share
6. Energy consumption intensity

Biodiversity:
7. Activities negatively affecting biodiversity areas

Water:
8. Emissions to water

Waste:
9. Hazardous waste ratio

Social:
10. UN Global Compact/OECD violations
11. No processes for monitoring compliance
12. Unadjusted gender pay gap
13. Board gender diversity
14. Exposure to controversial weapons

Q10: Calculation methodology
- Weighted average of investee metrics
- Based on enterprise value for emissions
- Based on revenue for intensity metrics
- Quarterly data collection where possible

SECTION V - TAXONOMY ALIGNMENT

Q11: How to disclose Taxonomy alignment?
For Article 8 and 9 products:
- % of investments Taxonomy-aligned
- Minimum % commitment (if any)
- Breakdown by environmental objective

Q12: "Do No Significant Harm" under Taxonomy vs SFDR?
- Taxonomy DNSH: Technical screening criteria
- SFDR DNSH: PAI indicators consideration
- Both must be satisfied for sustainable investments`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'standard',
    categories: ['sfdr'],
    title: 'Regulatory Technical Standards for SFDR',
    shortTitle: 'SFDR RTS',
    documentNumber: 'EU 2022/1288',
    publishDate: '2022-07-25',
    effectiveDate: '2023-01-01',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R1288',
    summary: 'Tekniska standarder för SFDR-upplysningar.',
    fullText: `SFDR Delegated Regulation (EU) 2022/1288

CHAPTER I - GENERAL PROVISIONS

Article 1 - Definitions
Key definitions including:
- Sustainability indicator
- Sustainable investment
- Principal adverse impact

CHAPTER II - TRANSPARENCY OF SUSTAINABILITY RISKS

Article 2 - Website disclosure
Financial market participants shall publish:
- Description of sustainability risk integration
- Policies for identification and prioritisation
- Integration in investment decision-making

CHAPTER III - ADVERSE SUSTAINABILITY IMPACTS

Article 4 - PAI Statement format
The statement shall contain:
- Summary section
- Detailed indicator calculations
- Engagement policies
- References to standards/codes

Article 5 - Calculation methodology
Indicators calculated as:
- Weighted average per investment
- Based on most recent available data
- Estimation permitted with methodology disclosure

CHAPTER IV - PRODUCT TRANSPARENCY

Articles 8-13 - Article 8 Products
Pre-contractual template (Annex II):
- Environmental/social characteristics description
- Investment strategy
- Asset allocation
- Monitoring and methodology
- Data sources
- Limitations
- Due diligence
- Engagement policies

Periodic template (Annex IV):
- Actual vs intended sustainability
- Top investments
- Asset allocation achieved
- Proportion in sustainable investments

Articles 14-19 - Article 9 Products
Pre-contractual template (Annex III):
Similar to Annex II plus:
- Sustainable investment objective
- No significant harm methodology
- Taxonomy alignment (if applicable)

Periodic template (Annex V):
Similar to Annex IV plus:
- Objective achievement assessment

ANNEX I - PAI INDICATORS

Table 1 - Mandatory indicators (14)
Table 2 - Additional climate indicators (opt-in)
Table 3 - Additional social indicators (opt-in)

Calculation formulas provided for each indicator.`,
    status: 'scraped',
    lastScraped: now,
  },
];

// ============================================================================
// EU FÖRORDNINGAR
// ============================================================================

const EU_REGULATIONS: SeedDoc[] = [
  {
    source: 'eur-lex',
    type: 'directive',
    categories: ['aifmd', 'general'],
    title: 'Alternative Investment Fund Managers Directive',
    shortTitle: 'AIFMD',
    documentNumber: '2011/61/EU',
    publishDate: '2011-07-01',
    effectiveDate: '2013-07-22',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0061',
    summary: 'EU-direktivet om förvaltare av alternativa investeringsfonder.',
    fullText: `DIRECTIVE 2011/61/EU - AIFMD

CHAPTER I - GENERAL PROVISIONS

Article 1 - Subject matter
This Directive lays down rules for:
- Authorisation and supervision of AIFMs
- Operation of AIFMs
- Transparency requirements
- Marketing of AIFs

Article 2 - Scope
Applies to:
- EU AIFMs managing EU or non-EU AIFs
- Non-EU AIFMs managing EU AIFs
- Non-EU AIFMs marketing AIFs in EU

Exemptions:
- Holding companies
- Pension institutions (under IORP)
- Supranational organisations
- Central banks
- Securitisation special purpose entities

Article 3 - Exemptions (sub-threshold)
Thresholds for registration only:
- EUR 100 million (including leverage)
- EUR 500 million (no leverage, 5-year lock-up)

Article 4 - Definitions
Key definitions:
- AIF: collective investment undertaking not UCITS
- AIFM: legal person managing one or more AIFs
- Depositary: entity entrusted with custody
- Marketing: direct or indirect offering in EU

CHAPTER II - AUTHORISATION

Article 6 - Conditions for authorisation
AIFM must:
- Have registered office and head office in same Member State
- Be of good repute
- Have sufficient initial capital
- Have fit and proper senior management

Article 7 - Application
Application must include:
- Information on persons conducting business
- Information on shareholders
- Programme of activity
- Remuneration policy
- Delegation arrangements
- Depositary arrangements

Article 8 - Conditions for granting authorisation
Competent authority shall grant if:
- Application complete
- Requirements met
- AIFM able to comply with Directive

Article 9 - Initial capital
- Internal AIFM: EUR 300,000
- External AIFM: EUR 125,000
- Additional: 0.02% of AUM > EUR 250 million (max EUR 10 million)

CHAPTER III - OPERATING CONDITIONS

Section 1 - General requirements

Article 12 - General principles
AIFMs shall:
- Act honestly and fairly
- Act with due skill, care and diligence
- Act in best interests of AIFs and investors
- Treat all investors fairly
- Not place interests above AIFs/investors

Article 13 - Remuneration
Remuneration policies shall:
- Be consistent with sound risk management
- Not encourage excessive risk-taking
- Apply to identified staff
- Include fixed and variable components
- Defer variable remuneration

Article 14 - Conflicts of interest
AIFMs shall:
- Identify potential conflicts
- Prevent, manage, monitor, disclose conflicts
- Maintain organisational arrangements
- Keep and update conflict register

Section 2 - Risk management

Article 15 - Risk management
AIFMs shall:
- Implement risk management systems
- Functionally separate risk management
- Set risk limits for each AIF
- Review systems at least annually

Article 16 - Liquidity management
AIFMs shall:
- Employ appropriate liquidity management
- Ensure consistency of investment strategy with redemption
- Conduct stress tests
- Have policies for illiquid assets

Section 3 - Valuation

Article 19 - Valuation
Requirements:
- Appropriate and consistent procedures
- At least annual valuation
- Independence from portfolio management
- External valuer permitted
- Liability remains with AIFM

CHAPTER IV - TRANSPARENCY REQUIREMENTS

Article 22 - Annual report
Contains:
- Balance sheet
- Income and expenditure account
- Report on activities
- Material changes disclosed
- Total remuneration paid

Article 23 - Disclosure to investors
Before investment:
- Investment strategy
- Leverage policy
- Risk profile
- Redemption procedures
- Valuation procedures
- Fee structure

Article 24 - Reporting to competent authorities
Report:
- Principal markets and instruments
- Main exposures and concentrations
- Risk profile
- Liquidity management
- Leverage employed

CHAPTER V - AIFM MANAGING SPECIFIC TYPES OF AIF

Article 25 - Leveraged AIFs
Additional requirements:
- Demonstrate leverage limits reasonable
- NCAs may impose limits for systemic risk
- ESMA coordination role

Articles 26-30 - AIFs acquiring control
Requirements for:
- Notification of acquisition
- Disclosure of intentions
- Asset stripping restrictions

CHAPTER VI - MARKETING

Article 31 - Marketing in home Member State
Notification to NCA with:
- Programme of operations
- AIF rules
- Depositary arrangements
- Information for investors

Article 32 - Marketing in other Member States
Passport with notification to home NCA including:
- Host Member State
- AIF identification
- Documents required under Article 31`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'eur-lex',
    type: 'directive',
    categories: ['aifmd'],
    title: 'AIFMD II - Amendments to AIFMD',
    shortTitle: 'AIFMD II',
    documentNumber: '2024/XXX/EU',
    publishDate: '2024-04-24',
    effectiveDate: '2026-04-24',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021PC0721',
    summary: 'Ändringar av AIFMD - AIFMD II.',
    fullText: `AIFMD II - Key Changes

LOAN ORIGINATION
New rules for loan-originating AIFs:
- Risk retention requirements (5%)
- Concentration limits
- Leverage limits
- Disclosure requirements

LIQUIDITY MANAGEMENT TOOLS
Mandatory tools available:
- Redemption gates
- Notice periods
- Swing pricing
- Anti-dilution levies
- Side pockets
- In-kind redemptions

NCAs may require use of specific tools.

DELEGATION
Enhanced requirements:
- Substance requirements
- Reporting on delegation arrangements
- Supervisory cooperation

DEPOSITARY SERVICES
CSDs recognised as depositaries
Expanded scope for non-EU CSDs

REPORTING
Enhanced Annex IV reporting:
- More detailed leverage data
- Liquidity stress test results
- Cost data

SUSTAINABILITY
Integration of:
- Sustainability risks in Article 15
- Sustainability preferences in conflicts
- PAI consideration

THIRD COUNTRY
New third-country provisions:
- Benchmarking of AML frameworks
- AIFM substance requirements
- Cooperation arrangements`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'eur-lex',
    type: 'regulation',
    categories: ['sfdr'],
    title: 'Sustainable Finance Disclosure Regulation',
    shortTitle: 'SFDR',
    documentNumber: '2019/2088',
    publishDate: '2019-12-09',
    effectiveDate: '2021-03-10',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R2088',
    summary: 'EU-förordningen om hållbarhetsrelaterade upplysningar.',
    fullText: `REGULATION (EU) 2019/2088 - SFDR

CHAPTER I - GENERAL PROVISIONS

Article 1 - Subject matter
Establishes harmonised rules on:
- Transparency of sustainability risks
- Transparency of adverse sustainability impacts
- Transparency of sustainable investments

Article 2 - Definitions
Key definitions:
- Sustainable investment
- Sustainability risk
- Sustainability factors
- Principal adverse impacts

Article 3 - Transparency of sustainability risk policies
FMPs shall publish:
- Policies on integration of sustainability risks
- In investment decision-making process

Article 4 - Transparency of adverse sustainability impacts
FMPs shall publish either:
- Statement on PAI consideration, OR
- Clear reasons why not considered

CHAPTER II - TRANSPARENCY AT PRODUCT LEVEL

Article 6 - Transparency of sustainability risks
Pre-contractual disclosure of:
- How sustainability risks integrated
- Results of assessment of impact on returns
- If risks not relevant, explanation why

Article 7 - Transparency of adverse impacts at product level
For products under Article 4 consideration:
- How PAIs are taken into account

Article 8 - Transparency of promotion of environmental or social characteristics
Where product promotes E/S characteristics:
- Information on how characteristics met
- If index designated, how aligned
- Where information available

Article 9 - Transparency of sustainable investments
Where product has sustainable investment objective:
- Information on how objective achieved
- If index designated, explanation of alignment
- If no index, explanation of objective achievement

CHAPTER III - TRANSPARENCY OF REMUNERATION

Article 5 - Transparency of remuneration policies
Include in remuneration policies:
- How policies consistent with sustainability risks
- Publish information on website

CHAPTER IV - FINAL PROVISIONS

Delegated acts empowerment for:
- Content and presentation of information
- PAI indicators and methodologies
- Product disclosure templates`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'eur-lex',
    type: 'regulation',
    categories: ['taxonomy'],
    title: 'EU Taxonomy Regulation',
    shortTitle: 'Taxonomy Regulation',
    documentNumber: '2020/852',
    publishDate: '2020-06-22',
    effectiveDate: '2021-01-01',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32020R0852',
    summary: 'EU Taxonomin för hållbara investeringar.',
    fullText: `REGULATION (EU) 2020/852 - TAXONOMY

CHAPTER I - SUBJECT MATTER, SCOPE AND DEFINITIONS

Article 1 - Subject matter
Establishes criteria for:
- Determining environmentally sustainable activities
- For investment and corporate purposes

Article 2 - Scope
Applies to:
- Measures requiring sustainability disclosure
- Financial market participants offering products
- Financial or non-financial undertakings

Article 3 - Criteria for environmentally sustainable activities
Activity is sustainable if it:
1. Contributes substantially to one or more environmental objectives
2. Does not significantly harm any environmental objective
3. Is carried out in compliance with minimum safeguards
4. Complies with technical screening criteria

CHAPTER II - ENVIRONMENTAL OBJECTIVES

Article 9 - Environmental objectives
Six objectives:
1. Climate change mitigation
2. Climate change adaptation
3. Sustainable use of water and marine resources
4. Transition to circular economy
5. Pollution prevention and control
6. Protection of biodiversity and ecosystems

CHAPTER III - TECHNICAL SCREENING CRITERIA

Article 10 - Substantial contribution to climate mitigation
Including:
- Renewable energy generation
- Energy efficiency
- Clean mobility
- Carbon capture
- Reforestation

Article 11 - Substantial contribution to climate adaptation
Including:
- Climate risk solutions
- Adaptation solutions
- Resilience improvement

Article 12 - Substantial contribution to water
Including:
- Water conservation
- Water treatment
- Marine ecosystem protection

Article 13 - Substantial contribution to circular economy
Including:
- Resource efficiency
- Waste reduction
- Product durability
- Recycling

Article 14 - Substantial contribution to pollution prevention
Including:
- Pollution reduction
- Clean production
- Remediation

Article 15 - Substantial contribution to biodiversity
Including:
- Ecosystem restoration
- Conservation
- Sustainable agriculture/forestry

CHAPTER IV - TRANSPARENCY

Article 5 - Transparency for financial products with environmental objectives
Disclose:
- How and to what extent Taxonomy used
- What environmental objectives
- Proportion of Taxonomy-aligned investments

Article 6 - Transparency for other financial products
Where not Article 9 SFDR product:
- Statement that investments do not take into account EU criteria
- Disclaimer wording specified

Article 7 - Transparency for non-financial undertakings
Large companies disclose:
- Proportion of turnover from Taxonomy activities
- Proportion of CapEx and OpEx
- Breakdown by environmental objective`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'eur-lex',
    type: 'regulation',
    categories: ['aml'],
    title: 'Anti-Money Laundering Regulation',
    shortTitle: 'AMLR',
    documentNumber: '2024/XXX',
    publishDate: '2024-05-30',
    effectiveDate: '2027-07-10',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021PC0420',
    summary: 'Den nya EU AML-förordningen (AMLR).',
    fullText: `EU ANTI-MONEY LAUNDERING REGULATION

KEY CHANGES

1. SINGLE RULEBOOK
- Directly applicable rules
- No more national transposition differences
- Harmonised customer due diligence

2. CUSTOMER DUE DILIGENCE

Standard CDD includes:
- Identification of customer
- Identification of beneficial owner
- Purpose and nature of business relationship
- Ongoing monitoring

Enhanced CDD when:
- High-risk third country
- PEP involvement
- Complex transactions
- Correspondent relationships
- Private banking
- Crypto-asset providers

Simplified CDD when:
- Listed companies
- Government entities
- Low-value transactions
- Low-risk products

3. BENEFICIAL OWNERSHIP

Requirements:
- Maximum 25% ownership threshold
- Nominee arrangements transparency
- Register access rules
- Interconnection of registers

4. SUSPICIOUS TRANSACTION REPORTING

Report to FIU when:
- Suspicion of ML/TF
- Attempted suspicious transaction
- Tax crimes (above thresholds)

Timeline:
- Without delay
- Maximum 24 hours for urgent

5. RECORD KEEPING
- 5 years after business relationship ends
- 10 years for certain high-risk

6. PENALTIES
- Administrative fines up to EUR 10 million
- Or 10% of annual turnover
- Personal liability for management

7. AMLA (NEW AUTHORITY)
European Anti-Money Laundering Authority:
- Direct supervision of high-risk entities
- Coordination of national supervisors
- Single point for FIU cooperation`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'eur-lex',
    type: 'regulation',
    categories: ['mifid'],
    title: 'Markets in Financial Instruments Regulation',
    shortTitle: 'MiFIR',
    documentNumber: '600/2014',
    publishDate: '2014-06-12',
    effectiveDate: '2018-01-03',
    language: 'en',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0600',
    summary: 'MiFIR - Direkt tillämplig förordning för finansmarknader.',
    fullText: `REGULATION (EU) 600/2014 - MiFIR

TITLE I - SUBJECT MATTER AND SCOPE

Article 1 - Subject matter
Uniform requirements for:
- Disclosure of trade data
- Reporting of transactions
- Trading of derivatives on venues
- Non-discriminatory access

TITLE II - TRANSPARENCY FOR TRADING VENUES

Chapter 1 - Transparency for equity instruments

Article 3 - Pre-trade transparency for trading venues
Publish:
- Current bid and offer prices
- Depth of trading interest
- Real-time basis

Article 6 - Post-trade transparency for trading venues
Publish:
- Price, volume, time of transactions
- As close to real-time as possible
- Maximum 15 minutes delay

Chapter 2 - Transparency for non-equity instruments

Article 8 - Pre-trade transparency for trading venues
Waivers available for:
- Large in scale orders
- Actionable indications of interest
- Request for quote systems

Article 10 - Post-trade transparency for trading venues
Deferrals available for:
- Large in scale transactions
- Illiquid instruments
- Size specific to instrument

TITLE III - TRANSPARENCY FOR SYSTEMATIC INTERNALISERS

Article 14 - Obligation for systematic internalisers to make public firm quotes
Requirements:
- Quote in liquid equity instruments
- When dealing below standard market size
- Binding quotes to clients

Article 18 - Obligation for systematic internalisers in non-equity
Provide quotes:
- On request
- For liquid instruments
- Below size specific threshold

TITLE IV - TRANSACTION REPORTING

Article 26 - Transaction reporting
Report transactions to competent authority:
- As quickly as possible
- No later than end of next working day
- Content specified in RTS

Content includes:
- Instrument identification
- Quantity and price
- Counterparty identification
- Trader identification
- Execution date and time

TITLE V - DERIVATIVES

Article 28 - Obligation to trade on regulated markets
Derivatives subject to clearing obligation:
- Must trade on regulated market, MTF, OTF
- Or equivalent third country venue`,
    status: 'scraped',
    lastScraped: now,
  },
];

// ============================================================================
// KOMBINERA ALLA DOKUMENT
// ============================================================================

export const ALL_SEED_DOCUMENTS: SeedDoc[] = [
  ...FFFS_DOCUMENTS,
  ...ESMA_DOCUMENTS,
  ...EU_REGULATIONS,
];

/**
 * Generera alla dokument med IDs och timestamps
 */
export function generateAllSeedDocuments(): ComplianceDocument[] {
  return ALL_SEED_DOCUMENTS.map(doc => ({
    ...doc,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Statistik över dokumenten
 */
export function getSeedDocumentStats(): {
  total: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
} {
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const doc of ALL_SEED_DOCUMENTS) {
    bySource[doc.source] = (bySource[doc.source] || 0) + 1;
    byType[doc.type] = (byType[doc.type] || 0) + 1;
    for (const cat of doc.categories) {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
  }

  return {
    total: ALL_SEED_DOCUMENTS.length,
    bySource,
    byCategory,
    byType,
  };
}




