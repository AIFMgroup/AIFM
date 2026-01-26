import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand, QueryCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// DynamoDB Setup
// ============================================================================

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE_NAME || 'aifm-workflows';
const WORKFLOW_INSTANCES_TABLE = process.env.WORKFLOW_INSTANCES_TABLE_NAME || 'aifm-workflow-instances';

// ============================================================================
// Types
// ============================================================================

interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: 'approval' | 'task' | 'notification' | 'condition' | 'wait';
  assigneeType: 'role' | 'user' | 'dynamic';
  assignee: string;
  config: Record<string, unknown>;
  order: number;
  required: boolean;
}

interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'threshold';
  config: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  escalationRules: {
    afterHours: number;
    escalateTo: string;
    notifyOnEscalation: boolean;
  };
  sla: {
    warningHours: number;
    criticalHours: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'escalated';
  currentStep: number;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  context: Record<string, unknown>;
  stepHistory: Array<{
    stepId: string;
    status: string;
    completedBy?: string;
    completedAt?: string;
    comments?: string;
  }>;
}

// ============================================================================
// GET - List workflows or get specific workflow
// ============================================================================

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('id');
    const type = searchParams.get('type') || 'workflows';

    if (workflowId) {
      return await getWorkflow(workflowId);
    }

    switch (type) {
      case 'instances':
        return await getWorkflowInstances(searchParams);
      case 'templates':
        return await getWorkflowTemplates();
      case 'stats':
        return await getWorkflowStats();
      case 'workflows':
      default:
        return await listWorkflows(searchParams);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch workflows';
    console.error('Failed to fetch workflows:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function getWorkflow(workflowId: string) {
  const command = new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { id: workflowId },
  });
  const response = await docClient.send(command);

  if (!response.Item) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  return NextResponse.json({ workflow: response.Item });
}

async function listWorkflows(searchParams: URLSearchParams) {
  const category = searchParams.get('category');
  const status = searchParams.get('status');

  const filterExpressions: string[] = [];
  const expressionAttributeValues: Record<string, unknown> = {};
  const expressionAttributeNames: Record<string, string> = {};

  if (category) {
    filterExpressions.push('category = :category');
    expressionAttributeValues[':category'] = category;
  }

  if (status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
  }

  const params: ScanCommandInput = {
    TableName: WORKFLOWS_TABLE,
  };

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }
  }

  try {
    const command = new ScanCommand(params);
    const response = await docClient.send(command);

    return NextResponse.json({
      workflows: response.Items || getDefaultWorkflows(),
    });
  } catch {
    // Return defaults if table doesn't exist
    return NextResponse.json({ workflows: getDefaultWorkflows() });
  }
}

async function getWorkflowInstances(searchParams: URLSearchParams) {
  const workflowId = searchParams.get('workflowId');
  const status = searchParams.get('status');

  const filterExpressions: string[] = [];
  const expressionAttributeValues: Record<string, unknown> = {};
  const expressionAttributeNames: Record<string, string> = {};

  if (workflowId) {
    filterExpressions.push('workflowId = :workflowId');
    expressionAttributeValues[':workflowId'] = workflowId;
  }

  if (status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
  }

  const params: ScanCommandInput = {
    TableName: WORKFLOW_INSTANCES_TABLE,
  };

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }
  }

  try {
    const command = new ScanCommand(params);
    const response = await docClient.send(command);

    return NextResponse.json({
      instances: response.Items || [],
    });
  } catch {
    return NextResponse.json({ instances: [] });
  }
}

