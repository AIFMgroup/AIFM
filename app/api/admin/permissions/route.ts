import { NextRequest, NextResponse } from 'next/server';
import { 
  CognitoIdentityProviderClient,
  ListGroupsCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  UpdateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

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
const PERMISSIONS_TABLE = process.env.PERMISSIONS_TABLE_NAME || 'aifm-permissions';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

// ============================================================================
// Types
// ============================================================================

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  actions: string[];
}

interface Role {
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  precedence?: number;
  createdAt?: string;
  userCount?: number;
}

interface PermissionMatrix {
  roles: Role[];
  permissions: Permission[];
  matrix: Record<string, Record<string, boolean>>;
}

// ============================================================================
// Default permissions and roles
// ============================================================================

const DEFAULT_PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'dashboard.view', name: 'Visa dashboard', description: 'Visa huvuddashboard', category: 'Dashboard', actions: ['read'] },
  { id: 'dashboard.edit', name: 'Redigera dashboard', description: 'Anpassa dashboardwidgets', category: 'Dashboard', actions: ['read', 'write'] },
  
  // Accounting
  { id: 'accounting.view', name: 'Visa bokföring', description: 'Visa bokföringsdata', category: 'Bokföring', actions: ['read'] },
  { id: 'accounting.edit', name: 'Redigera bokföring', description: 'Skapa och redigera verifikationer', category: 'Bokföring', actions: ['read', 'write'] },
  { id: 'accounting.approve', name: 'Godkänna bokföring', description: 'Godkänna fakturor och verifikationer', category: 'Bokföring', actions: ['read', 'write', 'approve'] },
  { id: 'accounting.delete', name: 'Radera bokföring', description: 'Radera verifikationer', category: 'Bokföring', actions: ['read', 'write', 'delete'] },
  { id: 'accounting.export', name: 'Exportera bokföring', description: 'Exportera till Fortnox/SIE', category: 'Bokföring', actions: ['read', 'export'] },
  
  // Compliance
  { id: 'compliance.view', name: 'Visa compliance', description: 'Visa complianceinformation', category: 'Compliance', actions: ['read'] },
  { id: 'compliance.edit', name: 'Redigera compliance', description: 'Uppdatera compliancedokumentation', category: 'Compliance', actions: ['read', 'write'] },
  { id: 'compliance.report', name: 'Rapportera', description: 'Skapa och skicka rapporter', category: 'Compliance', actions: ['read', 'write', 'export'] },
  
  // CRM
  { id: 'crm.view', name: 'Visa CRM', description: 'Visa kunddata', category: 'CRM', actions: ['read'] },
  { id: 'crm.edit', name: 'Redigera CRM', description: 'Skapa och redigera kunder', category: 'CRM', actions: ['read', 'write'] },
  { id: 'crm.delete', name: 'Radera CRM', description: 'Radera kunddata', category: 'CRM', actions: ['read', 'write', 'delete'] },
  
  // Documents
  { id: 'documents.view', name: 'Visa dokument', description: 'Visa dokument', category: 'Dokument', actions: ['read'] },
  { id: 'documents.upload', name: 'Ladda upp dokument', description: 'Ladda upp nya dokument', category: 'Dokument', actions: ['read', 'write'] },
  { id: 'documents.delete', name: 'Radera dokument', description: 'Radera dokument', category: 'Dokument', actions: ['read', 'write', 'delete'] },
  { id: 'documents.share', name: 'Dela dokument', description: 'Dela dokument externt', category: 'Dokument', actions: ['read', 'share'] },
  
  // Admin
  { id: 'admin.users', name: 'Hantera användare', description: 'Skapa, redigera och radera användare', category: 'Admin', actions: ['read', 'write', 'delete'] },
  { id: 'admin.roles', name: 'Hantera roller', description: 'Skapa och redigera roller', category: 'Admin', actions: ['read', 'write'] },
  { id: 'admin.settings', name: 'Systeminställningar', description: 'Ändra systeminställningar', category: 'Admin', actions: ['read', 'write'] },
  { id: 'admin.audit', name: 'Visa granskningslogg', description: 'Visa audit logs', category: 'Admin', actions: ['read'] },
  { id: 'admin.security', name: 'Säkerhetsinställningar', description: 'Hantera MFA och sessioner', category: 'Admin', actions: ['read', 'write'] },
  
  // Workflows
  { id: 'workflows.view', name: 'Visa arbetsflöden', description: 'Visa arbetsflöden', category: 'Arbetsflöden', actions: ['read'] },
  { id: 'workflows.execute', name: 'Utföra arbetsflöden', description: 'Starta och slutföra arbetsflöden', category: 'Arbetsflöden', actions: ['read', 'execute'] },
  { id: 'workflows.manage', name: 'Hantera arbetsflöden', description: 'Skapa och redigera arbetsflöden', category: 'Arbetsflöden', actions: ['read', 'write', 'delete'] },
];

