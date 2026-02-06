/**
 * GLEIF API Client
 * Global Legal Entity Identifier Foundation
 * Free API for LEI lookups
 * https://www.gleif.org/en/lei-data/gleif-lei-look-up-api
 * 
 * Includes caching to reduce API calls
 */

import { getCached, setCached } from './cache';

const GLEIF_API_URL = 'https://api.gleif.org/api/v1';
const CACHE_PREFIX = 'gleif';
const LEI_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days (LEI data rarely changes)

export interface GLEIFEntity {
  lei: string;
  legalName: string;
  legalAddress: {
    addressLines: string[];
    city: string;
    country: string;
    postalCode: string;
  };
  headquartersAddress: {
    addressLines: string[];
    city: string;
    country: string;
    postalCode: string;
  };
  registrationStatus: string;
  entityCategory: string;
  legalForm?: {
    id: string;
    other?: string;
  };
}

export interface GLEIFSearchResult {
  success: boolean;
  data?: {
    lei: string;
    legalName: string;
    country: string;
    city: string;
    status: string;
    registrationDate?: string;
  };
  error?: string;
  source: 'gleif';
  sourceUrl: string;
}

export class GLEIFClient {
  /**
   * Extract company name from security name
   * E.g., "VOLVO AB-B SHS" -> "VOLVO AB"
   * E.g., "NOKIA OYJ" -> "NOKIA OYJ"
   * E.g., "ERICSSON B" -> "ERICSSON"
   */
  private extractCompanyName(securityName: string): string {
    // Common share class indicators to remove
    const shareClassPatterns = [
      /[\s-]+(CLASS\s+)?[A-Z]\s*(SHS|SHARES?)?$/i,  // -A, -B SHS, CLASS A, etc.
      /[\s-]+SHS$/i,                                  // Just SHS
      /[\s-]+SHARES?$/i,                              // SHARES
      /[\s-]+COMMON$/i,                               // COMMON
      /[\s-]+ORD(INARY)?$/i,                         // ORD, ORDINARY
      /[\s-]+PREF(ERRED)?$/i,                        // PREF, PREFERRED
      /[\s-]+REG(ISTERED)?$/i,                       // REG, REGISTERED
      /[\s-]+BEARER$/i,                              // BEARER
      /[\s-]+ADR$/i,                                 // ADR
      /[\s-]+GDR$/i,                                 // GDR
      /[\s-]+NPV$/i,                                 // NPV (No Par Value)
      /[\s-]+\d+(\.\d+)?%?\s*(PREF)?$/i,            // Percentage bonds/prefs
    ];

    let name = securityName.trim();
    
    // Apply all patterns
    for (const pattern of shareClassPatterns) {
      name = name.replace(pattern, '');
    }
    
    return name.trim();
  }

  /**
   * Search for LEI by company name
   */
  async searchByName(companyName: string, country?: string): Promise<GLEIFSearchResult> {
    // First, extract the actual company name from security name
    const extractedName = this.extractCompanyName(companyName);
    
    // Check cache first
    const cacheKey = `search:${extractedName.toUpperCase()}:${country || 'any'}`;
    const cached = await getCached<GLEIFSearchResult>(cacheKey, { prefix: CACHE_PREFIX });
    if (cached !== null) {
      console.log('[GLEIF] Cache hit for:', extractedName);
      return cached;
    }
    
    try {
      // Clean up company name for search (remove legal suffixes for initial search)
      const cleanName = extractedName
        .replace(/\s+(AB|A\/S|AS|ASA|OYJ|PLC|LTD|INC|CORP|AG|SE|SA|NV|BV)$/i, '')
        .trim();
      
      console.log('[GLEIF] Searching for company:', { original: companyName, extracted: extractedName, clean: cleanName });

      let url = `${GLEIF_API_URL}/lei-records?filter[entity.legalName]=${encodeURIComponent(cleanName)}`;
      
      if (country) {
        url += `&filter[entity.legalAddress.country]=${country.toUpperCase()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Ingen LEI hittades för detta företag',
            source: 'gleif',
            sourceUrl: 'https://search.gleif.org/',
          };
        }
        return {
          success: false,
          error: `GLEIF API error: ${response.status}`,
          source: 'gleif',
          sourceUrl: 'https://search.gleif.org/',
        };
      }

      const result = await response.json();

      if (!result.data || result.data.length === 0) {
        // Try with extracted name (includes legal suffix)
        if (extractedName !== cleanName) {
          const retryResult = await this.tryExactSearch(extractedName, country);
          if (retryResult) return retryResult;
        }
        
        // Try fuzzy search
        return this.fuzzySearchByName(extractedName, country);
      }

      const entity = result.data[0].attributes;
      const lei = result.data[0].id;

      const searchResult: GLEIFSearchResult = {
        success: true,
        data: {
          lei,
          legalName: entity.entity?.legalName?.name || '',
          country: entity.entity?.legalAddress?.country || '',
          city: entity.entity?.legalAddress?.city || '',
          status: entity.registration?.status || '',
          registrationDate: entity.registration?.initialRegistrationDate,
        },
        source: 'gleif',
        sourceUrl: `https://search.gleif.org/#/record/${lei}`,
      };
      
      // Cache successful result
      await setCached(cacheKey, searchResult, { prefix: CACHE_PREFIX, ttlSeconds: LEI_CACHE_TTL });
      console.log('[GLEIF] Found and cached LEI:', lei);
      
      return searchResult;
    } catch (error) {
      console.error('GLEIF search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search GLEIF',
        source: 'gleif',
        sourceUrl: 'https://search.gleif.org/',
      };
    }
  }

