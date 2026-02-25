import { NextRequest, NextResponse } from 'next/server';
import { 
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  ListGroupsCommand,
  CreateGroupCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// ============================================================================
// Cognito Client Setup
// ============================================================================

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-north-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

// ============================================================================
// Helper Functions
// ============================================================================

function getUserAttribute(user: any, attrName: string): string | undefined {
  const attr = user.Attributes?.find((a: any) => a.Name === attrName);
  return attr?.Value;
}

async function ensureGroupExists(groupName: string) {
  try {
    await cognitoClient.send(new CreateGroupCommand({
      UserPoolId: USER_POOL_ID,
      GroupName: groupName,
    }));
  } catch (err: any) {
    if (err.name !== 'GroupExistsException') {
      throw err;
    }
  }
}

function formatUser(user: any, groups?: string[]) {
  return {
    username: user.Username,
    email: getUserAttribute(user, 'email'),
    name: getUserAttribute(user, 'name') || getUserAttribute(user, 'custom:name'),
    phone: getUserAttribute(user, 'phone_number'),
    status: user.UserStatus,
    enabled: user.Enabled,
    created: user.UserCreateDate?.toISOString(),
    modified: user.UserLastModifiedDate?.toISOString(),
    groups: groups || [],
  };
}

// ============================================================================
// GET - List all users
// ============================================================================

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!USER_POOL_ID) {
    console.error('COGNITO_USER_POOL_ID is not set');
    return NextResponse.json({ error: 'Server misconfiguration: User Pool ID missing' }, { status: 500 });
  }

  try {
    // List all users (paginate if needed)
    let allUsers: any[] = [];
    let paginationToken: string | undefined;

    do {
      const listCommand = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: 60,
        PaginationToken: paginationToken,
      });
      const usersResponse = await cognitoClient.send(listCommand);
      allUsers = allUsers.concat(usersResponse.Users || []);
      paginationToken = usersResponse.PaginationToken;
    } while (paginationToken);

    // Get groups for each user (parallel batches of 10 for rate-limit safety)
    const usersWithGroups: ReturnType<typeof formatUser>[] = [];
    const BATCH_SIZE = 10;
    for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
      const batch = allUsers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (user) => {
          try {
            const groupsCommand = new AdminListGroupsForUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: user.Username!,
            });
            const groupsResponse = await cognitoClient.send(groupsCommand);
            const groups = groupsResponse.Groups?.map(g => g.GroupName!) || [];
            return formatUser(user, groups);
          } catch (err: any) {
            console.warn(`Failed to get groups for ${user.Username}: ${err?.name} ${err?.message}`);
            return formatUser(user, []);
          }
        })
      );
      usersWithGroups.push(...batchResults);
    }

    // Also get available groups from Cognito
    let cognitoGroups: { name: string; description: string | undefined }[] = [];
    try {
      const groupsCommand = new ListGroupsCommand({
        UserPoolId: USER_POOL_ID,
      });
      const groupsResponse = await cognitoClient.send(groupsCommand);
      cognitoGroups = (groupsResponse.Groups || []).map(g => ({
        name: g.GroupName || '',
        description: g.Description,
      }));
    } catch (err) {
      console.warn('Failed to list groups:', err);
    }

    // Merge with standard roles to ensure they always appear
    const STANDARD_GROUPS = [
      { name: 'admin', description: 'Fullständig åtkomst' },
      { name: 'executive', description: 'VD/Ledning' },
      { name: 'manager', description: 'Avdelningschef' },
      { name: 'operation', description: 'Operations - fondadministration' },
      { name: 'forvaltare', description: 'Fondförvaltare' },
      { name: 'accountant', description: 'Redovisning' },
      { name: 'compliance', description: 'Complianceansvarig' },
      { name: 'auditor', description: 'Revisor' },
      { name: 'customer', description: 'Extern kund' },
    ];

    const existingNames = new Set(cognitoGroups.map(g => g.name.toLowerCase()));
    const mergedGroups = [...cognitoGroups];
    for (const std of STANDARD_GROUPS) {
      if (!existingNames.has(std.name.toLowerCase())) {
        mergedGroups.push(std);
      }
    }

    return NextResponse.json({
      users: usersWithGroups,
      groups: mergedGroups,
    });
  } catch (error: any) {
    const msg = error?.message || 'Failed to list users';
    const name = error?.name || 'UnknownError';
    console.error('Failed to list users:', name, msg);
    return NextResponse.json(
      { error: `${name}: ${msg}` },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create new user
// ============================================================================

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, name, tempPassword, groups, sendInvite } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Create user
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        ...(name ? [{ Name: 'name', Value: name }] : []),
      ],
      TemporaryPassword: tempPassword,
      MessageAction: sendInvite === false ? 'SUPPRESS' : undefined,
    });

    const createResponse = await cognitoClient.send(createCommand);

    // Add to groups if specified (auto-create group if it doesn't exist)
    if (groups && groups.length > 0) {
      for (const groupName of groups) {
        await ensureGroupExists(groupName);
        await cognitoClient.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          GroupName: groupName,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      user: formatUser(createResponse.User, groups || []),
    });
  } catch (error: any) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update user
// ============================================================================

export async function PATCH(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { username, action, name, groups, enabled, newPassword } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Handle different actions
    if (action === 'enable') {
      await cognitoClient.send(new AdminEnableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      }));
    } else if (action === 'disable') {
      await cognitoClient.send(new AdminDisableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      }));
    } else if (action === 'resetPassword' && newPassword) {
      await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: newPassword,
        Permanent: false, // Force password change on next login
      }));
    } else if (action === 'updateGroups' && groups) {
      // Get current groups
      const currentGroupsResponse = await cognitoClient.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
        })
      );
      const currentGroups = currentGroupsResponse.Groups?.map(g => g.GroupName!) || [];

      // Remove from old groups
      for (const group of currentGroups) {
        if (!groups.includes(group)) {
          await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: group,
          }));
        }
      }

      // Add to new groups (auto-create if needed)
      for (const group of groups) {
        if (!currentGroups.includes(group)) {
          await ensureGroupExists(group);
          await cognitoClient.send(new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: group,
          }));
        }
      }
    } else if (name) {
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: [{ Name: 'name', Value: name }],
      }));
    }

    // Get updated user
    const userResponse = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    }));

    const groupsResponse = await cognitoClient.send(new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    }));

    return NextResponse.json({
      success: true,
      user: formatUser(userResponse, groupsResponse.Groups?.map(g => g.GroupName!) || []),
    });
  } catch (error: any) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete user
// ============================================================================

export async function DELETE(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    await cognitoClient.send(new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    }));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}