async function getWorkflowTemplates() {
  // Pre-defined workflow templates
  const templates = [
    {
      id: 'template-invoice-approval',
      name: 'Fakturagodkännande',
      description: 'Standard arbetsflöde för godkännande av fakturor',
      category: 'Ekonomi',
      steps: [
        { id: 's1', name: 'Granska faktura', type: 'task', assigneeType: 'role', assignee: 'accountant', order: 1, required: true },
        { id: 's2', name: 'Godkänn belopp', type: 'approval', assigneeType: 'role', assignee: 'manager', order: 2, required: true },
        { id: 's3', name: 'Bokför', type: 'task', assigneeType: 'role', assignee: 'accountant', order: 3, required: true },
      ],
    },
    {
      id: 'template-client-onboarding',
      name: 'Kund-onboarding',
      description: 'Process för att ta emot nya kunder',
      category: 'Kunder',
      steps: [
        { id: 's1', name: 'KYC-kontroll', type: 'task', assigneeType: 'role', assignee: 'compliance', order: 1, required: true },
        { id: 's2', name: 'Riskbedömning', type: 'approval', assigneeType: 'role', assignee: 'manager', order: 2, required: true },
        { id: 's3', name: 'Skapa avtal', type: 'task', assigneeType: 'role', assignee: 'admin', order: 3, required: true },
        { id: 's4', name: 'Godkänn avtal', type: 'approval', assigneeType: 'role', assignee: 'executive', order: 4, required: true },
        { id: 's5', name: 'Välkomstmail', type: 'notification', assigneeType: 'dynamic', assignee: 'client', order: 5, required: false },
      ],
    },
    {
      id: 'template-quarterly-reporting',
      name: 'Kvartalsrapportering',
      description: 'Checklista för kvartalsrapportering',
      category: 'Compliance',
      steps: [
        { id: 's1', name: 'Samla in data', type: 'task', assigneeType: 'role', assignee: 'accountant', order: 1, required: true },
        { id: 's2', name: 'Verifiera siffror', type: 'task', assigneeType: 'role', assignee: 'manager', order: 2, required: true },
        { id: 's3', name: 'Granska rapport', type: 'approval', assigneeType: 'role', assignee: 'compliance', order: 3, required: true },
        { id: 's4', name: 'Slutgodkännande', type: 'approval', assigneeType: 'role', assignee: 'executive', order: 4, required: true },
        { id: 's5', name: 'Skicka till FI', type: 'task', assigneeType: 'role', assignee: 'compliance', order: 5, required: true },
      ],
    },
    {
      id: 'template-expense-approval',
      name: 'Utgiftsgodkännande',
      description: 'Godkännandeflöde för utgifter baserat på belopp',
      category: 'Ekonomi',
      steps: [
        { id: 's1', name: 'Verifiera kvitto', type: 'task', assigneeType: 'role', assignee: 'accountant', order: 1, required: true },
        { id: 's2', name: 'Första godkännande', type: 'approval', assigneeType: 'role', assignee: 'manager', order: 2, required: true },
        { id: 's3', name: 'VD-godkännande (>50k)', type: 'condition', assigneeType: 'role', assignee: 'executive', order: 3, required: false, config: { condition: 'amount > 50000' } },
      ],
    },
  ];

  return NextResponse.json({ templates });
}

