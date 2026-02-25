import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { getSession } from '@/lib/auth/session';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.DELEGATION_SUBMISSIONS_TABLE || 'aifm-delegation-submissions';

/** GET: list submissions for current user, or get one by id */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.email ?? null;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const res = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: 'SUB', sk: id },
        })
      );
      const item = res.Item;
      if (!item) {
        return NextResponse.json({ error: 'Inlämning hittades inte' }, { status: 404 });
      }
      if (userEmail && item.createdByEmail !== userEmail) {
        return NextResponse.json({ error: 'Åtkomst nekas' }, { status: 403 });
      }
      return NextResponse.json({
        submission: {
          id: item.sk,
          year: item.year,
          sfdrArticle: item.sfdrArticle ?? '',
          answers: item.answers ?? {},
          answerDetails: item.answerDetails ?? {},
          underlag: item.underlag ?? {},
          signatureDate: item.signatureDate ?? '',
          signatureName: item.signatureName ?? '',
          signatureCompany: item.signatureCompany ?? '',
          status: item.status ?? 'draft',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          createdByEmail: item.createdByEmail,
        },
      });
    }

    if (!userEmail) {
      return NextResponse.json({ submissions: [] });
    }

    try {
      const listRes = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'byUser',
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':prefix': userEmail + '#',
          },
        })
      );
      const submissions = (listRes.Items ?? []).map((i) => ({
        id: i.submissionId,
        year: i.year,
        status: i.status ?? 'draft',
        updatedAt: i.updatedAt,
      }));
      return NextResponse.json({ submissions });
    } catch (queryErr) {
      if (
        queryErr &&
        typeof queryErr === 'object' &&
        'name' in queryErr &&
        (queryErr as { name: string }).name === 'ValidationException'
      ) {
        return NextResponse.json({ submissions: [] });
      }
      throw queryErr;
    }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      ('name' in err && err.name === 'ResourceNotFoundException') &&
      'message' in err &&
      String(err.message).includes('Table')
    ) {
      return NextResponse.json({ submissions: [], submission: null });
    }
    console.error('[Delegation submissions] GET error:', err);
    return NextResponse.json(
      { error: 'Kunde inte hämta inlämnanden' },
      { status: 500 }
    );
  }
}

/** POST: create or update a submission */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.email ?? 'anonymous';

    const body = await request.json();
    const {
      id,
      year,
      sfdrArticle,
      answers,
      answerDetails,
      underlag,
      signatureDate,
      signatureName,
      signatureCompany,
      status = 'draft',
    } = body;

    const now = new Date().toISOString();
    const submissionId = id || `del-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let createdAt = now;
    if (id) {
      const existing = await docClient.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'SUB', sk: id } })
      );
      if (existing.Item?.createdAt) createdAt = existing.Item.createdAt as string;
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'SUB',
          sk: submissionId,
          year: year ?? new Date().getFullYear(),
          sfdrArticle: sfdrArticle ?? '',
          answers: answers ?? {},
          answerDetails: answerDetails ?? {},
          underlag: underlag ?? {},
          signatureDate: signatureDate ?? '',
          signatureName: signatureName ?? '',
          signatureCompany: signatureCompany ?? '',
          status: status ?? 'draft',
          createdByEmail: userEmail,
          createdAt,
          updatedAt: now,
        },
      })
    );

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'USER',
          sk: `${userEmail}#${submissionId}`,
          submissionId,
          year: year ?? new Date().getFullYear(),
          status: status ?? 'draft',
          updatedAt: now,
        },
      })
    );

    return NextResponse.json({
      id: submissionId,
      updatedAt: now,
    });
  } catch (err) {
    console.error('[Delegation submissions] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte spara' },
      { status: 500 }
    );
  }
}
