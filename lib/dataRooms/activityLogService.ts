/**
 * Activity Log Service
 * Detailed tracking of who viewed what, when, and for how long
 */

import crypto from 'crypto';

// Types
export interface DetailedActivity {
  id: string;
  roomId: string;
  documentId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCompany?: string;
  
  // Action details
  action: ActivityAction;
  actionDetails?: string;
  
  // Timing
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
  
  // Access context
  ipAddress?: string;
  userAgent?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  operatingSystem?: string;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  
  // Document specifics
  pagesViewed?: number[];
  totalPages?: number;
  scrollDepth?: number; // percentage
  downloadFormat?: string;
  
  // Security
  accessMethod: 'direct' | 'shared_link' | 'invite' | 'nda_access';
  sharedLinkId?: string;
  watermarkApplied: boolean;
  watermarkTrackingCode?: string;
}

export type ActivityAction = 
  | 'VIEW_DOCUMENT'
  | 'DOWNLOAD_DOCUMENT'
  | 'PRINT_DOCUMENT'
  | 'VIEW_PAGE'
  | 'ENTER_ROOM'
  | 'EXIT_ROOM'
  | 'SEARCH'
  | 'SHARE_LINK_CREATED'
  | 'SHARE_LINK_ACCESSED'
  | 'NDA_SIGNED'
  | 'NDA_DECLINED'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'PERMISSION_CHANGED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'FOLDER_CREATED'
  | 'SETTINGS_CHANGED';

export interface ActivitySession {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  startTime: Date;
  endTime?: Date;
  totalDurationSeconds: number;
  documentsViewed: number;
  documentsDownloaded: number;
  activities: string[]; // Activity IDs
  isActive: boolean;
}

export interface ActivitySummary {
  roomId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalViews: number;
  totalDownloads: number;
  uniqueUsers: number;
  totalSessionTime: number;
  mostViewedDocuments: Array<{
    documentId: string;
    documentName: string;
    viewCount: number;
    avgDuration: number;
  }>;
  activeUsers: Array<{
    userId: string;
    userName: string;
    viewCount: number;
    downloadCount: number;
    lastActive: Date;
  }>;
  accessByDevice: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };
}

export interface UserActivityReport {
  userId: string;
  userName: string;
  userEmail: string;
  roomId: string;
  
  totalViews: number;
  totalDownloads: number;
  totalSessionTime: number;
  averageSessionDuration: number;
  
  firstAccess: Date;
  lastAccess: Date;
  totalSessions: number;
  
  documentsAccessed: Array<{
    documentId: string;
    documentName: string;
    viewCount: number;
    downloadCount: number;
    totalViewTime: number;
    lastAccessed: Date;
  }>;
  
  accessTimeline: Array<{
    date: Date;
    action: ActivityAction;
    documentName?: string;
    duration?: number;
  }>;
}

/**
 * Parse user agent string to get device info
 */
function parseUserAgent(userAgent?: string): { 
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  operatingSystem?: string;
} {
  if (!userAgent) {
    return { deviceType: 'unknown' };
  }
  
  const ua = userAgent.toLowerCase();
  
  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }
  
  // Detect browser
  let browser: string | undefined;
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
  
  // Detect OS
  let operatingSystem: string | undefined;
  if (ua.includes('windows')) operatingSystem = 'Windows';
  else if (ua.includes('mac')) operatingSystem = 'macOS';
  else if (ua.includes('linux')) operatingSystem = 'Linux';
  else if (ua.includes('iphone') || ua.includes('ipad')) operatingSystem = 'iOS';
  else if (ua.includes('android')) operatingSystem = 'Android';
  
  return { deviceType, browser, operatingSystem };
}

/**
 * Activity Log Service
 */
class ActivityLogService {
  private activities: Map<string, DetailedActivity> = new Map();
  private sessions: Map<string, ActivitySession> = new Map();
  private documentNames: Map<string, string> = new Map(); // Cache for document names
  
