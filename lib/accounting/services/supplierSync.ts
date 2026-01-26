/**
 * Supplier Sync Service
 * 
 * Synkroniserar leverantörer mellan AIFM och Fortnox.
 * Skapar automatiskt leverantörer vid behov.
 */

import { FortnoxClient } from '@/lib/fortnox/client';
import { getSupplierProfile, findSimilarSupplier, SupplierProfile } from './supplierMemory';

export interface FortnoxSupplier {
  SupplierNumber: string;
  Name: string;
  OrganisationNumber?: string;
  Address1?: string;
  Address2?: string;
  ZipCode?: string;
  City?: string;
  Country?: string;
  Phone?: string;
  Email?: string;
  WWW?: string;
  BankAccountNumber?: string;
  BG?: string;
  PG?: string;
  Currency?: string;
  VATNumber?: string;
  PaymentTerms?: string;
}

export interface SupplierMatchResult {
  found: boolean;
  supplierNumber?: string;
  supplierName?: string;
  matchType: 'exact' | 'org_number' | 'fuzzy' | 'created' | 'none';
  confidence: number;
  fortnoxSupplier?: FortnoxSupplier;
}

/**
 * Hitta eller skapa leverantör i Fortnox
 */
export async function findOrCreateSupplier(
  companyId: string,
  supplierName: string,
  orgNumber?: string,
  invoiceData?: {
    bankgiro?: string;
    plusgiro?: string;
    email?: string;
    address?: string;
  }
): Promise<SupplierMatchResult> {
  const fortnoxClient = new FortnoxClient(companyId);
  const initialized = await fortnoxClient.init();

  if (!initialized) {
    console.warn('[SupplierSync] Fortnox not connected, skipping supplier sync');
    return {
      found: false,
      matchType: 'none',
      confidence: 0,
    };
  }

  // 1. Sök efter exakt match på organisationsnummer
  if (orgNumber) {
    const orgMatch = await searchSupplierByOrgNumber(fortnoxClient, orgNumber);
    if (orgMatch) {
      return {
        found: true,
        supplierNumber: orgMatch.SupplierNumber,
        supplierName: orgMatch.Name,
        matchType: 'org_number',
        confidence: 1.0,
        fortnoxSupplier: orgMatch,
      };
    }
  }

  // 2. Sök efter exakt namnmatch
  const nameMatch = await searchSupplierByName(fortnoxClient, supplierName);
  if (nameMatch) {
    return {
      found: true,
      supplierNumber: nameMatch.SupplierNumber,
      supplierName: nameMatch.Name,
      matchType: 'exact',
      confidence: 0.95,
      fortnoxSupplier: nameMatch,
    };
  }

  // 3. Fuzzy-sök i Fortnox
  const fuzzyMatch = await fuzzySearchSupplier(fortnoxClient, supplierName);
  if (fuzzyMatch) {
    return {
      found: true,
      supplierNumber: fuzzyMatch.SupplierNumber,
      supplierName: fuzzyMatch.Name,
      matchType: 'fuzzy',
      confidence: 0.7,
      fortnoxSupplier: fuzzyMatch,
    };
  }

  // 4. Kolla i vårt leverantörsminne
  const localMatch = await findSimilarSupplier(companyId, supplierName);
  if (localMatch && localMatch.orgNumber) {
    // Försök hitta i Fortnox med org.nummer från minnet
    const orgMatch = await searchSupplierByOrgNumber(fortnoxClient, localMatch.orgNumber);
    if (orgMatch) {
      return {
        found: true,
        supplierNumber: orgMatch.SupplierNumber,
        supplierName: orgMatch.Name,
        matchType: 'org_number',
        confidence: 0.85,
        fortnoxSupplier: orgMatch,
      };
    }
  }

  // 5. Skapa ny leverantör i Fortnox
  const newSupplier = await createSupplierInFortnox(fortnoxClient, {
    Name: supplierName,
    OrganisationNumber: orgNumber,
    BG: invoiceData?.bankgiro,
    PG: invoiceData?.plusgiro,
    Email: invoiceData?.email,
    Address1: invoiceData?.address,
  });

  if (newSupplier) {
    return {
      found: true,
      supplierNumber: newSupplier.SupplierNumber,
      supplierName: newSupplier.Name,
      matchType: 'created',
      confidence: 1.0,
      fortnoxSupplier: newSupplier,
    };
  }

  return {
    found: false,
    matchType: 'none',
    confidence: 0,
  };
}

/**
 * Uppdatera leverantör i Fortnox med ny information
 */
