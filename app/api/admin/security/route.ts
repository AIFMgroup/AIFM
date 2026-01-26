import { NextRequest, NextResponse } from 'next/server';
import { 
  CognitoIdentityProviderClient,
  AdminListDevicesCommand,
  AdminUserGlobalSignOutCommand,
  AdminSetUserMFAPreferenceCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand, ScanCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Clients Setup
// ============================================================================

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-north-1',
});

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const SESSIONS_TABLE = process.env.SESSIONS_TABLE_NAME || 'aifm-user-sessions';
const SECURITY_POLICIES_TABLE = process.env.SECURITY_POLICIES_TABLE_NAME || 'aifm-security-policies';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

// ============================================================================
// Types
// ============================================================================

interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  deviceInfo: string;
  ipAddress: string;
  location?: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  isActive: boolean;
}

interface SecurityPolicy {
  id: string;
  name: string;
  type: 'mfa' | 'password' | 'session' | 'ip' | 'device';
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface MFAStatus {
  userId: string;
  email: string;
  mfaEnabled: boolean;
  mfaType?: 'TOTP' | 'SMS' | 'SOFTWARE_TOKEN';
  lastMfaSetup?: string;
}

// ============================================================================
// GET - Get security overview
// ============================================================================

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    switch (type) {
      case 'sessions':
        return await getSessions(searchParams);
      case 'mfa-status':
        return await getMFAStatus();
      case 'policies':
        return await getSecurityPolicies();
      case 'overview':
      default:
        return await getSecurityOverview();
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch security data';
    console.error('Failed to fetch security data:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function getSecurityOverview() {
  // Get users with MFA status
  const usersCommand = new ListUsersCommand({
    UserPoolId: USER_POOL_ID,
    Limit: 60,
  });
  const usersResponse = await cognitoClient.send(usersCommand);
  const totalUsers = usersResponse.Users?.length || 0;

  // Get MFA statistics
  let mfaEnabled = 0;
  for (const user of usersResponse.Users || []) {
    try {
      const userCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: user.Username!,
      });
      const userResponse = await cognitoClient.send(userCommand);
      if (userResponse.UserMFASettingList && userResponse.UserMFASettingList.length > 0) {
        mfaEnabled++;
      }
    } catch {
      // Ignore errors for individual users
    }
  }

  // Get active sessions count (from DynamoDB)
  let activeSessions = 0;
  try {
    const sessionsCommand = new ScanCommand({
      TableName: SESSIONS_TABLE,
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: { ':active': true },
      Select: 'COUNT',
    });
    const sessionsResponse = await docClient.send(sessionsCommand);
    activeSessions = sessionsResponse.Count || 0;
  } catch {
    // Sessions table might not exist yet
  }

  // Calculate security score
  const mfaScore = totalUsers > 0 ? (mfaEnabled / totalUsers) * 40 : 0;
  const baseScore = 60; // Base security from using Cognito
  const securityScore = Math.round(baseScore + mfaScore);

  return NextResponse.json({
    overview: {
      totalUsers,
      mfaEnabled,
      mfaDisabled: totalUsers - mfaEnabled,
      activeSessions,
      securityScore,
      lastSecurityAudit: new Date().toISOString(),
    },
    recentActivity: [
      // This would come from audit logs in production
    ],
    alerts: mfaEnabled < totalUsers ? [
      {
        id: 'mfa-warning',
        type: 'warning',
        message: `${totalUsers - mfaEnabled} användare har inte aktiverat MFA`,
        timestamp: new Date().toISOString(),
      }
    ] : [],
  });
}

async function getSessions(searchParams: URLSearchParams) {
  const userId = searchParams.get('userId');
  
  try {
    const params: ScanCommandInput = {
      TableName: SESSIONS_TABLE,
    };

    if (userId) {
      params.FilterExpression = 'userId = :userId';
      params.ExpressionAttributeValues = { ':userId': userId };
    }

    const command = new ScanCommand(params);
    const response = await docClient.send(command);

    return NextResponse.json({
      sessions: response.Items || [],
    });
  } catch {
    // Return empty if table doesn't exist
    return NextResponse.json({ sessions: [] });
  }
}

