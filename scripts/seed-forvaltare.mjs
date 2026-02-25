#!/usr/bin/env node
/**
 * Seed script: Create förvaltare accounts (no welcome email) and assign funds.
 *
 * Usage:
 *   node scripts/seed-forvaltare.mjs
 *
 * Requires AWS credentials configured (env vars, SSO profile, or EC2 role).
 * Reads COGNITO_USER_POOL_ID from .env.local or environment.
 */

import { readFileSync } from 'fs';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand, CreateGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const REGION = process.env.AWS_REGION || 'eu-north-1';

function loadUserPoolId() {
  if (process.env.COGNITO_USER_POOL_ID) return process.env.COGNITO_USER_POOL_ID;
  try {
    const envLocal = readFileSync('.env.local', 'utf-8');
    const match = envLocal.match(/COGNITO_USER_POOL_ID=(.+)/);
    if (match) return match[1].trim();
  } catch { /* ignore */ }
  throw new Error('COGNITO_USER_POOL_ID not found. Set it in .env.local or as env var.');
}

const USER_POOL_ID = loadUserPoolId();
const ASSIGNMENTS_TABLE = process.env.USER_FUND_ASSIGNMENTS_TABLE || 'aifm-user-fund-assignments';
const COGNITO_GROUP = 'forvaltare';
const ADMIN_EMAIL = 'christopher.genberg@aifm.se';

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const USERS = [
  { email: 'eric.strand@auagfonder.se', name: 'Eric Strand' },
  { email: 'stefan.westin@aifm.se', name: 'Stefan Westin' },
  { email: 'patrik.wallenberg@aifm.se', name: 'Patrik Wallenberg' },
  { email: 'magnus.nicklasson@aifm.se', name: 'Magnus Nicklasson' },
  { email: 'maria.blidstedt@siriusam.se', name: 'Maria Blidstedt' },
  { email: 'fredrik@sensuminvestment.se', name: 'Fredrik Hegbart' },
  { email: 'jh.von.dahn@soic.se', name: 'John Henric Von Dahn' },
];

const FUNDS = [
  { fundId: 'auag-essential-metals', fundName: 'AuAg Essential Metals', article: '8' },
  { fundId: 'auag-gold-rush', fundName: 'AuAg Gold Rush', article: '8' },
  { fundId: 'auag-precious-green', fundName: 'AuAg Precious Green', article: '8' },
  { fundId: 'auag-silver-bullet', fundName: 'AuAg Silver Bullet', article: '8' },
  { fundId: 'epoque', fundName: 'EPOQUE', article: '6' },
  { fundId: 'go-blockchain', fundName: 'Go Blockchain Fund', article: '6' },
  { fundId: 'metaspace', fundName: 'MetaSpace Fund', article: '6' },
  { fundId: 'plain-capital-bronx', fundName: 'Plain Capital BronX', article: '6' },
  { fundId: 'plain-capital-lunatix', fundName: 'Plain Capital LunatiX', article: '6' },
  { fundId: 'plain-capital-styx', fundName: 'Plain Capital StyX', article: '6' },
  { fundId: 'proethos', fundName: 'Proethos Fond', article: '9' },
  { fundId: 'sam-aktiv-ranta', fundName: 'SAM Aktiv Ränta', article: '6' },
  { fundId: 'sensum-strategy-global', fundName: 'Sensum Strategy Global', article: '8' },
  { fundId: 'soic-dynamic-china', fundName: 'SOIC Dynamic China', article: '6' },
  // Vinga will be added later when Stefan Westfeldt's email arrives
  // { fundId: 'vinga-corporate-bond', fundName: 'Vinga Corporate Bond', article: '8' },
];