export async function updateSupplierIfNeeded(
  companyId: string,
  supplierNumber: string,
  newData: Partial<FortnoxSupplier>
): Promise<boolean> {
  const fortnoxClient = new FortnoxClient(companyId);
  const initialized = await fortnoxClient.init();

  if (!initialized) {
    return false;
  }

  try {
    // Hämta befintlig leverantör
    const existing = await fortnoxClient.getSuppliers();
    if (!existing.success || !existing.data) {
      return false;
    }

    const supplier = existing.data.Suppliers.find(
      s => s.SupplierNumber === supplierNumber
    );

    if (!supplier) {
      return false;
    }

    // Kontrollera om det finns nya data att uppdatera
    const updates: Partial<FortnoxSupplier> = {};
    
    if (newData.BG && !supplier.OrganisationNumber) {
      updates.BG = newData.BG;
    }
    if (newData.PG && !supplier.OrganisationNumber) {
      updates.PG = newData.PG;
    }
    if (newData.Email && !supplier.OrganisationNumber) {
      updates.Email = newData.Email;
    }

    if (Object.keys(updates).length === 0) {
      return true; // Inget att uppdatera
    }

    // TODO: Implementera update i FortnoxClient
    console.log('[SupplierSync] Would update supplier:', supplierNumber, updates);
    return true;

  } catch (error) {
    console.error('[SupplierSync] Update supplier error:', error);
    return false;
  }
}

/**
 * Synka alla leverantörer från Fortnox till lokalt minne
 */
export async function syncAllSuppliersFromFortnox(companyId: string): Promise<number> {
  const fortnoxClient = new FortnoxClient(companyId);
  const initialized = await fortnoxClient.init();

  if (!initialized) {
    return 0;
  }

  try {
    const result = await fortnoxClient.getSuppliers();
    if (!result.success || !result.data) {
      return 0;
    }

    // TODO: Spara till lokalt minne
    console.log(`[SupplierSync] Found ${result.data.Suppliers.length} suppliers in Fortnox`);
    return result.data.Suppliers.length;

  } catch (error) {
    console.error('[SupplierSync] Sync error:', error);
    return 0;
  }
}

// ============ Interna hjälpfunktioner ============

async function searchSupplierByOrgNumber(
  client: FortnoxClient,
  orgNumber: string
): Promise<FortnoxSupplier | null> {
  try {
    // Normalisera org.nummer (ta bort bindestreck, mellanslag)
    const normalized = orgNumber.replace(/[-\s]/g, '');
    
    const result = await client.getSuppliers();
    if (!result.success || !result.data) {
      return null;
    }

    const match = result.data.Suppliers.find(s => {
      const supplierOrg = s.OrganisationNumber?.replace(/[-\s]/g, '');
      return supplierOrg === normalized;
    });

    return match as FortnoxSupplier || null;

  } catch (error) {
    console.error('[SupplierSync] Search by org number error:', error);
    return null;
  }
}

async function searchSupplierByName(
  client: FortnoxClient,
  name: string
): Promise<FortnoxSupplier | null> {
  try {
    const normalizedName = name.toLowerCase().trim();
    
    const result = await client.getSuppliers();
    if (!result.success || !result.data) {
      return null;
    }

    // Exakt match (case-insensitive)
    const exactMatch = result.data.Suppliers.find(
      s => s.Name.toLowerCase().trim() === normalizedName
    );

    return exactMatch as FortnoxSupplier || null;

  } catch (error) {
    console.error('[SupplierSync] Search by name error:', error);
    return null;
  }
}

async function fuzzySearchSupplier(
  client: FortnoxClient,
  name: string
): Promise<FortnoxSupplier | null> {
  try {
    const normalizedName = normalizeForMatching(name);
    
    const result = await client.getSuppliers();
    if (!result.success || !result.data) {
      return null;
    }

    // Fuzzy match - hitta leverantör där namnet delvis matchar
    for (const supplier of result.data.Suppliers) {
      const supplierNormalized = normalizeForMatching(supplier.Name);
      
      // En innehåller den andra
      if (supplierNormalized.includes(normalizedName) || 
          normalizedName.includes(supplierNormalized)) {
        return supplier as FortnoxSupplier;
      }

      // Levenshtein-avstånd för korta namn
      if (normalizedName.length < 15 && supplierNormalized.length < 15) {
        const distance = levenshteinDistance(normalizedName, supplierNormalized);
        if (distance <= 2) {
          return supplier as FortnoxSupplier;
        }
      }
    }

    return null;

  } catch (error) {
    console.error('[SupplierSync] Fuzzy search error:', error);
    return null;
  }
}

async function createSupplierInFortnox(
  client: FortnoxClient,
  supplierData: Partial<FortnoxSupplier>
): Promise<FortnoxSupplier | null> {
  try {
    console.log('[SupplierSync] Creating supplier:', supplierData.Name);

    const result = await client.findOrCreateSupplier(
      supplierData.Name || 'Okänd leverantör',
      supplierData.OrganisationNumber
    );

    if (result.success && result.data) {
      return {
        SupplierNumber: result.data.SupplierNumber,
        Name: supplierData.Name || 'Okänd leverantör',
        OrganisationNumber: supplierData.OrganisationNumber,
        BG: supplierData.BG,
        PG: supplierData.PG,
        Email: supplierData.Email,
      };
    }

    return null;

  } catch (error) {
    console.error('[SupplierSync] Create supplier error:', error);
    return null;
  }
}

function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ab$/, '')
    .replace(/inc\.?$/, '')
    .replace(/ltd\.?$/, '')
    .replace(/gmbh$/, '')
    .replace(/[^a-z0-9åäö]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}


