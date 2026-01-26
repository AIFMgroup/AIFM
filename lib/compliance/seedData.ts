/**
 * Compliance Seed Data
 * 
 * Fördefinierade regelverk och vägledning för AIF-förvaltare.
 * Innehåller sammanfattningar och nyckelinnehåll.
 */

import { ComplianceDocument } from './types';
import { v4 as uuidv4 } from 'uuid';

const now = new Date().toISOString();

export const SEED_DOCUMENTS: Omit<ComplianceDocument, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // ============ FFFS (Swedish regulations) ============
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
    pdfUrl: 'https://www.fi.se/contentassets/e5a79b1e1f8d408f9c5e37867be75611/fffs201310.pdf',
    summary: 'Denna föreskrift reglerar verksamheten för förvaltare av alternativa investeringsfonder (AIF-förvaltare) i Sverige. Föreskriften implementerar AIFMD i svensk rätt.',
    fullText: `FFFS 2013:10 - Finansinspektionens föreskrifter om förvaltare av alternativa investeringsfonder

KAPITEL 1 - TILLÄMPNINGSOMRÅDE OCH DEFINITIONER

1 § Dessa föreskrifter gäller för AIF-förvaltare med tillstånd enligt 3 kap. lagen (2013:561) om förvaltare av alternativa investeringsfonder.

Definitioner enligt föreskriften:
- AIF: Alternativ investeringsfond
- AIF-förvaltare: Ett företag som förvaltar en eller flera alternativa investeringsfonder
- Förvaringsinstitut: Ett företag som utsetts att förvara AIF:ens tillgångar

KAPITEL 2 - TILLSTÅND

En AIF-förvaltare ska ha tillstånd från Finansinspektionen för att bedriva verksamhet i Sverige.

Tillståndsansökan ska innehålla:
- Verksamhetsplan
- Information om ledning och ägare
- Beskrivning av riskhanteringssystem
- Beskrivning av värderingsrutiner
- Uppgifter om förvaringsinstitut

KAPITEL 3 - ORGANISATORISKA KRAV

3.1 Ledning och styrelse
- Styrelseledamöter och verkställande direktör ska ha tillräcklig erfarenhet och kunskap
- Ledningen ska aktivt övervaka verksamheten

3.2 Riskhantering
AIF-förvaltaren ska ha en oberoende riskhanteringsfunktion som:
- Implementerar riskhanteringspolicyer
- Övervakar riskprofilen för varje AIF
- Rapporterar till ledningen regelbundet

3.3 Likviditetshantering
- Regelbunden likviditetsstresstest
- Lämpliga likviditetshanteringsinstrument

KAPITEL 4 - INTRESSEKONFLIKTER

AIF-förvaltaren ska identifiera och hantera intressekonflikter mellan:
- Förvaltaren och fonderna
- Olika fonder som förvaltaren hanterar
- Förvaltaren och dess anställda
- Fonderna och investerarna

KAPITEL 5 - VÄRDERING

Värdering av tillgångar ska ske:
- Med lämplig frekvens (minst årligen)
- Enligt en dokumenterad värderingspolicy
- Av en oberoende värderingsfunktion eller extern värderare

KAPITEL 6 - DELEGERING

AIF-förvaltaren får delegera funktioner under förutsättning att:
- Delegeringen kan motiveras objektivt
- Mottagaren har tillräckliga resurser
- Övervakning sker kontinuerligt
- FI underrättas om väsentlig delegering

KAPITEL 7 - FÖRVARINGSINSTITUT

Varje AIF ska ha ett förvaringsinstitut som:
- Förvarar tillgångarna
- Övervakar kassaflöden
- Utför tillsyn över förvaltaren

KAPITEL 8 - RAPPORTERING

AIF-förvaltaren ska rapportera till FI enligt Annex IV:
- Årlig rapportering för mindre förvaltare
- Kvartalsvis rapportering för större förvaltare
- Information om tillgångar, hävstång, likviditet och riskprofil`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'fi',
    type: 'fffs',
    categories: ['aml'],
    title: 'Finansinspektionens föreskrifter om åtgärder mot penningtvätt och finansiering av terrorism',
    shortTitle: 'FFFS 2017:11',
    documentNumber: 'FFFS 2017:11',
    publishDate: '2017-08-01',
    effectiveDate: '2017-08-01',
    language: 'sv',
    sourceUrl: 'https://www.fi.se/sv/vara-register/fffs/sok-fffs/2017/201711/',
    summary: 'Föreskriften innehåller regler om åtgärder mot penningtvätt och finansiering av terrorism för finansiella företag, inklusive AIF-förvaltare.',
    fullText: `FFFS 2017:11 - Åtgärder mot penningtvätt och finansiering av terrorism

SYFTE
Att förhindra att finansiella företag utnyttjas för penningtvätt eller terrorfinansiering.

ALLMÄN RISKBEDÖMNING
Företaget ska:
- Identifiera och bedöma risker för penningtvätt
- Dokumentera riskbedömningen
- Uppdatera regelbundet

KUNDKÄNNEDOM (KYC)
Grundläggande åtgärder:
- Identifiera kunden
- Kontrollera kundens identitet
- Förstå affärsrelationens syfte

Förstärkt kundkännedom vid:
- Högriskländer
- Politiskt exponerade personer (PEP)
- Komplexa transaktioner

ÖVERVAKNING
- Kontinuerlig övervakning av affärsrelationer
- Granska transaktioner som avviker
- Rapportera misstänkta transaktioner till Finanspolisen

INTERN KONTROLL
- Utse en centralt funktionsansvarig
- Utbilda personalen regelbundet
- Ha tydliga rutiner och riktlinjer`,
    status: 'scraped',
    lastScraped: now,
  },

  // ============ ESMA Documents ============
  {
    source: 'esma',
    type: 'qa',
    categories: ['aifmd', 'general'],
    title: 'Questions and Answers on the application of the AIFMD',
    shortTitle: 'ESMA AIFMD Q&A',
    documentNumber: 'ESMA34-32-352',
    publishDate: '2023-07-21',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-32-352_qa_on_aifmd.pdf',
    summary: 'ESMAs samling av frågor och svar om tillämpningen av AIFMD. Uppdateras regelbundet med nya tolkningar.',
    fullText: `ESMA Q&A on AIFMD Application

Section I: Scope
Q1: What is the definition of an AIF?
An AIF is any collective investment undertaking which raises capital from a number of investors, with a view to investing it in accordance with a defined investment policy for the benefit of those investors, and which does not require authorisation as a UCITS.

Q2: Are holding companies within scope?
A company is not an AIF merely because it holds shares in other entities, provided it does not pool capital from investors to generate pooled returns.

Section II: Authorisation
Q3: What are the initial capital requirements?
- Full-scope AIFMs: EUR 125,000 minimum
- Additional capital: 0.02% of AUM exceeding EUR 250 million, capped at EUR 10 million
- Professional liability insurance may substitute additional capital

Section III: Operating conditions
Q4: What are the requirements for risk management?
AIFMs must implement:
- Appropriate risk management systems
- Regular stress tests for each AIF
- Risk limits for each AIF
- Separation between portfolio management and risk management functions

Section IV: Delegation
Q5: What are the conditions for delegation?
An AIFM may delegate portfolio management or risk management functions if:
- The delegation can be justified objectively
- The delegate has sufficient resources
- Effective supervision is ensured
- The AIFM remains responsible

Section V: Depositary
Q6: What are the depositary's responsibilities?
- Safe-keeping of assets
- Cash flow monitoring
- Oversight of the AIFM

Section VI: Transparency
Q7: What must be disclosed to investors?
- Investment strategy and objectives
- Risk profile
- Leverage limits
- Fees and charges
- Valuation procedures

Section VII: Annex IV Reporting
Q8: What information must be reported?
- Principal markets and instruments
- Portfolio concentration
- Geographical focus
- Liquidity profile
- Risk measures
- Leverage employed`,
    status: 'scraped',
    lastScraped: now,
  },

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
    summary: 'Riktlinjer för hur prestationsbaserade avgifter ska beräknas och kommuniceras i UCITS och vissa AIF:er.',
    fullText: `ESMA Guidelines on Performance Fees

PURPOSE
To ensure consistent application of performance fee structures across the EU and protect investors from unfair fee practices.

SCOPE
These guidelines apply to:
- UCITS management companies
- AIFMs marketing to retail investors
- Self-managed UCITS and retail AIFs

KEY REQUIREMENTS

1. Performance Fee Models
Acceptable models include:
- High Water Mark (HWM)
- High-on-High model with a reference period of at least 5 years

2. Reference Benchmark
- Must be consistent with the fund's investment strategy
- Cannot be changed to favor the manager

3. Crystallization
- Performance fees should crystallize at least annually
- Negative performance must be recovered before new fees

4. Disclosure
Must disclose:
- Fee calculation methodology
- Historical performance fee amounts
- Impact on returns

5. Simulation
Managers must provide:
- Concrete examples of fee calculation
- Simulation of fee impact over various scenarios`,
    status: 'scraped',
    lastScraped: now,
  },

  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'risk'],
    title: 'Guidelines on Article 25 of Directive 2011/61/EU - Leverage',
    shortTitle: 'AIFMD Leverage Guidelines',
    documentNumber: 'ESMA34-43-1203',
    publishDate: '2020-12-17',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-43-1203_final_report_guidelines_on_art_25_aifmd.pdf',
    summary: 'Riktlinjer för nationella tillsynsmyndigheter om bedömning av hävstångsrelaterade systemrisker och lämpliga åtgärder.',
    fullText: `ESMA Guidelines on AIFMD Article 25 - Leverage Assessment

BACKGROUND
Article 25 of AIFMD empowers national competent authorities (NCAs) to impose leverage limits on AIFMs to address systemic risks.

LEVERAGE CALCULATION METHODS

1. Gross Method
- Sum of absolute values of all positions
- Includes derivatives exposure
- No netting allowed

2. Commitment Method
- Considers netting and hedging arrangements
- Provides net economic exposure

RISK ASSESSMENT FRAMEWORK

Step 1: Identify AIFs with significant leverage
- Leverage exceeding 300% (commitment) warrants closer examination
- Consider both gross and commitment methods

Step 2: Assess potential systemic risk
Consider:
- AIF size relative to market
- Investment strategy concentration
- Counterparty concentration
- Redemption terms vs. asset liquidity

Step 3: Determine appropriate measures
Options include:
- Leverage limits
- Enhanced reporting
- Stress testing requirements

INDICATORS OF SYSTEMIC RISK
- Rapid leverage increases
- Concentrated exposures
- Illiquid underlying assets
- Short redemption periods
- High interconnectedness with financial system`,
    status: 'scraped',
    lastScraped: now,
  },

  // ============ SFDR Documents ============
  {
    source: 'esma',
    type: 'qa',
    categories: ['sfdr'],
    title: 'Questions and Answers on the SFDR',
    shortTitle: 'SFDR Q&A',
    documentNumber: 'JC 2023 18',
    publishDate: '2023-05-17',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/2023-05/JC_2023_18_-_Consolidated_JC_SFDR_QAs.pdf',
    summary: 'Gemensamma frågor och svar från ESMA, EBA och EIOPA om tillämpningen av SFDR.',
    fullText: `Joint Q&A on SFDR (Sustainable Finance Disclosure Regulation)

ARTICLE 6 - INTEGRATION OF SUSTAINABILITY RISKS
Q: Must all financial products integrate sustainability risks?
A: Yes, all financial products must explain how sustainability risks are integrated into investment decisions, even if the product does not have sustainability as an objective.

ARTICLE 8 - ENVIRONMENTAL OR SOCIAL CHARACTERISTICS
Q: What qualifies as an Article 8 product?
A: A product that promotes environmental or social characteristics, provided that:
- The companies invested in follow good governance practices
- Binding commitments are made in documentation

Q: What must be disclosed for Article 8 products?
- How the characteristics are met
- Reference benchmark information (if applicable)
- Pre-contractual and periodic disclosures

ARTICLE 9 - SUSTAINABLE INVESTMENT OBJECTIVE
Q: What distinguishes Article 9 from Article 8?
A: Article 9 products must have sustainable investment as their objective, meaning:
- Investments must contribute to environmental or social objectives
- No significant harm to any environmental/social objective
- Good governance of investee companies

PRINCIPAL ADVERSE IMPACTS (PAI)
Q: What are PAI indicators?
A: Mandatory indicators include:
1. GHG emissions (Scope 1, 2, 3)
2. Carbon footprint
3. GHG intensity of investee companies
4. Exposure to fossil fuels
5. Non-renewable energy consumption
6. Energy consumption intensity
7. Biodiversity impact
8. Water emissions
9. Hazardous waste
10. UN Global Compact violations
11. Gender pay gap
12. Board gender diversity
13. Controversial weapons exposure

TAXONOMY ALIGNMENT
Q: How does SFDR relate to the EU Taxonomy?
A: Article 8 and 9 products must disclose:
- The extent to which investments are Taxonomy-aligned
- Whether sustainable investments contribute to Taxonomy objectives
- "Do no significant harm" assessment aligned with Taxonomy criteria`,
    status: 'scraped',
    lastScraped: now,
  },

  // ============ Reporting ============
  {
    source: 'esma',
    type: 'guideline',
    categories: ['aifmd', 'reporting'],
    title: 'Guidelines on AIFMD reporting obligations',
    shortTitle: 'Annex IV Reporting Guidelines',
    documentNumber: 'ESMA/2014/869',
    publishDate: '2014-08-08',
    language: 'en',
    sourceUrl: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2014-869.pdf',
    summary: 'Riktlinjer för hur AIFM ska fylla i och lämna in Annex IV-rapporter till tillsynsmyndigheter.',
    fullText: `ESMA Guidelines on AIFMD Annex IV Reporting

REPORTING FREQUENCY

Small AIFMs (AUM < EUR 100 million):
- Annual reporting
- Report within 1 month of period end

Large AIFMs (AUM > EUR 100 million):
- Quarterly or semi-annual depending on fund type
- Report within 1 month of period end

REPORT CONTENT

Section 1: General Information
- AIFM identification
- AIF identification
- Reporting period

Section 2: Principal Markets and Instruments
- Top 5 markets traded
- Main instrument types
- Geographical focus

Section 3: Portfolio Concentration
- Top 5 holdings
- Beneficial ownership
- Concentration percentages

Section 4: Investor Information
- Investor breakdown by type
- Geographical distribution
- Redemption rights

Section 5: Liquidity
- Portfolio liquidity profile
- Investor liquidity profile
- Liquidity risk management

Section 6: Risk Profile
- Market risk measures
- Counterparty risk
- Liquidity risk
- Operational risk

Section 7: Leverage
- Gross method calculation
- Commitment method calculation
- Source of leverage
- Derivative exposure

SPECIAL PROVISIONS

Leverage exceeding 3x (commitment method):
- Additional quarterly reporting
- Enhanced risk disclosure

Master-feeder structures:
- Report both at master and feeder level
- Identify relationship in reports

TECHNICAL SPECIFICATIONS
- XML format required
- Validation rules apply
- Submit via national regulator portal`,
    status: 'scraped',
    lastScraped: now,
  },
];

/**
 * Generera ComplianceDocument-objekt med IDs och timestamps
 */
export function generateSeedDocuments(): ComplianceDocument[] {
  return SEED_DOCUMENTS.map(doc => ({
    ...doc,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  }));
}




