/**
 * KYC-checklista – frågebatteri för AI-analys av kunddokument (årsredovisning, UBO, bolagsregistreringsbevis).
 * Mappas till checklist-items: c1–c7 och edd.
 */

export interface KycPromptQuestion {
  id: string;
  number: string;
  text: string;
  /** Vad AI ska leta efter i dokumentet */
  extractHint?: string;
}

/** KYC-checklistpunkter i samma ordning som i NewKycModal (DEFAULT_CHECKLIST). */
export const KYC_CHECKLIST_IDS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'edd'] as const;

/** Frågor formaterade för AI-prompt (id, number, text + extractHint för kontext). */
export function getKycQuestionsForPrompt(): KycPromptQuestion[] {
  return [
    {
      id: 'c1',
      number: '1',
      text: 'Verklig huvudman identifierad',
      extractHint: 'Ägarstruktur, aktieägare >25%, UBO, styrelsemedlemmar, ägandeförhållanden',
    },
    {
      id: 'c2',
      number: '2',
      text: 'ID-verifiering',
      extractHint: 'Personuppgifter, ID-nummer, pass, verifieringsdatum, verifieringsmetod',
    },
    {
      id: 'c3',
      number: '3',
      text: 'Adressverifiering',
      extractHint: 'Registrerad adress, säte, postadress, verifieringsbevis',
    },
    {
      id: 'c4',
      number: '4',
      text: 'PEP-kontroll (Politiskt exponerad person)',
      extractHint: 'Politiska kopplingar, styrelseledamöter med offentliga uppdrag, familjemedlemmar i politik',
    },
    {
      id: 'c5',
      number: '5',
      text: 'Sanktionslistekontroll',
      extractHint: 'Internationella kopplingar, högriskländer, sanktionslistor, watchlist-resultat',
    },
    {
      id: 'c6',
      number: '6',
      text: 'Verksamhetsbeskrivning',
      extractHint: 'Bolagsändamål, bransch, verksamhetsområde, omsättning, anställda',
    },
    {
      id: 'c7',
      number: '7',
      text: 'Kapitalets ursprung verifierat',
      extractHint: 'Finansiering, investerare, intäktskällor, kapitaltillskott',
    },
    {
      id: 'edd',
      number: '8',
      text: 'Förstärkt kundkännedom (EDD)',
      extractHint: 'Källan till förmögenhet, transaktionsmönster, förstärkt övervakning',
    },
  ];
}

/** Alla KYC-fråge-ID:n i ordning (för API-svar och state). */
export function getOrderedKycQuestionIds(): string[] {
  return getKycQuestionsForPrompt().map((q) => q.id);
}
