import { vatDeclarationService } from '@/lib/accounting/services/vatDeclarationService';
import { skatteverketSubmissionStore, SkatteverketSubmission } from './skatteverketSubmissionStore';

/**
 * Stub/service layer for Skatteverket submissions.
 * - Creates and persists the exact payload we intend to submit.
 * - Does NOT call any external API (until integration is configured).
 */
export const skatteverketSubmissionService = {
  async queueVatDeclaration(params: {
    companyId: string;
    year: number;
    month?: number;
    quarter?: number;
  }): Promise<SkatteverketSubmission> {
    const { companyId, year, month, quarter } = params;
    const declaration = await vatDeclarationService.generateDeclaration(companyId, year, month, quarter);
    const xml = vatDeclarationService.generateSKVXML(declaration);
    const periodKey = declaration.period.label.replace(/\s+/g, '_');
    return await skatteverketSubmissionStore.upsertQueued(companyId, 'VAT', periodKey, xml);
  },

  async list(companyId: string) {
    return await skatteverketSubmissionStore.list(companyId);
  },

  /**
   * Placeholder for the future API call.
   */
  async submitNow(_companyId: string, _submissionId: string) {
    return {
      success: false,
      error: 'Skatteverket API integration not configured yet (queue-only mode).',
    };
  },
};



