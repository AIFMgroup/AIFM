/**
 * API Route: PDF Export for Security Approvals
 * Generates professional PDF documents via pdfkit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApproval, exportApprovalJSON } from '@/lib/integrations/securities';
import { generateApprovalPDF } from '@/lib/integrations/securities/pdf-generator-real';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import type { PDFESGLiveData } from '@/lib/integrations/securities/pdf-generator';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom } from '@/lib/dataRooms/archiveToDataroom';

async function fetchESGData(isin: string): Promise<PDFESGLiveData | undefined> {
  try {
    const esgClient = getESGServiceClient();
    const esgData = await esgClient.getESGData(isin);
    if (!esgData) return undefined;
    return {
      totalScore: esgData.totalScore,
      environmentScore: esgData.environmentScore,
      socialScore: esgData.socialScore,
      governanceScore: esgData.governanceScore,
      sfdrAlignment: esgData.sfdrAlignment,
      taxonomyAlignmentPercent: esgData.taxonomyAlignmentPercent,
      carbonIntensity: esgData.carbonIntensity,
      carbonIntensityUnit: esgData.carbonIntensityUnit,
      meetsExclusionCriteria: esgData.meetsExclusionCriteria,
      exclusionFlags: esgData.exclusionFlags?.map(f => ({
        category: f.category,
        categoryDescription: f.categoryDescription,
        revenuePercent: f.revenuePercent,
      })),
      provider: esgData.provider,
      fetchedAt: esgData.fetchedAt,
    };
  } catch (err) {
    console.warn('[PDF] Failed to fetch live ESG data:', err);
    return undefined;
  }
}

// GET /api/securities/pdf?id=xxx&format=pdf|json
export async function GET(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const { searchParams } = new URL(request.url);
    const approvalId = searchParams.get('id');
    const format = searchParams.get('format') || 'pdf';

    if (!approvalId) {
      return NextResponse.json({ success: false, error: 'id krävs' }, { status: 400 });
    }

    const approval = await getApproval(approvalId);
    if (!approval) {
      return NextResponse.json({ success: false, error: 'Ansökan hittades inte' }, { status: 404 });
    }

    if (format === 'json') {
      const jsonContent = exportApprovalJSON(approval);
      return new NextResponse(jsonContent, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="approval-${approvalId}.json"`,
        },
      });
    }

    const esgLiveData = approval.basicInfo?.isin
      ? await fetchESGData(approval.basicInfo.isin)
      : undefined;

    const pdfBuffer = await generateApprovalPDF(approval, esgLiveData);

    const safeFilename = (approval.basicInfo?.name ?? 'approval').replace(/[^a-zA-Z0-9åäöÅÄÖ\s_-]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `${safeFilename}_${approvalId!.slice(-6)}.pdf`;

    if (session?.email) {
      archiveToDataroom({
        userEmail: session.email,
        userName: session.name || session.email || 'Användare',
        analysisType: 'securities',
        fileName,
        pdfBuffer,
        skipIfExists: false,
      })
        .then((res) => console.log(`[Securities PDF] Archived to dataroom: ${res.documentId}`))
        .catch((e) => console.warn('[Securities PDF] Archive failed:', e));
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PDF generation error:', msg, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { success: false, error: `Kunde inte generera PDF: ${msg}` },
      { status: 500 }
    );
  }
}

// POST /api/securities/pdf - Preview from form data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData, fundId, fundName, userEmail, userName } = body;

    if (!formData) {
      return NextResponse.json({ success: false, error: 'formData krävs' }, { status: 400 });
    }

    const previewApproval = {
      id: 'preview-' + Date.now(),
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userName || 'Preview User',
      createdByEmail: userEmail || 'preview@aifm.se',
      fundId: fundId || 'preview-fund',
      fundName: fundName || 'Preview Fund',
      basicInfo: {
        name: formData.name || '',
        category: formData.category || 'transferable_security',
        type: formData.type || 'stock',
        isUCITS_ETF: formData.isUCITS_ETF,
        ticker: formData.ticker || '',
        isin: formData.isin || '',
        marketPlace: formData.securityData?.exchangeCode || '',
        listingType: formData.listingType || 'regulated_market',
        mic: formData.mic || '',
        securityUrl: formData.securityUrl,
        currency: formData.currency || '',
        country: formData.country || '',
        emitter: formData.emitter || '',
        emitterLEI: formData.emitterLEI,
        gicsSector: formData.gicsSector,
        conflictsOfInterest: formData.conflictsOfInterest,
      },
      fundCompliance: {
        fundId: fundId || '',
        fundName: fundName || '',
        complianceMotivation: formData.complianceMotivation || '',
        placementRestrictions: formData.placementRestrictions || '',
      },
      regulatoryFFFS: {
        limitedPotentialLoss: formData.limitedPotentialLoss ?? true,
        liquidityNotEndangered: formData.liquidityNotEndangered ?? true,
        reliableValuation: {
          type: formData.reliableValuationType || 'market_price',
          checked: formData.reliableValuationChecked ?? true,
        },
        appropriateInformation: {
          type: formData.appropriateInfoType || 'regular_market_info',
          checked: formData.appropriateInfoChecked ?? true,
        },
        isMarketable: formData.isMarketable ?? true,
        compatibleWithFund: formData.compatibleWithFund ?? true,
        riskManagementCaptures: formData.riskManagementCaptures ?? true,
      },
      regulatoryLVF: {},
      liquidityAnalysis: {
        stockLiquidity: {
          presumption400MSEK: formData.stockLiquidityPresumption ?? false,
          canLiquidate1Day: formData.canLiquidate1Day ?? false,
          canLiquidate2Days: formData.canLiquidate2Days ?? false,
          canLiquidate3Days: formData.canLiquidate3Days ?? false,
          moreThan3Days: formData.moreThan3Days ?? false,
        },
        noHistoryEstimate: formData.noHistoryEstimate,
        portfolioIlliquidShareBefore: formData.portfolioIlliquidBefore ? parseFloat(formData.portfolioIlliquidBefore) : undefined,
        portfolioIlliquidShareAfter: formData.portfolioIlliquidAfter ? parseFloat(formData.portfolioIlliquidAfter) : undefined,
        portfolioMotivation: formData.portfolioMotivation,
        fffsLiquidityNotEndangered: formData.liquidityNotEndangered ?? true,
        fffsIsMarketable: formData.isMarketable ?? true,
        howLiquidityRequirementMet: formData.liquidityRequirementMotivation,
        howMarketabilityRequirementMet: formData.marketabilityMotivation,
      },
      valuationInfo: {
        reliableDailyPrices: formData.reliableDailyPrices ?? true,
        priceSourceUrl: formData.priceSourceUrl,
        priceSourceComment: formData.priceSourceComment,
        isEmission: formData.isEmission ?? false,
        emissionValuationMethod: formData.emissionValuationMethod,
        proposedValuationMethod: formData.proposedValuationMethod,
      },
      esgInfo: {
        article8Or9Fund: formData.article8Or9Fund ?? false,
        fundArticle: formData.fundArticle,
        environmentalCharacteristics: formData.environmentalCharacteristics,
        socialCharacteristics: formData.socialCharacteristics,
        meetsExclusionCriteria: formData.meetsExclusionCriteria ?? true,
        meetsSustainableInvestmentMinimum: formData.meetsSustainableMinimum ?? true,
        paiConsidered: formData.paiConsidered,
        article9NoSignificantHarm: formData.article9NoSignificantHarm,
        article9GoodGovernance: formData.article9GoodGovernance,
        article9OECDCompliant: formData.article9OECDCompliant,
        article9UNGPCompliant: formData.article9UNGPCompliant,
        normScreening: formData.normScreening,
        exclusionResults: formData.exclusionResults,
        governance: formData.governance,
        envRiskLevel: formData.envRiskLevel,
        socialRiskLevel: formData.socialRiskLevel,
        govRiskLevel: formData.govRiskLevel,
        pai: formData.pai,
        ghgData: formData.ghgData,
        sustainableGoalCategory: formData.sustainableGoalCategory,
        revenueCapExFromSustainable: formData.revenueCapExFromSustainable,
        taxonomyQualifiedPercent: formData.taxonomyQualifiedPercent,
        taxonomyAlignedPercent: formData.taxonomyAlignedPercent,
        allocationBeforePercent: formData.allocationBeforePercent,
        allocationAfterPercent: formData.allocationAfterPercent,
        promotedCharacteristicsResult: formData.promotedCharacteristicsResult,
        esgDecision: formData.esgDecision,
        esgDecisionMotivation: formData.esgDecisionMotivation,
        engagementRequired: formData.engagementRequired,
        engagementComment: formData.engagementComment,
      },
      plannedAcquisitionShare: formData.plannedAcquisitionShare,
      plannedPortfolioWeight: formData.plannedPortfolioWeight,
      fundUnitInfo: (formData.category === 'fund_unit' || formData.type === 'fund' || formData.type === 'etf') ? {
        fundType: formData.fundUnitType || '',
        complianceLinks: formData.fundUnitComplianceLinks
          ? (typeof formData.fundUnitComplianceLinks === 'string'
            ? formData.fundUnitComplianceLinks.split(',').map((s: string) => s.trim()).filter(Boolean)
            : formData.fundUnitComplianceLinks)
          : undefined,
        maxOwnFundUnits10Percent: formData.fundUnitMaxOwn10Percent ?? false,
        maxTargetFundUnits25Percent: formData.fundUnitMaxTarget25Percent ?? false,
      } : undefined,
    };

    const esgLiveData = (previewApproval as any).basicInfo?.isin
      ? await fetchESGData((previewApproval as any).basicInfo.isin)
      : undefined;

    const pdfBuffer = await generateApprovalPDF(previewApproval as any, esgLiveData);

    const safeName = (formData.name || 'värdepapper').replace(/[^a-zA-Z0-9åäöÅÄÖ\s_-]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `${safeName}_förhandsgranskning.pdf`;

    const session = await getSession().catch(() => null);
    if (session?.email || userEmail) {
      const email = session?.email || userEmail;
      const name = session?.name || userName || email || 'Användare';
      archiveToDataroom({
        userEmail: email,
        userName: name,
        analysisType: 'securities',
        fileName,
        pdfBuffer,
        skipIfExists: false,
      })
        .then((res) => console.log(`[Securities PDF POST] Archived to dataroom: ${res.documentId}`))
        .catch((e) => console.warn('[Securities PDF POST] Archive failed:', e));
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PDF preview error:', msg, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { success: false, error: `Kunde inte generera förhandsvisning: ${msg}` },
      { status: 500 }
    );
  }
}
