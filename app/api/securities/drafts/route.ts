/**
 * API Route: Security Approval Drafts
 * Handles auto-save, draft listing, and draft retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  saveDraft, 
  listDraftsByUser, 
  getApproval, 
  deleteApproval,
  searchApprovedSecurities,
  copyApprovalAsDraft,
} from '@/lib/integrations/securities';

// GET /api/securities/drafts
// Get all drafts for a user, search approved securities for copy, or get single draft
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const draftId = searchParams.get('id');
    const searchQuery = searchParams.get('search');
    const searchApproved = searchParams.get('searchApproved');

    // Search approved securities for "copy from previous"
    if (searchApproved && searchQuery) {
      const results = await searchApprovedSecurities(searchQuery, 10);
      return NextResponse.json({
        success: true,
        results: results.map(r => ({
          id: r.id,
          name: r.basicInfo.name,
          isin: r.basicInfo.isin,
          ticker: r.basicInfo.ticker,
          fundName: r.fundName,
          approvedAt: r.reviewedAt,
          status: r.status,
        })),
      });
    }

    // Get single draft by ID
    if (draftId) {
      const draft = await getApproval(draftId);
      if (!draft) {
        return NextResponse.json(
          { success: false, error: 'Utkast hittades inte' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, draft });
    }

    // List all drafts for user
    if (userEmail) {
      const drafts = await listDraftsByUser(userEmail);
      return NextResponse.json({
        success: true,
        drafts: drafts.map(d => ({
          id: d.id,
          name: d.basicInfo?.name || 'Namnlös',
          isin: d.basicInfo?.isin || '',
          ticker: d.basicInfo?.ticker || '',
          fundName: d.fundName,
          fundId: d.fundId,
          updatedAt: d.updatedAt,
          createdAt: d.createdAt,
          step: getCompletionStep(d),
        })),
      });
    }

    return NextResponse.json(
      { success: false, error: 'userEmail eller id krävs' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Draft GET error:', error);
    
    // If DynamoDB table doesn't exist, return empty results
    if (error instanceof Error && 
        (error.message.includes('ResourceNotFoundException') || 
         error.message.includes('Table') ||
         error.name === 'ResourceNotFoundException')) {
      return NextResponse.json({
        success: true,
        drafts: [],
        results: [],
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Kunde inte hämta utkast' },
      { status: 500 }
    );
  }
}

// POST /api/securities/drafts
// Create or update draft (auto-save)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      draftId, 
      formData, 
      fundId, 
      fundName, 
      createdBy = 'Current User', 
      createdByEmail = 'user@aifm.se',
      // For copy action
      action,
      sourceId,
      targetFundId,
      targetFundName,
    } = body;

    // Copy from previous approval
    if (action === 'copy' && sourceId) {
      const newDraft = await copyApprovalAsDraft(
        sourceId,
        targetFundId || fundId,
        targetFundName || fundName,
        createdBy,
        createdByEmail
      );

      if (!newDraft) {
        return NextResponse.json(
          { success: false, error: 'Kunde inte kopiera ansökan' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        draftId: newDraft.id,
        message: 'Ansökan kopierad som nytt utkast',
      });
    }

    // Auto-save draft
    if (!fundId || !fundName) {
      return NextResponse.json(
        { success: false, error: 'fundId och fundName krävs' },
        { status: 400 }
      );
    }

    // Convert form data to approval structure
    const approvalData = convertFormDataToApproval(formData, fundId, fundName);

    const draft = await saveDraft(draftId || null, {
      ...approvalData,
      fundId,
      fundName,
      createdBy,
      createdByEmail,
    });

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      updatedAt: draft.updatedAt,
      message: 'Utkast sparat',
    });
  } catch (error) {
    console.error('Draft POST error:', error);
    
    // If DynamoDB table doesn't exist, return helpful error
    if (error instanceof Error && 
        (error.message.includes('ResourceNotFoundException') || 
         error.message.includes('Table') ||
         error.name === 'ResourceNotFoundException')) {
      return NextResponse.json(
        { success: false, error: 'Databasen är inte konfigurerad. Kontakta administratör.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Kunde inte spara utkast' },
      { status: 500 }
    );
  }
}

// DELETE /api/securities/drafts
// Delete a draft
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('id');

    if (!draftId) {
      return NextResponse.json(
        { success: false, error: 'id krävs' },
        { status: 400 }
      );
    }

    const deleted = await deleteApproval(draftId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Kunde inte radera utkast (endast utkast kan raderas)' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Utkast raderat',
    });
  } catch (error) {
    console.error('Draft DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte radera utkast' },
      { status: 500 }
    );
  }
}

// Helper: Determine which step the draft is at
function getCompletionStep(draft: any): number {
  if (!draft.basicInfo?.isin) return 1;
  if (!draft.basicInfo?.name || !draft.basicInfo?.category) return 2;
  if (!draft.fundCompliance?.complianceMotivation) return 3;
  if (!draft.regulatoryFFFS?.limitedPotentialLoss) return 4;
  if (!draft.liquidityAnalysis) return 5;
  if (!draft.liquidityAnalysis?.fffsLiquidityNotEndangered) return 6;
  if (!draft.valuationInfo?.reliableDailyPrices) return 7;
  return 8;
}

// Helper: Convert frontend form data to approval structure
function convertFormDataToApproval(formData: any, fundId: string, fundName: string) {
  if (!formData) return {};

  return {
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
      fundId,
      fundName,
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
    regulatoryLVF: {
      stateGuaranteed: formData.stateGuaranteed ? {
        applicable: true,
        maxExposure35Percent: formData.stateGuaranteedMax35 ?? false,
      } : undefined,
      nonVotingShares: formData.nonVotingShares ? {
        applicable: true,
        maxIssuedShares10Percent: formData.nonVotingSharesMax10 ?? false,
      } : undefined,
      bondOrMoneyMarket: formData.bondOrMoneyMarket ? {
        applicable: true,
        maxIssuedInstruments10Percent: formData.bondMax10Issued ?? false,
      } : undefined,
      significantInfluence: {
        willHaveInfluence: formData.significantInfluence ?? false,
      },
    },
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
}
