/**
 * NAV System Status API
 *
 * Visar status för NAV-systemet:
 * - Fund Registry
 * - LSEG prisdata
 * - SEB bankintegration
 * - Databas-status
 * - Senaste körning
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';
import { getPriceDataProviderManager } from '@/lib/integrations/pricing/price-provider';
import { getSEBClient } from '@/lib/integrations/bank/seb-client';
import { getNAVRunStore, getNAVRecordStore } from '@/lib/nav-engine/nav-store';

export async function GET(request: NextRequest) {
  try {
    const status = {
      fundRegistry: {
        available: false,
        fundCount: 0,
        error: null as string | null,
      },
      priceProvider: {
        activeSource: 'unknown',
        available: false,
        message: null as string | null,
      },
      seb: {
        configured: false,
        connected: false,
        error: null as string | null,
      },
      database: {
        connected: false,
        tables: {
          navRecords: false,
          navApprovals: false,
          navRuns: false,
          fundConfig: false,
        },
        error: null as string | null,
      },
      lastRun: null as {
        runId: string;
        navDate: string;
        status: string;
        completedAt: string;
        fundCount: number;
      } | null,
      lastNAV: null as {
        navDate: string;
        fundCount: number;
        totalAUM: number;
      } | null,
    };

    // Check Fund Registry
    try {
      const registry = getFundRegistry();
      const funds = await registry.listFunds();
      status.fundRegistry.available = true;
      status.fundRegistry.fundCount = funds.length;
    } catch (error) {
      status.fundRegistry.error = error instanceof Error ? error.message : 'Fund Registry unavailable';
    }

    // Check Price Provider
    try {
      const priceManager = getPriceDataProviderManager();
      status.priceProvider.activeSource = priceManager.getActiveSource();
      const providerStatus = await priceManager.getActiveProvider().getStatus();
      status.priceProvider.available = providerStatus.available;
      status.priceProvider.message = providerStatus.message ?? null;
    } catch (error) {
      status.priceProvider.available = false;
      status.priceProvider.message = error instanceof Error ? error.message : 'Price provider error';
    }

    // Check SEB
    try {
      const seb = getSEBClient();
      const sebStatus = await seb.testConnection();
      status.seb.configured = true;
      status.seb.connected = sebStatus.connected;
      status.seb.error = sebStatus.connected ? null : (sebStatus.message ?? 'Not connected');
    } catch (error) {
      status.seb.error = error instanceof Error ? error.message : 'SEB unavailable';
    }

    // Check database
    try {
      const navRunStore = getNAVRunStore();
      const navRecordStore = getNAVRecordStore();

      try {
        const recentRuns = await navRunStore.getRecentRuns(1);
        status.database.tables.navRuns = true;
        if (recentRuns.length > 0) {
          const lastRun = recentRuns[0];
          status.lastRun = {
            runId: lastRun.runId,
            navDate: lastRun.navDate,
            status: lastRun.status,
            completedAt: lastRun.completedAt || lastRun.startedAt,
            fundCount: lastRun.completedFunds,
          };
        }
      } catch {
        status.database.tables.navRuns = false;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const navRecords = await navRecordStore.getNAVHistory('f1', 'sc1a', undefined, today, 1);
        status.database.tables.navRecords = true;
        if (navRecords.length > 0) {
          status.lastNAV = {
            navDate: navRecords[0].navDate,
            fundCount: 1,
            totalAUM: navRecords[0].netAssetValue,
          };
        }
      } catch {
        status.database.tables.navRecords = false;
      }

      status.database.connected = status.database.tables.navRuns || status.database.tables.navRecords;
    } catch (error) {
      status.database.connected = false;
      status.database.error = error instanceof Error ? error.message : 'Database connection failed';
    }

    const readiness = {
      canCalculateNAV: status.fundRegistry.available,
      canStoreResults: status.database.connected,
      canReconcile: status.seb.connected,
      fullyOperational: status.fundRegistry.available && status.database.connected,
    };

    return NextResponse.json({
      success: true,
      status,
      readiness,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[NAV Status API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get system status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
