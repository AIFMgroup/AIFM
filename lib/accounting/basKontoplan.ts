/**
 * BAS Kontoplan 2025 - Svenska standardkonton för bokföring
 * Källa: BAS-föreningen (bas.se)
 */

export interface BASKonto {
  konto: string;
  namn: string;
  kategori: string;
  grupp: string;
  momsavdrag?: boolean;
  vanligaLeverantorer?: string[];
  nyckelord?: string[];
}

// ============ KONTOKLASS 1: TILLGÅNGAR ============
export const tillgangar: BASKonto[] = [
  // 10 Immateriella anläggningstillgångar
  { konto: '1010', namn: 'Utvecklingsutgifter', kategori: 'Tillgångar', grupp: 'Immateriella' },
  { konto: '1020', namn: 'Patent', kategori: 'Tillgångar', grupp: 'Immateriella' },
  { konto: '1030', namn: 'Licenser', kategori: 'Tillgångar', grupp: 'Immateriella' },
  { konto: '1040', namn: 'Varumärken', kategori: 'Tillgångar', grupp: 'Immateriella' },
  { konto: '1050', namn: 'Goodwill', kategori: 'Tillgångar', grupp: 'Immateriella' },
  
  // 11 Byggnader och mark
  { konto: '1110', namn: 'Byggnader', kategori: 'Tillgångar', grupp: 'Fastigheter' },
  { konto: '1130', namn: 'Mark', kategori: 'Tillgångar', grupp: 'Fastigheter' },
  { konto: '1150', namn: 'Markanläggningar', kategori: 'Tillgångar', grupp: 'Fastigheter' },
  
  // 12 Maskiner och inventarier
  { konto: '1210', namn: 'Maskiner och tekniska anläggningar', kategori: 'Tillgångar', grupp: 'Inventarier' },
  { konto: '1220', namn: 'Inventarier och verktyg', kategori: 'Tillgångar', grupp: 'Inventarier' },
  { konto: '1230', namn: 'Installationer', kategori: 'Tillgångar', grupp: 'Inventarier' },
  { konto: '1240', namn: 'Bilar och transportmedel', kategori: 'Tillgångar', grupp: 'Inventarier' },
  { konto: '1250', namn: 'Datorer', kategori: 'Tillgångar', grupp: 'Inventarier' },
  
  // 13 Finansiella anläggningstillgångar
  { konto: '1310', namn: 'Aktier i koncernföretag', kategori: 'Tillgångar', grupp: 'Finansiella' },
  { konto: '1320', namn: 'Aktier i intresseföretag', kategori: 'Tillgångar', grupp: 'Finansiella' },
  { konto: '1350', namn: 'Andra långfristiga värdepapper', kategori: 'Tillgångar', grupp: 'Finansiella' },
  
  // 14 Lager
  { konto: '1410', namn: 'Lager av råvaror', kategori: 'Tillgångar', grupp: 'Lager' },
  { konto: '1420', namn: 'Lager av halvfabrikat', kategori: 'Tillgångar', grupp: 'Lager' },
  { konto: '1460', namn: 'Lager av handelsvaror', kategori: 'Tillgångar', grupp: 'Lager' },
  
  // 15 Kundfordringar
  { konto: '1510', namn: 'Kundfordringar', kategori: 'Tillgångar', grupp: 'Kundfordringar' },
  { konto: '1519', namn: 'Osäkra kundfordringar', kategori: 'Tillgångar', grupp: 'Kundfordringar' },
  
  // 16 Övriga fordringar
  { konto: '1610', namn: 'Fordringar hos koncernföretag', kategori: 'Tillgångar', grupp: 'Övriga fordringar' },
  { konto: '1650', namn: 'Momsfordran', kategori: 'Tillgångar', grupp: 'Övriga fordringar' },
  
  // 17 Förutbetalda kostnader
  { konto: '1710', namn: 'Förutbetalda hyreskostnader', kategori: 'Tillgångar', grupp: 'Förutbetalda' },
  { konto: '1720', namn: 'Förutbetalda leasingavgifter', kategori: 'Tillgångar', grupp: 'Förutbetalda' },
  { konto: '1730', namn: 'Förutbetalda försäkringspremier', kategori: 'Tillgångar', grupp: 'Förutbetalda' },
  { konto: '1790', namn: 'Övriga förutbetalda kostnader', kategori: 'Tillgångar', grupp: 'Förutbetalda' },
  
  // 19 Kassa och bank
  { konto: '1910', namn: 'Kassa', kategori: 'Tillgångar', grupp: 'Likvida medel' },
  { konto: '1920', namn: 'Plusgiro', kategori: 'Tillgångar', grupp: 'Likvida medel' },
  { konto: '1930', namn: 'Företagskonto', kategori: 'Tillgångar', grupp: 'Likvida medel' },
  { konto: '1940', namn: 'Övriga bankkonton', kategori: 'Tillgångar', grupp: 'Likvida medel' },
];

