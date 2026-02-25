import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { getSession } from '@/lib/auth/session';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.INVESTMENT_ANALYSIS_TABLE || 'aifm-investment-analysis';

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
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'INV', sk: id } })
    );
    const item = res.Item;
    if (!item) {
      return NextResponse.json({ error: 'Analys hittades inte' }, { status: 404 });
    }
    if (userEmail && item.createdByEmail !== userEmail) {
      return NextResponse.json({ error: 'Åtkomst nekas' }, { status: 403 });
    }
    return NextResponse.json({
      submission: {
        id: item.sk,
        companyName: item.companyName ?? '',
        sfdrArticle: item.sfdrArticle ?? '',
        investmentStrategy: item.investmentStrategy ?? '',
        analysis: item.analysis ?? {},
        status: item.status ?? 'draft',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ResourceNotFoundException') {
      return NextResponse.json({ error: 'Tabell ej konfigurerad' }, { status: 503 });
    }
    console.error('[InvestmentAnalysis submissions] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte hämta' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.email ?? 'anonymous';

    const body = await request.json();
    const {
      id,
      companyName,
      sfdrArticle,
      investmentStrategy,
      analysis,
      status = 'draft',
    } = body;

    const now = new Date().toISOString();
    const submissionId = id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let createdAt = now;
    if (id) {
      try {
        const existing = await docClient.send(
          new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'INV', sk: id } })
        );
        if (existing.Item?.createdAt) createdAt = existing.Item.createdAt as string;
      } catch { /* new */ }
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'INV',
          sk: submissionId,
          companyName: companyName ?? '',
          sfdrArticle: sfdrArticle ?? '',
          investmentStrategy: investmentStrategy ?? '',
          analysis: analysis ?? {},
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
          companyName: companyName ?? '',
          status: status ?? 'draft',
          updatedAt: now,
        },
      })
    );

    return NextResponse.json({ id: submissionId, updatedAt: now });
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: 'Investeringsanalys-tabellen är inte konfigurerad.' },
        { status: 503 }
      );
    }
    console.error('[InvestmentAnalysis submissions] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte spara' },
      { status: 500 }
    );
  }
}
