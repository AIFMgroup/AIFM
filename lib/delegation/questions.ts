/**
 * Delegationsövervakning för portföljförvaltning – frågebatteri från
 * Delegationsovervakning_Portfoljforvaltning_2025.docx
 */

export interface DelegationQuestion {
  id: string;
  number: string;
  text: string;
  type: 'text' | 'yesno' | 'yesno_with_detail';
  subQuestions?: DelegationQuestion[];
}

export interface DelegationSection {
  id: string;
  title: string;
  questions: DelegationQuestion[];
}

/** Checklist item for "Begäran om underlag" */
export interface UnderlagItem {
  id: string;
  label: string;
}

/** All sections and questions for the delegation monitoring form */
export const DELEGATION_SECTIONS: DelegationSection[] = [
  {
    id: 'ekonomisk',
    title: 'Ekonomisk ställning, organisation och ägarstruktur',
    questions: [
      {
        id: 'q1',
        number: '1',
        text: 'Har ni erhållit betalningsanmärkningar under den senaste 12-månadersperioden?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q2',
        number: '2',
        text: 'Beskriv er nuvarande ägarstruktur samt ange verklig huvudman? Ange även eventuella ägarförändringar de senaste 12 månaderna?',
        type: 'text',
      },
      {
        id: 'q3',
        number: '3',
        text: 'Beskriv er nuvarande organisationsstruktur samt eventuella förändringar senaste 12 månaderna (inklusive ny VD, affärsområdeschef eller externrevisor alternativt ny organisationsstruktur)?',
        type: 'text',
      },
      {
        id: 'q4',
        number: '4',
        text: 'Ange övriga relevanta verksamhetsförändringar under de senaste 12 månaderna.',
        type: 'text',
      },
      {
        id: 'q5',
        number: '5',
        text: 'Ange eventuella samarbetspartners eller utlagd verksamhet som är relevant för uppdraget samt eventuella ändringar som skett under perioden.',
        type: 'text',
      },
      {
        id: 'q6',
        number: '6',
        text: 'Intyga att ni inte har vidaredelegerat uppgifter och funktioner avseende den delegerade verksamheten utan vårt samtycke.',
        type: 'yesno_with_detail',
      },
      {
        id: 'q7',
        number: '7',
        text: 'Har ni någon certifiering (kvalitetssäkring, miljö, informationssäkerhet osv)? Om inte, har ni planer på att certifiera er, inom vilket område och när?',
        type: 'text',
      },
      {
        id: 'q8',
        number: '8',
        text: 'Har ni interna regler och riktlinjer för:',
        type: 'yesno_with_detail',
        subQuestions: [
          {
            id: 'q8a',
            number: '8a',
            text: 'Åtgärder mot penningtvätt och finansiering av terrorism?',
            type: 'yesno_with_detail',
          },
          {
            id: 'q8b',
            number: '8b',
            text: 'Åtgärder mot mutor?',
            type: 'yesno_with_detail',
          },
          {
            id: 'q8c',
            number: '8c',
            text: 'Etiskt handlande?',
            type: 'yesno_with_detail',
          },
        ],
      },
      {
        id: 'q8_followup',
        number: '8 (uppföljning)',
        text: 'Ange vilka styrdokument som är fastställda av styrelsen samt datum för fastställelse hänförligt till a, b samt c ovan.',
        type: 'text',
      },
    ],
  },
  {
    id: 'personal',
    title: 'Personal och bemanning',
    questions: [
      {
        id: 'q9',
        number: '9',
        text: 'Vem ansvarar för uppdraget?',
        type: 'text',
      },
      {
        id: 'q10',
        number: '10',
        text: 'Vilka andra genomför uppgifter inom ramen för uppdraget?',
        type: 'text',
      },
      {
        id: 'q11',
        number: '11',
        text: 'Har någon slutat att arbeta med uppdraget under året?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q12',
        number: '12',
        text: 'Har det tillkommit nyanställda hos uppdragstagaren som ska arbeta i uppdraget? Om ja, bifoga CV.',
        type: 'yesno_with_detail',
      },
      {
        id: 'q12a',
        number: '12a',
        text: 'Beskriv portföljförvaltarnas erfarenhet av komplexa finansiella instrument i de fall det är relevant i förhållande till fondens placeringsmandat?',
        type: 'text',
      },
      {
        id: 'q12b',
        number: '12b',
        text: 'Beskriv portföljförvaltarnas erfarenhet av beslut rörande corporate actions samt andra portföljpåverkande åtgärder i de fall det är relevant?',
        type: 'text',
      },
      {
        id: 'q13',
        number: '13',
        text: 'Hur säkerställer ni att ni har erforderlig, kompetent personal för uppdraget?',
        type: 'text',
      },
      {
        id: 'q14',
        number: '14',
        text: 'Hur har uppdraget och dess leveranser kvalitetssäkrats?',
        type: 'text',
      },
      {
        id: 'q15',
        number: '15',
        text: 'Hur hanterar ni sjukdom, semester och annan typ av frånvaro av personal?',
        type: 'text',
      },
      {
        id: 'q16',
        number: '16',
        text: 'Finns beredskap hos uppdragstagaren om personer som arbetar i uppdraget säger upp sig?',
        type: 'yesno_with_detail',
      },
    ],
  },
  {
    id: 'incidenter',
    title: 'Incidenter, väsentliga händelser och intressekonflikter',
    questions: [
      {
        id: 'q16_incident',
        number: '16',
        text: 'Har det inträffat några för uppdraget relevanta incidenter eller andra avvikelser under perioden? Om ja:',
        type: 'yesno_with_detail',
        subQuestions: [
          {
            id: 'q16a',
            number: '16a',
            text: 'Har den rapporterats till AIFM?',
            type: 'yesno_with_detail',
          },
          {
            id: 'q16b',
            number: '16b',
            text: 'Hur har incidenten hanterats och vilka åtgärder har vidtagits för att säkerställa att liknande incident inte inträffar igen?',
            type: 'text',
          },
        ],
      },
      {
        id: 'q17',
        number: '17',
        text: 'Har det inträffat några händelser av väsentlig betydelse under året som påverkar AIFM (t.ex. som väsentligt kan påverka er förmåga att effektivt utöva de delegerade funktionerna)?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q18',
        number: '18',
        text: 'Har det identifierats några intressekonflikter under året?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q19',
        number: '19',
        text: 'Utför ni någon annan verksamhet som påverkar eller riskerar att påverka utförandet av uppdraget eller som innebär eller riskerar att innebära ekonomiska incitament eller dylikt som innefattar intressekonflikter?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q20',
        number: '20',
        text: 'Hur följer ni upp anställdas ekonomiska intressen och risken för att dessa påverkar uppdragets utförande?',
        type: 'text',
      },
    ],
  },
  {
    id: 'legala',
    title: 'Legala aspekter',
    questions: [
      {
        id: 'q22',
        number: '22',
        text: 'Har ni under perioden blivit föremål för någon rättslig åtgärd, administrativ påföljd eller sanktion?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q23',
        number: '23',
        text: 'Befinner ni er för närvarande i legal tvist?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q24',
        number: '24',
        text: 'Hur ser ni till att konfidentiell information inte sprids till obehöriga?',
        type: 'text',
      },
      {
        id: 'q25',
        number: '25',
        text: 'Har anställda och ev. uppdragstagare skrivit under sekretessförbindelser?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q26',
        number: '26',
        text: 'Kan ni uppvisa era anställdas egna affärer om så efterfrågas?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q27',
        number: '27',
        text: 'Är den verksamhet som regleras genom uppdragsavtalet av sådan karaktär att tillstånd från myndighet erfordras? Om ja, innehar ni erforderliga tillstånd?',
        type: 'yesno_with_detail',
      },
    ],
  },
  {
    id: 'it',
    title: 'IT, systemstöd, säkerhet, kontinuitet och beredskap',
    questions: [
      {
        id: 'q28',
        number: '28',
        text: 'Vilka rutiner finns för att säkerställa informationssäkerhet?',
        type: 'text',
      },
      {
        id: 'q29',
        number: '29',
        text: 'Hur skyddar ni er mot dataintrång ("hackerattacker") och annan form av cyberkriminalitet?',
        type: 'text',
      },
      {
        id: 'q30',
        number: '30',
        text: 'Har ni varit utsatta för cyberkriminalitet under det senaste året?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q31',
        number: '31',
        text: 'Hur hanterar ni externa IT–leverantörer som inte uppfyller sina åtaganden (problem med Internet, prisinformationsleverantörer m.m.)?',
        type: 'text',
      },
      {
        id: 'q32',
        number: '32',
        text: 'Har ni en beredskapsplan? Om ja, hur ofta uppdateras beredskapsplanen?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q33',
        number: '33',
        text: 'Vilka IT-system använder ni?',
        type: 'text',
      },
      {
        id: 'q34',
        number: '34',
        text: 'Finns systemstöd för att utföra uppdraget på ett effektivt sätt och för att minimera operationella risker?',
        type: 'yesno_with_detail',
      },
      {
        id: 'q35',
        number: '35',
        text: 'Hur lagras data som är av relevans för uppdraget?',
        type: 'text',
      },
      {
        id: 'q36',
        number: '36',
        text: 'Beskriv era backuprutiner för:',
        type: 'text',
        subQuestions: [
          {
            id: 'q36a',
            number: '36a',
            text: 'Stöld eller annan fysisk skada på främst IT-utrustning, men också annan egendom för uppdraget.',
            type: 'text',
          },
          {
            id: 'q36b',
            number: '36b',
            text: 'Fel i programvaror.',
            type: 'text',
          },
          {
            id: 'q36c',
            number: '36c',
            text: 'Andra tekniska fel.',
            type: 'text',
          },
        ],
      },
      {
        id: 'q37',
        number: '37',
        text: 'Hur ofta testas ert system för säkerhetskopiering?',
        type: 'text',
      },
    ],
  },
  {
    id: 'esg',
    title: 'ESG',
    questions: [
      {
        id: 'q38',
        number: '38',
        text: 'Hur indentifieras hållbarhetsrisker?',
        type: 'text',
      },
      {
        id: 'q39',
        number: '39',
        text: 'Vilka datakällor används för ESG-analys',
        type: 'text',
      },
      {
        id: 'q40',
        number: '40',
        text: 'Har eventuella exkluderingskriterier följts upp och vad var utfallet?',
        type: 'text',
      },
      {
        id: 'q41',
        number: '41',
        text: 'Vilka miljörelaterade eller sociala egenskaper har främjats?',
        type: 'text',
      },
      {
        id: 'q42',
        number: '42',
        text: 'Vilka hållbarhetsindikatorer har följts upp och vad var utfallet?',
        type: 'text',
      },
      {
        id: 'q43',
        number: '43',
        text: 'Hur stor andel av fonden främjar miljöreleaterade eller sociala egenskaper?',
        type: 'text',
      },
      {
        id: 'q44',
        number: '44',
        text: 'Hur hanteras hållbarhetsrisker?',
        type: 'text',
      },
    ],
  },
];

