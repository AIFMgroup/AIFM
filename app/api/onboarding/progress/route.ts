import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand,
  UpdateCommand 
} from '@aws-sdk/lib-dynamodb';

// ============================================================================
// DynamoDB Setup
// ============================================================================

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});
const docClient = DynamoDBDocumentClient.from(client);

const ONBOARDING_TABLE = process.env.ONBOARDING_TABLE || 'aifm-onboarding-progress';

// ============================================================================
// Types
// ============================================================================

interface OnboardingProgress {
  userId: string;
  email: string;
  name?: string;
  completedTasks: string[];
  startedAt: string;
  completedAt?: string;
  lastActivity: string;
  dismissed: boolean;
}

// ============================================================================
// Helper to get user from cookies/session
// ============================================================================

async function getCurrentUser(): Promise<{ email: string; name?: string } | null> {
  const cookieStore = await cookies();
  // Try to get user info from cookie (set by auth callback)
  const userCookie = cookieStore.get('aifm-user');
  if (userCookie) {
    try {
      return JSON.parse(userCookie.value);
    } catch {
      // Ignore parse errors
    }
  }
  // Fallback to a demo user for development
  return { email: 'demo@aifm.se', name: 'Demo User' };
}

// ============================================================================
// GET - Fetch user's onboarding progress
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.email;

    try {
      const result = await docClient.send(new GetCommand({
        TableName: ONBOARDING_TABLE,
        Key: { userId },
      }));

      if (result.Item) {
        return NextResponse.json({ progress: result.Item });
      }

      // Create initial progress record
      const initialProgress: OnboardingProgress = {
        userId,
        email: user.email,
        name: user.name,
        completedTasks: [],
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        dismissed: false,
      };

      await docClient.send(new PutCommand({
        TableName: ONBOARDING_TABLE,
        Item: initialProgress,
      }));

      return NextResponse.json({ progress: initialProgress });
    } catch (dbError) {
      // If table doesn't exist, return mock data
      console.warn('DynamoDB error, returning mock progress:', dbError);
      
      const mockProgress: OnboardingProgress = {
        userId,
        email: user.email,
        name: user.name,
        completedTasks: [],
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        dismissed: false,
      };

      return NextResponse.json({ progress: mockProgress });
    }
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding progress' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Update onboarding progress
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.email;
    const body = await request.json();
    const { taskId, action } = body;

    try {
      // Get current progress
      const result = await docClient.send(new GetCommand({
        TableName: ONBOARDING_TABLE,
        Key: { userId },
      }));

      let progress = result.Item as OnboardingProgress | undefined;

      if (!progress) {
        progress = {
          userId,
          email: user.email,
          name: user.name,
          completedTasks: [],
          startedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          dismissed: false,
        };
      }

      // Handle different actions
      if (action === 'complete' && taskId) {
        if (!progress.completedTasks.includes(taskId)) {
          progress.completedTasks.push(taskId);
        }
        progress.lastActivity = new Date().toISOString();

        // Check if all required tasks are complete
        const requiredTasks = [
          'profile-complete',
          'profile-mfa', 
          'company-select'
        ];
        const allRequiredComplete = requiredTasks.every(t => 
          progress!.completedTasks.includes(t)
        );
        
        if (allRequiredComplete && !progress.completedAt) {
          progress.completedAt = new Date().toISOString();
        }
      } else if (action === 'dismiss') {
        progress.dismissed = true;
        progress.lastActivity = new Date().toISOString();
      } else if (action === 'reset') {
        progress.completedTasks = [];
        progress.completedAt = undefined;
        progress.dismissed = false;
        progress.lastActivity = new Date().toISOString();
      }

      // Save updated progress
      await docClient.send(new PutCommand({
        TableName: ONBOARDING_TABLE,
        Item: progress,
      }));

      return NextResponse.json({ progress });
    } catch (dbError) {
      console.warn('DynamoDB error, returning mock progress:', dbError);
      
      // Return mock updated progress
      const mockProgress: OnboardingProgress = {
        userId,
        email: user.email,
        name: user.name,
        completedTasks: taskId ? [taskId] : [],
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        dismissed: action === 'dismiss',
      };

      return NextResponse.json({ progress: mockProgress });
    }
  } catch (error) {
    console.error('Error updating onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    );
  }
}

