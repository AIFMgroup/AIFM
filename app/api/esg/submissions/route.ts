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

const TABLE_NAME = process.env.ESG_SUBMISSIONS_TABLE || 'aifm-esg-submissions';

/** GET: get one submission by id */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.email ?? null;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id saknas' }, { status: 400 });
    }
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'SUB', sk: id },
      })
    );
    const item = res.Item;
    if (!item) {
      return NextResponse.json({ error: 'ESG-inlämning hittades inte' }, { status: 404 });
    }
    if (userEmail && item.createdByEmail !== userEmail) {
      return NextResponse.json({ error: 'Åtkomst nekas' }, { status: 403 });
    }
    return NextResponse.json({
      submission: {
        id: item.sk,
        answers: item.answers ?? {},
        answerDetails: item.answerDetails ?? {},
        signatureDate: item.signatureDate ?? '',
        signatureName: item.signatureName ?? '',
        signatureCompany: item.signatureCompany ?? '',
        status: item.status ?? 'draft',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ResourceNotFoundException'
    ) {
      return NextResponse.json({ error: 'Tabell ej konfigurerad' }, { status: 503 });
    }
    console.error('[ESG submissions] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte hämta' },
      { status: 500 }
    );
  }
}

/** POST: create or update an ESG submission */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.email ?? 'anonymous';

    const body = await request.json();
    const {
      id,
      sfdrArticle,
      answers,
      answerDetails,
      signatureDate,
      signatureName,
      signatureCompany,
      status = 'draft',
    } = body;

    const now = new Date().toISOString();
    const submissionId = id || `esg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let createdAt = now;
    if (id) {
      try {
        const existing = await docClient.send(
          new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'SUB', sk: id } })
        );
        if (existing.Item?.createdAt) createdAt = existing.Item.createdAt as string;
      } catch {
        // new submission
      }
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'SUB',
          sk: submissionId,
          sfdrArticle: sfdrArticle ?? '',
          answers: answers ?? {},
          answerDetails: answerDetails ?? {},
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
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ResourceNotFoundException'
    ) {
      return NextResponse.json(
        { error: 'ESG-inlämningar är inte konfigurerade. Sätt ESG_SUBMISSIONS_TABLE.' },
        { status: 503 }
      );
    }
    console.error('[ESG submissions] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte spara' },
      { status: 500 }
    );
  }
}
