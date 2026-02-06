/**
 * Microsoft 365 Integration Client
 * 
 * Handles OAuth authentication and API calls for:
 * - Calendar (events, meetings, availability)
 * - Email (read, send, search)
 * - User profile
 */

// ============================================================================
// Types
// ============================================================================

export interface MS365Config {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

export interface MS365Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface MS365User {
  id: string;
  displayName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  organizer?: { emailAddress: { name: string; address: string } };
  attendees?: Array<{
    emailAddress: { name: string; address: string };
    status: { response: string };
  }>;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  bodyPreview?: string;
  webLink?: string;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  webLink: string;
}

export interface FreeBusySlot {
  start: string;
  end: string;
  status: 'free' | 'busy' | 'tentative' | 'oof' | 'workingElsewhere';
}

// ============================================================================
// Microsoft Graph API Scopes
// ============================================================================

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Calendars.ReadWrite',
  'Mail.ReadWrite',
  'Mail.Send',
  'User.Read',
  'User.ReadBasic.All',
].join(' ');

// ============================================================================
// MS365 Client
// ============================================================================

export class MS365Client {
  private config: MS365Config;
  private tokens?: MS365Tokens;
  private graphBaseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(config: MS365Config, tokens?: MS365Tokens) {
    this.config = config;
    this.tokens = tokens;
  }

  // ==========================================================================
  // OAuth Methods
  // ==========================================================================

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: SCOPES,
      response_mode: 'query',
      state: state,
    });

    const tenantId = this.config.tenantId || 'common';
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<MS365Tokens> {
    const tenantId = this.config.tenantId || 'common';
    
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
          scope: SCOPES,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = await response.json();
    
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
    };

    return this.tokens;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<MS365Tokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tenantId = this.config.tenantId || 'common';
    
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.tokens.refreshToken,
          grant_type: 'refresh_token',
          scope: SCOPES,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.tokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
    };

    return this.tokens;
  }

  /**
   * Ensure valid token
   */
  private async ensureValidToken(): Promise<string> {
    if (!this.tokens?.accessToken) {
      throw new Error('Not authenticated');
    }

    // Refresh if expires in less than 5 minutes
    if (this.tokens.expiresAt < Date.now() + 300000) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  /**
   * Make authenticated request to Graph API
   */
  private async graphRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.ensureValidToken();
    
    const response = await fetch(`${this.graphBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==========================================================================
  // User Methods
  // ==========================================================================

  /**
   * Get current user profile
   */
  async getMe(): Promise<MS365User> {
    const data = await this.graphRequest<any>('/me');
    return {
      id: data.id,
      displayName: data.displayName,
      email: data.mail || data.userPrincipalName,
      jobTitle: data.jobTitle,
      department: data.department,
      officeLocation: data.officeLocation,
      mobilePhone: data.mobilePhone,
    };
  }

  // ==========================================================================
  // Calendar Methods
  // ==========================================================================

  /**
   * Get calendar events
   */
  async getCalendarEvents(
    startDate: string,
    endDate: string,
    maxResults: number = 50
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      startDateTime: startDate,
      endDateTime: endDate,
      $top: maxResults.toString(),
      $orderby: 'start/dateTime',
      $select: 'id,subject,start,end,location,organizer,attendees,isOnlineMeeting,onlineMeetingUrl,bodyPreview,webLink',
    });

    const data = await this.graphRequest<{ value: CalendarEvent[] }>(
      `/me/calendarView?${params.toString()}`
    );

    return data.value;
  }

  /**
   * Get today's events
   */
  async getTodayEvents(): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    return this.getCalendarEvents(startOfDay, endOfDay);
  }

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    
    return this.getCalendarEvents(start, end);
  }

  /**
   * Create calendar event
   */
  async createEvent(event: {
    subject: string;
    start: Date;
    end: Date;
    attendees?: string[];
    location?: string;
    body?: string;
    isOnlineMeeting?: boolean;
  }): Promise<CalendarEvent> {
    const eventData = {
      subject: event.subject,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'Europe/Stockholm',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'Europe/Stockholm',
      },
      location: event.location ? { displayName: event.location } : undefined,
      body: event.body ? { contentType: 'text', content: event.body } : undefined,
      attendees: event.attendees?.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      isOnlineMeeting: event.isOnlineMeeting,
    };

    return this.graphRequest<CalendarEvent>('/me/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  /**
   * Check availability
   */
  async getFreeBusy(
    emails: string[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, FreeBusySlot[]>> {
    const data = await this.graphRequest<any>('/me/calendar/getSchedule', {
      method: 'POST',
      body: JSON.stringify({
        schedules: emails,
        startTime: { dateTime: startDate, timeZone: 'Europe/Stockholm' },
        endTime: { dateTime: endDate, timeZone: 'Europe/Stockholm' },
        availabilityViewInterval: 30,
      }),
    });

    const result = new Map<string, FreeBusySlot[]>();
    for (const schedule of data.value) {
      result.set(schedule.scheduleId, schedule.scheduleItems || []);
    }
    return result;
  }

  // ==========================================================================
  // Email Methods
  // ==========================================================================

  /**
   * Get emails
   */
  async getEmails(
    folder: string = 'inbox',
    maxResults: number = 25,
    filter?: string
  ): Promise<EmailMessage[]> {
    let endpoint = `/me/mailFolders/${folder}/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;
    
    if (filter) {
      endpoint += `&$filter=${encodeURIComponent(filter)}`;
    }

    const data = await this.graphRequest<{ value: EmailMessage[] }>(endpoint);
    return data.value;
  }

  /**
   * Get unread emails
   */
  async getUnreadEmails(maxResults: number = 25): Promise<EmailMessage[]> {
    return this.getEmails('inbox', maxResults, 'isRead eq false');
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, maxResults: number = 25): Promise<EmailMessage[]> {
    const data = await this.graphRequest<{ value: EmailMessage[] }>(
      `/me/messages?$search="${encodeURIComponent(query)}"&$top=${maxResults}`
    );
    return data.value;
  }

  /**
   * Send email
   */
  async sendEmail(email: {
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    importance?: 'low' | 'normal' | 'high';
  }): Promise<void> {
    const message = {
      message: {
        subject: email.subject,
        body: { contentType: 'HTML', content: email.body },
        toRecipients: email.to.map(addr => ({ emailAddress: { address: addr } })),
        ccRecipients: email.cc?.map(addr => ({ emailAddress: { address: addr } })),
        importance: email.importance || 'normal',
      },
    };

    await this.graphRequest('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  /**
   * Get email by ID with full body
   */
  async getEmailById(id: string): Promise<EmailMessage> {
    return this.graphRequest<EmailMessage>(`/me/messages/${id}?$select=id,subject,from,toRecipients,receivedDateTime,body,isRead,hasAttachments,importance,webLink`);
  }
}

// ============================================================================
// Singleton & Helpers
// ============================================================================

export function isMS365Configured(): boolean {
  return !!(
    process.env.MS365_CLIENT_ID &&
    process.env.MS365_CLIENT_SECRET
  );
}

export function getMS365Config(): MS365Config | null {
  if (!isMS365Configured()) return null;
  
  return {
    clientId: process.env.MS365_CLIENT_ID!,
    clientSecret: process.env.MS365_CLIENT_SECRET!,
    tenantId: process.env.MS365_TENANT_ID || 'common',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/microsoft365/callback`,
  };
}