const DEFAULT_ROLES: Role[] = [
  {
    name: 'admin',
    description: 'Fullständig åtkomst till alla funktioner',
    permissions: DEFAULT_PERMISSIONS.map(p => p.id),
    isSystemRole: true,
    precedence: 1,
  },
  {
    name: 'executive',
    description: 'VD/Ledning - godkännande och översikt',
    permissions: [
      'dashboard.view', 'dashboard.edit',
      'accounting.view', 'accounting.approve', 'accounting.export',
      'compliance.view', 'compliance.report',
      'crm.view',
      'documents.view', 'documents.share',
      'workflows.view', 'workflows.execute',
      'admin.audit',
    ],
    isSystemRole: true,
    precedence: 2,
  },
  {
    name: 'manager',
    description: 'Avdelningschef - hantera team och godkänna',
    permissions: [
      'dashboard.view',
      'accounting.view', 'accounting.edit', 'accounting.approve',
      'compliance.view', 'compliance.edit',
      'crm.view', 'crm.edit',
      'documents.view', 'documents.upload', 'documents.share',
      'workflows.view', 'workflows.execute',
    ],
    isSystemRole: true,
    precedence: 3,
  },
  {
    name: 'accountant',
    description: 'Redovisningskonsult - bokföring och rapporter',
    permissions: [
      'dashboard.view',
      'accounting.view', 'accounting.edit', 'accounting.export',
      'compliance.view',
      'documents.view', 'documents.upload',
      'workflows.view', 'workflows.execute',
    ],
    isSystemRole: true,
    precedence: 4,
  },
  {
    name: 'compliance',
    description: 'Complianceansvarig',
    permissions: [
      'dashboard.view',
      'accounting.view',
      'compliance.view', 'compliance.edit', 'compliance.report',
      'documents.view', 'documents.upload',
      'workflows.view', 'workflows.execute', 'workflows.manage',
      'admin.audit',
    ],
    isSystemRole: true,
    precedence: 4,
  },
  {
    name: 'customer',
    description: 'Extern kund - begränsad åtkomst',
    permissions: [
      'dashboard.view',
      'documents.view',
    ],
    isSystemRole: true,
    precedence: 10,
  },
  {
    name: 'auditor',
    description: 'Revisor - läsåtkomst för granskning',
    permissions: [
      'dashboard.view',
      'accounting.view', 'accounting.export',
      'compliance.view',
      'documents.view',
      'admin.audit',
    ],
    isSystemRole: true,
    precedence: 5,
  },
];

// ============================================================================
// GET - Get permissions matrix
// ============================================================================

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'matrix';

    switch (type) {
      case 'roles':
        return await getRoles();
      case 'permissions':
        return await getPermissions();
      case 'matrix':
      default:
        return await getPermissionMatrix();
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch permissions';
    console.error('Failed to fetch permissions:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function getRoles() {
  // Get groups from Cognito
  const command = new ListGroupsCommand({
    UserPoolId: USER_POOL_ID,
  });
  const response = await cognitoClient.send(command);

  // Merge with default roles and get user counts
  const roles: Role[] = [];
  
  for (const group of response.Groups || []) {
    const defaultRole = DEFAULT_ROLES.find(r => r.name.toLowerCase() === group.GroupName?.toLowerCase());
    
    // Get user count for this group
    let userCount = 0;
    try {
      const usersCommand = new ListUsersInGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: group.GroupName!,
      });
      const usersResponse = await cognitoClient.send(usersCommand);
      userCount = usersResponse.Users?.length || 0;
    } catch {
      // Ignore errors
    }

    roles.push({
      name: group.GroupName || '',
      description: group.Description || defaultRole?.description,
      permissions: defaultRole?.permissions || [],
      isSystemRole: defaultRole?.isSystemRole || false,
      precedence: group.Precedence,
      createdAt: group.CreationDate?.toISOString(),
      userCount,
    });
  }

  // Add any default roles not in Cognito
  for (const defaultRole of DEFAULT_ROLES) {
    if (!roles.find(r => r.name.toLowerCase() === defaultRole.name.toLowerCase())) {
      roles.push({ ...defaultRole, userCount: 0 });
    }
  }

  return NextResponse.json({ roles });
}

