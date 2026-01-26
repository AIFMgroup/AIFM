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
  // Check admin role
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // List all users
    const listCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
    });
    
    const usersResponse = await cognitoClient.send(listCommand);
    
    // Get groups for each user
    const usersWithGroups = await Promise.all(
      (usersResponse.Users || []).map(async (user) => {
        try {
          const groupsCommand = new AdminListGroupsForUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: user.Username!,
          });
          const groupsResponse = await cognitoClient.send(groupsCommand);
          const groups = groupsResponse.Groups?.map(g => g.GroupName!) || [];
          return formatUser(user, groups);
        } catch {
          return formatUser(user, []);
        }
      })
    );

    // Also get available groups
    const groupsCommand = new ListGroupsCommand({
      UserPoolId: USER_POOL_ID,
    });
    const groupsResponse = await cognitoClient.send(groupsCommand);
    const availableGroups = groupsResponse.Groups?.map(g => ({
      name: g.GroupName,
      description: g.Description,
    })) || [];

    return NextResponse.json({
      users: usersWithGroups,
      groups: availableGroups,
    });
  } catch (error: any) {
    console.error('Failed to list users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list users' },
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

    // Add to groups if specified
    if (groups && groups.length > 0) {
      for (const groupName of groups) {
        const addGroupCommand = new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          GroupName: groupName,
        });
        await cognitoClient.send(addGroupCommand);
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

      // Add to new groups
      for (const group of groups) {
        if (!currentGroups.includes(group)) {
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