  /**
   * Log a detailed activity
   */
  logActivity(params: {
    roomId: string;
    documentId?: string;
    documentName?: string;
    userId: string;
    userName: string;
    userEmail: string;
    userCompany?: string;
    action: ActivityAction;
    actionDetails?: string;
    ipAddress?: string;
    userAgent?: string;
    accessMethod?: DetailedActivity['accessMethod'];
    sharedLinkId?: string;
    watermarkApplied?: boolean;
    watermarkTrackingCode?: string;
    pagesViewed?: number[];
    totalPages?: number;
    scrollDepth?: number;
    downloadFormat?: string;
  }): DetailedActivity {
    const deviceInfo = parseUserAgent(params.userAgent);
    
    const activity: DetailedActivity = {
      id: `activity-${crypto.randomUUID()}`,
      roomId: params.roomId,
      documentId: params.documentId,
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      userCompany: params.userCompany,
      action: params.action,
      actionDetails: params.actionDetails,
      startTime: new Date(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      accessMethod: params.accessMethod || 'direct',
      sharedLinkId: params.sharedLinkId,
      watermarkApplied: params.watermarkApplied || false,
      watermarkTrackingCode: params.watermarkTrackingCode,
      pagesViewed: params.pagesViewed,
      totalPages: params.totalPages,
      scrollDepth: params.scrollDepth,
      downloadFormat: params.downloadFormat,
    };
    
    this.activities.set(activity.id, activity);
    
    // Cache document name
    if (params.documentId && params.documentName) {
      this.documentNames.set(params.documentId, params.documentName);
    }
    
    // Update or create session
    this.updateSession(params.roomId, params.userId, params.userName, activity.id, params.action);
    
    return activity;
  }
  
  /**
   * Update activity with end time (for tracking duration)
   */
  endActivity(activityId: string, additionalData?: {
    pagesViewed?: number[];
    scrollDepth?: number;
  }): DetailedActivity | null {
    const activity = this.activities.get(activityId);
    if (!activity) return null;
    
    activity.endTime = new Date();
    activity.durationSeconds = Math.round(
      (activity.endTime.getTime() - activity.startTime.getTime()) / 1000
    );
    
    if (additionalData) {
      if (additionalData.pagesViewed) activity.pagesViewed = additionalData.pagesViewed;
      if (additionalData.scrollDepth) activity.scrollDepth = additionalData.scrollDepth;
    }
    
    this.activities.set(activityId, activity);
    return activity;
  }
  
  /**
   * Track page view within a document
   */
  logPageView(
    parentActivityId: string,
    pageNumber: number
  ): void {
    const activity = this.activities.get(parentActivityId);
    if (activity) {
      if (!activity.pagesViewed) activity.pagesViewed = [];
      if (!activity.pagesViewed.includes(pageNumber)) {
        activity.pagesViewed.push(pageNumber);
      }
      this.activities.set(parentActivityId, activity);
    }
  }
  
  /**
   * Update or create a session for a user
   */
  private updateSession(
    roomId: string,
    userId: string,
    userName: string,
    activityId: string,
    action: ActivityAction
  ): void {
    const sessionKey = `${roomId}-${userId}`;
    let session = this.sessions.get(sessionKey);
    
    // Check if existing session is still active (within 30 minutes)
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    if (session && session.isActive) {
      const timeSinceLastActivity = Date.now() - (session.endTime?.getTime() || session.startTime.getTime());
      if (timeSinceLastActivity > sessionTimeout) {
        // Close old session and create new one
        session.isActive = false;
        this.sessions.set(sessionKey, session);
        session = undefined;
      }
    }
    
    if (!session || !session.isActive) {
      // Create new session
      session = {
        id: `session-${crypto.randomUUID()}`,
        roomId,
        userId,
        userName,
        startTime: new Date(),
        totalDurationSeconds: 0,
        documentsViewed: 0,
        documentsDownloaded: 0,
        activities: [],
        isActive: true,
      };
    }
    
    // Update session
    session.endTime = new Date();
    session.totalDurationSeconds = Math.round(
      (session.endTime.getTime() - session.startTime.getTime()) / 1000
    );
    session.activities.push(activityId);
    
    if (action === 'VIEW_DOCUMENT') {
      session.documentsViewed++;
    } else if (action === 'DOWNLOAD_DOCUMENT') {
      session.documentsDownloaded++;
    }
    
    this.sessions.set(sessionKey, session);
  }
  
  /**
   * End a user session
   */
  endSession(roomId: string, userId: string): ActivitySession | null {
    const sessionKey = `${roomId}-${userId}`;
    const session = this.sessions.get(sessionKey);
    if (session && session.isActive) {
      session.endTime = new Date();
      session.totalDurationSeconds = Math.round(
        (session.endTime.getTime() - session.startTime.getTime()) / 1000
      );
      session.isActive = false;
      this.sessions.set(sessionKey, session);
      
      // Log exit activity
      this.logActivity({
        roomId,
        userId,
        userName: session.userName,
        userEmail: '', // Would be filled from actual user data
        action: 'EXIT_ROOM',
      });
      
      return session;
    }
    return null;
  }
  
  /**
   * Get activities for a room
   */
  getActivitiesByRoom(
    roomId: string, 
    options?: {
      limit?: number;
      offset?: number;
      action?: ActivityAction;
      userId?: string;
      documentId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): DetailedActivity[] {
    let activities = Array.from(this.activities.values())
      .filter(a => a.roomId === roomId);
    
    if (options?.action) {
      activities = activities.filter(a => a.action === options.action);
    }
    if (options?.userId) {
      activities = activities.filter(a => a.userId === options.userId);
    }
    if (options?.documentId) {
      activities = activities.filter(a => a.documentId === options.documentId);
    }
    if (options?.startDate) {
      activities = activities.filter(a => a.startTime >= options.startDate!);
    }
    if (options?.endDate) {
      activities = activities.filter(a => a.startTime <= options.endDate!);
    }
    
    // Sort by most recent first
    activities.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    
    return activities.slice(offset, offset + limit);
  }
  
  /**
   * Get activity summary for a room
   */
  getActivitySummary(
    roomId: string,
    startDate: Date,
    endDate: Date
  ): ActivitySummary {
    const activities = this.getActivitiesByRoom(roomId, { startDate, endDate });
    
    const uniqueUsers = new Set(activities.map(a => a.userId));
    const documentViews = new Map<string, { count: number; totalDuration: number; name: string }>();
    const userActivity = new Map<string, { views: number; downloads: number; lastActive: Date; name: string }>();
    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    
    let totalViews = 0;
    let totalDownloads = 0;
    let totalSessionTime = 0;
    
    for (const activity of activities) {
      // Count views and downloads
      if (activity.action === 'VIEW_DOCUMENT') {
        totalViews++;
        if (activity.documentId) {
          const docStats = documentViews.get(activity.documentId) || { 
            count: 0, 
            totalDuration: 0, 
            name: this.documentNames.get(activity.documentId) || 'Unknown' 
          };
          docStats.count++;
          docStats.totalDuration += activity.durationSeconds || 0;
          documentViews.set(activity.documentId, docStats);
        }
      } else if (activity.action === 'DOWNLOAD_DOCUMENT') {
        totalDownloads++;
      }
      
      // Track user activity
      const userStats = userActivity.get(activity.userId) || { 
        views: 0, 
        downloads: 0, 
        lastActive: activity.startTime,
        name: activity.userName
      };
      if (activity.action === 'VIEW_DOCUMENT') userStats.views++;
      if (activity.action === 'DOWNLOAD_DOCUMENT') userStats.downloads++;
      if (activity.startTime > userStats.lastActive) userStats.lastActive = activity.startTime;
      userActivity.set(activity.userId, userStats);
      
      // Count devices
      deviceCounts[activity.deviceType]++;
      
      // Sum session time
      totalSessionTime += activity.durationSeconds || 0;
    }
    
    // Build most viewed documents list
    const mostViewedDocuments = Array.from(documentViews.entries())
      .map(([documentId, stats]) => ({
        documentId,
        documentName: stats.name,
        viewCount: stats.count,
        avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
      }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10);
    
    // Build active users list
    const activeUsers = Array.from(userActivity.entries())
      .map(([userId, stats]) => ({
        userId,
        userName: stats.name,
        viewCount: stats.views,
        downloadCount: stats.downloads,
        lastActive: stats.lastActive,
      }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 20);
    
    return {
      roomId,
      period: { start: startDate, end: endDate },
      totalViews,
      totalDownloads,
      uniqueUsers: uniqueUsers.size,
      totalSessionTime,
      mostViewedDocuments,
      activeUsers,
      accessByDevice: deviceCounts,
    };
  }
  
  /**
   * Get user activity report
   */
  getUserActivityReport(roomId: string, userId: string): UserActivityReport | null {
    const activities = this.getActivitiesByRoom(roomId, { userId });
    if (activities.length === 0) return null;
    
    const firstActivity = activities[activities.length - 1];
    const lastActivity = activities[0];
    
    // Calculate totals
    let totalViews = 0;
    let totalDownloads = 0;
    let totalSessionTime = 0;
    const documentStats = new Map<string, {
      name: string;
      viewCount: number;
      downloadCount: number;
      totalViewTime: number;
      lastAccessed: Date;
    }>();
    
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.roomId === roomId && s.userId === userId);
    
    for (const activity of activities) {
      if (activity.action === 'VIEW_DOCUMENT') {
        totalViews++;
        totalSessionTime += activity.durationSeconds || 0;
        
        if (activity.documentId) {
          const stats = documentStats.get(activity.documentId) || {
            name: this.documentNames.get(activity.documentId) || 'Unknown',
            viewCount: 0,
            downloadCount: 0,
            totalViewTime: 0,
            lastAccessed: activity.startTime,
          };
          stats.viewCount++;
          stats.totalViewTime += activity.durationSeconds || 0;
          if (activity.startTime > stats.lastAccessed) stats.lastAccessed = activity.startTime;
          documentStats.set(activity.documentId, stats);
        }
      } else if (activity.action === 'DOWNLOAD_DOCUMENT') {
        totalDownloads++;
        if (activity.documentId) {
          const stats = documentStats.get(activity.documentId) || {
            name: this.documentNames.get(activity.documentId) || 'Unknown',
            viewCount: 0,
            downloadCount: 0,
            totalViewTime: 0,
            lastAccessed: activity.startTime,
          };
          stats.downloadCount++;
          documentStats.set(activity.documentId, stats);
        }
      }
    }
    
    return {
      userId,
      userName: firstActivity.userName,
      userEmail: firstActivity.userEmail,
      roomId,
      totalViews,
      totalDownloads,
      totalSessionTime,
      averageSessionDuration: sessions.length > 0 
        ? Math.round(totalSessionTime / sessions.length) 
        : 0,
      firstAccess: firstActivity.startTime,
      lastAccess: lastActivity.startTime,
      totalSessions: sessions.length,
      documentsAccessed: Array.from(documentStats.entries())
        .map(([documentId, stats]) => ({ 
          documentId, 
          documentName: stats.name,
          viewCount: stats.viewCount,
          downloadCount: stats.downloadCount,
          totalViewTime: stats.totalViewTime,
          lastAccessed: stats.lastAccessed,
        }))
        .sort((a, b) => b.viewCount - a.viewCount),
      accessTimeline: activities.slice(0, 50).map(a => ({
        date: a.startTime,
        action: a.action,
        documentName: a.documentId ? this.documentNames.get(a.documentId) : undefined,
        duration: a.durationSeconds,
      })),
    };
  }
  
  /**
   * Export activities as CSV
   */
  exportActivitiesAsCsv(roomId: string, startDate?: Date, endDate?: Date): string {
    const activities = this.getActivitiesByRoom(roomId, { startDate, endDate });
    
    const headers = [
      'Timestamp',
      'User',
      'Email',
      'Action',
      'Document',
      'Duration (sec)',
      'Device',
      'Browser',
      'OS',
      'IP Address',
      'Access Method',
      'Watermark Code'
    ];
    
    const rows = activities.map(a => [
      a.startTime.toISOString(),
      a.userName,
      a.userEmail,
      a.action,
      a.documentId ? (this.documentNames.get(a.documentId) || a.documentId) : '',
      a.durationSeconds?.toString() || '',
      a.deviceType,
      a.browser || '',
      a.operatingSystem || '',
      a.ipAddress || '',
      a.accessMethod,
      a.watermarkTrackingCode || '',
    ]);
    
    return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  }
}

export const activityLogService = new ActivityLogService();

