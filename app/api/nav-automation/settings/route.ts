/**
 * NAV Automation Settings API
 * 
 * Endpoints för att spara och hämta NAV-automationsinställningar
 * Lagras i DynamoDB
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

// ============================================
// DYNAMODB CLIENT
// ============================================

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.NAV_SETTINGS_TABLE || 'aifm-nav-settings';

// ============================================
// TYPES
// ============================================

interface Fund {
  id: string;
  name: string;
  isin: string;
  currency: string;
  enabled: boolean;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  fundIds: string[];
  reportTypes: ('NAV' | 'NOTOR' | 'SUBRED' | 'PRICE_DATA' | 'OWNER_DATA')[];
}

interface ScheduleConfig {
  dataFetch: string;
  notor: string;
  navReports: string;
  priceData: string;
  ownerData: string;
  subRed: string;
}

interface DataSourceConfig {
  lseg: { configured: boolean; environment: string };
  seb: { configured: boolean; sandbox: boolean };
  fundRegistry: { configured: boolean };
}

interface NAVSettings {
  tenantId: string;
  funds: Fund[];
  recipients: Recipient[];
  schedule: ScheduleConfig;
  dataSourceConfig: DataSourceConfig;
  options: {
    uploadToWebsite: boolean;
    slackNotifications: boolean;
    fourEyesPrinciple: boolean;
  };
  updatedAt: string;
  updatedBy?: string;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_FUNDS: Fund[] = [
  { id: 'f1', name: 'AUAG Essential Metals', isin: 'SE0019175563', currency: 'SEK', enabled: true },
  { id: 'f2', name: 'AuAg Gold Rush', isin: 'SE0020677946', currency: 'SEK', enabled: true },
  { id: 'f3', name: 'AuAg Precious Green', isin: 'SE0014808440', currency: 'SEK', enabled: true },
  { id: 'f4', name: 'AuAg Silver Bullet', isin: 'SE0013358181', currency: 'SEK', enabled: true },
];

const DEFAULT_SCHEDULE: ScheduleConfig = {
  dataFetch: '06:00',
  notor: '07:00',
  navReports: '08:30',
  priceData: '09:00',
  ownerData: '09:15',
  subRed: '15:00',
};

const DEFAULT_DATA_SOURCE_CONFIG: DataSourceConfig = {
  lseg: { configured: !!process.env.LSEG_API_KEY, environment: process.env.LSEG_API_URL ? 'production' : 'sandbox' },
  seb: { configured: !!process.env.SEB_CLIENT_ID, sandbox: !process.env.SEB_API_URL?.includes('api.seb.se') },
  fundRegistry: { configured: !!process.env.FUND_REGISTRY_TABLE },
};

const DEFAULT_OPTIONS = {
  uploadToWebsite: true,
  slackNotifications: true,
  fourEyesPrinciple: true,
};

// ============================================
// GET - Hämta inställningar
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from header or use default
    const tenantId = request.headers.get('x-tenant-id') || 'default';

    // Try to fetch settings from DynamoDB
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { tenantId },
      }));

      if (result.Item) {
        return NextResponse.json({
          success: true,
          settings: result.Item as NAVSettings,
        });
      }
    } catch (dbError) {
      // If table doesn't exist or other DB error, return defaults
      console.warn('[NAV Settings] DynamoDB error, returning defaults:', dbError);
    }

    // Return default settings if none found
    const defaultSettings: NAVSettings = {
      tenantId,
      funds: DEFAULT_FUNDS,
      recipients: [],
      schedule: DEFAULT_SCHEDULE,
      dataSourceConfig: DEFAULT_DATA_SOURCE_CONFIG,
      options: DEFAULT_OPTIONS,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      settings: defaultSettings,
      isDefault: true,
    });
  } catch (error) {
    console.error('[NAV Settings] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Spara inställningar
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get tenant ID from header or use default
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const userId = request.headers.get('x-user-id') || 'unknown';

    // Validate required fields
    if (!body.funds || !body.schedule) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: funds, schedule' },
        { status: 400 }
      );
    }

    // Construct settings object
    const settings: NAVSettings = {
      tenantId,
      funds: body.funds || DEFAULT_FUNDS,
      recipients: body.recipients || [],
      schedule: body.schedule || DEFAULT_SCHEDULE,
      dataSourceConfig: body.dataSourceConfig || DEFAULT_DATA_SOURCE_CONFIG,
      options: body.options || DEFAULT_OPTIONS,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    // Save to DynamoDB
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: settings,
      }));

      console.log(`[NAV Settings] Settings saved for tenant: ${tenantId}`);

      return NextResponse.json({
        success: true,
        message: 'Settings saved successfully',
        settings,
      });
    } catch (dbError) {
      // If DynamoDB is not configured, just return success with the data
      // This allows the frontend to work even without a database
      console.warn('[NAV Settings] DynamoDB save failed, returning success anyway:', dbError);
      
      return NextResponse.json({
        success: true,
        message: 'Settings validated (database not configured)',
        settings,
        warning: 'Settings not persisted - database not configured',
      });
    }
  } catch (error) {
    console.error('[NAV Settings] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Återställ till standard
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default';

    // Reset to defaults
    const defaultSettings: NAVSettings = {
      tenantId,
      funds: DEFAULT_FUNDS,
      recipients: [],
      schedule: DEFAULT_SCHEDULE,
      dataSourceConfig: DEFAULT_DATA_SOURCE_CONFIG,
      options: DEFAULT_OPTIONS,
      updatedAt: new Date().toISOString(),
    };

    // Save defaults to DynamoDB
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: defaultSettings,
      }));
    } catch (dbError) {
      console.warn('[NAV Settings] DynamoDB reset failed:', dbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults',
      settings: defaultSettings,
    });
  } catch (error) {
    console.error('[NAV Settings] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}