// ============ KONTOKLASS 2: EGET KAPITAL OCH SKULDER ============
export const egetKapitalOchSkulder: BASKonto[] = [
  // 20 Eget kapital
  { konto: '2010', namn: 'Eget kapital', kategori: 'Eget kapital', grupp: 'Eget kapital' },
  { konto: '2081', namn: 'Aktiekapital', kategori: 'Eget kapital', grupp: 'Bundet eget kapital' },
  { konto: '2091', namn: 'Balanserad vinst/förlust', kategori: 'Eget kapital', grupp: 'Fritt eget kapital' },
  { konto: '2099', namn: 'Årets resultat', kategori: 'Eget kapital', grupp: 'Fritt eget kapital' },
  
  // 23 Långfristiga skulder
  { konto: '2310', namn: 'Obligations- och förlagslån', kategori: 'Skulder', grupp: 'Långfristiga skulder' },
  { konto: '2330', namn: 'Checkräkningskredit', kategori: 'Skulder', grupp: 'Långfristiga skulder' },
  { konto: '2350', namn: 'Banklån', kategori: 'Skulder', grupp: 'Långfristiga skulder' },
  
  // 24 Kortfristiga skulder
  { konto: '2410', namn: 'Kortfristiga lån från kreditinstitut', kategori: 'Skulder', grupp: 'Kortfristiga skulder' },
  { konto: '2440', namn: 'Leverantörsskulder', kategori: 'Skulder', grupp: 'Kortfristiga skulder' },
  
  // 26 Moms och skatteskulder
  { konto: '2610', namn: 'Utgående moms 25%', kategori: 'Skulder', grupp: 'Moms' },
  { konto: '2620', namn: 'Utgående moms 12%', kategori: 'Skulder', grupp: 'Moms' },
  { konto: '2630', namn: 'Utgående moms 6%', kategori: 'Skulder', grupp: 'Moms' },
  { konto: '2640', namn: 'Ingående moms', kategori: 'Skulder', grupp: 'Moms' },
  { konto: '2650', namn: 'Momsredovisning', kategori: 'Skulder', grupp: 'Moms' },
  
  // 27 Personalens skatter
  { konto: '2710', namn: 'Personalskatt', kategori: 'Skulder', grupp: 'Personalskatter' },
  { konto: '2730', namn: 'Sociala avgifter', kategori: 'Skulder', grupp: 'Personalskatter' },
  { konto: '2731', namn: 'Arbetsgivaravgifter', kategori: 'Skulder', grupp: 'Personalskatter' },
  
  // 29 Upplupna kostnader
  { konto: '2910', namn: 'Upplupna löner', kategori: 'Skulder', grupp: 'Upplupna kostnader' },
  { konto: '2920', namn: 'Upplupna semesterlöner', kategori: 'Skulder', grupp: 'Upplupna kostnader' },
  { konto: '2940', namn: 'Upplupna räntekostnader', kategori: 'Skulder', grupp: 'Upplupna kostnader' },
  { konto: '2990', namn: 'Övriga upplupna kostnader', kategori: 'Skulder', grupp: 'Upplupna kostnader' },
];