async function getWorkflowStats() {
  // Get workflow statistics
  try {
    const workflowsCommand = new ScanCommand({
      TableName: WORKFLOWS_TABLE,
    });
    const workflowsResponse = await docClient.send(workflowsCommand);
    const workflows = workflowsResponse.Items || [];

    const instancesCommand = new ScanCommand({
      TableName: WORKFLOW_INSTANCES_TABLE,
    });
    const instancesResponse = await docClient.send(instancesCommand);
    const instances = instancesResponse.Items || [];

    const stats = {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter((w: Record<string, unknown>) => w.status === 'active').length,
      totalInstances: instances.length,
      pendingInstances: instances.filter((i: Record<string, unknown>) => i.status === 'pending' || i.status === 'in_progress').length,
      completedInstances: instances.filter((i: Record<string, unknown>) => i.status === 'completed').length,
      escalatedInstances: instances.filter((i: Record<string, unknown>) => i.status === 'escalated').length,
      averageCompletionTime: 0, // Would calculate from actual data
      byCategory: {} as Record<string, number>,
    };

    // Group by category
    for (const workflow of workflows) {
      const category = (workflow.category as string) || 'Övrigt';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({
      stats: {
        totalWorkflows: 0,
        activeWorkflows: 0,
        totalInstances: 0,
        pendingInstances: 0,
        completedInstances: 0,
        escalatedInstances: 0,
        averageCompletionTime: 0,
        byCategory: {},
      },
    });
  }
}

function getDefaultWorkflows(): Workflow[] {
  return [
    {
      id: 'wf-invoice-approval',
      name: 'Fakturagodkännande',
      description: 'Standard arbetsflöde för godkännande av fakturor',
      category: 'Ekonomi',
      version: 1,
      status: 'active',
      steps: [
        { id: 's1', name: 'Granska faktura', type: 'task', assigneeType: 'role', assignee: 'accountant', order: 1, required: true, config: {} },
        { id: 's2', name: 'Godkänn belopp', type: 'approval', assigneeType: 'role', assignee: 'manager', order: 2, required: true, config: {} },
        { id: 's3', name: 'Bokför', type: 'task', assigneeType: 'role', assignee: 'accountant', order: 3, required: true, config: {} },
      ],
      triggers: [{ type: 'event', config: { event: 'invoice.created' } }],
      escalationRules: { afterHours: 48, escalateTo: 'executive', notifyOnEscalation: true },
      sla: { warningHours: 24, criticalHours: 48 },
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    },
    {
      id: 'wf-client-onboarding',
      name: 'Kund-onboarding',
      description: 'Process för att ta emot nya kunder',
      category: 'Kunder',
      version: 1,
      status: 'active',
      steps: [
        { id: 's1', name: 'KYC-kontroll', type: 'task', assigneeType: 'role', assignee: 'compliance', order: 1, required: true, config: {} },
        { id: 's2', name: 'Riskbedömning', type: 'approval', assigneeType: 'role', assignee: 'manager', order: 2, required: true, config: {} },
        { id: 's3', name: 'Skapa avtal', type: 'task', assigneeType: 'role', assignee: 'admin', order: 3, required: true, config: {} },
        { id: 's4', name: 'Godkänn avtal', type: 'approval', assigneeType: 'role', assignee: 'executive', order: 4, required: true, config: {} },
      ],
      triggers: [{ type: 'manual', config: {} }],
      escalationRules: { afterHours: 72, escalateTo: 'executive', notifyOnEscalation: true },
      sla: { warningHours: 48, criticalHours: 72 },
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    },
  ];
}

// ============================================================================
// POST - Create new workflow or start workflow instance
// ============================================================================

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create':
        return await createWorkflow(data, request.headers.get('x-aifm-user') || 'unknown');
      case 'start':
        return await startWorkflowInstance(data, request.headers.get('x-aifm-user') || 'unknown');
      case 'complete-step':
        return await completeWorkflowStep(data, request.headers.get('x-aifm-user') || 'unknown');
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process workflow action';
    console.error('Failed to process workflow action:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function createWorkflow(data: Partial<Workflow>, createdBy: string) {
  const workflow: Workflow = {
    id: `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: data.name || 'Nytt arbetsflöde',
    description: data.description || '',
    category: data.category || 'Övrigt',
    version: 1,
    status: 'draft',
    steps: data.steps || [],
    triggers: data.triggers || [{ type: 'manual', config: {} }],
    escalationRules: data.escalationRules || { afterHours: 48, escalateTo: 'manager', notifyOnEscalation: true },
    sla: data.sla || { warningHours: 24, criticalHours: 48 },
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  };

  const command = new PutCommand({
    TableName: WORKFLOWS_TABLE,
    Item: workflow,
  });
  await docClient.send(command);

  console.log('[AUDIT] Workflow created', { workflowId: workflow.id, name: workflow.name, createdBy });

  return NextResponse.json({ success: true, workflow });
}

async function startWorkflowInstance(data: { workflowId: string; context?: Record<string, unknown> }, startedBy: string) {
  // Get the workflow
  const getCommand = new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { id: data.workflowId },
  });
  const workflowResponse = await docClient.send(getCommand);

  if (!workflowResponse.Item) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  const workflow = workflowResponse.Item as Workflow;

  if (workflow.status !== 'active') {
    return NextResponse.json({ error: 'Workflow is not active' }, { status: 400 });
  }

  const instance: WorkflowInstance = {
    id: `wfi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'in_progress',
    currentStep: 0,
    startedBy,
    startedAt: new Date().toISOString(),
    context: data.context || {},
    stepHistory: [],
  };

  const putCommand = new PutCommand({
    TableName: WORKFLOW_INSTANCES_TABLE,
    Item: instance,
  });
  await docClient.send(putCommand);

  // Update usage count
  workflow.usageCount = (workflow.usageCount || 0) + 1;
  workflow.updatedAt = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: WORKFLOWS_TABLE,
    Item: workflow,
  }));

  console.log('[AUDIT] Workflow instance started', { instanceId: instance.id, workflowId: workflow.id, startedBy });

  return NextResponse.json({ success: true, instance });
}

