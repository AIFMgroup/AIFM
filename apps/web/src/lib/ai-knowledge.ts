import { prisma } from '@/lib/prisma';

// Define TaskKind locally to avoid Prisma dependency
type TaskKind = 
  | 'QC_CHECK'
  | 'KYC_REVIEW'
  | 'REPORT_DRAFT'
  | 'BANK_RECON'
  | 'RISK_CALC'
  | 'COMPLIANCE_CHECK'
  | 'INVESTOR_ONBOARD';

/**
 * Get active AI model for a specific task kind
 * Falls back to default model if no active model found
 */
export async function getAIModelForTask(taskKind: TaskKind) {
  // First try to find default model for this task kind
  const defaultModel = await prisma.aIModel.findFirst({
    where: {
      taskKind,
      isDefault: true,
      isActive: true,
    },
    include: {
      prompts: {
        orderBy: { order: 'asc' },
      },
      examples: {
        where: { isActive: true },
        orderBy: { successRate: 'desc' }, // Best examples first
        take: 5, // Top 5 examples
      },
    },
  });

  if (defaultModel) {
    return defaultModel;
  }

  // Fallback: find any active model for this task kind
  const activeModel = await prisma.aIModel.findFirst({
    where: {
      taskKind,
      isActive: true,
    },
    include: {
      prompts: {
        orderBy: { order: 'asc' },
      },
      examples: {
        where: { isActive: true },
        orderBy: { successRate: 'desc' },
        take: 5,
      },
    },
    orderBy: {
      updatedAt: 'desc', // Most recently updated
    },
  });

  return activeModel;
}

/**
 * Build messages array from AI model configuration
 */
export function buildAIMessages(
  model: Awaited<ReturnType<typeof getAIModelForTask>>,
  context: any
) {
  if (!model) {
    throw new Error('No AI model found');
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // Add system prompts (in order)
  for (const prompt of model.prompts) {
    if (prompt.role === 'system') {
      messages.push({
        role: 'system',
        content: prompt.content,
      });
    }
  }

  // Add few-shot examples
  for (const example of model.examples) {
    messages.push(
      {
        role: 'user',
        content: typeof example.input === 'string' 
          ? example.input 
          : JSON.stringify(example.input),
      },
      {
        role: 'assistant',
        content: typeof example.output === 'string'
          ? example.output
          : JSON.stringify(example.output),
      }
    );
  }

  // Add actual user context
  messages.push({
    role: 'user',
    content: `Analyze this data: ${JSON.stringify(context)}`,
  });

  return messages;
}

/**
 * Track example usage (for analytics)
 */
export async function trackExampleUsage(exampleId: string, wasCorrect: boolean) {
  const example = await prisma.aIModelExample.findUnique({
    where: { id: exampleId },
  });

  if (!example) return;

  // Calculate new success rate
  const totalUses = example.usageCount + 1;
  const currentSuccesses = (example.successRate || 0) * example.usageCount;
  const newSuccessRate = wasCorrect
    ? (currentSuccesses + 1) / totalUses
    : currentSuccesses / totalUses;

  await prisma.aIModelExample.update({
    where: { id: exampleId },
    data: {
      usageCount: totalUses,
      successRate: newSuccessRate,
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Record AI feedback
 */
export async function recordAIFeedback(data: {
  modelId: string;
  userId?: string;
  taskId?: string;
  rating: number;
  wasCorrect?: boolean;
  comment?: string;
  input?: any;
  output?: any;
  expected?: any;
}) {
  return await prisma.aIFeedback.create({
    data: {
      modelId: data.modelId,
      userId: data.userId,
      taskId: data.taskId,
      rating: data.rating,
      wasCorrect: data.wasCorrect,
      comment: data.comment,
      input: data.input,
      output: data.output,
      expected: data.expected,
    },
  });
}

/**
 * Search knowledge base by category and tags
 */
export async function searchKnowledgeBase(params: {
  category?: string;
  tags?: string[];
  query?: string;
  limit?: number;
}) {
  return await prisma.aIKnowledgeBase.findMany({
    where: {
      isActive: true,
      ...(params.category && { category: params.category }),
      ...(params.tags && { tags: { hasSome: params.tags } }),
      ...(params.query && {
        OR: [
          { title: { contains: params.query, mode: 'insensitive' } },
          { content: { contains: params.query, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: [
      { helpful: 'desc' }, // Most helpful first
      { views: 'desc' },
    ],
    take: params.limit || 10,
  });
}

