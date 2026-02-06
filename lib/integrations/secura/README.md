# ISEC SECURA Integration

Integration med ISEC SECURA Platform REST API för automatiserad NAV-beräkning.

## Översikt

Denna integration möjliggör:
- Hämta fonddata (positioner, kassor, transaktioner)
- Hämta NAV-data från SECURA
- Hämta andelsägare och order
- Beräkna NAV lokalt och jämföra med SECURA

## Konfiguration

### Miljövariabler

Lägg till följande i `.env.local`:

```bash
# SECURA API Configuration
SECURA_HOST=194.62.154.68
SECURA_PORT=20023
SECURA_USERNAME=RESTAPI_AIFM
SECURA_PASSWORD=your-password-here
SECURA_TIMEOUT=30000
SECURA_RETRY_ATTEMPTS=3
```

### Programmatisk konfiguration

```typescript
import { createSecuraClient, SecuraConfig } from '@/lib/integrations/secura';

const config: SecuraConfig = {
  host: '194.62.154.68',
  port: 20023,
  username: 'RESTAPI_AIFM',
  password: 'your-password',
  timeout: 30000,
  retryAttempts: 3,
};

const client = createSecuraClient(config);
```

## Användning

### Grundläggande exempel

```typescript
import { getSecuraClientFromEnv } from '@/lib/integrations/secura';

// Skapa klient från miljövariabler
const client = getSecuraClientFromEnv();

// Testa anslutning
const status = await client.testConnection();
console.log('Connected:', status.connected);

// Hämta alla fonder
const funds = await client.getFunds();

// Hämta positioner för en fond
const positions = await client.getPositions('FUND123');

// Hämta kassor
const cash = await client.getCashBalances('FUND123');

// Hämta aktuellt NAV
const nav = await client.getNAV('FUND123', 'SC001');
```

### NAV-beräkning

```typescript
import { createNAVService } from '@/lib/nav-engine';
import { createSecuraClient } from '@/lib/integrations/secura';

// Skapa SECURA-klient
const securaClient = createSecuraClient(config);

// Skapa NAV-service
const navService = createNAVService(securaClient);

// Beräkna NAV för en fond/andelsklass
const result = await navService.calculateNAV(
  'FUND123',
  'SC001',
  '2026-02-04'
);

console.log('NAV per andel:', result.navPerShare);
console.log('Fondförmögenhet:', result.netAssetValue);
console.log('Status:', result.status);

// Kör daglig NAV-beräkning för alla fonder
const dailyRun = await navService.runDailyNAV('2026-02-04');
console.log('Completed:', dailyRun.completedFunds);
console.log('Failed:', dailyRun.failedFunds);
```

### Verifiera mot SECURA

```typescript
// Jämför beräknat NAV med SECURA
const comparison = await navService.verifyNAV(
  'FUND123',
  'SC001',
  '2026-02-04',
  0.01 // 0.01% tolerans
);

if (comparison.difference?.withinTolerance) {
  console.log('NAV matchar SECURA');
} else {
  console.log('Avvikelse:', comparison.difference?.navPerSharePercent, '%');
}
```

## API Endpoints

### SECURA REST API Endpoints

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/auth/token` | POST | Autentisering |
| `/funds` | GET | Lista alla fonder |
| `/funds/{id}` | GET | Hämta specifik fond |
| `/funds/{id}/positions` | GET | Hämta positioner |
| `/funds/{id}/cash` | GET | Hämta kassor |
| `/funds/{id}/nav` | GET | Hämta aktuellt NAV |
| `/funds/{id}/transactions` | GET | Hämta transaktioner |
| `/funds/{id}/shareholders` | GET | Hämta andelsägare |
| `/funds/{id}/orders` | GET | Hämta order |
| `/prices` | POST | Hämta prisdata |
| `/fx-rates` | GET | Hämta valutakurser |

### Lokala API Endpoints

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/api/nav/calculate` | POST | Beräkna NAV för en fond |
| `/api/nav/calculate?date=YYYY-MM-DD` | GET | Kör daglig NAV |

## NAV-beräkningslogik

### Formel

```
NAV = Bruttotillgångar - Skulder

NAV per andel = NAV / Utestående andelar
```

### Bruttotillgångar

- Värdepappersinnehav (aktier, obligationer, fonder, derivat)
- Kassor och bankmedel
- Fordringar (utdelningar, räntor, etc.)
- Periodiserade intäkter

### Skulder

- Förvaltningsavgift (periodiserad)
- Resultatbaserad avgift (om tillämplig)
- Förvaringsinstitutets avgift
- Administrationsavgift
- Revisionsarvode
- Väntande inlösen
- Övriga skulder

### Periodiseringar

Avgifter periodiseras dagligen enligt:

```
Daglig avgift = (AUM × Årlig avgift) / 365
```

## Felhantering

```typescript
import { SecuraApiError } from '@/lib/integrations/secura';

try {
  const positions = await client.getPositions('FUND123');
} catch (error) {
  if (error instanceof SecuraApiError) {
    console.error('SECURA API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Response:', error.responseBody);
  }
}
```

## Validering

NAV-beräkningen inkluderar automatisk validering:

- **Errors**: Negativ NAV, ogiltiga andelar
- **Warnings**: Saknade priser, föråldrade priser, NAV-avvikelse från SECURA

```typescript
if (result.status === 'ERRORS') {
  console.error('Validation errors:', result.validationErrors);
} else if (result.status === 'WARNINGS') {
  console.warn('Warnings:', result.warnings);
}
```

## Nästa steg

1. **Produktionsinstallation**
   - Konfigurera SECURA API-uppgifter
   - Testa anslutning
   - Verifiera dataflöde

2. **Schemaläggning**
   - Konfigurera daglig NAV-körning (cron)
   - Sätt upp godkännandeflöde

3. **Integrationer**
   - Valutakurser (ECB/Riksbanken)
   - Bankavstämning
   - Rapportgenerering