async function getPermissions() {
  // Try to get custom permissions from DynamoDB
  try {
    const command = new ScanCommand({
      TableName: PERMISSIONS_TABLE,
    });
    const response = await docClient.send(command);
    
    if (response.Items && response.Items.length > 0) {
      return NextResponse.json({ permissions: response.Items });
    }
  } catch {
    // Table doesn't exist, use defaults
  }

  return NextResponse.json({ permissions: DEFAULT_PERMISSIONS });
}

async function getPermissionMatrix() {
  const [rolesResponse, permissionsResponse] = await Promise.all([
    getRoles(),
    getPermissions(),
  ]);

  const rolesData = await rolesResponse.json();
  const permissionsData = await permissionsResponse.json();

  // Build matrix
  const matrix: Record<string, Record<string, boolean>> = {};
  
  for (const role of rolesData.roles) {
    matrix[role.name] = {};
    for (const permission of permissionsData.permissions) {
      matrix[role.name][permission.id] = role.permissions.includes(permission.id);
    }
  }

  return NextResponse.json({
    roles: rolesData.roles,
    permissions: permissionsData.permissions,
    matrix,
  });
}

// ============================================================================
// POST - Create role or update permissions
// ============================================================================

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-role':
        return await createRole(data);
      case 'update-role-permissions':
        return await updateRolePermissions(data);
      case 'assign-role':
        return await assignRoleToUser(data);
      case 'remove-role':
        return await removeRoleFromUser(data);
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process permissions action';
    console.error('Failed to process permissions action:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function createRole(data: { name: string; description?: string; permissions?: string[] }) {
  // Create group in Cognito
  const command = new CreateGroupCommand({
    UserPoolId: USER_POOL_ID,
    GroupName: data.name,
    Description: data.description,
  });
  await cognitoClient.send(command);

  // Store permissions in DynamoDB
  if (data.permissions && data.permissions.length > 0) {
    const putCommand = new PutCommand({
      TableName: PERMISSIONS_TABLE,
      Item: {
        id: `role-${data.name}`,
        type: 'role-permissions',
        roleName: data.name,
        permissions: data.permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    await docClient.send(putCommand);
  }

  console.log('[AUDIT] Role created', { roleName: data.name });

  return NextResponse.json({ 
    success: true, 
    role: { 
      name: data.name, 
      description: data.description, 
      permissions: data.permissions || [],
      isSystemRole: false,
      userCount: 0,
    } 
  });
}

async function updateRolePermissions(data: { roleName: string; permissions: string[] }) {
  // Store updated permissions in DynamoDB
  const putCommand = new PutCommand({
    TableName: PERMISSIONS_TABLE,
    Item: {
      id: `role-${data.roleName}`,
      type: 'role-permissions',
      roleName: data.roleName,
      permissions: data.permissions,
      updatedAt: new Date().toISOString(),
    },
  });
  await docClient.send(putCommand);

  console.log('[AUDIT] Role permissions updated', { roleName: data.roleName, permissionCount: data.permissions.length });

  return NextResponse.json({ success: true });
}

async function assignRoleToUser(data: { username: string; roleName: string }) {
  const command = new AdminAddUserToGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: data.username,
    GroupName: data.roleName,
  });
  await cognitoClient.send(command);

  console.log('[AUDIT] Role assigned to user', { username: data.username, roleName: data.roleName });

  return NextResponse.json({ success: true });
}

async function removeRoleFromUser(data: { username: string; roleName: string }) {
  const command = new AdminRemoveUserFromGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: data.username,
    GroupName: data.roleName,
  });
  await cognitoClient.send(command);

  console.log('[AUDIT] Role removed from user', { username: data.username, roleName: data.roleName });

  return NextResponse.json({ success: true });
}

// ============================================================================
// DELETE - Delete role
// ============================================================================

export async function DELETE(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const roleName = searchParams.get('roleName');

    if (!roleName) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check if it's a system role
    if (DEFAULT_ROLES.find(r => r.name === roleName && r.isSystemRole)) {
      return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 400 });
    }

    // Delete from Cognito
    const command = new DeleteGroupCommand({
      UserPoolId: USER_POOL_ID,
      GroupName: roleName,
    });
    await cognitoClient.send(command);

    console.log('[AUDIT] Role deleted', { roleName });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete role';
    console.error('Failed to delete role:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


