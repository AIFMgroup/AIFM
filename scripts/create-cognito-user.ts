/**
 * Create a single Cognito user with permanent password.
 * Run from aifm-frontend with .env.local (or env) containing COGNITO_USER_POOL_ID and AWS credentials.
 *
 * Usage: npx tsx scripts/create-cognito-user.ts <email> <password> [name]
 * Example: npx tsx scripts/create-cognito-user.ts robert.bratt@aifm.se 'AIFM123!' 'Robert Bratt'
 */

import { config } from 'dotenv';

// Load .env.local first, then .env
config({ path: '.env.local' });
config({ path: '.env' });

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  ListGroupsCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'eu-north-1';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || email.split('@')[0];

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-cognito-user.ts <email> <password> [name]');
    process.exit(1);
  }

  if (!USER_POOL_ID) {
    console.error('COGNITO_USER_POOL_ID is not set (check .env.local or .env)');
    process.exit(1);
  }

  const client = new CognitoIdentityProviderClient({ region: REGION });

  try {
    // Create user (suppress invite email)
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: name },
        ],
        TemporaryPassword: password,
        MessageAction: 'SUPPRESS',
      })
    );
    console.log('User created:', email);

    // Set permanent password so they are not forced to change on first login
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        Password: password,
        Permanent: true,
      })
    );
    console.log('Permanent password set.');

    // Add to "Users" group if it exists
    try {
      const { Groups } = await client.send(
        new ListGroupsCommand({ UserPoolId: USER_POOL_ID })
      );
      const usersGroup = Groups?.find((g) => g.GroupName === 'Users' || g.GroupName === 'users');
      if (usersGroup) {
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            GroupName: usersGroup.GroupName!,
          })
        );
        console.log('Added to group:', usersGroup.GroupName);
      }
    } catch {
      // ignore if no groups or add fails
    }

    console.log('Done. User can log in with', email, 'and the given password.');
  } catch (err: any) {
    if (err.name === 'UsernameExistsException') {
      console.log('User already exists. Setting permanent password only...');
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          Password: password,
          Permanent: true,
        })
      );
      console.log('Done. Password updated.');
    } else {
      console.error(err);
      process.exit(1);
    }
  }
}

main();
