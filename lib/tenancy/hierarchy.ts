/**
 * Customer Hierarchy Model
 * 
 * Defines the relationship structure:
 * Tenant (AIFMgroup customer) → Company → Fund → Portfolio
 * 
 * This hierarchy is used for:
 * - Access control
 * - Data isolation
 * - Reporting rollups
 * - Billing
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { TenantContext, validateResourceAccess } from './tenantContext';

// ============================================================================
// Types
// ============================================================================

export interface HierarchyNode {
  id: string;
  tenantId: string;
  parentId?: string;
  type: 'tenant' | 'company' | 'fund' | 'portfolio';
  name: string;
  shortName?: string;
  orgNumber?: string;
  status: 'active' | 'inactive' | 'archived';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyNode extends HierarchyNode {
  type: 'company';
  metadata: {
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    vatNumber?: string;
    fortnoxConnected?: boolean;
    fortnoxCompanyId?: string;
    fiscalYearEnd?: string; // MM-DD format, e.g., "12-31"
    currency?: string;
  };
}

export interface FundNode extends HierarchyNode {
  type: 'fund';
  parentId: string; // Company ID
  metadata: {
    fundType: 'private_equity' | 'venture_capital' | 'real_estate' | 'hedge' | 'credit' | 'infrastructure';
    vintageYear?: number;
    targetSize?: number;
    currency?: string;
    investmentPeriodEnd?: string;
    fundTermEnd?: string;
    managementFee?: number;
    carriedInterest?: number;
    hurdleRate?: number;
    regulatoryStatus?: string;
  };
}

export interface PortfolioNode extends HierarchyNode {
  type: 'portfolio';
  parentId: string; // Fund ID
  metadata: {
    sector?: string;
    industry?: string;
    geography?: string;
    investmentDate?: string;
    initialInvestment?: number;
    currentValuation?: number;
    currency?: string;
    ownershipPercentage?: number;
    boardRepresentation?: boolean;
    exitDate?: string;
    exitType?: 'ipo' | 'trade_sale' | 'secondary' | 'write_off';
    exitProceeds?: number;
  };
}

export type AnyHierarchyNode = CompanyNode | FundNode | PortfolioNode;

// ============================================================================
// DynamoDB Setup
// ============================================================================

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const HIERARCHY_TABLE = process.env.HIERARCHY_TABLE_NAME || 'aifm-hierarchy';

// ============================================================================
// Hierarchy Service
// ============================================================================

export const hierarchyService = {
  /**
   * Get all nodes for a tenant (full hierarchy)
   */
  async getHierarchy(context: TenantContext): Promise<HierarchyNode[]> {
    const command = new QueryCommand({
      TableName: HIERARCHY_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${context.tenantId}`,
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []) as HierarchyNode[];
  },

  /**
   * Get children of a node
   */
  async getChildren(context: TenantContext, parentId: string): Promise<HierarchyNode[]> {
    const command = new QueryCommand({
      TableName: HIERARCHY_TABLE,
      IndexName: 'parentId-index',
      KeyConditionExpression: 'parentId = :parentId AND tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':parentId': parentId,
        ':tenantId': context.tenantId,
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []) as HierarchyNode[];
  },

  /**
   * Get a specific node
   */
  async getNode(context: TenantContext, nodeId: string): Promise<HierarchyNode | null> {
    const command = new GetCommand({
      TableName: HIERARCHY_TABLE,
      Key: {
        pk: `TENANT#${context.tenantId}`,
        sk: `NODE#${nodeId}`,
      },
    });

    const response = await docClient.send(command);
    const node = response.Item as HierarchyNode | undefined;

    // Validate tenant access
    if (node && !validateResourceAccess(context, node.tenantId)) {
      console.warn(`[Hierarchy] Unauthorized access attempt to node ${nodeId}`);
      return null;
    }

    return node || null;
  },

  /**
   * Get all companies in tenant
   */
  async getCompanies(context: TenantContext): Promise<CompanyNode[]> {
    const command = new QueryCommand({
      TableName: HIERARCHY_TABLE,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${context.tenantId}`,
        ':type': 'company',
      },
    });

    const response = await docClient.send(command);
    const companies = (response.Items || []) as CompanyNode[];

    // Filter by user's allowed companies if not admin
    if (context.role !== 'tenant_admin' && context.role !== 'tenant_manager') {
      return companies.filter(c => context.allowedCompanyIds.includes(c.id));
    }

    return companies;
  },

  /**
   * Get funds for a company
   */
  async getFunds(context: TenantContext, companyId: string): Promise<FundNode[]> {
    // Validate company access
    if (!context.allowedCompanyIds.includes(companyId) && 
        context.role !== 'tenant_admin' && context.role !== 'tenant_manager') {
      return [];
    }

    const command = new QueryCommand({
      TableName: HIERARCHY_TABLE,
      IndexName: 'parentId-index',
      KeyConditionExpression: 'parentId = :parentId',
      FilterExpression: 'tenantId = :tenantId AND #type = :type',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':parentId': companyId,
        ':tenantId': context.tenantId,
        ':type': 'fund',
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []) as FundNode[];
  },

  /**
   * Get portfolios for a fund
   */
  async getPortfolios(context: TenantContext, fundId: string): Promise<PortfolioNode[]> {
    // First get the fund to validate access
    const fund = await this.getNode(context, fundId);
    if (!fund || fund.type !== 'fund') {
      return [];
    }

    const command = new QueryCommand({
      TableName: HIERARCHY_TABLE,
      IndexName: 'parentId-index',
      KeyConditionExpression: 'parentId = :parentId',
      FilterExpression: 'tenantId = :tenantId AND #type = :type',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':parentId': fundId,
        ':tenantId': context.tenantId,
        ':type': 'portfolio',
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []) as PortfolioNode[];
  },

  /**
   * Create a new node
   */
  async createNode<T extends HierarchyNode>(
    context: TenantContext,
    node: Omit<T, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const now = new Date().toISOString();
    const nodeId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Validate parent access if parent specified
    if (node.parentId) {
      const parent = await this.getNode(context, node.parentId);
      if (!parent) {
        throw new Error(`Parent node ${node.parentId} not found`);
      }
    }

    const newNode: T = {
      ...node,
      id: nodeId,
      tenantId: context.tenantId,
      createdAt: now,
      updatedAt: now,
    } as T;

    await docClient.send(new PutCommand({
      TableName: HIERARCHY_TABLE,
      Item: {
        pk: `TENANT#${context.tenantId}`,
        sk: `NODE#${nodeId}`,
        ...newNode,
      },
    }));

    console.log(`[Hierarchy] Created ${node.type} node ${nodeId} in tenant ${context.tenantId}`);

    return newNode;
  },

  /**
   * Update a node
   */
  async updateNode(
    context: TenantContext,
    nodeId: string,
    updates: Partial<HierarchyNode>
  ): Promise<HierarchyNode | null> {
    // Validate access
    const existing = await this.getNode(context, nodeId);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updateExpressions: string[] = ['updatedAt = :now'];
    const expressionValues: Record<string, unknown> = { ':now': now };
    const expressionNames: Record<string, string> = {};

    // Build update expression dynamically
    const allowedUpdates = ['name', 'shortName', 'status', 'metadata'];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key) && value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionNames[`#${key}`] = key;
        expressionValues[`:${key}`] = value;
      }
    }

    await docClient.send(new UpdateCommand({
      TableName: HIERARCHY_TABLE,
      Key: {
        pk: `TENANT#${context.tenantId}`,
        sk: `NODE#${nodeId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
      ExpressionAttributeValues: expressionValues,
    }));

    return this.getNode(context, nodeId);
  },

  /**
   * Delete a node (soft delete - sets status to archived)
   */
  async archiveNode(context: TenantContext, nodeId: string): Promise<boolean> {
    const node = await this.getNode(context, nodeId);
    if (!node) {
      return false;
    }

    // Check for children
    const children = await this.getChildren(context, nodeId);
    if (children.length > 0) {
      throw new Error('Cannot archive node with active children. Archive children first.');
    }

    await this.updateNode(context, nodeId, { status: 'archived' });
    console.log(`[Hierarchy] Archived node ${nodeId}`);

    return true;
  },

  /**
   * Get full path from node to tenant root
   */
  async getNodePath(context: TenantContext, nodeId: string): Promise<HierarchyNode[]> {
    const path: HierarchyNode[] = [];
    let currentId: string | undefined = nodeId;

    while (currentId) {
      const node = await this.getNode(context, currentId);
      if (!node) break;
      
      path.unshift(node);
      currentId = node.parentId;
    }

    return path;
  },

  /**
   * Validate if user has access to a node based on company hierarchy
   */
  async validateNodeAccess(context: TenantContext, nodeId: string): Promise<boolean> {
    const path = await this.getNodePath(context, nodeId);
    
    // Find the company in the path
    const company = path.find(n => n.type === 'company');
    if (!company) {
      return false;
    }

    // Check if user has access to this company
    return context.allowedCompanyIds.includes(company.id) ||
           context.role === 'tenant_admin' ||
           context.role === 'tenant_manager';
  },
};

// ============================================================================
// Migration Helper - Create initial hierarchy from existing companies
// ============================================================================

export async function migrateExistingCompanies(
  context: TenantContext,
  existingCompanies: Array<{
    id: string;
    name: string;
    orgNumber?: string;
    fortnoxCompanyId?: string;
  }>
): Promise<void> {
  for (const company of existingCompanies) {
    const exists = await hierarchyService.getNode(context, company.id);
    if (exists) continue;

    await hierarchyService.createNode<CompanyNode>(context, {
      type: 'company',
      name: company.name,
      orgNumber: company.orgNumber,
      status: 'active',
      metadata: {
        fortnoxCompanyId: company.fortnoxCompanyId,
        fortnoxConnected: !!company.fortnoxCompanyId,
      },
    });
  }
}