// ============ KONTOKLASS 3: INTÄKTER ============
export const intakter: BASKonto[] = [
  { konto: '3010', namn: 'Försäljning varor 25% moms', kategori: 'Intäkter', grupp: 'Försäljning' },
  { konto: '3011', namn: 'Försäljning varor 12% moms', kategori: 'Intäkter', grupp: 'Försäljning' },
  { konto: '3012', namn: 'Försäljning varor 6% moms', kategori: 'Intäkter', grupp: 'Försäljning' },
  { konto: '3040', namn: 'Försäljning tjänster 25% moms', kategori: 'Intäkter', grupp: 'Försäljning' },
  { konto: '3050', namn: 'Försäljning tjänster utomlands', kategori: 'Intäkter', grupp: 'Försäljning' },
  { konto: '3540', namn: 'Fakturerade kostnader', kategori: 'Intäkter', grupp: 'Övriga intäkter' },
  { konto: '3590', namn: 'Övriga sidointäkter', kategori: 'Intäkter', grupp: 'Övriga intäkter' },
  { konto: '3740', namn: 'Öres- och kronutjämning', kategori: 'Intäkter', grupp: 'Övriga intäkter' },
  { konto: '3960', namn: 'Valutakursvinster', kategori: 'Intäkter', grupp: 'Övriga intäkter' },
];

// ============ KONTOKLASS 4: VARUINKÖP ============
export const varuinkop: BASKonto[] = [
  { konto: '4010', namn: 'Inköp varor', kategori: 'Varuinköp', grupp: 'Varuinköp', momsavdrag: true, 
    nyckelord: ['varor', 'inköp', 'material', 'lager', 'produkter'] },
  { konto: '4012', namn: 'Inköp varor EU', kategori: 'Varuinköp', grupp: 'Varuinköp' },
  { konto: '4013', namn: 'Inköp varor utanför EU', kategori: 'Varuinköp', grupp: 'Varuinköp' },
  { konto: '4040', namn: 'Inköp varor för eget bruk', kategori: 'Varuinköp', grupp: 'Varuinköp' },
  { konto: '4400', namn: 'Förbrukningsmaterial', kategori: 'Varuinköp', grupp: 'Förbrukning', momsavdrag: true },
  { konto: '4500', namn: 'Övriga varuinköp', kategori: 'Varuinköp', grupp: 'Övriga' },
];

// ============ KONTOKLASS 5: LOKALKOSTNADER ============
export const lokalkostnader: BASKonto[] = [
  { konto: '5010', namn: 'Lokalhyra', kategori: 'Lokalkostnader', grupp: 'Hyra', momsavdrag: true,
    nyckelord: ['hyra', 'lokal', 'kontor', 'fastighet', 'lokalhyra'],
    vanligaLeverantorer: ['Vasakronan', 'Castellum', 'Fabege', 'Atrium Ljungberg', 'Wallenstam'] },
  { konto: '5020', namn: 'Hyra parkeringsplats', kategori: 'Lokalkostnader', grupp: 'Hyra', momsavdrag: true },
  { konto: '5050', namn: 'Lokaltillbehör', kategori: 'Lokalkostnader', grupp: 'Tillbehör' },
  { konto: '5060', namn: 'Städning och renhållning', kategori: 'Lokalkostnader', grupp: 'Drift', momsavdrag: true,
    nyckelord: ['städ', 'rengöring', 'sanitet'] },
  { konto: '5070', namn: 'Reparation och underhåll', kategori: 'Lokalkostnader', grupp: 'Underhåll', momsavdrag: true },
  { konto: '5090', namn: 'Övriga lokalkostnader', kategori: 'Lokalkostnader', grupp: 'Övriga' },
  
  // 51 Fastighetskostnader
  { konto: '5110', namn: 'Tomträttsavgäld/arrende', kategori: 'Lokalkostnader', grupp: 'Fastighet' },
  { konto: '5120', namn: 'El för fastighet', kategori: 'Lokalkostnader', grupp: 'Fastighet', momsavdrag: true,
    nyckelord: ['el', 'elektricitet', 'kraft'],
    vanligaLeverantorer: ['Vattenfall', 'E.ON', 'Fortum', 'Ellevio'] },
  { konto: '5130', namn: 'Värme', kategori: 'Lokalkostnader', grupp: 'Fastighet', momsavdrag: true,
    nyckelord: ['värme', 'fjärrvärme', 'uppvärmning'] },
  { konto: '5140', namn: 'Vatten och avlopp', kategori: 'Lokalkostnader', grupp: 'Fastighet' },
  { konto: '5170', namn: 'Fastighetsskatt', kategori: 'Lokalkostnader', grupp: 'Fastighet' },
];

