/**
 * API Route: PDF Export for Security Approvals
 * Generates PDF documents from approval data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApproval, generateApprovalPDFContent, exportApprovalJSON } from '@/lib/integrations/securities';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import type { PDFESGLiveData } from '@/lib/integrations/securities/pdf-generator';
import { generateApprovalPDF } from '@/lib/integrations/securities/pdf-generator-real';

// GET /api/securities/pdf?id=xxx
// Generate PDF for an approval
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const approvalId = searchParams.get('id');
    const format = searchParams.get('format') || 'pdf'; // pdf, html, json

    if (!approvalId) {
      return NextResponse.json(
        { success: false, error: 'id krävs' },
        { status: 400 }
      );
    }

    const approval = await getApproval(approvalId);

    if (!approval) {
      return NextResponse.json(
        { success: false, error: 'Ansökan hittades inte' },
        { status: 404 }
      );
    }

    // JSON export for archiving
    if (format === 'json') {
      const jsonContent = exportApprovalJSON(approval);
      return new NextResponse(jsonContent, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="approval-${approvalId}.json"`,
        },
      });
    }

    // Fetch live ESG data if ISIN is available
    let esgLiveData: PDFESGLiveData | undefined;
    const isin = approval.basicInfo?.isin;
    if (isin) {
      try {
        const esgClient = getESGServiceClient();
        const esgData = await esgClient.getESGData(isin);
        if (esgData) {
          esgLiveData = {
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
        }
      } catch (err) {
        console.warn('[PDF] Failed to fetch live ESG data:', err);
      }
    }

    // HTML fallback (for preview/print)
    if (format === 'html') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.aifm.se';
      const htmlContent = generateApprovalPDFContent(approval, undefined, baseUrl, esgLiveData);
      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // Generate real PDF (default)
    const pdfBuffer = await generateApprovalPDF(approval, esgLiveData);
    const safeFilename = (approval.basicInfo?.name ?? 'approval').replace(/[^a-zA-Z0-9åäöÅÄÖ\s_-]/g, '').trim().replace(/\s+/g, '_');
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}_${approvalId.slice(-6)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte generera PDF' },
      { status: 500 }
    );
  }
}

// POST /api/securities/pdf
// Generate PDF preview from form data (before saving)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData, fundId, fundName, userEmail, userName } = body;

    if (!formData) {
      return NextResponse.json(
        { success: false, error: 'formData krävs' },
        { status: 400 }
      );
    }

    // Create a temporary approval object for preview
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
        environmentalCharacteristics: formData.environmentalCharacteristics,
        socialCharacteristics: formData.socialCharacteristics,
        meetsExclusionCriteria: formData.meetsExclusionCriteria ?? true,
        meetsSustainableInvestmentMinimum: formData.meetsSustainableMinimum ?? true,
        paiConsidered: formData.paiConsidered,
        article9NoSignificantHarm: formData.article9NoSignificantHarm,
        article9GoodGovernance: formData.article9GoodGovernance,
        article9OECDCompliant: formData.article9OECDCompliant,
        article9UNGPCompliant: formData.article9UNGPCompliant,
      },
      plannedAcquisitionShare: formData.plannedAcquisitionShare,
    };

    const pdfBuffer = await generateApprovalPDF(previewApproval as any);
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
      },
    });
  } catch (error) {
    console.error('PDF preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte generera förhandsvisning' },
      { status: 500 }
    );
  }
}
