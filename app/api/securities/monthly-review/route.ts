/**
 * Cron endpoint: monthly AI review of all approved securities.
 * Uses Claude 4.6 Opus to re-evaluate each approved security against fund conditions.
 * If the AI detects significant changes or concerns, a notification is created for the förvaltare.
 *
 * Call with: GET /api/securities/monthly-review
 * Header: x-aifm-cron-secret: <AIFM_CRON_SECRET>
 *
 * Designed to run once per month via an external scheduler (e.g. EventBridge, cron.org).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { listApprovalsByStatus } from '@/lib/integrations/securities';
import type { SecurityApprovalRequest } from '@/lib/integrations/securities';
import {
  getESGFundConfig,
} from '@/lib/integrations/securities/esg-fund-configs';
import { createNotification } from '@/lib/notifications/notification-store';
import { getFundDocumentText } from '@/lib/fund-documents/fund-document-store';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const MODEL_ID = 'eu.anthropic.claude-opus-4-6-v1';

function buildReviewPrompt(approval: SecurityApprovalRequest, uploadedDocText?: string): string {
  const fundConfig = getESGFundConfig(approval.fundId, approval.fundName);

  const lines: string[] = [];
  lines.push('Du är en senior riskanalytiker som utför en månatlig omprövning av ett redan godkänt värdepapper.');
  lines.push('Bedöm om det finns DRASTISKA eller VÄSENTLIGA FÖRÄNDRINGAR som motiverar omprövning.');
  lines.push('');

  if (fundConfig) {
    lines.push(`## Fondvillkor: ${fundConfig.fundName} (Artikel ${fundConfig.article})`);
    if (fundConfig.exclusions.length > 0) {
      lines.push('Uteslutningskriterier:');
      for (const ex of fundConfig.exclusions) {
        lines.push(`  - ${ex.label}: max ${ex.threshold}% (${ex.severity})`);
      }
    }
    if (fundConfig.promotedCharacteristics) {
      lines.push('Främjade egenskaper: ' + fundConfig.promotedCharacteristics.join(', '));
    }
    if (fundConfig.engagementProcess) {
      lines.push(`Engagemangsprocess: risktröskel < ${fundConfig.engagementProcess.riskThreshold}, tidslinje ${fundConfig.engagementProcess.timelineMonths} mån`);
    }
    lines.push('');
  }

  const basic = approval.basicInfo;
  lines.push('## Värdepapper');
  lines.push(`Namn: ${basic?.name || 'Okänt'}`);
  lines.push(`ISIN: ${basic?.isin || 'Ej angivet'}`);
  lines.push(`Typ: ${basic?.type || 'Okänt'}`);
  lines.push(`Sektor: ${basic?.gicsSector || 'Ej angivet'}`);
  lines.push(`Land: ${basic?.country || 'Ej angivet'}`);
  lines.push(`Emittent: ${basic?.emitter || 'Ej angivet'}`);
  lines.push(`Fond: ${approval.fundName}`);
  lines.push(`Godkänt: ${approval.reviewedAt || approval.updatedAt}`);
  lines.push(`Utgår: ${approval.expiresAt || 'Ej satt'}`);
  lines.push('');

  const esg = approval.esgInfo;
  if (esg) {
    lines.push('## ESG-data vid godkännande');
    if (esg.fundArticle) lines.push(`Fondartikel: ${esg.fundArticle}`);
    if (esg.envRiskLevel) lines.push(`Miljörisk: ${esg.envRiskLevel}`);
    if (esg.socialRiskLevel) lines.push(`Social risk: ${esg.socialRiskLevel}`);
    if (esg.govRiskLevel) lines.push(`Bolagsstyrningsrisk: ${esg.govRiskLevel}`);
    if (esg.fossilExposurePercent != null) lines.push(`Fossilexponering: ${esg.fossilExposurePercent}%`);
    if (esg.esgDecision) lines.push(`ESG-beslut: ${esg.esgDecision}`);
    if (esg.esgDecisionMotivation) lines.push(`Motivering: ${esg.esgDecisionMotivation}`);
    lines.push('');
  }

  const liq = approval.liquidityAnalysis;
  if (liq) {
    lines.push('## Likviditet vid godkännande');
    if (liq.averageDailyValueSEK) lines.push(`ADV (SEK): ${liq.averageDailyValueSEK}`);
    if (liq.portfolioIlliquidShareAfter != null) lines.push(`Illikvid andel efter: ${liq.portfolioIlliquidShareAfter}%`);
    lines.push('');
  }

  if (uploadedDocText) {
    lines.push('## Uppladdade fondvillkor och dokument');
    lines.push('Nedan följer text från fondens officiella dokument. Använd som primär källa.');
    lines.push('');
    lines.push(uploadedDocText);
    lines.push('');
  }

  lines.push('## Instruktion');
  lines.push('Baserat på värdepapprets egenskaper, emittentens bransch, ESG-profil och marknadsförhållanden:');
  lines.push('1. Bedöm om det finns RISK för att värdepappret inte längre uppfyller fondens villkor');
  lines.push('2. Identifiera potentiella problem (sanktioner, ESG-kontroverser, likviditetsförändringar, sektorrisker)');
  lines.push('3. Bedöm om engagemang eller avveckling kan behövas');
  lines.push('');
  lines.push('Svara i JSON-format:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "alert": true/false,');
  lines.push('  "severity": "high" | "medium" | "low",');
  lines.push('  "title": "Kort rubrik (max 80 tecken, svenska)",');
  lines.push('  "summary": "2-3 meningar om varför (svenska)",');
  lines.push('  "details": "Mer detaljerad analys (svenska)"');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('Sätt alert=true BARA om det finns genuina risker eller förändringar att flagga.');
  lines.push('Var inte överdrivet försiktig — normala marknadsfluktuationer ska inte trigga en alert.');
  lines.push('Men ESG-kontroverser, sanktionsrisker, kraftiga likviditetsförsämringar, eller regelbrott ska flaggas.');

  return lines.join('\n');
}

interface ReviewResult {
  alert: boolean;
  severity: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  details: string;
}

async function runAIReview(approval: SecurityApprovalRequest, uploadedDocText?: string): Promise<ReviewResult | null> {
  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [
        {
          text: 'Du är en riskanalytiker som gör månatlig omprövning av godkända värdepapper. Svara BARA med ett JSON-objekt, inget annat.',
        },
      ],
      messages: [
        {
          role: 'user',
          content: [{ text: buildReviewPrompt(approval, uploadedDocText) }],
        },
      ],
      inferenceConfig: { maxTokens: 2048 },
    });

    const response = await bedrockClient.send(command);
    const outputContent = response.output?.message?.content;
    let text = '';
    if (outputContent) {
      for (const block of outputContent) {
        if ('text' in block && block.text) text += block.text;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ReviewResult;
    return parsed;
  } catch (error) {
    console.error(`AI review failed for ${approval.id}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.AIFM_CRON_SECRET;
  const header = request.headers.get('x-aifm-cron-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const approved = await listApprovalsByStatus('approved');

    if (approved.length === 0) {
      return NextResponse.json({
        ok: true,
        reviewed: 0,
        alerts: 0,
        message: 'No approved securities to review',
      });
    }

    let alertCount = 0;
    const results: { approvalId: string; securityName: string; alert: boolean; severity?: string }[] = [];

    for (const approval of approved) {
      let docText = '';
      try {
        docText = await getFundDocumentText(approval.fundId);
      } catch { /* non-fatal */ }
      const reviewResult = await runAIReview(approval, docText || undefined);

      if (!reviewResult) {
        results.push({
          approvalId: approval.id,
          securityName: approval.basicInfo?.name || approval.id,
          alert: false,
        });
        continue;
      }

      results.push({
        approvalId: approval.id,
        securityName: approval.basicInfo?.name || approval.id,
        alert: reviewResult.alert,
        severity: reviewResult.severity,
      });

      if (reviewResult.alert) {
        alertCount++;

        try {
          await createNotification({
            userEmail: approval.createdByEmail,
            type: 'security_review_alert',
            title: reviewResult.title,
            message: reviewResult.summary,
            link: '/securities/approved',
            priority: reviewResult.severity === 'high' ? 'high' : 'medium',
            metadata: {
              approvalId: approval.id,
              securityName: approval.basicInfo?.name || '',
              fundName: approval.fundName,
              severity: reviewResult.severity,
              details: reviewResult.details,
            },
          });
        } catch (notifError) {
          console.error(`Failed to create notification for ${approval.id}:`, notifError);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      reviewed: approved.length,
      alerts: alertCount,
      results,
    });
  } catch (error) {
    console.error('Monthly review error:', error);
    return NextResponse.json(
      { error: 'Monthly review failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