// ============ KONTOKLASS 5: FÖRBRUKNINGSINVENTARIER OCH FÖRBRUKNINGSMATERIAL ============
export const forbrukningOchMaterial: BASKonto[] = [
  { konto: '5410', namn: 'Förbrukningsinventarier', kategori: 'Förbrukning', grupp: 'Inventarier', momsavdrag: true,
    nyckelord: ['inventarier', 'möbler', 'inredning', 'utrustning'] },
  { konto: '5420', namn: 'Programvaror', kategori: 'Förbrukning', grupp: 'IT', momsavdrag: true,
    nyckelord: ['mjukvara', 'software', 'licens', 'program', 'saas'] },
  { konto: '5460', namn: 'Förbrukningsmaterial', kategori: 'Förbrukning', grupp: 'Material', momsavdrag: true },
  { konto: '5480', namn: 'Arbetskläder och skyddsmaterial', kategori: 'Förbrukning', grupp: 'Kläder' },
];

// ============ KONTOKLASS 5: RESEKOSTNADER ============
export const resekostnader: BASKonto[] = [
  { konto: '5800', namn: 'Resekostnader', kategori: 'Resekostnader', grupp: 'Resor', momsavdrag: true },
  { konto: '5810', namn: 'Biljetter', kategori: 'Resekostnader', grupp: 'Transport', momsavdrag: true,
    nyckelord: ['tåg', 'flyg', 'buss', 'biljett', 'resa', 'transport'],
    vanligaLeverantorer: ['SJ', 'SAS', 'Norwegian', 'Widerøe', 'BRA', 'MTR', 'Flixbus'] },
  { konto: '5820', namn: 'Hyrbil', kategori: 'Resekostnader', grupp: 'Transport', momsavdrag: true,
    nyckelord: ['hyrbil', 'bilhyra'],
    vanligaLeverantorer: ['Hertz', 'Europcar', 'Avis', 'Sixt', 'Budget'] },
  { konto: '5830', namn: 'Kost och logi', kategori: 'Resekostnader', grupp: 'Boende', momsavdrag: true,
    nyckelord: ['hotell', 'logi', 'boende', 'övernattning'],
    vanligaLeverantorer: ['Scandic', 'Nordic Choice', 'Best Western', 'Booking.com', 'Hotels.com'] },
  { konto: '5840', namn: 'Traktamenten', kategori: 'Resekostnader', grupp: 'Traktamenten' },
  { konto: '5890', namn: 'Övriga resekostnader', kategori: 'Resekostnader', grupp: 'Övriga', momsavdrag: true,
    nyckelord: ['taxi', 'uber', 'bolt', 'parkering'] },
];

// ============ KONTOKLASS 5: BILKOSTNADER ============
export const bilkostnader: BASKonto[] = [
  { konto: '5610', namn: 'Personbilskostnader', kategori: 'Bilkostnader', grupp: 'Personbil' },
  { konto: '5611', namn: 'Drivmedel personbil', kategori: 'Bilkostnader', grupp: 'Drivmedel', momsavdrag: true,
    nyckelord: ['bensin', 'diesel', 'drivmedel', 'bränsle', 'tankning'],
    vanligaLeverantorer: ['Circle K', 'Preem', 'OKQ8', 'St1', 'Shell', 'Ingo'] },
  { konto: '5612', namn: 'Försäkring och skatt personbil', kategori: 'Bilkostnader', grupp: 'Försäkring' },
  { konto: '5613', namn: 'Reparation och underhåll personbil', kategori: 'Bilkostnader', grupp: 'Underhåll', momsavdrag: true },
  { konto: '5615', namn: 'Leasing personbil', kategori: 'Bilkostnader', grupp: 'Leasing', momsavdrag: true },
  { konto: '5620', namn: 'Lastbilskostnader', kategori: 'Bilkostnader', grupp: 'Lastbil' },
];

