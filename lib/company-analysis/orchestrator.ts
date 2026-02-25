/**
 * Company Analysis Orchestrator
 *
 * Collects data in parallel from all available APIs and returns
 * a CompleteCompanyAnalysis structure (without AI synthesis; that is done in the API route).
 */

import { performEnrichedLookup } from '../integrations/securities/enriched-lookup';
import { getYahooFinanceClient } from '../integrations/securities/yahoo-finance-client';
import { getESGServiceClient } from '../integrations/esg/esg-service';
import { getHoldingDocuments } from '../holding-documents/holding-document-store';
import { getMarketDataClient } from '../integrations/market-data/market-data-client';
import { FundRegistry } from '../fund-registry/fund-registry';
import { getESGFundConfig } from '../integrations/securities/esg-fund-configs';
import { getFundDocumentText } from '../fund-documents/fund-document-store';
import type { RegulatoryFFFS } from '../integrations/securities/types';
import type { ExclusionInvolvement } from '../integrations/esg/types';
import type {
  CompleteCompanyAnalysis,
  IdentificationSection,
  MarketDataSection,
  ESGSection,
  ComplianceSection,
  DocumentsSection,
  FundContext,
  FundTermsContext,
  ExclusionEvaluation,
  NewsSection,
} from './types';

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function toInstrumentId(name: string, isin?: string): string {
  if (isin && ISIN_REGEX.test(isin)) return isin;
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

export interface CollectCompanyDataInput {
  /** ISIN (e.g. US7672041008) */
  isin?: string;
  /** Ticker (e.g. RIO) */
  ticker?: string;
  /** MIC code (optional) */
  mic?: string;
  /** Fund ID for portfolio context and ESG fund config */
  fundId?: string;
  /** Prefer LSEG as ESG provider when configured */
  useLSEG?: boolean;
}

/**
 * Collect all company data in parallel after resolving identifier.
 * Requires at least isin or ticker.
 */
export async function collectCompanyData(
  input: CollectCompanyDataInput
): Promise<CompleteCompanyAnalysis> {
  const { isin, ticker, mic, fundId, useLSEG } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isin && !ticker) {
    return buildEmptyAnalysis(
      'Minst ett av isin eller ticker krävs.',
      [],
      []
    );
  }

  // 1. Enriched lookup (blocking; we need isin/name for downstream)
  const lookupResult = await performEnrichedLookup(isin ?? '', ticker, mic);
  if (!lookupResult.success || !lookupResult.data) {
    return buildEmptyAnalysis(
      lookupResult.errors[0] ?? 'Värdepappret hittades inte.',
      lookupResult.errors,
      lookupResult.warnings
    );
  }

  const data = lookupResult.data;
  const resolvedIsin = data.isin?.value || isin || '';
  const companyName = data.name?.value || '';
  const resolvedTicker = data.ticker?.value || ticker || '';
  const instrumentId = toInstrumentId(companyName, resolvedIsin);
  const identifier = resolvedIsin || resolvedTicker || companyName;

  // 2. Parallel data collection
  const esgClient = getESGServiceClient();
  const providerName = useLSEG && esgClient.getAvailableProviders().includes('LSEG') ? 'LSEG' : undefined;

  const [esgData, exclusionScreening, paiIndicators, irDocuments, newsArticles, regulatoryUpdates, positions] =
    await Promise.all([
      esgClient.getESGData(identifier, providerName).catch((e) => {
        errors.push(`ESG: ${(e as Error).message}`);
        return null;
      }),
      esgClient.getExclusionScreening(identifier, providerName).catch((e) => {
        warnings.push(`Exkluderingsscreening: ${(e as Error).message}`);
        return null;
      }),
      esgClient.getPAIIndicators(identifier, providerName).catch(() => null),
      getHoldingDocuments(instrumentId).catch((e) => {
        warnings.push(`IR-dokument: ${(e as Error).message}`);
        return [];
      }),
      getMarketDataClient()
        .getFinancialNews(companyName || identifier, 10)
        .catch((e) => {
          warnings.push(`Nyheter: ${(e as Error).message}`);
          return [];
        }),
      getMarketDataClient()
        .getRegulatoryNews()
        .then((updates) => updates.slice(0, 5))
        .catch(() => []),
      fundId
        ? new FundRegistry().getPositions(fundId, new Date().toISOString().split('T')[0]).catch(() => [])
        : Promise.resolve([]),
    ]);

  // 3. Build sections
  const identification: IdentificationSection = {
    lookup: data,
    companyName: companyName || undefined,
    ticker: resolvedTicker || undefined,
    isin: resolvedIsin || undefined,
    sector: data.gicsSector?.value,
    industry: data.industry?.value,
    country: data.country?.value,
    exchange: data.exchangeName?.value,
    currency: data.currency?.value,
    emitter: data.emitter?.value,
    emitterLEI: data.emitterLEI?.value,
  };

  // Yahoo financials (P/E, ROE, margins, etc.) when we have the symbol
  let financials: MarketDataSection = {};
  if (data.yahooSymbol?.value) {
    try {
      const yf = await getYahooFinanceClient().getFinancials(data.yahooSymbol.value);
      if (yf.success && yf.data) financials = yf.data;
    } catch {
      // non-fatal
    }
  }

  const marketData: MarketDataSection = {
    currentPrice: data.currentPrice?.value,
    marketCap: data.marketCap?.value,
    currency: data.currency?.value,
    averageDailyVolume: data.averageDailyVolume?.value,
    averageDailyValueSEK: data.averageDailyValueSEK?.value,
    exchange: data.exchangeName?.value,
    isRegulatedMarket: data.isRegulatedMarket?.value,
    listingType: data.listingType?.value,
    meetsLiquidityPresumption: data.meetsLiquidityPresumption?.value,
    estimatedLiquidationDays: data.estimatedLiquidationDays?.value,
    liquidityCategory: data.liquidityCategory?.value,
    ...financials,
  };

  const esg: ESGSection = {
    esg: esgData ?? null,
    exclusionScreening: exclusionScreening ?? null,
    paiIndicators: paiIndicators ?? null,
    provider: esgData?.provider,
  };

  const rd = data.regulatoryDefaults;
  const fffsCompliance: RegulatoryFFFS | undefined = rd
    ? {
        limitedPotentialLoss: rd.limitedPotentialLoss?.value ?? false,
        liquidityNotEndangered: rd.liquidityNotEndangered?.value ?? false,
        reliableValuation: {
          type: (data.valuationDefaults?.reliableValuationType?.value as RegulatoryFFFS['reliableValuation']['type']) ?? 'market_price',
          checked: rd.reliableValuationChecked?.value ?? false,
        },
        appropriateInformation: {
          type: (data.valuationDefaults?.appropriateInfoType?.value as RegulatoryFFFS['appropriateInformation']['type']) ?? 'regular_market_info',
          checked: rd.appropriateInfoChecked?.value ?? false,
        },
        isMarketable: rd.isMarketable?.value ?? false,
        compatibleWithFund: rd.compatibleWithFund?.value ?? false,
        riskManagementCaptures: rd.riskManagementCaptures?.value ?? false,
      }
    : undefined;

  const compliance: ComplianceSection = {
    fffs: fffsCompliance ?? undefined,
    fffsCompliance: fffsCompliance ?? undefined,
    liquidityAnalysis: data.regulatoryDefaults
      ? {
          fffsLiquidityNotEndangered: data.regulatoryDefaults.liquidityNotEndangered?.value ?? false,
          fffsIsMarketable: data.regulatoryDefaults.isMarketable?.value ?? false,
        }
      : undefined,
    valuationInfo: data.valuationDefaults
      ? {
          reliableDailyPrices: data.valuationDefaults.reliableDailyPrices?.value ?? false,
          priceSourceUrl: data.valuationDefaults.priceSourceUrl?.value,
          isEmission: false as const,
        }
      : undefined,
  };

  const documents: DocumentsSection = {
    irDocuments: irDocuments ?? [],
  };

  let fundContext: FundContext | undefined;
  if (fundId && Array.isArray(positions) && positions.length > 0) {
    const totalValue = positions.reduce((sum: number, p: { marketValueBase?: number; marketValue?: number }) => sum + (p.marketValueBase ?? p.marketValue ?? 0), 0) || 1;
    const currentPosition = positions.find(
      (p: { instrumentId?: string; isin?: string }) => p.instrumentId === instrumentId || p.isin === resolvedIsin
    );
    const posValue = currentPosition && ((currentPosition as { marketValueBase?: number }).marketValueBase ?? (currentPosition as { marketValue?: number }).marketValue);
    const positionWeight = posValue != null ? posValue / totalValue : undefined;
    const sectorPeers = positions
      .filter((p: { instrumentId?: string; isin?: string }) => p.instrumentId !== instrumentId && p.isin !== resolvedIsin)
      .slice(0, 10)
      .map((p: { instrumentName?: string; instrumentId?: string; isin?: string; marketValueBase?: number; marketValue?: number }) => ({
        name: p.instrumentName ?? p.instrumentId ?? '',
        isin: p.isin,
        weight: totalValue > 0 && (p.marketValueBase ?? p.marketValue) != null ? (p.marketValueBase ?? p.marketValue ?? 0) / totalValue : undefined,
      }));
    fundContext = { positionWeight, sectorPeers };
  }

  // Build fund terms context with exclusion evaluation against actual ESG data
  let fundTermsContext: FundTermsContext | undefined;
  if (fundId) {
    try {
      const registry = new FundRegistry();
      const fundInfo = await registry.getFund(fundId).catch(() => null);
      const fundName = fundInfo?.name || fundId;
      const fundConfig = getESGFundConfig(fundId, fundName);

      const exclusionFlags: ExclusionInvolvement[] =
        esgData?.exclusionFlags ?? exclusionScreening?.involvement ?? [];

      const exclusionEvals: ExclusionEvaluation[] = (fundConfig?.exclusions ?? []).map((ex) => {
        const matchingFlags = exclusionFlags.filter((f) => matchCategory(ex.category, f.category));
        const actualPercent = matchingFlags.length > 0
          ? Math.max(...matchingFlags.map((f) => f.revenuePercent ?? 0))
          : null;
        const approved = actualPercent === null || actualPercent <= ex.threshold;
        return {
          category: ex.category,
          label: ex.label,
          threshold: ex.threshold,
          actualPercent,
          approved,
          severity: ex.severity,
          source: matchingFlags.length > 0
            ? matchingFlags.map((f) => f.categoryDescription || f.category).join(', ')
            : undefined,
        };
      });

      let fondvillkorExcerpt: string | undefined;
      try {
        const rawText = await getFundDocumentText(fundId);
        if (rawText?.trim()) {
          fondvillkorExcerpt = rawText.slice(0, 15000);
        }
      } catch {
        // non-fatal
      }

      fundTermsContext = {
        fundId,
        fundName,
        article: fundConfig?.article ?? '6',
        exclusions: exclusionEvals,
        promotedCharacteristics: fundConfig?.promotedCharacteristics,
        normScreening: fundConfig?.normScreening,
        fondvillkorExcerpt,
      };
    } catch (e) {
      warnings.push(`Fondvillkor: ${(e as Error).message}`);
    }
  }

  const news: NewsSection = {
    articles: newsArticles ?? [],
    regulatoryUpdates: regulatoryUpdates?.map((u) => ({
      id: u.id,
      title: u.title,
      summary: u.summary,
      source: u.source,
      publishedAt: u.publishedAt,
      url: u.url,
    })),
  };

  return {
    analyzedAt: new Date().toISOString(),
    fundId,
    fundContext,
    fundTermsContext,
    identification,
    marketData,
    esg,
    compliance,
    documents,
    financialAnalysis: {},
    riskSwot: {},
    news,
    summary: {},
    errors,
    warnings,
  };
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  weapons: ['weapons', 'conventional_weapons', 'military', 'arms', 'vapen', 'krigsmateriel'],
  defense: ['defense', 'defence'],
  controversialWeapons: ['controversial_weapons', 'cluster_munitions', 'landmines', 'biological_weapons', 'chemical_weapons', 'kontroversiella_vapen'],
  nuclearWeapons: ['nuclear_weapons', 'nuclear', 'kärnvapen'],
  tobacco: ['tobacco', 'tobak'],
  alcohol: ['alcohol', 'alkohol'],
  fossilFuels: ['fossil_fuels', 'thermal_coal', 'oil_sands', 'arctic_drilling', 'fossila_bränslen', 'fossil'],
  gambling: ['gambling', 'spel', 'hasardspel'],
  adultContent: ['adult_entertainment', 'pornography', 'pornografi'],
  clusterMines: ['cluster_munitions', 'landmines', 'klusterbomber', 'personminor'],
  chemicalBiological: ['chemical_weapons', 'biological_weapons', 'kemiska_vapen', 'biologiska_vapen'],
  sanctionedCountries: ['sanctioned_countries', 'sanctions'],
  smsLoans: ['sms_loans', 'payday_loans'],
};

function matchCategory(configCategory: string, providerCategory: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '_');
  const cc = norm(configCategory);
  const pc = norm(providerCategory);
  if (cc === pc) return true;
  const aliases = CATEGORY_ALIASES[configCategory] ?? [];
  return aliases.some((a) => pc.includes(norm(a)) || norm(a).includes(pc));
}

function buildEmptyAnalysis(
  mainError: string,
  errors: string[],
  warnings: string[]
): CompleteCompanyAnalysis {
  const errs = errors.length ? errors : [mainError];
  return {
    analyzedAt: new Date().toISOString(),
    identification: {},
    marketData: {},
    esg: {},
    compliance: {},
    documents: { irDocuments: [] },
    financialAnalysis: {},
    riskSwot: {},
    news: { articles: [] },
    summary: {},
    errors: errs,
    warnings,
  };
}
