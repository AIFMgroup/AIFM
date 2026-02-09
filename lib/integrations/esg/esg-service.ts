/**
 * ESG Service Client
 * 
 * Provider-agnostic orchestration layer for ESG data.
 * Manages provider registry, caching (DynamoDB), and normalization.
 */

import type {
  ESGDataProvider,
  NormalizedESGData,
  NormalizedExclusionScreening,
  PAIIndicator,
} from './types';
import {
  getCachedESG,
  setCachedESG,
  getCachedExclusion,
  setCachedExclusion,
} from './esg-cache';

/** Singleton service client */
let _instance: ESGServiceClient | null = null;

export class ESGServiceClient {
  private providers: Map<string, ESGDataProvider> = new Map();
  private defaultProviderName: string | null = null;

  /** Register a provider (first one registered becomes default unless overridden) */
  registerProvider(provider: ESGDataProvider): void {
    this.providers.set(provider.name, provider);
    if (!this.defaultProviderName) {
      this.defaultProviderName = provider.name;
    }
    console.log(`[ESG Service] Registered provider: ${provider.name}`);
  }

  /** Set a specific provider as default */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`[ESG Service] Provider "${name}" not registered`);
    }
    this.defaultProviderName = name;
  }

  /** Get available providers */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([, p]) => p.isAvailable())
      .map(([name]) => name);
  }

  /** Get a provider by name, or the default one */
  private getProvider(name?: string): ESGDataProvider | null {
    if (name) {
      const p = this.providers.get(name);
      return p && p.isAvailable() ? p : null;
    }
    // Try the configured default first
    const envProvider = process.env.ESG_DEFAULT_PROVIDER;
    const preferredName = envProvider || this.defaultProviderName;
    if (preferredName) {
      const p = this.providers.get(preferredName);
      if (p?.isAvailable()) return p;
    }
    // Fallback: first available
    for (const [, p] of this.providers) {
      if (p.isAvailable()) return p;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get normalized ESG data for a security.
   * Checks cache first, then calls provider. Caches result.
   */
  async getESGData(identifier: string, providerName?: string): Promise<NormalizedESGData | null> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      console.warn('[ESG Service] No ESG provider available');
      return null;
    }

    // Cache check
    const cached = await getCachedESG(identifier, provider.name);
    if (cached) {
      console.log(`[ESG Service] Cache HIT ${identifier} (${provider.name})`);
      return cached;
    }

    // Fetch from provider
    console.log(`[ESG Service] Fetching ${identifier} from ${provider.name}`);
    const data = await provider.getESGData(identifier);
    if (!data) return null;

    // Store in cache (async, non-blocking)
    setCachedESG(identifier, provider.name, data).catch((err) =>
      console.warn('[ESG Service] Cache write failed:', err)
    );

    return data;
  }

  /**
   * Get exclusion screening for a security.
   * Uses 1-hour cache TTL.
   */
  async getExclusionScreening(identifier: string, providerName?: string): Promise<NormalizedExclusionScreening | null> {
    const provider = this.getProvider(providerName);
    if (!provider) return null;

    const cached = await getCachedExclusion(identifier, provider.name);
    if (cached) return cached;

    const data = await provider.getExclusionScreening(identifier);
    if (!data) return null;

    setCachedExclusion(identifier, provider.name, data).catch((err) =>
      console.warn('[ESG Service] Exclusion cache write failed:', err)
    );

    return data;
  }

  /**
   * Bulk ESG data retrieval. Uses cache and provider bulk API if available.
   */
  async getBulkESGData(
    identifiers: string[],
    providerName?: string
  ): Promise<Map<string, NormalizedESGData | null>> {
    const provider = this.getProvider(providerName);
    const result = new Map<string, NormalizedESGData | null>();

    if (!provider) {
      identifiers.forEach((id) => result.set(id, null));
      return result;
    }

    // Check cache first
    const uncached: string[] = [];
    for (const id of identifiers) {
      const cached = await getCachedESG(id, provider.name);
      if (cached) {
        result.set(id, cached);
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return result;

    // Use provider bulk if available
    if (provider.getBulkESGData) {
      const bulkResult = await provider.getBulkESGData(uncached);
      for (const [id, data] of bulkResult) {
        result.set(id, data);
        if (data) {
          setCachedESG(id, provider.name, data).catch(() => {});
        }
      }
    } else {
      // Fallback: serial fetch
      for (const id of uncached) {
        const data = await provider.getESGData(id);
        result.set(id, data);
        if (data) {
          setCachedESG(id, provider.name, data).catch(() => {});
        }
      }
    }

    return result;
  }

  /**
   * Get PAI indicators for a security.
   */
  async getPAIIndicators(identifier: string, providerName?: string): Promise<PAIIndicator[] | null> {
    const provider = this.getProvider(providerName);
    if (!provider?.getPAIIndicators) return null;
    return provider.getPAIIndicators(identifier);
  }

  /**
   * Get the currently active provider name.
   */
  getActiveProviderName(): string | null {
    const p = this.getProvider();
    return p?.name ?? null;
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

/**
 * Get the global ESG service client singleton.
 * Providers are registered lazily on first access.
 */
export function getESGServiceClient(): ESGServiceClient {
  if (!_instance) {
    _instance = new ESGServiceClient();

    // Auto-register available providers
    // These imports are deferred to avoid circular dependencies
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { YahooFinanceESGProvider } = require('./providers/yahoo-finance');
      const yahoo = new YahooFinanceESGProvider();
      if (yahoo.isAvailable()) {
        _instance.registerProvider(yahoo);
      }
    } catch {
      // Yahoo adapter not available
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GenericESGProvider } = require('./providers/generic-provider');
      const generic = new GenericESGProvider();
      if (generic.isAvailable()) {
        _instance.registerProvider(generic);
        // If a dedicated provider is configured, make it default over Yahoo
        _instance.setDefaultProvider(generic.name);
      }
    } catch {
      // Generic adapter not available
    }

    const available = _instance.getAvailableProviders();
    console.log(`[ESG Service] Initialized with ${available.length} provider(s): ${available.join(', ') || '(none)'}`);
  }

  return _instance;
}