const ASSIGNMENTS = [
  { fundId: 'auag-essential-metals', emails: ['eric.strand@auagfonder.se'] },
  { fundId: 'auag-gold-rush', emails: ['eric.strand@auagfonder.se'] },
  { fundId: 'auag-precious-green', emails: ['eric.strand@auagfonder.se'] },
  { fundId: 'auag-silver-bullet', emails: ['eric.strand@auagfonder.se'] },
  { fundId: 'epoque', emails: ['stefan.westin@aifm.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'go-blockchain', emails: ['stefan.westin@aifm.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'metaspace', emails: ['magnus.nicklasson@aifm.se'] },
  { fundId: 'plain-capital-bronx', emails: ['stefan.westin@aifm.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'plain-capital-lunatix', emails: ['stefan.westin@aifm.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'plain-capital-styx', emails: ['stefan.westin@aifm.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'proethos', emails: ['stefan.westin@aifm.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'sam-aktiv-ranta', emails: ['maria.blidstedt@siriusam.se'] },
  { fundId: 'sensum-strategy-global', emails: ['fredrik@sensuminvestment.se', 'patrik.wallenberg@aifm.se'] },
  { fundId: 'soic-dynamic-china', emails: ['jh.von.dahn@soic.se'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTempPassword() {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const specials = '!@#$%';
  const all = lower + upper + digits;
  // Guarantee at least one of each required type
  let pw = '';
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += specials[Math.floor(Math.random() * specials.length)];
  for (let i = 0; i < 8; i++) pw += all[Math.floor(Math.random() * all.length)];
  // Shuffle
  pw = pw.split('').sort(() => Math.random() - 0.5).join('');
  return pw;
}

async function ensureGroupExists(groupName) {
  try {
    await cognito.send(new CreateGroupCommand({
      GroupName: groupName,
      UserPoolId: USER_POOL_ID,
      Description: `${groupName} role`,
    }));
    console.log(`  [Group] Created '${groupName}'`);
  } catch (err) {
    if (err.name === 'GroupExistsException') {
      console.log(`  [Group] '${groupName}' already exists`);
    } else {
      throw err;
    }
  }
}

async function userExists(email) {
  try {
    await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    }));
    return true;
  } catch (err) {
    if (err.name === 'UserNotFoundException') return false;
    throw err;
  }
}

async function createUser(email, name) {
  const exists = await userExists(email);
  if (exists) {
    console.log(`  [Cognito] User ${email} already exists – skipping creation`);
    // Still add to group in case they're not in it
    try {
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: COGNITO_GROUP,
      }));
      console.log(`  [Cognito] Ensured ${email} is in '${COGNITO_GROUP}' group`);
    } catch (err) {
      console.warn(`  [Cognito] Could not add to group: ${err.message}`);
    }
    return;
  }

  const tempPassword = generateTempPassword();
  await cognito.send(new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: name },
    ],
    TemporaryPassword: tempPassword,
    MessageAction: 'SUPPRESS', // No welcome email
  }));
  console.log(`  [Cognito] Created ${email} (temp password: ${tempPassword})`);

  await cognito.send(new AdminAddUserToGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    GroupName: COGNITO_GROUP,
  }));
  console.log(`  [Cognito] Added ${email} to '${COGNITO_GROUP}' group`);
}

async function assignFund(email, fund) {
  const now = new Date().toISOString();
  await dynamo.send(new PutCommand({
    TableName: ASSIGNMENTS_TABLE,
    Item: {
      PK: `USER#${email}`,
      SK: `FUND#${fund.fundId}`,
      GSI1PK: `FUND#${fund.fundId}`,
      GSI1SK: `USER#${email}`,
      email,
      fundId: fund.fundId,
      fundName: fund.fundName,
      article: fund.article,
      assignedAt: now,
      assignedBy: ADMIN_EMAIL,
    },
  }));
  console.log(`  [DynamoDB] ${email} → ${fund.fundName}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== AIFM Förvaltare Seed ===');
  console.log(`User Pool: ${USER_POOL_ID}`);
  console.log(`Region:    ${REGION}`);
  console.log(`Table:     ${ASSIGNMENTS_TABLE}`);
  console.log('');

  // 1. Ensure forvaltare group
  console.log('Step 1: Ensure Cognito group');
  await ensureGroupExists(COGNITO_GROUP);
  console.log('');

  // 2. Create users
  console.log('Step 2: Create users (no welcome emails)');
  for (const u of USERS) {
    await createUser(u.email, u.name);
  }
  console.log('');

  // 3. Assign funds
  console.log('Step 3: Assign funds');
  const fundMap = new Map(FUNDS.map(f => [f.fundId, f]));
  for (const a of ASSIGNMENTS) {
    const fund = fundMap.get(a.fundId);
    if (!fund) { console.warn(`  Unknown fundId: ${a.fundId}`); continue; }
    for (const email of a.emails) {
      await assignFund(email, fund);
    }
  }

  console.log('');
  console.log('Done! Summary:');
  console.log(`  Users created/verified: ${USERS.length}`);
  console.log(`  Fund assignments:       ${ASSIGNMENTS.reduce((n, a) => n + a.emails.length, 0)}`);
  console.log('');
  console.log('Note: Vinga Corporate Bond will be added when Stefan Westfeldt\'s email is provided.');
  console.log('Note: Users have temporary passwords. They will need to set new passwords on first login.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
