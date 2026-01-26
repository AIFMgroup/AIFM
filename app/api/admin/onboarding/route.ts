import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { 
  CognitoIdentityProviderClient, 
  ListUsersCommand 
} from '@aws-sdk/client-cognito-identity-provider';

// ============================================================================
// Clients
// ============================================================================

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const ONBOARDING_TABLE = process.env.ONBOARDING_TABLE || 'aifm-onboarding-progress';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

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

interface UserOnboardingStatus {
  userId: string;
  email: string;
  name?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedTasks: number;
  totalTasks: number;
  completionPercentage: number;
  startedAt?: string;
  completedAt?: string;
  lastActivity?: string;
  createdAt?: string;
}

// ============================================================================
// GET - Get all users' onboarding status (Admin only)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // TODO: Add proper admin role check via middleware
    // For now, this endpoint is protected by the admin route group

    const totalTasks = 12; // Total onboarding tasks
    const requiredTasks = 3; // Required tasks count

    try {
      // Get all onboarding progress records
      const progressResult = await docClient.send(new ScanCommand({
        TableName: ONBOARDING_TABLE,
      }));

      const progressMap = new Map<string, OnboardingProgress>();
      (progressResult.Items || []).forEach((item) => {
        const progress = item as OnboardingProgress;
        progressMap.set(progress.userId, progress);
      });

      // Get all Cognito users
      let allUsers: UserOnboardingStatus[] = [];
      
      if (USER_POOL_ID) {
        try {
          const usersResult = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            Limit: 60,
          }));

          allUsers = (usersResult.Users || []).map((user) => {
            const email = user.Attributes?.find(a => a.Name === 'email')?.Value || user.Username || '';
            const name = user.Attributes?.find(a => a.Name === 'name')?.Value;
            const progress = progressMap.get(email);

            const completedCount = progress?.completedTasks?.length || 0;
            const completionPercentage = Math.round((completedCount / totalTasks) * 100);

            let status: UserOnboardingStatus['status'] = 'not_started';
            if (progress?.completedAt) {
              status = 'completed';
            } else if (completedCount > 0) {
              status = 'in_progress';
            }

            return {
              userId: email,
              email,
              name,
              status,
              completedTasks: completedCount,
              totalTasks,
              completionPercentage,
              startedAt: progress?.startedAt,
              completedAt: progress?.completedAt,
              lastActivity: progress?.lastActivity,
              createdAt: user.UserCreateDate?.toISOString(),
            };
          });
        } catch (cognitoError) {
          console.warn('Cognito error:', cognitoError);
        }
      }

      // If no Cognito users, use progress records
      if (allUsers.length === 0) {
        allUsers = Array.from(progressMap.values()).map((progress) => {
          const completedCount = progress.completedTasks?.length || 0;
          const completionPercentage = Math.round((completedCount / totalTasks) * 100);

          let status: UserOnboardingStatus['status'] = 'not_started';
          if (progress.completedAt) {
            status = 'completed';
          } else if (completedCount > 0) {
            status = 'in_progress';
          }

          return {
            userId: progress.userId,
            email: progress.email,
            name: progress.name,
            status,
            completedTasks: completedCount,
            totalTasks,
            completionPercentage,
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
            lastActivity: progress.lastActivity,
          };
        });
      }

      // Calculate summary stats
      const stats = {
        totalUsers: allUsers.length,
        notStarted: allUsers.filter(u => u.status === 'not_started').length,
        inProgress: allUsers.filter(u => u.status === 'in_progress').length,
        completed: allUsers.filter(u => u.status === 'completed').length,
        averageCompletion: allUsers.length > 0 
          ? Math.round(allUsers.reduce((sum, u) => sum + u.completionPercentage, 0) / allUsers.length)
          : 0,
      };

      return NextResponse.json({ 
        users: allUsers.sort((a, b) => {
          // Sort: in_progress first, then not_started, then completed
          const order = { in_progress: 0, not_started: 1, completed: 2 };
          return order[a.status] - order[b.status];
        }),
        stats 
      });

    } catch (dbError) {
      console.warn('Database error, returning mock data:', dbError);
      
      // Return mock data for development
      const mockUsers: UserOnboardingStatus[] = [
        {
          userId: 'admin@aifm.se',
          email: 'admin@aifm.se',
          name: 'Admin User',
          status: 'completed',
          completedTasks: 12,
          totalTasks: 12,
          completionPercentage: 100,
          startedAt: '2026-01-01T10:00:00Z',
          completedAt: '2026-01-02T14:30:00Z',
          lastActivity: '2026-01-09T10:00:00Z',
        },
        {
          userId: 'anna.lindberg@aifm.se',
          email: 'anna.lindberg@aifm.se',
          name: 'Anna Lindberg',
          status: 'in_progress',
          completedTasks: 7,
          totalTasks: 12,
          completionPercentage: 58,
          startedAt: '2026-01-05T09:00:00Z',
          lastActivity: '2026-01-09T08:30:00Z',
        },
        {
          userId: 'erik.svensson@aifm.se',
          email: 'erik.svensson@aifm.se',
          name: 'Erik Svensson',
          status: 'in_progress',
          completedTasks: 4,
          totalTasks: 12,
          completionPercentage: 33,
          startedAt: '2026-01-07T11:00:00Z',
          lastActivity: '2026-01-08T16:45:00Z',
        },
        {
          userId: 'maria.johansson@aifm.se',
          email: 'maria.johansson@aifm.se',
          name: 'Maria Johansson',
          status: 'not_started',
          completedTasks: 0,
          totalTasks: 12,
          completionPercentage: 0,
          createdAt: '2026-01-08T14:00:00Z',
        },
        {
          userId: 'johan.berg@aifm.se',
          email: 'johan.berg@aifm.se',
          name: 'Johan Berg',
          status: 'not_started',
          completedTasks: 0,
          totalTasks: 12,
          completionPercentage: 0,
          createdAt: '2026-01-09T09:00:00Z',
        },
      ];

      const stats = {
        totalUsers: mockUsers.length,
        notStarted: mockUsers.filter(u => u.status === 'not_started').length,
        inProgress: mockUsers.filter(u => u.status === 'in_progress').length,
        completed: mockUsers.filter(u => u.status === 'completed').length,
        averageCompletion: Math.round(mockUsers.reduce((sum, u) => sum + u.completionPercentage, 0) / mockUsers.length),
      };

      return NextResponse.json({ users: mockUsers, stats });
    }
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding status' },
      { status: 500 }
    );
  }
}