// ============ KONTOKLASS 6: ÖVRIGA EXTERNA KOSTNADER ============
export const ovrigaExternaKostnader: BASKonto[] = [
  // 60 Kontorskostnader
  { konto: '6010', namn: 'Kontorsmateriel', kategori: 'Kontorskostnader', grupp: 'Material', momsavdrag: true,
    nyckelord: ['kontorsmaterial', 'papper', 'pennor', 'pärmar', 'skrivare'],
    vanligaLeverantorer: ['Staples', 'Lyreco', 'Office Depot', 'Procurator'] },
  { konto: '6050', namn: 'Trycksaker', kategori: 'Kontorskostnader', grupp: 'Tryck', momsavdrag: true },
  { konto: '6060', namn: 'Kontorsinventarier', kategori: 'Kontorskostnader', grupp: 'Inventarier', momsavdrag: true },
  { konto: '6070', namn: 'Representation', kategori: 'Kontorskostnader', grupp: 'Representation', momsavdrag: false,
    nyckelord: ['representation', 'middag', 'lunch', 'restaurang', 'kundträff'] },
  
  // 61 Telekommunikation
  { konto: '6200', namn: 'Tele- och datakommunikation', kategori: 'Telekommunikation', grupp: 'Tele', momsavdrag: true },
  { konto: '6211', namn: 'Fast telefoni', kategori: 'Telekommunikation', grupp: 'Telefon', momsavdrag: true,
    vanligaLeverantorer: ['Telia', 'Telenor', 'Tele2', 'Tre'] },
  { konto: '6212', namn: 'Mobiltelefon', kategori: 'Telekommunikation', grupp: 'Telefon', momsavdrag: true,
    nyckelord: ['mobil', 'telefon', 'mobilabonnemang'],
    vanligaLeverantorer: ['Telia', 'Telenor', 'Tele2', 'Tre', 'Hallon', 'Comviq'] },
  { konto: '6214', namn: 'Internet', kategori: 'Telekommunikation', grupp: 'Internet', momsavdrag: true,
    nyckelord: ['internet', 'bredband', 'fiber'],
    vanligaLeverantorer: ['Telia', 'Telenor', 'Bahnhof', 'A3'] },
  { konto: '6230', namn: 'Datakommunikation', kategori: 'Telekommunikation', grupp: 'Data', momsavdrag: true },
  
  // 63 Försäkringar
  { konto: '6300', namn: 'Företagsförsäkringar', kategori: 'Försäkringar', grupp: 'Försäkring',
    nyckelord: ['försäkring', 'skadeförsäkring'],
    vanligaLeverantorer: ['If', 'Trygg-Hansa', 'Länsförsäkringar', 'Folksam', 'Zurich'] },
  { konto: '6310', namn: 'Ansvarsförsäkring', kategori: 'Försäkringar', grupp: 'Försäkring' },
  { konto: '6320', namn: 'Inkomstförsäkring', kategori: 'Försäkringar', grupp: 'Försäkring' },
  { konto: '6380', namn: 'Övriga försäkringar', kategori: 'Försäkringar', grupp: 'Försäkring' },
  
  // 64 Förvaltningskostnader
  { konto: '6400', namn: 'Förvaltningskostnader', kategori: 'Förvaltning', grupp: 'Förvaltning' },
  { konto: '6410', namn: 'Styrelsearvoden', kategori: 'Förvaltning', grupp: 'Arvoden' },
  { konto: '6420', namn: 'Ersättningar till revisor', kategori: 'Förvaltning', grupp: 'Revision', momsavdrag: true,
    nyckelord: ['revision', 'revisor', 'granskning'],
    vanligaLeverantorer: ['PwC', 'KPMG', 'EY', 'Deloitte', 'Grant Thornton', 'BDO', 'Mazars'] },
  
  // 65 Köpta tjänster
  { konto: '6500', namn: 'Övriga externa tjänster', kategori: 'Köpta tjänster', grupp: 'Tjänster', momsavdrag: true },
  { konto: '6530', namn: 'Redovisningstjänster', kategori: 'Köpta tjänster', grupp: 'Redovisning', momsavdrag: true,
    nyckelord: ['redovisning', 'bokföring', 'bokföringstjänst'],
    vanligaLeverantorer: ['KPMG', 'PwC', 'Grant Thornton', 'Accountor', 'Aspia'] },
  { konto: '6540', namn: 'IT-tjänster', kategori: 'Köpta tjänster', grupp: 'IT', momsavdrag: true,
    nyckelord: ['it', 'datortjänster', 'support', 'drift', 'hosting', 'molntjänster', 'saas'],
    vanligaLeverantorer: ['AWS', 'Microsoft', 'Google', 'Telia', 'Atea', 'Dustin'] },
  { konto: '6550', namn: 'Konsultarvoden', kategori: 'Köpta tjänster', grupp: 'Konsult', momsavdrag: true,
    nyckelord: ['konsult', 'rådgivning', 'arvode', 'tjänster', 'uppdrag'] },
  { konto: '6560', namn: 'Serviceavgifter', kategori: 'Köpta tjänster', grupp: 'Service', momsavdrag: true },
  { konto: '6570', namn: 'Banktjänster', kategori: 'Köpta tjänster', grupp: 'Bank',
    nyckelord: ['bank', 'avgift', 'bankavgift', 'kontoavgift'],
    vanligaLeverantorer: ['SEB', 'Handelsbanken', 'Nordea', 'Swedbank', 'Danske Bank'] },
  { konto: '6580', namn: 'Advokat- och rättegångskostnader', kategori: 'Köpta tjänster', grupp: 'Juridik', momsavdrag: true,
    nyckelord: ['advokat', 'juridik', 'juridisk', 'rättegång'] },
  { konto: '6590', namn: 'Övriga externa tjänster', kategori: 'Köpta tjänster', grupp: 'Övriga', momsavdrag: true },
  
  // 68 Inhyrd personal
  { konto: '6800', namn: 'Inhyrd personal', kategori: 'Inhyrd personal', grupp: 'Personal', momsavdrag: true,
    nyckelord: ['bemanning', 'inhyrd', 'konsult', 'uthyrd'] },
  
  // 69 Övriga externa kostnader
  { konto: '6970', namn: 'Tidningar och tidskrifter', kategori: 'Övriga externa', grupp: 'Media', momsavdrag: true },
  { konto: '6980', namn: 'Föreningsavgifter', kategori: 'Övriga externa', grupp: 'Medlemskap' },
  { konto: '6990', namn: 'Övriga externa kostnader', kategori: 'Övriga externa', grupp: 'Övriga', momsavdrag: true },
];

