/**
 * Microsoft 365 Integration Client
 * 
 * Client for interacting with Microsoft Graph API for email, calendar, files, and users.
 */

import { BaseIntegrationClient, registerClient } from '../baseClient';
import type { IntegrationApiResponse } from '../types';

// ============================================================================
// Microsoft-Specific Types
// ============================================================================

export interface MicrosoftUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  givenName: string;
  surname: string;
  jobTitle: string;
  mobilePhone: string;
  officeLocation: string;
  preferredLanguage: string;
}

export interface MicrosoftEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location: {
    displayName: string;
  };
  attendees: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    status: {
      response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
      time: string;
    };
    type: 'required' | 'optional' | 'resource';
  }>;
  isAllDay: boolean;
  isCancelled: boolean;
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string;
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  recurrence?: {
    pattern: {
      type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
      interval: number;
      daysOfWeek?: string[];
    };
    range: {
      type: 'endDate' | 'noEnd' | 'numbered';
      startDate: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
}

export interface MicrosoftDriveItem {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
    hashes?: {
      sha256Hash: string;
    };
  };
  createdBy: {
    user: {
      displayName: string;
      id: string;
    };
  };
  lastModifiedBy: {
    user: {
      displayName: string;
      id: string;
    };
  };
  parentReference?: {
    id: string;
    path: string;
    driveId: string;
  };
}

export interface MicrosoftContact {
  id: string;
  displayName: string;
  givenName: string;
  surname: string;
  emailAddresses: Array<{
    address: string;
    name: string;
  }>;
  businessPhones: string[];
  mobilePhone: string;
  companyName: string;
  jobTitle: string;
}

// ============================================================================
// Microsoft Client
// ============================================================================

export class MicrosoftClient extends BaseIntegrationClient {
  constructor(companyId: string) {
    super('microsoft', companyId);
  }

  // ============================================================================
  // User Profile
  // ============================================================================

  async getMe(): Promise<IntegrationApiResponse<MicrosoftUser>> {
    return this.get('/me');
  }

  async getUser(userId: string): Promise<IntegrationApiResponse<MicrosoftUser>> {
    return this.get(`/users/${userId}`);
  }

  async listUsers(): Promise<IntegrationApiResponse<{ value: MicrosoftUser[] }>> {
    return this.get('/users');
  }

  // ============================================================================
  // Email
  // ============================================================================

  async listEmails(params?: {
    top?: number;
    skip?: number;
    filter?: string;
    orderby?: string;
    select?: string;
  }): Promise<IntegrationApiResponse<{ value: MicrosoftEmail[] }>> {
    const queryParams: Record<string, string> = {};
    if (params?.top) queryParams['$top'] = String(params.top);
    if (params?.skip) queryParams['$skip'] = String(params.skip);
    if (params?.filter) queryParams['$filter'] = params.filter;
    if (params?.orderby) queryParams['$orderby'] = params.orderby;
    if (params?.select) queryParams['$select'] = params.select;
    
    return this.get('/me/messages', { params: queryParams });
  }

  async getEmail(messageId: string): Promise<IntegrationApiResponse<MicrosoftEmail>> {
    return this.get(`/me/messages/${messageId}`);
  }

  async sendEmail(email: {
    subject: string;
    body: {
      contentType: 'text' | 'html';
      content: string;
    };
    toRecipients: Array<{
      emailAddress: {
        address: string;
        name?: string;
      };
    }>;
    ccRecipients?: Array<{
      emailAddress: {
        address: string;
        name?: string;
      };
    }>;
  }): Promise<IntegrationApiResponse<void>> {
    return this.post('/me/sendMail', {
      message: email,
      saveToSentItems: true,
    });
  }

  async markEmailAsRead(messageId: string): Promise<IntegrationApiResponse<MicrosoftEmail>> {
    return this.patch(`/me/messages/${messageId}`, { isRead: true });
  }

  async deleteEmail(messageId: string): Promise<IntegrationApiResponse<void>> {
    return this.delete(`/me/messages/${messageId}`);
  }

