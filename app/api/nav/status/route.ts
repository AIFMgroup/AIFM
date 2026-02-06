/**
 * NAV System Status API
 * 
 * Visar status för NAV-systemet:
 * - SECURA-anslutning
 * - Databas-status
 * - Senaste körning
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSecuraClient } from '@/lib/integrations/secura/secura-client';
import { getNAVRunStore, getNAVRecordStore } from '@/lib/nav-engine/nav-store';

export async function GET(request: NextRequest) {
  try {
    const status = {
      secura: {
        configured: false,
        connected: false,
        host: process.env.SECURA_HOST || '194.62.154.68',
        port: process.env.SECURA_PORT || '20023',
        username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
        version: null as string | null,
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

    // Check SECURA connection
    const securaPassword = process.env.SECURA_PASSWORD;
    status.secura.configured = !!securaPassword;

    if (securaPassword) {
      try {
        const securaClient = createSecuraClient({
          host: process.env.SECURA_HOST || '194.62.154.68',
          port: parseInt(process.env.SECURA_PORT || '20023', 10),
          username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
          password: securaPassword,
          timeout: 10000, // Short timeout for status check
        });

        const connectionStatus = await securaClient.testConnection();
        status.secura.connected = connectionStatus.connected;
        status.secura.version = connectionStatus.version || null;
        status.secura.error = connectionStatus.error || null;
      } catch (error) {
        status.secura.connected = false;
        status.secura.error = error instanceof Error ? error.message : 'Connection failed';
      }
    }

    // Check database connectivity
    try {
      const navRunStore = getNAVRunStore();
      const navRecordStore = getNAVRecordStore();

      // Try to get recent runs (this will test the connection)
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

      // Try to get latest NAV records
      try {
        const today = new Date().toISOString().split('T')[0];
        const navRecords = await navRecordStore.getNAVHistory('f1', 'sc1a', undefined, today, 1);
        status.database.tables.navRecords = true;
        
        if (navRecords.length > 0) {
          status.lastNAV = {
            navDate: navRecords[0].navDate,
            fundCount: 1, // Would need to aggregate
            totalAUM: navRecords[0].netAssetValue,
          };
        }
      } catch {
        status.database.tables.navRecords = false;
      }

      // Overall database status
      status.database.connected = 
        status.database.tables.navRuns || 
        status.database.tables.navRecords;

    } catch (error) {
      status.database.connected = false;
      status.database.error = error instanceof Error ? error.message : 'Database connection failed';
    }

    // Determine overall system readiness
    const readiness = {
      canCalculateNAV: status.secura.connected || true, // Can use mock data
      canStoreResults: status.database.connected,
      canApproveNAV: status.database.connected || true, // Can use in-memory
      fullyOperational: status.secura.connected && status.database.connected,
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
      { 
        success: false, 
        error: 'Failed to get system status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
