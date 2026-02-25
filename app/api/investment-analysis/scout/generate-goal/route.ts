import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getESGFundConfig } from '@/lib/integrations/securities/esg-fund-configs';
import { getFundDocumentText } from '@/lib/fund-documents/fund-document-store';
import { getFundRegistry } from '@/lib/fund-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const MODEL_CANDIDATES = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

export async function POST(request: NextRequest) {
  try {
    const { fundId, sfdrArticle } = await request.json();

    if (!fundId) {
      return NextResponse.json({ error: 'fundId krävs' }, { status: 400 });
    }

    const contextParts: string[] = [];

    // 1. Fund ESG config (exclusions, promoted characteristics, norm screening)
    const fundConfig = getESGFundConfig(fundId);
    if (fundConfig) {
      contextParts.push(`FOND: ${fundConfig.fundName}`);
      contextParts.push(`SFDR-ARTIKEL: ${fundConfig.sfdrArticle}`);
      if (fundConfig.exclusions?.length) {
        contextParts.push('\nEXKLUDERINGSKRITERIER:');
        for (const ex of fundConfig.exclusions) {
          contextParts.push(`  - ${ex.label || ex.category}: max ${ex.threshold}% (${ex.threshold === 0 ? 'nolltolerans' : 'tolerans upp till ' + ex.threshold + '%'})`);
        }
      }
      if (fundConfig.promotedCharacteristics?.length) {
        contextParts.push(`\nFRÄMJADE EGENSKAPER: ${fundConfig.promotedCharacteristics.join(', ')}`);
      }
      if (fundConfig.normScreening) {
        const ns = fundConfig.normScreening;
        const parts = [];
        if (ns.ungc) parts.push('UN Global Compact');
        if (ns.oecd) parts.push('OECD:s riktlinjer');
        if (ns.humanRights) parts.push('Mänskliga rättigheter');
        if (ns.antiCorruption) parts.push('Anti-korruption');
        if (parts.length) contextParts.push(`NORMSCREENING: ${parts.join(', ')}`);
      }
    }

    // 2. Fund document text (fondvillkor/fondbestämmelser)
    const fundDocText = await getFundDocumentText(fundId);
    if (fundDocText) {
      const trimmed = fundDocText.length > 10000 ? fundDocText.slice(0, 10000) + '\n... (förkortat)' : fundDocText;
      contextParts.push(`\nFONDVILLKOR / FONDBESTÄMMELSER:\n${trimmed}`);
    }

    // 3. Current portfolio positions
    try {
      const registry = getFundRegistry();
      const today = new Date().toISOString().split('T')[0];
      const positions = await registry.getPositions(fundId, today);

      if (positions.length > 0) {
        contextParts.push(`\nBEFINTLIGA INNEHAV (${positions.length} positioner):`);
        const sorted = [...positions].sort((a, b) => (b.marketValueBase || 0) - (a.marketValueBase || 0));
        const totalValue = sorted.reduce((sum, p) => sum + (p.marketValueBase || 0), 0);
        for (const pos of sorted.slice(0, 50)) {
          const pct = totalValue > 0 ? ((pos.marketValueBase || 0) / totalValue * 100).toFixed(1) : '?';
          contextParts.push(`  - ${pos.instrumentName}${pos.isin ? ' (' + pos.isin + ')' : ''}: ${pct}% av portföljen, typ: ${pos.instrumentType}`);
        }
        if (sorted.length > 50) {
          contextParts.push(`  ... och ${sorted.length - 50} ytterligare positioner`);
        }

        const sectorMap: Record<string, number> = {};
        const typeMap: Record<string, number> = {};
        for (const pos of sorted) {
          typeMap[pos.instrumentType] = (typeMap[pos.instrumentType] || 0) + (pos.marketValueBase || 0);
        }
        if (Object.keys(typeMap).length > 0) {
          contextParts.push('\nFÖRDELNING PER INSTRUMENTTYP:');
          for (const [type, val] of Object.entries(typeMap).sort((a, b) => b[1] - a[1])) {
            const pct = totalValue > 0 ? (val / totalValue * 100).toFixed(1) : '?';
            contextParts.push(`  - ${type}: ${pct}%`);
          }
        }
      } else {
        contextParts.push('\nBEFINTLIGA INNEHAV: Inga positioner registrerade (ny fond eller data saknas).');
      }
    } catch (e) {
      console.warn('[GenerateGoal] Could not fetch positions:', e);
      contextParts.push('\nBEFINTLIGA INNEHAV: Kunde inte hämta positionsdata.');
    }

    // 4. Fund basic info from registry
    try {
      const registry = getFundRegistry();
      const fundInfo = await registry.getFundSnapshot(fundId);
      if (fundInfo?.fund) {
        const f = fundInfo.fund;
        if (f.legalName) contextParts.push(`\nFONDENS LEGALA NAMN: ${f.legalName}`);
        if (f.type) contextParts.push(`FONDTYP: ${f.type}`);
        if (f.currency) contextParts.push(`VALUTA: ${f.currency}`);
        if (f.ucits) contextParts.push('UCITS: Ja');
        if (f.aifmd) contextParts.push('AIFMD: Ja');
        if (fundInfo.navRecords?.length) {
          const latest = fundInfo.navRecords[0];
          contextParts.push(`SENASTE NAV: ${latest.navPerShare} per andel, totalt ${latest.totalNetAssets} ${f.currency}`);
        }
      }
    } catch {
      // Optional
    }

    if (contextParts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ingen fonddata kunde hämtas. Kontrollera att fonden finns i systemet.',
      });
    }

    const systemPrompt = `Du är en av världens mest erfarna fondförvaltare med 30+ års erfarenhet av institutionell kapitalförvaltning i Norden och Europa. Du arbetar på AIFM Capital AB.

Du har fått komplett information om en fond — dess fondvillkor, exkluderingspolicy, befintliga portföljinnehav och regulatoriska krav.

Din uppgift: Generera en detaljerad och genomtänkt investeringsstrategi/investeringsmål som ska användas som underlag för att hitta NYA innehav till portföljen.

INSTRUKTIONER:
1. Analysera fondens nuvarande skick — vad har den redan? Var finns luckor eller övervikter?
2. Beakta fondvillkoren noggrant — vilka typer av bolag PASSAR och vilka är UTESLUTNA?
3. Identifiera sektorer/regioner/teman som saknas eller bör stärkas
4. Beakta makromiljön och aktuella marknadstrender
5. Ge konkreta riktlinjer: vilken typ av bolag ska prioriteras, i vilka regioner, med vilken profil

FORMAT:
Skriv 3-5 stycken på svenska med konkreta och specifika riktlinjer. Texten ska vara direkt användbar som input till en AI-scout som ska hitta 5 nya innehav. Var SPECIFIK — nämn sektorer, regioner, marknadsvärdesspann, ESG-profil, etc.

Avsluta med 2-3 punkter under "Undvik:" som sammanfattar vad fonden INTE bör investera i baserat på fondvillkoren.`;

    const userMessage = `Här är all tillgänglig information om fonden:\n\n${contextParts.join('\n')}\n\nGenerera en investeringsstrategi baserat på ovanstående. Skriv direkt utan JSON — bara text.`;

    let generatedGoal = '';
    for (const modelId of MODEL_CANDIDATES) {
      try {
        const command = new ConverseCommand({
          modelId,
          system: [{ text: systemPrompt }],
          messages: [{ role: 'user', content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: 4000 },
        });
        const response = await bedrockClient.send(command);
        const outputContent = response.output?.message?.content;
        if (outputContent?.[0] && 'text' in outputContent[0] && outputContent[0].text) {
          generatedGoal = outputContent[0].text;
          break;
        }
      } catch (err) {
        console.warn(`[GenerateGoal] Model ${modelId} failed:`, err);
      }
    }

    if (!generatedGoal) {
      return NextResponse.json({
        success: false,
        error: 'AI-genereringen misslyckades. Försök igen.',
      });
    }

    return NextResponse.json({
      success: true,
      goal: generatedGoal,
      fundName: fundConfig?.fundName || fundId,
      dataUsed: {
        hasConfig: !!fundConfig,
        hasFundDoc: !!fundDocText,
        hasPositions: contextParts.some(p => p.includes('BEFINTLIGA INNEHAV') && !p.includes('Inga positioner')),
      },
    });
  } catch (err) {
    console.error('[GenerateGoal] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Serverfel' },
      { status: 500 }
    );
  }
}