async function completeWorkflowStep(data: { instanceId: string; comments?: string }, completedBy: string) {
  // Get the instance
  const getCommand = new GetCommand({
    TableName: WORKFLOW_INSTANCES_TABLE,
    Key: { id: data.instanceId },
  });
  const instanceResponse = await docClient.send(getCommand);

  if (!instanceResponse.Item) {
    return NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
  }

  const instance = instanceResponse.Item as WorkflowInstance;

  // Get the workflow for steps
  const workflowCommand = new GetCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { id: instance.workflowId },
  });
  const workflowResponse = await docClient.send(workflowCommand);
  const workflow = workflowResponse.Item as Workflow;

  // Complete current step
  const currentStep = workflow.steps[instance.currentStep];
  instance.stepHistory.push({
    stepId: currentStep.id,
    status: 'completed',
    completedBy,
    completedAt: new Date().toISOString(),
    comments: data.comments,
  });

  // Move to next step or complete workflow
  if (instance.currentStep + 1 >= workflow.steps.length) {
    instance.status = 'completed';
    instance.completedAt = new Date().toISOString();
  } else {
    instance.currentStep += 1;
  }

  const putCommand = new PutCommand({
    TableName: WORKFLOW_INSTANCES_TABLE,
    Item: instance,
  });
  await docClient.send(putCommand);

  console.log('[AUDIT] Workflow step completed', { 
    instanceId: instance.id, 
    stepId: currentStep.id, 
    completedBy,
    workflowCompleted: instance.status === 'completed',
  });

  return NextResponse.json({ success: true, instance });
}

// ============================================================================
// PATCH - Update workflow
// ============================================================================

export async function PATCH(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get existing workflow
    const getCommand = new GetCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { id },
    });
    const response = await docClient.send(getCommand);

    if (!response.Item) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const workflow = { ...response.Item, ...updates, updatedAt: new Date().toISOString() };

    // If status changed to active, increment version
    if (updates.status === 'active' && response.Item.status !== 'active') {
      workflow.version = (workflow.version || 1) + 1;
    }

    const putCommand = new PutCommand({
      TableName: WORKFLOWS_TABLE,
      Item: workflow,
    });
    await docClient.send(putCommand);

    console.log('[AUDIT] Workflow updated', { workflowId: id, updates: Object.keys(updates) });

    return NextResponse.json({ success: true, workflow });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update workflow';
    console.error('Failed to update workflow:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete workflow
// ============================================================================

export async function DELETE(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const command = new DeleteCommand({
      TableName: WORKFLOWS_TABLE,
      Key: { id },
    });
    await docClient.send(command);

    console.log('[AUDIT] Workflow deleted', { workflowId: id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete workflow';
    console.error('Failed to delete workflow:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

