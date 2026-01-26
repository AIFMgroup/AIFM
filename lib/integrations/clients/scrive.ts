/**
 * Scrive Integration Client
 * 
 * Client for interacting with Scrive API for electronic signatures.
 */

import { BaseIntegrationClient, registerClient } from '../baseClient';
import type { IntegrationApiResponse } from '../types';

// ============================================================================
// Scrive-Specific Types
// ============================================================================

export type ScriveDocumentStatus =
  | 'preparation'
  | 'pending'
  | 'closed'
  | 'cancelled'
  | 'timedout'
  | 'rejected'
  | 'document_error';

export type ScriveSignatoryStatus =
  | 'unsigned'
  | 'signed'
  | 'declined'
  | 'undelivered'
  | 'opened'
  | 'sent'
  | 'waiting';

export type ScriveAuthenticationMethod =
  | 'standard'
  | 'sms_pin'
  | 'se_bankid'
  | 'no_bankid'
  | 'dk_nemid'
  | 'fi_tupas'
  | 'verimi'
  | 'onfido';

export type ScriveDeliveryMethod =
  | 'email'
  | 'mobile'
  | 'email_mobile'
  | 'pad'
  | 'api';

export interface ScriveSignatory {
  id: string;
  current: boolean;
  signatory_role: 'signing_party' | 'viewer' | 'approver';
  sign_order: number;
  sign_time?: string;
  seen_time?: string;
  read_invitation_time?: string;
  rejected_time?: string;
  rejection_reason?: string;
  sign_success_redirect_url?: string;
  reject_redirect_url?: string;
  fields: Array<{
    type: 'name' | 'email' | 'mobile' | 'company' | 'company_number' | 'personal_number' | 'text' | 'signature' | 'checkbox' | 'radiogroup';
    name?: string;
    value?: string;
    is_obligatory?: boolean;
    should_be_filled_by_sender?: boolean;
    placements?: Array<{
      xrel: number;
      yrel: number;
      wrel: number;
      hrel: number;
      fsrel: number;
      page: number;
    }>;
  }>;
  delivery_method: ScriveDeliveryMethod;
  authentication_method_to_view: ScriveAuthenticationMethod;
  authentication_method_to_sign: ScriveAuthenticationMethod;
  confirmation_delivery_method: 'email' | 'mobile' | 'email_mobile' | 'none';
}

export interface ScriveDocument {
  id: string;
  title: string;
  status: ScriveDocumentStatus;
  parties: ScriveSignatory[];
  file: {
    id: string;
    name: string;
  };
  sealed_file?: {
    id: string;
    name: string;
  };
  author: {
    id: string;
    name: string;
    email: string;
  };
  ctime: string;
  mtime: string;
  timeout_time?: string;
  auto_remind_time?: string;
  current_sign_order: number;
  is_template: boolean;
  is_saved: boolean;
  is_shared: boolean;
  is_trashed: boolean;
  is_deleted: boolean;
  viewer_id?: string;
  signing_possible: boolean;
  object_version: number;
  access_token: string;
  timezone: string;
  tags: Array<{ name: string; value: string }>;
  api_callback_url?: string;
}

export interface ScriveDocumentListItem {
  id: string;
  title: string;
  status: ScriveDocumentStatus;
  ctime: string;
  mtime: string;
  is_template: boolean;
  parties: Array<{
    name: string;
    email: string;
    status: ScriveSignatoryStatus;
  }>;
}

export interface ScriveCreateDocumentParams {
  title: string;
  parties: Array<{
    signatory_role: 'signing_party' | 'viewer' | 'approver';
    fields: Array<{
      type: 'name' | 'email' | 'mobile' | 'company';
      value: string;
    }>;
    delivery_method?: ScriveDeliveryMethod;
    authentication_method_to_view?: ScriveAuthenticationMethod;
    authentication_method_to_sign?: ScriveAuthenticationMethod;
    sign_order?: number;
  }>;
  file?: {
    name: string;
    content: string; // base64
  };
  days_to_sign?: number;
  days_to_remind?: number;
  api_callback_url?: string;
  lang?: 'sv' | 'en' | 'da' | 'no' | 'fi' | 'de' | 'fr' | 'nl' | 'it' | 'es' | 'pt' | 'et' | 'lv' | 'lt' | 'pl';
}

// ============================================================================
// Scrive Client
// ============================================================================

export class ScriveClient extends BaseIntegrationClient {
  constructor(companyId: string) {
    super('scrive', companyId);
  }

  // ============================================================================
  // Documents
  // ============================================================================

  /**
   * List documents
   */
  async listDocuments(params?: {
    offset?: number;
    max?: number;
    filter?: string;
    sorting?: string;
  }): Promise<IntegrationApiResponse<{ documents: ScriveDocumentListItem[]; total_matching: number }>> {
    const queryParams: Record<string, string> = {};
    if (params?.offset) queryParams['offset'] = String(params.offset);
    if (params?.max) queryParams['max'] = String(params.max);
    if (params?.filter) queryParams['filter'] = params.filter;
    if (params?.sorting) queryParams['sorting'] = params.sorting;
    
    return this.get('/documents/list', { params: queryParams });
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.get(`/documents/${documentId}`);
  }