async function getMFAStatus() {
  const usersCommand = new ListUsersCommand({
    UserPoolId: USER_POOL_ID,
    Limit: 60,
  });
  const usersResponse = await cognitoClient.send(usersCommand);

  const mfaStatuses: MFAStatus[] = [];

  for (const user of usersResponse.Users || []) {
    try {
      const userCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: user.Username!,
      });
      const userResponse = await cognitoClient.send(userCommand);
      
      const email = user.Attributes?.find(a => a.Name === 'email')?.Value;
      const hasMFA = !!(userResponse.UserMFASettingList && userResponse.UserMFASettingList.length > 0);

      mfaStatuses.push({
        userId: user.Username!,
        email: email || 'unknown',
        mfaEnabled: hasMFA,
        mfaType: hasMFA ? (userResponse.UserMFASettingList![0] as 'TOTP' | 'SMS' | 'SOFTWARE_TOKEN') : undefined,
      });
    } catch {
      // Skip users with errors
    }
  }

  return NextResponse.json({ users: mfaStatuses });
}

async function getSecurityPolicies() {
  try {
    const command = new ScanCommand({
      TableName: SECURITY_POLICIES_TABLE,
    });
    const response = await docClient.send(command);

    return NextResponse.json({
      policies: response.Items || getDefaultPolicies(),
    });
  } catch {
    // Return defaults if table doesn't exist
    return NextResponse.json({ policies: getDefaultPolicies() });
  }
}

function getDefaultPolicies(): SecurityPolicy[] {
  return [
    {
      id: 'mfa-policy',
      name: 'MFA-krav',
      type: 'mfa',
      enabled: false,
      config: {
        requireForAdmins: true,
        requireForAll: false,
        allowedMethods: ['TOTP', 'SMS'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'password-policy',
      name: 'Lösenordspolicy',
      type: 'password',
      enabled: true,
      config: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        maxAge: 90,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'session-policy',
      name: 'Sessionspolicy',
      type: 'session',
      enabled: true,
      config: {
        maxIdleMinutes: 30,
        maxSessionHours: 8,
        singleSessionPerDevice: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ip-policy',
      name: 'IP-begränsning',
      type: 'ip',
      enabled: false,
      config: {
        allowedIPs: [],
        blockedIPs: [],
        blockTorExits: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

// ============================================================================
// POST - Perform security actions
// ============================================================================

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'terminate-session':
        return await terminateSession(params.sessionId, params.userId);
      case 'terminate-all-sessions':
        return await terminateAllSessions(params.userId);
      case 'require-mfa':
        return await setMFARequirement(params.userId, params.required);
      case 'update-policy':
        return await updateSecurityPolicy(params.policy);
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to perform security action';
    console.error('Failed to perform security action:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function terminateSession(sessionId: string, userId: string) {
  // Delete from DynamoDB
  const command = new DeleteCommand({
    TableName: SESSIONS_TABLE,
    Key: { sessionId, userId },
  });
  await docClient.send(command);

  // Log audit entry
  console.log('[AUDIT] Session terminated', { sessionId, userId });

  return NextResponse.json({ success: true });
}

async function terminateAllSessions(userId: string) {
  // Sign out user globally from Cognito
  const command = new AdminUserGlobalSignOutCommand({
    UserPoolId: USER_POOL_ID,
    Username: userId,
  });
  await cognitoClient.send(command);

  // Log audit entry
  console.log('[AUDIT] All sessions terminated for user', { userId });

  return NextResponse.json({ success: true });
}

async function setMFARequirement(userId: string, required: boolean) {
  const command = new AdminSetUserMFAPreferenceCommand({
    UserPoolId: USER_POOL_ID,
    Username: userId,
    SoftwareTokenMfaSettings: {
      Enabled: required,
      PreferredMfa: required,
    },
  });
  await cognitoClient.send(command);

  // Log audit entry
  console.log('[AUDIT] MFA requirement updated', { userId, required });

  return NextResponse.json({ success: true });
}

async function updateSecurityPolicy(policy: SecurityPolicy) {
  policy.updatedAt = new Date().toISOString();

  const command = new PutCommand({
    TableName: SECURITY_POLICIES_TABLE,
    Item: policy,
  });
  await docClient.send(command);

  // Log audit entry
  console.log('[AUDIT] Security policy updated', { policyId: policy.id, policyName: policy.name });

  return NextResponse.json({ success: true, policy });
}