  // ============================================================================
  // Calendar
  // ============================================================================

  async listCalendarEvents(params?: {
    startDateTime?: string;
    endDateTime?: string;
    top?: number;
  }): Promise<IntegrationApiResponse<{ value: MicrosoftCalendarEvent[] }>> {
    const queryParams: Record<string, string> = {};
    if (params?.startDateTime && params?.endDateTime) {
      queryParams['startDateTime'] = params.startDateTime;
      queryParams['endDateTime'] = params.endDateTime;
      return this.get('/me/calendarView', { params: queryParams });
    }
    if (params?.top) queryParams['$top'] = String(params.top);
    return this.get('/me/events', { params: queryParams });
  }

  async getCalendarEvent(eventId: string): Promise<IntegrationApiResponse<MicrosoftCalendarEvent>> {
    return this.get(`/me/events/${eventId}`);
  }

  async createCalendarEvent(event: {
    subject: string;
    body?: {
      contentType: 'text' | 'html';
      content: string;
    };
    start: {
      dateTime: string;
      timeZone: string;
    };
    end: {
      dateTime: string;
      timeZone: string;
    };
    location?: {
      displayName: string;
    };
    attendees?: Array<{
      emailAddress: {
        address: string;
        name?: string;
      };
      type: 'required' | 'optional';
    }>;
    isOnlineMeeting?: boolean;
  }): Promise<IntegrationApiResponse<MicrosoftCalendarEvent>> {
    return this.post('/me/events', event);
  }

  async updateCalendarEvent(
    eventId: string,
    updates: Partial<MicrosoftCalendarEvent>
  ): Promise<IntegrationApiResponse<MicrosoftCalendarEvent>> {
    return this.patch(`/me/events/${eventId}`, updates);
  }

  async deleteCalendarEvent(eventId: string): Promise<IntegrationApiResponse<void>> {
    return this.delete(`/me/events/${eventId}`);
  }

  // ============================================================================
  // OneDrive / Files
  // ============================================================================

  async listDriveItems(folderId?: string): Promise<IntegrationApiResponse<{ value: MicrosoftDriveItem[] }>> {
    const path = folderId 
      ? `/me/drive/items/${folderId}/children`
      : '/me/drive/root/children';
    return this.get(path);
  }

  async getDriveItem(itemId: string): Promise<IntegrationApiResponse<MicrosoftDriveItem>> {
    return this.get(`/me/drive/items/${itemId}`);
  }

  async searchDrive(query: string): Promise<IntegrationApiResponse<{ value: MicrosoftDriveItem[] }>> {
    return this.get(`/me/drive/root/search(q='${encodeURIComponent(query)}')`);
  }

  async createFolder(parentId: string, name: string): Promise<IntegrationApiResponse<MicrosoftDriveItem>> {
    return this.post(`/me/drive/items/${parentId}/children`, {
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    });
  }

  async deleteDriveItem(itemId: string): Promise<IntegrationApiResponse<void>> {
    return this.delete(`/me/drive/items/${itemId}`);
  }

  // ============================================================================
  // Contacts
  // ============================================================================

  async listContacts(): Promise<IntegrationApiResponse<{ value: MicrosoftContact[] }>> {
    return this.get('/me/contacts');
  }

  async getContact(contactId: string): Promise<IntegrationApiResponse<MicrosoftContact>> {
    return this.get(`/me/contacts/${contactId}`);
  }

  async createContact(contact: {
    givenName?: string;
    surname?: string;
    displayName?: string;
    emailAddresses?: Array<{
      address: string;
      name?: string;
    }>;
    businessPhones?: string[];
    mobilePhone?: string;
    companyName?: string;
    jobTitle?: string;
  }): Promise<IntegrationApiResponse<MicrosoftContact>> {
    return this.post('/me/contacts', contact);
  }
}

// Register the client
registerClient('microsoft', MicrosoftClient);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create and initialize a Microsoft client
 */
export async function createMicrosoftClient(companyId: string): Promise<MicrosoftClient> {
  const client = new MicrosoftClient(companyId);
  await client.init();
  return client;
}