// ============ KONTOKLASS 7: PERSONALKOSTNADER ============
export const personalkostnader: BASKonto[] = [
  // 70 Löner
  { konto: '7010', namn: 'Löner till kollektivanställda', kategori: 'Personalkostnader', grupp: 'Löner' },
  { konto: '7011', namn: 'Löner till tjänstemän', kategori: 'Personalkostnader', grupp: 'Löner' },
  { konto: '7012', namn: 'Löner till företagsledare', kategori: 'Personalkostnader', grupp: 'Löner' },
  { konto: '7082', namn: 'Semesterlöner', kategori: 'Personalkostnader', grupp: 'Löner' },
  { konto: '7090', namn: 'Förändring semesterlöneskuld', kategori: 'Personalkostnader', grupp: 'Löner' },
  
  // 73 Kostnadsersättningar
  { konto: '7310', namn: 'Traktamenten', kategori: 'Personalkostnader', grupp: 'Ersättningar' },
  { konto: '7320', namn: 'Bilersättningar', kategori: 'Personalkostnader', grupp: 'Ersättningar' },
  { konto: '7330', namn: 'Övriga kostnadsersättningar', kategori: 'Personalkostnader', grupp: 'Ersättningar' },
  
  // 74 Pensionskostnader
  { konto: '7410', namn: 'Pensionsförsäkringspremier', kategori: 'Personalkostnader', grupp: 'Pension' },
  { konto: '7420', namn: 'Arbetsmarknadsförsäkringar', kategori: 'Personalkostnader', grupp: 'Försäkringar' },
  
  // 75 Sociala avgifter
  { konto: '7510', namn: 'Arbetsgivaravgifter', kategori: 'Personalkostnader', grupp: 'Sociala avgifter' },
  { konto: '7519', namn: 'Sociala avgifter för semester', kategori: 'Personalkostnader', grupp: 'Sociala avgifter' },
  { konto: '7530', namn: 'Särskild löneskatt', kategori: 'Personalkostnader', grupp: 'Sociala avgifter' },
  
  // 76 Övriga personalkostnader
  { konto: '7610', namn: 'Utbildning', kategori: 'Personalkostnader', grupp: 'Utbildning', momsavdrag: true,
    nyckelord: ['utbildning', 'kurs', 'konferens', 'seminarium'] },
  { konto: '7620', namn: 'Sjuk- och hälsovård', kategori: 'Personalkostnader', grupp: 'Hälsa', momsavdrag: true },
  { konto: '7631', namn: 'Personalrepresentation, avdragsgill', kategori: 'Personalkostnader', grupp: 'Representation' },
  { konto: '7650', namn: 'Sjuklön', kategori: 'Personalkostnader', grupp: 'Sjuklön' },
  { konto: '7690', namn: 'Övriga personalkostnader', kategori: 'Personalkostnader', grupp: 'Övriga' },
];

