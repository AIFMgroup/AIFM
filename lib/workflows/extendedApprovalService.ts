/**
 * Extended Approval Service
 * 
 * Utökar godkännandeflöden till fler områden:
 * - Export (SIE, Fortnox, rapporter)
 * - Rapportpublicering (investerare, FI, styrelse)
 * - Masterdata-ändringar (kontoplaner, leverantörer, kunder)
 * 
 * Alla kritiska ändringar kräver 4-eyes principle.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { sendNotification } from '../accounting/services/notificationService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.APPROVALS_TABLE_NAME || 'aifm-approvals';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// Types
// ============================================================================

export type ApprovalDomain = 
  | 'ACCOUNTING'           // Befintlig - fakturor/verifikationer
  | 'EXPORT'               // SIE-export, Fortnox-synk
  | 'REPORT_PUBLISH'       // Publicera rapporter
  | 'MASTERDATA'           // Kontoplaner, leverantörer
  | 'USER_MANAGEMENT'      // Användare, behörigheter
  | 'SYSTEM_CONFIG'        // Systeminställningar
  | 'FUND_OPERATION';      // Fonddrift (subscriptions, redemptions)

export type ApprovalType =
  // Export
  | 'EXPORT_SIE'
  | 'EXPORT_FORTNOX_BATCH'
  | 'EXPORT_ANNUAL_REPORT'
  | 'EXPORT_TAX_DECLARATION'
  // Report publishing
  | 'PUBLISH_NAV'
  | 'PUBLISH_INVESTOR_REPORT'
  | 'PUBLISH_FI_REPORT'
  | 'PUBLISH_BOARD_REPORT'
  // Masterdata
  | 'CHANGE_CHART_OF_ACCOUNTS'
  | 'ADD_SUPPLIER'
  | 'CHANGE_SUPPLIER'
  | 'DELETE_SUPPLIER'
  | 'ADD_CUSTOMER'
  | 'CHANGE_CUSTOMER'
  | 'DELETE_CUSTOMER'
  | 'CHANGE_COST_CENTER'
  // User management
  | 'ADD_USER'
  | 'CHANGE_USER_ROLE'
  | 'REMOVE_USER'
  | 'GRANT_ACCESS'
  | 'REVOKE_ACCESS'
  // System config
  | 'CHANGE_INTEGRATION'
  | 'CHANGE_POLICY'
  | 'CHANGE_APPROVAL_RULES'
  // Fund operations
  | 'PROCESS_SUBSCRIPTION'
  | 'PROCESS_REDEMPTION'
  | 'CHANGE_NAV';

export interface ApprovalPolicy {
  type: ApprovalType;
  domain: ApprovalDomain;
  name: string;
  description: string;
  
  // Krav
  requiresApproval: boolean;
  requiresDualApproval: boolean;
  minimumApprovers: number;
  
  // Vem kan godkänna
  approverRoles: string[];
  excludeRequestor: boolean; // Kan inte godkänna egen request
  
  // Trösklar för automatgodkännande
  autoApproveConditions?: {
    maxAmount?: number;
    maxItems?: number;
    trustedRequestorRoles?: string[];
  };
  
  // SLA
  defaultDeadlineHours: number;
  escalationHours: number;
  escalateTo: string[];
  
  // Notifikationer
  notifyOnRequest: string[];
  notifyOnApproval: string[];
  notifyOnRejection: string[];
}

export interface ExtendedApprovalRequest {
  id: string;
  tenantId: string;
  companyId: string;
  
  // Typ
  domain: ApprovalDomain;
  type: ApprovalType;
  
  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  
  // Detaljer
  title: string;
  description: string;
  data: Record<string, unknown>; // Typ-specifik data
  
  // Ändringsförhandsvisning
  changePreview?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    affectedRecords: number;
  };
  
  // Risk/påverkan
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactDescription?: string;
  reversible: boolean;
  
  // Request info
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  requestComment?: string;
  
  // Deadline
  deadline: string;
  escalatedAt?: string;
  escalatedTo?: string[];
  
  // Godkännanden
  requiredApprovers: number;
  approvals: ApprovalVote[];
  rejections: ApprovalVote[];
  
  // Resultat
  approvedAt?: string;
  rejectedAt?: string;
  executedAt?: string;
  executionResult?: {
    success: boolean;
    message?: string;
    error?: string;
  };
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalVote {
  userId: string;
  userName: string;
  userRole: string;
  decision: 'APPROVE' | 'REJECT';
  comment?: string;
  timestamp: string;
  ipAddress?: string;
}

// ============================================================================
// Default Policies
// ============================================================================

const DEFAULT_POLICIES: ApprovalPolicy[] = [
  // Export policies
  {
    type: 'EXPORT_SIE',
    domain: 'EXPORT',
    name: 'SIE-export',
    description: 'Export av bokföringsdata till SIE-format',
    requiresApproval: true,
    requiresDualApproval: false,
    minimumApprovers: 1,
    approverRoles: ['accountant', 'manager', 'executive', 'admin'],
    excludeRequestor: false,
    defaultDeadlineHours: 24,
    escalationHours: 48,
    escalateTo: ['manager'],
    notifyOnRequest: ['manager'],
    notifyOnApproval: ['requestor'],
    notifyOnRejection: ['requestor'],
  },
  {
    type: 'EXPORT_FORTNOX_BATCH',
    domain: 'EXPORT',
    name: 'Fortnox batch-synk',
    description: 'Bulk-synkronisering till Fortnox',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['accountant', 'manager', 'executive'],
    excludeRequestor: true,
    autoApproveConditions: {
      maxItems: 10,
      trustedRequestorRoles: ['manager', 'executive'],
    },
    defaultDeadlineHours: 4,
    escalationHours: 8,
    escalateTo: ['executive'],
    notifyOnRequest: ['accountant', 'manager'],
    notifyOnApproval: ['requestor', 'accountant'],
    notifyOnRejection: ['requestor'],
  },
  {
    type: 'EXPORT_ANNUAL_REPORT',
    domain: 'EXPORT',
    name: 'Årsredovisning export',
    description: 'Export/publicering av årsredovisning',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['executive', 'board'],
    excludeRequestor: true,
    defaultDeadlineHours: 72,
    escalationHours: 24,
    escalateTo: ['board'],
    notifyOnRequest: ['executive', 'board'],
    notifyOnApproval: ['all_stakeholders'],
    notifyOnRejection: ['requestor', 'executive'],
  },
  
  // Report publishing policies
  {
    type: 'PUBLISH_NAV',
    domain: 'REPORT_PUBLISH',
    name: 'NAV-publicering',
    description: 'Publicera NAV till investerare och databaser',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['fund_accountant', 'manager', 'executive'],
    excludeRequestor: true,
    defaultDeadlineHours: 4,
    escalationHours: 2,
    escalateTo: ['executive'],
    notifyOnRequest: ['manager', 'executive'],
    notifyOnApproval: ['fund_operations'],
    notifyOnRejection: ['requestor', 'manager'],
  },
  {
    type: 'PUBLISH_FI_REPORT',
    domain: 'REPORT_PUBLISH',
    name: 'FI-rapportering',
    description: 'Skicka rapport till Finansinspektionen',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['compliance_manager', 'executive'],
    excludeRequestor: true,
    defaultDeadlineHours: 24,
    escalationHours: 4,
    escalateTo: ['executive'],
    notifyOnRequest: ['compliance_team', 'executive'],
    notifyOnApproval: ['compliance_team'],
    notifyOnRejection: ['requestor', 'compliance_manager'],
  },
  
  // Masterdata policies
  {
    type: 'CHANGE_CHART_OF_ACCOUNTS',
    domain: 'MASTERDATA',
    name: 'Ändra kontoplan',
    description: 'Lägga till, ändra eller ta bort konton i kontoplanen',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['manager', 'executive'],
    excludeRequestor: true,
    defaultDeadlineHours: 48,
    escalationHours: 24,
    escalateTo: ['executive'],
    notifyOnRequest: ['accountant', 'manager'],
    notifyOnApproval: ['accountant', 'manager'],
    notifyOnRejection: ['requestor'],
  },
  {
    type: 'ADD_SUPPLIER',
    domain: 'MASTERDATA',
    name: 'Ny leverantör',
    description: 'Lägga till ny leverantör i systemet',
    requiresApproval: true,
    requiresDualApproval: false,
    minimumApprovers: 1,
    approverRoles: ['accountant', 'manager'],
    excludeRequestor: false,
    autoApproveConditions: {
      trustedRequestorRoles: ['manager', 'executive'],
    },
    defaultDeadlineHours: 24,
    escalationHours: 48,
    escalateTo: ['manager'],
    notifyOnRequest: ['accountant'],
    notifyOnApproval: ['requestor'],
    notifyOnRejection: ['requestor'],
  },
  {
    type: 'DELETE_SUPPLIER',
    domain: 'MASTERDATA',
    name: 'Ta bort leverantör',
    description: 'Ta bort leverantör från systemet',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['manager', 'executive'],
    excludeRequestor: true,
    defaultDeadlineHours: 72,
    escalationHours: 48,
    escalateTo: ['executive'],
    notifyOnRequest: ['accountant', 'manager'],
    notifyOnApproval: ['accountant'],
    notifyOnRejection: ['requestor'],
  },
  
  // User management policies
  {
    type: 'ADD_USER',
    domain: 'USER_MANAGEMENT',
    name: 'Lägg till användare',
    description: 'Skapa ny användare i systemet',
    requiresApproval: true,
    requiresDualApproval: false,
    minimumApprovers: 1,
    approverRoles: ['tenant_admin', 'tenant_manager'],
    excludeRequestor: false,
    defaultDeadlineHours: 24,
    escalationHours: 48,
    escalateTo: ['tenant_admin'],
    notifyOnRequest: ['tenant_admin'],
    notifyOnApproval: ['it_admin'],
    notifyOnRejection: ['requestor'],
  },
  {
    type: 'CHANGE_USER_ROLE',
    domain: 'USER_MANAGEMENT',
    name: 'Ändra användarroll',
    description: 'Ändra behörighetsroll för användare',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['tenant_admin'],
    excludeRequestor: true,
    defaultDeadlineHours: 24,
    escalationHours: 24,
    escalateTo: ['tenant_admin'],
    notifyOnRequest: ['tenant_admin'],
    notifyOnApproval: ['affected_user', 'it_admin'],
    notifyOnRejection: ['requestor'],
  },
  
  // Fund operations
  {
    type: 'PROCESS_SUBSCRIPTION',
    domain: 'FUND_OPERATION',
    name: 'Teckningsorder',
    description: 'Godkänn och verkställ teckningsorder',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['fund_operations', 'manager', 'executive'],
    excludeRequestor: true,
    defaultDeadlineHours: 48,
    escalationHours: 24,
    escalateTo: ['executive'],
    notifyOnRequest: ['fund_operations', 'manager'],
    notifyOnApproval: ['investor_relations'],
    notifyOnRejection: ['requestor', 'fund_operations'],
  },
  {
    type: 'CHANGE_NAV',
    domain: 'FUND_OPERATION',
    name: 'Korrigera NAV',
    description: 'Manuell korrigering av publicerat NAV',
    requiresApproval: true,
    requiresDualApproval: true,
    minimumApprovers: 2,
    approverRoles: ['executive', 'compliance_manager'],
    excludeRequestor: true,
    defaultDeadlineHours: 4,
    escalationHours: 2,
    escalateTo: ['board'],
    notifyOnRequest: ['executive', 'compliance_manager', 'board'],
    notifyOnApproval: ['all_stakeholders'],
    notifyOnRejection: ['requestor', 'executive'],
  },
];

// ============================================================================
// Service
// ============================================================================

export const extendedApprovalService = {
  // ========== Policies ==========

  getPolicy(type: ApprovalType): ApprovalPolicy | undefined {
    return DEFAULT_POLICIES.find(p => p.type === type);
  },

  getAllPolicies(): ApprovalPolicy[] {
    return DEFAULT_POLICIES;
  },

  getPoliciesByDomain(domain: ApprovalDomain): ApprovalPolicy[] {
    return DEFAULT_POLICIES.filter(p => p.domain === domain);
  },

  // ========== Request Management ==========

  async createRequest(params: {
    tenantId: string;
    companyId: string;
    type: ApprovalType;
    title: string;
    description: string;
    data: Record<string, unknown>;
    changePreview?: ExtendedApprovalRequest['changePreview'];
    requestedBy: string;
    requestedByName: string;
    requestedByRole: string;
    requestComment?: string;
    ipAddress?: string;
  }): Promise<ExtendedApprovalRequest> {
    const policy = this.getPolicy(params.type);
    if (!policy) {
      throw new Error(`No policy found for type ${params.type}`);
    }

    // Check if auto-approve is possible
    let canAutoApprove = false;
    if (policy.autoApproveConditions) {
      const { trustedRequestorRoles, maxItems, maxAmount } = policy.autoApproveConditions;
      
      if (trustedRequestorRoles?.includes(params.requestedByRole)) {
        canAutoApprove = true;
      }
      if (maxItems && (params.changePreview?.affectedRecords || 0) > maxItems) {
        canAutoApprove = false;
      }
      if (maxAmount && (params.data.amount as number || 0) > maxAmount) {
        canAutoApprove = false;
      }
    }

    // Calculate deadline
    const now = new Date();
    const deadline = new Date(now.getTime() + policy.defaultDeadlineHours * 60 * 60 * 1000);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(params.type, params.data, params.changePreview);

    const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const request: ExtendedApprovalRequest = {
      id: requestId,
      tenantId: params.tenantId,
      companyId: params.companyId,
      domain: policy.domain,
      type: params.type,
      status: canAutoApprove && !policy.requiresApproval ? 'APPROVED' : 'PENDING',
      title: params.title,
      description: params.description,
      data: params.data,
      changePreview: params.changePreview,
      riskLevel,
      reversible: this.isReversible(params.type),
      requestedBy: params.requestedBy,
      requestedByName: params.requestedByName,
      requestedAt: now.toISOString(),
      requestComment: params.requestComment,
      deadline: deadline.toISOString(),
      requiredApprovers: policy.requiresDualApproval ? Math.max(2, policy.minimumApprovers) : policy.minimumApprovers,
      approvals: [],
      rejections: [],
      ...(canAutoApprove && !policy.requiresApproval && { approvedAt: now.toISOString() }),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `APPROVAL#${requestId}`,
        gsi1pk: `COMPANY#${params.companyId}`,
        gsi1sk: `APPROVAL#${request.status}#${request.deadline}`,
        gsi2pk: `TYPE#${params.type}`,
        gsi2sk: `${request.status}#${request.createdAt}`,
        ...request,
        ttl: Math.floor(Date.now() / 1000) + (2 * 365 * 24 * 60 * 60), // 2 years
      },
    }));

    // Send notifications
    if (policy.notifyOnRequest.length > 0) {
      await this.notifyRecipients(
        params.tenantId,
        params.companyId,
        policy.notifyOnRequest,
        'Ny godkännandebegäran',
        `${params.requestedByName} har begärt godkännande för: ${params.title}`,
        `/approvals/${requestId}`
      );
    }

    console.log(`[ExtendedApproval] Created request ${requestId} for type ${params.type}`);

    return request;
  },

  async vote(params: {
    tenantId: string;
    requestId: string;
    userId: string;
    userName: string;
    userRole: string;
    decision: 'APPROVE' | 'REJECT';
    comment?: string;
    ipAddress?: string;
  }): Promise<ExtendedApprovalRequest> {
    const request = await this.getRequest(params.tenantId, params.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Cannot vote on request with status ${request.status}`);
    }

    const policy = this.getPolicy(request.type);
    if (!policy) {
      throw new Error('Policy not found');
    }

    // Check if user can approve
    if (!policy.approverRoles.includes(params.userRole) && params.userRole !== 'admin') {
      throw new Error('User role not authorized to approve this type');
    }

    // Check if requestor is trying to approve their own request
    if (policy.excludeRequestor && params.userId === request.requestedBy) {
      throw new Error('Cannot approve your own request');
    }

    // Check if user already voted
    const existingVote = [...request.approvals, ...request.rejections].find(v => v.userId === params.userId);
    if (existingVote) {
      throw new Error('User has already voted on this request');
    }

    const now = new Date().toISOString();
    const vote: ApprovalVote = {
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      decision: params.decision,
      comment: params.comment,
      timestamp: now,
      ipAddress: params.ipAddress,
    };

    if (params.decision === 'APPROVE') {
      request.approvals.push(vote);
    } else {
      request.rejections.push(vote);
    }

    // Check if decision is final
    if (request.rejections.length > 0) {
      request.status = 'REJECTED';
      request.rejectedAt = now;
    } else if (request.approvals.length >= request.requiredApprovers) {
      request.status = 'APPROVED';
      request.approvedAt = now;
    }

    request.updatedAt = now;

    // Save
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TENANT#${params.tenantId}`,
        sk: `APPROVAL#${params.requestId}`,
        gsi1pk: `COMPANY#${request.companyId}`,
        gsi1sk: `APPROVAL#${request.status}#${request.deadline}`,
        gsi2pk: `TYPE#${request.type}`,
        gsi2sk: `${request.status}#${request.createdAt}`,
        ...request,
        ttl: Math.floor(Date.now() / 1000) + (2 * 365 * 24 * 60 * 60),
      },
    }));

    // Send notifications based on result
    if (request.status === 'APPROVED' && policy.notifyOnApproval.length > 0) {
      await this.notifyRecipients(
        params.tenantId,
        request.companyId,
        policy.notifyOnApproval,
        'Begäran godkänd',
        `"${request.title}" har godkänts`,
        `/approvals/${params.requestId}`
      );
    } else if (request.status === 'REJECTED' && policy.notifyOnRejection.length > 0) {
      await this.notifyRecipients(
        params.tenantId,
        request.companyId,
        policy.notifyOnRejection,
        'Begäran avvisad',
        `"${request.title}" har avvisats: ${params.comment || 'Inget skäl angivet'}`,
        `/approvals/${params.requestId}`
      );
    }

    return request;
  },

  async getRequest(tenantId: string, requestId: string): Promise<ExtendedApprovalRequest | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `APPROVAL#${requestId}`,
        },
      }));

      return result.Item as ExtendedApprovalRequest | null;
    } catch (error) {
      console.error('[ExtendedApproval] Error getting request:', error);
      return null;
    }
  },

  async getPendingRequests(params: {
    tenantId: string;
    companyId?: string;
    domain?: ApprovalDomain;
    type?: ApprovalType;
    approverId?: string;
    approverRole?: string;
  }): Promise<ExtendedApprovalRequest[]> {
    let queryParams: Record<string, unknown>;

    if (params.companyId) {
      queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk AND begins_with(gsi1sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `COMPANY#${params.companyId}`,
          ':sk': 'APPROVAL#PENDING#',
        },
      };
    } else if (params.type) {
      queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'gsi2',
        KeyConditionExpression: 'gsi2pk = :pk AND begins_with(gsi2sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TYPE#${params.type}`,
          ':sk': 'PENDING#',
        },
      };
    } else {
      queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `TENANT#${params.tenantId}`,
          ':sk': 'APPROVAL#',
          ':status': 'PENDING',
        },
      };
    }

    try {
      const result = await docClient.send(new QueryCommand(queryParams as any));
      let requests = (result.Items || []) as ExtendedApprovalRequest[];

      // Filter by domain if specified
      if (params.domain) {
        requests = requests.filter(r => r.domain === params.domain);
      }

      // Filter by approver role if specified
      if (params.approverRole) {
        requests = requests.filter(r => {
          const policy = this.getPolicy(r.type);
          return policy?.approverRoles.includes(params.approverRole!) || params.approverRole === 'admin';
        });
      }

      // Filter out requests user already voted on
      if (params.approverId) {
        requests = requests.filter(r => {
          const hasVoted = [...r.approvals, ...r.rejections].some(v => v.userId === params.approverId);
          return !hasVoted;
        });
      }

      return requests;
    } catch (error) {
      console.error('[ExtendedApproval] Error getting pending requests:', error);
      return [];
    }
  },

  // ========== Helpers ==========

  calculateRiskLevel(
    type: ApprovalType,
    data: Record<string, unknown>,
    changePreview?: ExtendedApprovalRequest['changePreview']
  ): ExtendedApprovalRequest['riskLevel'] {
    const highRiskTypes: ApprovalType[] = [
      'CHANGE_NAV', 'DELETE_SUPPLIER', 'DELETE_CUSTOMER', 
      'REMOVE_USER', 'CHANGE_APPROVAL_RULES', 'EXPORT_ANNUAL_REPORT'
    ];

    const criticalRiskTypes: ApprovalType[] = [
      'PUBLISH_FI_REPORT', 'PROCESS_REDEMPTION', 'CHANGE_CHART_OF_ACCOUNTS'
    ];

    if (criticalRiskTypes.includes(type)) return 'CRITICAL';
    if (highRiskTypes.includes(type)) return 'HIGH';

    // Check by affected records
    if (changePreview?.affectedRecords && changePreview.affectedRecords > 100) return 'HIGH';
    if (changePreview?.affectedRecords && changePreview.affectedRecords > 10) return 'MEDIUM';

    // Check by amount
    const amount = data.amount as number;
    if (amount && amount > 1000000) return 'HIGH';
    if (amount && amount > 100000) return 'MEDIUM';

    return 'LOW';
  },

  isReversible(type: ApprovalType): boolean {
    const irreversibleTypes: ApprovalType[] = [
      'PUBLISH_NAV', 'PUBLISH_FI_REPORT', 'EXPORT_ANNUAL_REPORT',
      'EXPORT_TAX_DECLARATION', 'PROCESS_SUBSCRIPTION', 'PROCESS_REDEMPTION'
    ];

    return !irreversibleTypes.includes(type);
  },

  async notifyRecipients(
    tenantId: string,
    companyId: string,
    recipients: string[],
    title: string,
    message: string,
    actionUrl: string
  ): Promise<void> {
    // In production, would resolve recipients to actual users
    // and send via appropriate channels
    await sendNotification({
      companyId,
      type: 'pending_approval',
      priority: 'high',
      title,
      message,
      channels: ['in_app', 'email'],
      actionUrl,
      actionLabel: 'Visa begäran',
    });
  },

  // ========== Escalation ==========

  async checkAndEscalate(tenantId: string): Promise<number> {
    const now = new Date();
    let escalatedCount = 0;

    try {
      // Get all pending requests
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sk': 'APPROVAL#',
          ':status': 'PENDING',
        },
      }));

      const requests = (result.Items || []) as ExtendedApprovalRequest[];

      for (const request of requests) {
        const policy = this.getPolicy(request.type);
        if (!policy) continue;

        const escalationThreshold = new Date(
          new Date(request.deadline).getTime() - policy.escalationHours * 60 * 60 * 1000
        );

        if (now >= escalationThreshold && !request.escalatedAt) {
          // Escalate
          request.escalatedAt = now.toISOString();
          request.escalatedTo = policy.escalateTo;
          request.updatedAt = now.toISOString();

          await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              pk: `TENANT#${tenantId}`,
              sk: `APPROVAL#${request.id}`,
              gsi1pk: `COMPANY#${request.companyId}`,
              gsi1sk: `APPROVAL#${request.status}#${request.deadline}`,
              gsi2pk: `TYPE#${request.type}`,
              gsi2sk: `${request.status}#${request.createdAt}`,
              ...request,
            },
          }));

          // Notify escalation targets
          await this.notifyRecipients(
            tenantId,
            request.companyId,
            policy.escalateTo,
            'Eskalerad godkännandebegäran',
            `"${request.title}" kräver omedelbar uppmärksamhet`,
            `/approvals/${request.id}`
          );

          escalatedCount++;
        }
      }
    } catch (error) {
      console.error('[ExtendedApproval] Error during escalation check:', error);
    }

    return escalatedCount;
  },
};

export default extendedApprovalService;