/** Begäran om underlag – checklist of documents to submit */
export const UNDERLAG_ITEMS: UnderlagItem[] = [
  { id: 'underlag_1', label: 'Beredskapsplan samt kontinuitet/återhämtningsplan' },
  { id: 'underlag_2', label: 'Senaste rapporten från intern revisor samt regelefterlevnads- och riskfunktionen' },
  { id: 'underlag_3', label: 'Hållbarhetspolicy' },
  { id: 'underlag_4', label: 'Den senaste reviderade årsredovisningen' },
  { id: 'underlag_5', label: 'Registreringsbevis (ej äldre än tre månader)' },
  { id: 'underlag_6', label: 'Policy/instruktion för hantering av anställdas egna affärer' },
  { id: 'underlag_7', label: 'Intressekonfliktsregister samt policy/instruktion för hantering av intressekonflikter' },
  { id: 'underlag_8', label: 'Policy/instruktion för incidenthantering' },
];

/** Flatten all question IDs for API/answer mapping */
export function getAllQuestionIds(): string[] {
  return getOrderedQuestionIds();
}

/** Collect all question IDs in order (including sub-questions and follow-ups) */
export function getOrderedQuestionIds(): string[] {
  const ids: string[] = [];
  function collect(q: DelegationQuestion) {
    ids.push(q.id);
    q.subQuestions?.forEach(collect);
  }
  DELEGATION_SECTIONS.forEach((s) => {
    s.questions.forEach(collect);
  });
  return ids;
}

/** List of { id, number, text } for all questions (for AI prompt) */
export function getQuestionsForPrompt(): { id: string; number: string; text: string }[] {
  const out: { id: string; number: string; text: string }[] = [];
  function collect(q: DelegationQuestion) {
    out.push({ id: q.id, number: q.number, text: q.text });
    q.subQuestions?.forEach(collect);
  }
  DELEGATION_SECTIONS.forEach((s) => s.questions.forEach((q) => collect(q)));
  return out;
}