  /**
   * Try exact search with a specific name
   */
  private async tryExactSearch(name: string, country?: string): Promise<GLEIFSearchResult | null> {
    try {
      let url = `${GLEIF_API_URL}/lei-records?filter[entity.legalName]=${encodeURIComponent(name)}`;
      if (country) {
        url += `&filter[entity.legalAddress.country]=${country.toUpperCase()}`;
      }

      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.api+json' },
      });

      if (!response.ok || response.status === 404) return null;

      const result = await response.json();
      if (!result.data || result.data.length === 0) return null;

      const entity = result.data[0].attributes;
      const lei = result.data[0].id;

      return {
        success: true,
        data: {
          lei,
          legalName: entity.entity?.legalName?.name || '',
          country: entity.entity?.legalAddress?.country || '',
          city: entity.entity?.legalAddress?.city || '',
          status: entity.registration?.status || '',
          registrationDate: entity.registration?.initialRegistrationDate,
        },
        source: 'gleif',
        sourceUrl: `https://search.gleif.org/#/record/${lei}`,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fuzzy search using full-text search endpoint
   */
  private async fuzzySearchByName(companyName: string, country?: string): Promise<GLEIFSearchResult> {
    try {
      let url = `${GLEIF_API_URL}/lei-records?filter[fulltext]=${encodeURIComponent(companyName)}&page[size]=5`;
      
      if (country) {
        url += `&filter[entity.legalAddress.country]=${country.toUpperCase()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Ingen LEI hittades',
          source: 'gleif',
          sourceUrl: 'https://search.gleif.org/',
        };
      }

      const result = await response.json();

      if (!result.data || result.data.length === 0) {
        return {
          success: false,
          error: 'Ingen LEI hittades för detta företag i GLEIF-databasen',
          source: 'gleif',
          sourceUrl: 'https://search.gleif.org/',
        };
      }

      // Find best match
      const normalizedSearch = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      let bestMatch = result.data[0];
      let bestScore = 0;

      for (const record of result.data) {
        const legalName = record.attributes?.entity?.legalName?.name || '';
        const normalizedName = legalName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Simple similarity score
        let score = 0;
        if (normalizedName === normalizedSearch) score = 100;
        else if (normalizedName.includes(normalizedSearch)) score = 80;
        else if (normalizedSearch.includes(normalizedName)) score = 70;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = record;
        }
      }

      const entity = bestMatch.attributes;
      const lei = bestMatch.id;

      return {
        success: true,
        data: {
          lei,
          legalName: entity.entity?.legalName?.name || '',
          country: entity.entity?.legalAddress?.country || '',
          city: entity.entity?.legalAddress?.city || '',
          status: entity.registration?.status || '',
          registrationDate: entity.registration?.initialRegistrationDate,
        },
        source: 'gleif',
        sourceUrl: `https://search.gleif.org/#/record/${lei}`,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Kunde inte söka i GLEIF',
        source: 'gleif',
        sourceUrl: 'https://search.gleif.org/',
      };
    }
  }

  /**
   * Lookup LEI directly
   */
  async lookupByLEI(lei: string): Promise<GLEIFSearchResult> {
    try {
      const response = await fetch(`${GLEIF_API_URL}/lei-records/${lei}`, {
        headers: {
          'Accept': 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'LEI hittades inte',
          source: 'gleif',
          sourceUrl: 'https://search.gleif.org/',
        };
      }

      const result = await response.json();
      const entity = result.data.attributes;

      return {
        success: true,
        data: {
          lei,
          legalName: entity.entity?.legalName?.name || '',
          country: entity.entity?.legalAddress?.country || '',
          city: entity.entity?.legalAddress?.city || '',
          status: entity.registration?.status || '',
          registrationDate: entity.registration?.initialRegistrationDate,
        },
        source: 'gleif',
        sourceUrl: `https://search.gleif.org/#/record/${lei}`,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Kunde inte slå upp LEI',
        source: 'gleif',
        sourceUrl: 'https://search.gleif.org/',
      };
    }
  }
}

// Singleton
let gleifClient: GLEIFClient | null = null;

export function getGLEIFClient(): GLEIFClient {
  if (!gleifClient) {
    gleifClient = new GLEIFClient();
  }
  return gleifClient;
}
