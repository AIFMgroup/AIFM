import { NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { cookies } from 'next/headers';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'eu-north-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

function getUserAttribute(user: { Attributes?: { Name: string; Value: string }[] }, attrName: string): string | undefined {
  const attr = user.Attributes?.find((a) => a.Name === attrName);
  return attr?.Value;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sub || payload.email || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!USER_POOL_ID) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const listCommand = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
    });
    const usersResponse = await cognitoClient.send(listCommand);
    const users = usersResponse.Users || [];

    const colleagues = users
      .filter((user) => {
        if (!user.Enabled || user.UserStatus !== 'CONFIRMED') return false;
        const username = user.Username ?? '';
        const email = getUserAttribute(user, 'email') ?? '';
        const sub = getUserAttribute(user, 'sub') ?? '';
        if (currentUserId === username || currentUserId === email || currentUserId === sub) return false;
        return true;
      })
      .map((user) => ({
        username: user.Username ?? '',
        name: getUserAttribute(user, 'name') || getUserAttribute(user, 'custom:name') || getUserAttribute(user, 'email') || '',
        email: getUserAttribute(user, 'email') || '',
      }))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

    return NextResponse.json({ colleagues });
  } catch (error) {
    console.error('Error listing colleagues:', error);
    return NextResponse.json({ error: 'Failed to load colleagues' }, { status: 500 });
  }
}
