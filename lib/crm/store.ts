/**
 * CRM Store - DynamoDB-backed storage for CRM entities
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand, 
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { 
  Contact, 
  CrmCompany, 
  Deal, 
  Task, 
  Activity,
  CrmStats,
  TimelineEntry,
} from './types';

// ============ AWS Clients ============
const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.CRM_TABLE_NAME || 'aifm-crm';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Helpers ============
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ============ Contact Store ============
export const contactStore = {
  async get(contactId: string): Promise<Contact | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `CONTACT#${contactId}`, sk: 'METADATA' }
      }));
      return result.Item ? (result.Item as unknown as Contact) : null;
    } catch (error) {
      console.error('[CRM] Contact get error:', error);
      return null;
    }
  },

  async list(companyId: string): Promise<Contact[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'companyId-type-index',
        KeyConditionExpression: 'companyId = :companyId AND entityType = :type',
        ExpressionAttributeValues: { 
          ':companyId': companyId,
          ':type': 'contact'
        },
      }));
      return (result.Items || []) as unknown as Contact[];
    } catch (error) {
      console.error('[CRM] Contact list error:', error);
      return [];
    }
  },

  async create(companyId: string, data: Partial<Contact>, userId: string): Promise<Contact> {
    const id = generateId('contact');
    const now = nowISO();
    
    const contact: Contact = {
      id,
      companyId,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      title: data.title,
      department: data.department,
      linkedIn: data.linkedIn,
      address: data.address,
      status: data.status || 'active',
      tags: data.tags || [],
      notes: data.notes,
      avatarUrl: data.avatarUrl,
      crmCompanyId: data.crmCompanyId,
      ownerId: data.ownerId || userId,
      ownerName: data.ownerName,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `CONTACT#${id}`,
        sk: 'METADATA',
        entityType: 'contact',
        ...contact,
      }
    }));

    return contact;
  },

  async update(contactId: string, updates: Partial<Contact>, userId: string): Promise<void> {
    const existing = await this.get(contactId);
    if (!existing) throw new Error('Contact not found');

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `CONTACT#${contactId}`,
        sk: 'METADATA',
        entityType: 'contact',
        ...existing,
        ...updates,
        updatedAt: nowISO(),
        updatedBy: userId,
      }
    }));
  },

  async delete(contactId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CONTACT#${contactId}`, sk: 'METADATA' }
    }));
  },
};

// ============ CRM Company Store ============
export const crmCompanyStore = {
  async get(crmCompanyId: string): Promise<CrmCompany | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `CRMCOMPANY#${crmCompanyId}`, sk: 'METADATA' }
      }));
      return result.Item ? (result.Item as unknown as CrmCompany) : null;
    } catch (error) {
      console.error('[CRM] Company get error:', error);
      return null;
    }
  },

  async list(companyId: string): Promise<CrmCompany[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'companyId-type-index',
        KeyConditionExpression: 'companyId = :companyId AND entityType = :type',
        ExpressionAttributeValues: { 
          ':companyId': companyId,
          ':type': 'crmcompany'
        },
      }));
      return (result.Items || []) as unknown as CrmCompany[];
    } catch (error) {
      console.error('[CRM] Company list error:', error);
      return [];
    }
  },

  async create(companyId: string, data: Partial<CrmCompany>, userId: string): Promise<CrmCompany> {
    const id = generateId('crmco');
    const now = nowISO();
    
    const company: CrmCompany = {
      id,
      companyId,
      name: data.name || '',
      orgNumber: data.orgNumber,
      website: data.website,
      industry: data.industry,
      email: data.email,
      phone: data.phone,
      address: data.address,
      employeeCount: data.employeeCount,
      annualRevenue: data.annualRevenue,
      description: data.description,
      status: data.status || 'lead',
      tags: data.tags || [],
      ownerId: data.ownerId || userId,
      ownerName: data.ownerName,
      logoUrl: data.logoUrl,
      fortnoxSupplierId: data.fortnoxSupplierId,
      fortnoxCustomerId: data.fortnoxCustomerId,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `CRMCOMPANY#${id}`,
        sk: 'METADATA',
        entityType: 'crmcompany',
        ...company,
      }
    }));

    return company;
  },

  async update(crmCompanyId: string, updates: Partial<CrmCompany>, userId: string): Promise<void> {
    const existing = await this.get(crmCompanyId);
    if (!existing) throw new Error('CRM Company not found');

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `CRMCOMPANY#${crmCompanyId}`,
        sk: 'METADATA',
        entityType: 'crmcompany',
        ...existing,
        ...updates,
        updatedAt: nowISO(),
        updatedBy: userId,
      }
    }));
  },

  async delete(crmCompanyId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CRMCOMPANY#${crmCompanyId}`, sk: 'METADATA' }
    }));
  },
};

// ============ Deal Store ============
export const dealStore = {
  async get(dealId: string): Promise<Deal | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `DEAL#${dealId}`, sk: 'METADATA' }
      }));
      return result.Item ? (result.Item as unknown as Deal) : null;
    } catch (error) {
      console.error('[CRM] Deal get error:', error);
      return null;
    }
  },

  async list(companyId: string): Promise<Deal[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'companyId-type-index',
        KeyConditionExpression: 'companyId = :companyId AND entityType = :type',
        ExpressionAttributeValues: { 
          ':companyId': companyId,
          ':type': 'deal'
        },
      }));
      return (result.Items || []) as unknown as Deal[];
    } catch (error) {
      console.error('[CRM] Deal list error:', error);
      return [];
    }
  },

  async create(companyId: string, data: Partial<Deal>, userId: string): Promise<Deal> {
    const id = generateId('deal');
    const now = nowISO();
    
    const deal: Deal = {
      id,
      companyId,
      name: data.name || '',
      description: data.description,
      crmCompanyId: data.crmCompanyId,
      crmCompanyName: data.crmCompanyName,
      contactIds: data.contactIds || [],
      primaryContactId: data.primaryContactId,
      primaryContactName: data.primaryContactName,
      stage: data.stage || 'lead',
      probability: data.probability,
      value: data.value,
      currency: data.currency || 'SEK',
      expectedCloseDate: data.expectedCloseDate,
      actualCloseDate: data.actualCloseDate,
      status: data.status || 'open',
      lostReason: data.lostReason,
      tags: data.tags || [],
      ownerId: data.ownerId || userId,
      ownerName: data.ownerName,
      priority: data.priority || 'medium',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `DEAL#${id}`,
        sk: 'METADATA',
        entityType: 'deal',
        ...deal,
      }
    }));

    return deal;
  },

  async update(dealId: string, updates: Partial<Deal>, userId: string): Promise<void> {
    const existing = await this.get(dealId);
    if (!existing) throw new Error('Deal not found');

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `DEAL#${dealId}`,
        sk: 'METADATA',
        entityType: 'deal',
        ...existing,
        ...updates,
        updatedAt: nowISO(),
        updatedBy: userId,
      }
    }));
  },

  async updateStage(dealId: string, stage: Deal['stage'], userId: string): Promise<void> {
    const existing = await this.get(dealId);
    if (!existing) throw new Error('Deal not found');

    const updates: Partial<Deal> = {
      stage,
      updatedAt: nowISO(),
      updatedBy: userId,
    };

    // Auto-set status based on stage
    if (stage === 'won') {
      updates.status = 'won';
      updates.actualCloseDate = nowISO().split('T')[0];
    } else if (stage === 'lost') {
      updates.status = 'lost';
      updates.actualCloseDate = nowISO().split('T')[0];
    } else {
      updates.status = 'open';
    }

    await this.update(dealId, updates, userId);
  },

  async delete(dealId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `DEAL#${dealId}`, sk: 'METADATA' }
    }));
  },
};

// ============ Task Store ============
export const taskStore = {
  async get(taskId: string): Promise<Task | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `TASK#${taskId}`, sk: 'METADATA' }
      }));
      return result.Item ? (result.Item as unknown as Task) : null;
    } catch (error) {
      console.error('[CRM] Task get error:', error);
      return null;
    }
  },

  async list(companyId: string): Promise<Task[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'companyId-type-index',
        KeyConditionExpression: 'companyId = :companyId AND entityType = :type',
        ExpressionAttributeValues: { 
          ':companyId': companyId,
          ':type': 'task'
        },
      }));
      return (result.Items || []) as unknown as Task[];
    } catch (error) {
      console.error('[CRM] Task list error:', error);
      return [];
    }
  },

  async create(companyId: string, data: Partial<Task>, userId: string): Promise<Task> {
    const id = generateId('task');
    const now = nowISO();
    
    const task: Task = {
      id,
      companyId,
      title: data.title || '',
      description: data.description,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      completedAt: data.completedAt,
      contactId: data.contactId,
      contactName: data.contactName,
      crmCompanyId: data.crmCompanyId,
      crmCompanyName: data.crmCompanyName,
      dealId: data.dealId,
      dealName: data.dealName,
      activityId: data.activityId,
      assigneeId: data.assigneeId || userId,
      assigneeName: data.assigneeName,
      reminderAt: data.reminderAt,
      tags: data.tags || [],
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TASK#${id}`,
        sk: 'METADATA',
        entityType: 'task',
        ...task,
      }
    }));

    return task;
  },

  async update(taskId: string, updates: Partial<Task>, userId: string): Promise<void> {
    const existing = await this.get(taskId);
    if (!existing) throw new Error('Task not found');

    // Auto-set completedAt if status changes to completed
    if (updates.status === 'completed' && !updates.completedAt) {
      updates.completedAt = nowISO();
    }

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `TASK#${taskId}`,
        sk: 'METADATA',
        entityType: 'task',
        ...existing,
        ...updates,
        updatedAt: nowISO(),
        updatedBy: userId,
      }
    }));
  },

  async delete(taskId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `TASK#${taskId}`, sk: 'METADATA' }
    }));
  },
};

// ============ Activity Store ============
export const activityStore = {
  async get(activityId: string): Promise<Activity | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `ACTIVITY#${activityId}`, sk: 'METADATA' }
      }));
      return result.Item ? (result.Item as unknown as Activity) : null;
    } catch (error) {
      console.error('[CRM] Activity get error:', error);
      return null;
    }
  },

  async list(companyId: string): Promise<Activity[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'companyId-type-index',
        KeyConditionExpression: 'companyId = :companyId AND entityType = :type',
        ExpressionAttributeValues: { 
          ':companyId': companyId,
          ':type': 'activity'
        },
      }));
      return (result.Items || []) as unknown as Activity[];
    } catch (error) {
      console.error('[CRM] Activity list error:', error);
      return [];
    }
  },

  async listByDateRange(companyId: string, startDate: string, endDate: string): Promise<Activity[]> {
    const all = await this.list(companyId);
    return all.filter(a => {
      if (!a.startTime) return false;
      const activityDate = a.startTime.split('T')[0];
      return activityDate >= startDate && activityDate <= endDate;
    });
  },

  async create(companyId: string, data: Partial<Activity>, userId: string): Promise<Activity> {
    const id = generateId('activity');
    const now = nowISO();
    
    const activity: Activity = {
      id,
      companyId,
      type: data.type || 'meeting',
      title: data.title || '',
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.duration,
      location: data.location,
      isAllDay: data.isAllDay || false,
      contactId: data.contactId,
      contactName: data.contactName,
      crmCompanyId: data.crmCompanyId,
      crmCompanyName: data.crmCompanyName,
      dealId: data.dealId,
      dealName: data.dealName,
      participants: data.participants || [],
      outcome: data.outcome,
      nextSteps: data.nextSteps,
      status: data.status || 'scheduled',
      tags: data.tags || [],
      ownerId: data.ownerId || userId,
      ownerName: data.ownerName,
      recurrence: data.recurrence,
      color: data.color,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `ACTIVITY#${id}`,
        sk: 'METADATA',
        entityType: 'activity',
        ...activity,
      }
    }));

    return activity;
  },

  async update(activityId: string, updates: Partial<Activity>, userId: string): Promise<void> {
    const existing = await this.get(activityId);
    if (!existing) throw new Error('Activity not found');

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `ACTIVITY#${activityId}`,
        sk: 'METADATA',
        entityType: 'activity',
        ...existing,
        ...updates,
        updatedAt: nowISO(),
        updatedBy: userId,
      }
    }));
  },

  async delete(activityId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `ACTIVITY#${activityId}`, sk: 'METADATA' }
    }));
  },
};

// ============ Stats Helper ============
export async function getCrmStats(companyId: string): Promise<CrmStats> {
  const [contacts, companies, deals, tasks, activities] = await Promise.all([
    contactStore.list(companyId),
    crmCompanyStore.list(companyId),
    dealStore.list(companyId),
    taskStore.list(companyId),
    activityStore.list(companyId),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const openDeals = deals.filter(d => d.status === 'open');
  const wonDeals = deals.filter(d => d.status === 'won');
  const lostDeals = deals.filter(d => d.status === 'lost');

  return {
    totalContacts: contacts.length,
    totalCompanies: companies.length,
    totalDeals: deals.length,
    openDeals: openDeals.length,
    wonDeals: wonDeals.length,
    lostDeals: lostDeals.length,
    totalValue: openDeals.reduce((sum, d) => sum + (d.value || 0), 0),
    wonValue: wonDeals.reduce((sum, d) => sum + (d.value || 0), 0),
    activitiesThisWeek: activities.filter(a => 
      a.startTime && a.startTime.split('T')[0] >= weekAgo
    ).length,
    tasksOverdue: tasks.filter(t => 
      t.status !== 'completed' && 
      t.status !== 'cancelled' && 
      t.dueDate && 
      t.dueDate < today
    ).length,
    tasksDueToday: tasks.filter(t => 
      t.status !== 'completed' && 
      t.status !== 'cancelled' && 
      t.dueDate === today
    ).length,
  };
}

// ============ Timeline Helper ============
export async function getTimeline(
  companyId: string, 
  options?: {
    contactId?: string;
    crmCompanyId?: string;
    dealId?: string;
    limit?: number;
  }
): Promise<TimelineEntry[]> {
  const [activities, tasks] = await Promise.all([
    activityStore.list(companyId),
    taskStore.list(companyId),
  ]);

  let entries: TimelineEntry[] = [];

  // Add activities
  for (const activity of activities) {
    if (options?.contactId && activity.contactId !== options.contactId) continue;
    if (options?.crmCompanyId && activity.crmCompanyId !== options.crmCompanyId) continue;
    if (options?.dealId && activity.dealId !== options.dealId) continue;

    entries.push({
      id: activity.id,
      type: 'activity',
      title: activity.title,
      description: activity.description,
      timestamp: activity.startTime || activity.createdAt,
      entityType: 'activity',
      entityId: activity.id,
      metadata: {
        activityType: activity.type,
        status: activity.status,
      },
      user: activity.ownerId ? { id: activity.ownerId, name: activity.ownerName || '' } : undefined,
    });
  }

  // Add completed tasks
  for (const task of tasks) {
    if (task.status !== 'completed') continue;
    if (options?.contactId && task.contactId !== options.contactId) continue;
    if (options?.crmCompanyId && task.crmCompanyId !== options.crmCompanyId) continue;
    if (options?.dealId && task.dealId !== options.dealId) continue;

    entries.push({
      id: task.id,
      type: 'task_completed',
      title: `Uppgift slutförd: ${task.title}`,
      timestamp: task.completedAt || task.updatedAt,
      entityType: 'task',
      entityId: task.id,
      user: task.assigneeId ? { id: task.assigneeId, name: task.assigneeName || '' } : undefined,
    });
  }

  // Sort by timestamp descending
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply limit
  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