// ============ KONTOKLASS 8: FINANSIELLA POSTER ============
export const finansiellaPoster: BASKonto[] = [
  // 80 Resultat från andelar
  { konto: '8010', namn: 'Utdelning på aktier i dotterföretag', kategori: 'Finansiella intäkter', grupp: 'Utdelningar' },
  { konto: '8020', namn: 'Resultat från andelar i koncernföretag', kategori: 'Finansiella intäkter', grupp: 'Koncern' },
  { konto: '8030', namn: 'Resultat från andelar i intresseföretag', kategori: 'Finansiella intäkter', grupp: 'Intressebolag' },
  
  // 83 Ränteintäkter
  { konto: '8310', namn: 'Ränteintäkter från koncernföretag', kategori: 'Finansiella intäkter', grupp: 'Ränteintäkter' },
  { konto: '8314', namn: 'Skattefria ränteintäkter', kategori: 'Finansiella intäkter', grupp: 'Ränteintäkter' },
  { konto: '8380', namn: 'Övriga ränteintäkter', kategori: 'Finansiella intäkter', grupp: 'Ränteintäkter' },
  
  // 84 Räntekostnader
  { konto: '8410', namn: 'Räntekostnader till koncernföretag', kategori: 'Finansiella kostnader', grupp: 'Räntekostnader' },
  { konto: '8420', namn: 'Räntekostnader för långfristiga skulder', kategori: 'Finansiella kostnader', grupp: 'Räntekostnader' },
  { konto: '8480', namn: 'Övriga räntekostnader', kategori: 'Finansiella kostnader', grupp: 'Räntekostnader' },
  
  // 89 Skatter
  { konto: '8910', namn: 'Skatt på årets resultat', kategori: 'Skatter', grupp: 'Inkomstskatt' },
  { konto: '8999', namn: 'Årets resultat', kategori: 'Resultat', grupp: 'Årets resultat' },
];

// ============ MARKNADSFÖRING (tillägg för klarhet) ============
export const marknadsforing: BASKonto[] = [
  { konto: '5900', namn: 'Reklam och PR', kategori: 'Marknadsföring', grupp: 'Reklam', momsavdrag: true,
    nyckelord: ['reklam', 'annons', 'marknadsföring', 'pr', 'kampanj'] },
  { konto: '5910', namn: 'Annonsering', kategori: 'Marknadsföring', grupp: 'Annons', momsavdrag: true,
    nyckelord: ['annons', 'google ads', 'facebook ads', 'linkedin ads'],
    vanligaLeverantorer: ['Google', 'Meta', 'LinkedIn', 'Schibsted'] },
  { konto: '5930', namn: 'Sponsring', kategori: 'Marknadsföring', grupp: 'Sponsring' },
  { konto: '5940', namn: 'Mässor och utställningar', kategori: 'Marknadsföring', grupp: 'Mässa', momsavdrag: true },
];

