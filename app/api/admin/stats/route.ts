import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'eu-north-1' 
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Admin users (could be moved to env or database)
const ADMIN_EMAILS = [
  'christopher.genberg@aifm.se',
  'thomas.dahlin@aifm.se',
  'patrik.wallenberg@aifm.se',
];

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  
  try {
    const payload = await verifyIdToken(token);
    return { 
      sub: payload.sub as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * GET /api/admin/stats
 * Get platform statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '7d';
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    // Get knowledge base stats
    const knowledgeResult = await docClient.send(new ScanCommand({
      TableName: 'aifm-knowledge-base',
    }));
    
    const knowledgeItems = knowledgeResult.Items || [];
    const recentKnowledge = knowledgeItems.filter(
      item => new Date(item.createdAt) >= startDate
    );
    
    // Count by category
    const byCategory: Record<string, number> = {};
    for (const item of knowledgeItems) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    }
    
    // Count by user
    const byUser: Record<string, { count: number; email: string }> = {};
    for (const item of knowledgeItems) {
      if (!byUser[item.sharedByUserId]) {
        byUser[item.sharedByUserId] = { 
          count: 0, 
          email: item.sharedByEmail || 'Okänd' 
        };
      }
      byUser[item.sharedByUserId].count++;
    }
    
    // Get chat sessions stats
    let chatStats = { total: 0, recent: 0, byUser: {} as Record<string, number> };
    try {
      const chatResult = await docClient.send(new ScanCommand({
        TableName: 'aifm-chat-sessions',
        ProjectionExpression: 'userId, createdAt',
      }));
      
      const chatSessions = chatResult.Items || [];
      chatStats.total = chatSessions.length;
      chatStats.recent = chatSessions.filter(
        s => new Date(s.createdAt) >= startDate
      ).length;
      
      for (const session of chatSessions) {
        if (session.userId) {
          chatStats.byUser[session.userId] = (chatStats.byUser[session.userId] || 0) + 1;
        }
      }
    } catch (e) {
      // Chat table might not exist
      console.log('Could not fetch chat stats:', e);
    }
    
    // Get AI usage stats (from a hypothetical usage table)
    let aiUsageStats = {
      totalRequests: 0,
      recentRequests: 0,
      avgResponseTime: 0,
    };
    
    try {
      const usageResult = await docClient.send(new ScanCommand({
        TableName: 'aifm-ai-usage',
      }));
      
      const usageItems = usageResult.Items || [];
      aiUsageStats.totalRequests = usageItems.length;
      
      const recentUsage = usageItems.filter(
        item => new Date(item.timestamp) >= startDate
      );
      aiUsageStats.recentRequests = recentUsage.length;
      
      if (recentUsage.length > 0) {
        const totalTime = recentUsage.reduce(
          (sum, item) => sum + (item.responseTimeMs || 0), 0
        );
        aiUsageStats.avgResponseTime = Math.round(totalTime / recentUsage.length);
      }
    } catch (e) {
      // Usage table might not exist yet
      console.log('Could not fetch AI usage stats:', e);
    }
    
    // Top contributors
    const topContributors = Object.entries(byUser)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return NextResponse.json({
      timeRange,
      knowledge: {
        total: knowledgeItems.length,
        recent: recentKnowledge.length,
        byCategory,
        topContributors,
      },
      chat: chatStats,
      aiUsage: aiUsageStats,
      generatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