  /**
   * Create a new document
   */
  async createDocument(params: ScriveCreateDocumentParams): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post('/documents/new', params);
  }

  /**
   * Create document from template
   */
  async createFromTemplate(
    templateId: string,
    params: {
      parties: Array<{
        fields: Array<{
          type: string;
          value: string;
        }>;
      }>;
    }
  ): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${templateId}/clone`, params);
  }

  /**
   * Update a document (only in preparation status)
   */
  async updateDocument(
    documentId: string,
    updates: Partial<ScriveCreateDocumentParams>
  ): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/update`, updates);
  }

  /**
   * Start the signing process
   */
  async startSigning(documentId: string): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/start`);
  }

  /**
   * Cancel a document
   */
  async cancelDocument(documentId: string): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/cancel`);
  }

  /**
   * Prolong a document's timeout
   */
  async prolongDocument(documentId: string, days: number): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/prolong`, { days });
  }

  /**
   * Delete a document (move to trash)
   */
  async trashDocument(documentId: string): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/trash`);
  }

  /**
   * Permanently delete a document
   */
  async deleteDocument(documentId: string): Promise<IntegrationApiResponse<void>> {
    return this.delete(`/documents/${documentId}`);
  }

  // ============================================================================
  // Files
  // ============================================================================

  /**
   * Upload a file to attach to a document
   */
  async uploadFile(documentId: string, file: {
    name: string;
    content: string; // base64
  }): Promise<IntegrationApiResponse<{ id: string }>> {
    return this.post(`/documents/${documentId}/files`, file);
  }

  /**
   * Get the main PDF file
   */
  async getMainFile(documentId: string): Promise<IntegrationApiResponse<Blob>> {
    // Note: This would need special handling for binary response
    return this.get(`/documents/${documentId}/files/main`);
  }

  /**
   * Get the sealed (signed) PDF file
   */
  async getSealedFile(documentId: string): Promise<IntegrationApiResponse<Blob>> {
    return this.get(`/documents/${documentId}/files/sealed`);
  }

  // ============================================================================
  // Templates
  // ============================================================================

  /**
   * List templates
   */
  async listTemplates(params?: {
    offset?: number;
    max?: number;
  }): Promise<IntegrationApiResponse<{ documents: ScriveDocumentListItem[]; total_matching: number }>> {
    const queryParams: Record<string, string> = {
      filter: 'is_template',
    };
    if (params?.offset) queryParams['offset'] = String(params.offset);
    if (params?.max) queryParams['max'] = String(params.max);
    
    return this.get('/documents/list', { params: queryParams });
  }

  /**
   * Save a document as a template
   */
  async saveAsTemplate(documentId: string): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/settemplate`, { is_template: true });
  }

  // ============================================================================
  // Reminders
  // ============================================================================

  /**
   * Send a reminder to pending signatories
   */
  async sendReminder(documentId: string): Promise<IntegrationApiResponse<ScriveDocument>> {
    return this.post(`/documents/${documentId}/remind`);
  }

  // ============================================================================
  // Signing Links
  // ============================================================================

  /**
   * Get a signing link for a specific party
   */
  async getSigningLink(documentId: string, signatoryId: string): Promise<IntegrationApiResponse<{ link: string }>> {
    return this.get(`/documents/${documentId}/signatories/${signatoryId}/link`);
  }

  // ============================================================================
  // User Info
  // ============================================================================

  /**
   * Get current user info
   */
  async getMe(): Promise<IntegrationApiResponse<{ id: string; name: string; email: string; company_name: string }>> {
    return this.get('/getpersonalinfo');
  }
}

// Register the client
registerClient('scrive', ScriveClient);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create and initialize a Scrive client
 */
export async function createScriveClient(companyId: string): Promise<ScriveClient> {
  const client = new ScriveClient(companyId);
  await client.init();
  return client;
}

/**
 * Quick helper to send a document for signing
 */
export async function sendForSigning(
  companyId: string,
  params: {
    title: string;
    fileContent: string; // base64 PDF
    fileName: string;
    signatories: Array<{
      name: string;
      email: string;
      role?: 'signing_party' | 'viewer' | 'approver';
    }>;
    daysToSign?: number;
    callbackUrl?: string;
  }
): Promise<ScriveDocument | null> {
  const client = await createScriveClient(companyId);
  
  // Create document
  const createResult = await client.createDocument({
    title: params.title,
    file: {
      name: params.fileName,
      content: params.fileContent,
    },
    parties: params.signatories.map((s, index) => ({
      signatory_role: s.role || 'signing_party',
      sign_order: index + 1,
      fields: [
        { type: 'name', value: s.name },
        { type: 'email', value: s.email },
      ],
      delivery_method: 'email',
      authentication_method_to_view: 'standard',
      authentication_method_to_sign: 'standard',
    })),
    days_to_sign: params.daysToSign || 14,
    api_callback_url: params.callbackUrl,
  });

  if (!createResult.success || !createResult.data) {
    console.error('[Scrive] Failed to create document:', createResult.error);
    return null;
  }

  // Start signing
  const startResult = await client.startSigning(createResult.data.id);
  
  if (!startResult.success || !startResult.data) {
    console.error('[Scrive] Failed to start signing:', startResult.error);
    return null;
  }

  return startResult.data;
}