// ============ KOMPLETT KONTOPLAN ============
export const allaKonton: BASKonto[] = [
  ...tillgangar,
  ...egetKapitalOchSkulder,
  ...intakter,
  ...varuinkop,
  ...lokalkostnader,
  ...forbrukningOchMaterial,
  ...resekostnader,
  ...bilkostnader,
  ...ovrigaExternaKostnader,
  ...personalkostnader,
  ...finansiellaPoster,
  ...marknadsforing,
];

// ============ VANLIGA KOSTNADSKONTON (för dropdown) ============
export const vanligaKostnadskonton: BASKonto[] = [
  ...varuinkop.filter(k => ['4010', '4400'].includes(k.konto)),
  ...lokalkostnader.filter(k => ['5010', '5060', '5120', '5130'].includes(k.konto)),
  ...forbrukningOchMaterial.filter(k => ['5410', '5420'].includes(k.konto)),
  ...resekostnader.filter(k => ['5810', '5820', '5830', '5890'].includes(k.konto)),
  ...bilkostnader.filter(k => ['5611', '5615'].includes(k.konto)),
  ...ovrigaExternaKostnader.filter(k => ['6010', '6070', '6212', '6214', '6300', '6420', '6530', '6540', '6550', '6570', '6580'].includes(k.konto)),
  ...personalkostnader.filter(k => ['7010', '7011', '7510', '7610'].includes(k.konto)),
  ...marknadsforing.filter(k => ['5900', '5910'].includes(k.konto)),
].sort((a, b) => a.konto.localeCompare(b.konto));

// ============ SÖKFUNKTION ============
export function sokKonto(query: string): BASKonto[] {
  const q = query.toLowerCase();
  return allaKonton.filter(k => 
    k.konto.includes(q) ||
    k.namn.toLowerCase().includes(q) ||
    k.kategori.toLowerCase().includes(q) ||
    k.nyckelord?.some(n => n.includes(q)) ||
    k.vanligaLeverantorer?.some(l => l.toLowerCase().includes(q))
  );
}

// ============ HITTA BÄSTA KONTO ============
export function hittaBastaKonto(text: string, leverantor?: string): BASKonto | null {
  const searchText = `${text} ${leverantor || ''}`.toLowerCase();
  
  // Först: sök på leverantörer
  if (leverantor) {
    const matchByVendor = allaKonton.find(k => 
      k.vanligaLeverantorer?.some(v => leverantor.toLowerCase().includes(v.toLowerCase()))
    );
    if (matchByVendor) return matchByVendor;
  }
  
  // Sen: sök på nyckelord
  const matchByKeyword = allaKonton.find(k =>
    k.nyckelord?.some(n => searchText.includes(n))
  );
  if (matchByKeyword) return matchByKeyword;
  
  // Fallback: konsultarvoden
  return allaKonton.find(k => k.konto === '6550') || null;
}

// ============ HITTA KONTO PÅ NUMMER ============
export function findKontoByNummer(kontoNummer: string): BASKonto | null {
  return allaKonton.find(k => k.konto === kontoNummer) || null;
}

// ============ EXPORTERA FÖR FRONTEND ============
export function getKontoOptions() {
  const groups: Record<string, { value: string; label: string }[]> = {};
  
  vanligaKostnadskonton.forEach(k => {
    if (!groups[k.kategori]) {
      groups[k.kategori] = [];
    }
    groups[k.kategori].push({
      value: k.konto,
      label: `${k.konto} – ${k.namn}`,
    });
  });
  
  return Object.entries(groups).map(([category, options]) => ({
    category,
    options,
  }));
}






