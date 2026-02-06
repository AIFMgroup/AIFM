/**
 * Slack Integration Client
 * 
 * Handles OAuth authentication and API calls for:
 * - Sending messages
 * - Reading channels
 * - User lookup
 */

// ============================================================================
// Types
// ============================================================================

export interface SlackConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  signingSecret?: string;
}

export interface SlackTokens {
  accessToken: string;
  botToken: string;
  teamId: string;
  teamName: string;
  scope: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  topic?: string;
  purpose?: string;
  numMembers?: number;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email?: string;
  title?: string;
  phone?: string;
  isAdmin: boolean;
  isBot: boolean;
  avatar?: string;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  channel: string;
  threadTs?: string;
}

// ============================================================================
// Slack Client
// ============================================================================

export class SlackClient {
  private config: SlackConfig;
  private tokens?: SlackTokens;
  private apiBaseUrl = 'https://slack.com/api';

  constructor(config: SlackConfig, tokens?: SlackTokens) {
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
    const scopes = [
      'channels:read',
      'channels:history',
      'chat:write',
      'users:read',
      'users:read.email',
      'groups:read',
      'im:read',
      'team:read',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: scopes,
      redirect_uri: this.config.redirectUri,
      state: state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<SlackTokens> {
    const response = await fetch(`${this.apiBaseUrl}/oauth.v2.access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    this.tokens = {
      accessToken: data.authed_user?.access_token || data.access_token,
      botToken: data.access_token,
      teamId: data.team.id,
      teamName: data.team.name,
      scope: data.scope,
    };

    return this.tokens;
  }

  /**
   * Make authenticated request to Slack API
   */
  private async slackRequest<T>(
    method: string,
    params: Record<string, string> = {},
    useBot: boolean = true
  ): Promise<T> {
    if (!this.tokens) {
      throw new Error('Not authenticated with Slack');
    }

    const token = useBot ? this.tokens.botToken : this.tokens.accessToken;

    const response = await fetch(`${this.apiBaseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }

  // ==========================================================================
  // Channel Methods
  // ==========================================================================

  /**
   * List channels
   */
  async listChannels(includePrivate: boolean = false): Promise<SlackChannel[]> {
    const data = await this.slackRequest<any>('conversations.list', {
      types: includePrivate ? 'public_channel,private_channel' : 'public_channel',
      exclude_archived: 'true',
    });

    return data.channels.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private,
      isMember: ch.is_member,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
      numMembers: ch.num_members,
    }));
  }

  /**
   * Get channel by name
   */
  async getChannelByName(name: string): Promise<SlackChannel | null> {
    const channels = await this.listChannels(true);
    return channels.find(ch => ch.name === name || ch.name === name.replace('#', '')) || null;
  }

  // ==========================================================================
  // Message Methods
  // ==========================================================================

  /**
   * Send message to channel
   */
  async sendMessage(
    channel: string,
    text: string,
    options?: {
      threadTs?: string;
      blocks?: any[];
      unfurlLinks?: boolean;
    }
  ): Promise<SlackMessage> {
    // If channel is a name (starts with #), look up the ID
    let channelId = channel;
    if (channel.startsWith('#')) {
      const ch = await this.getChannelByName(channel);
      if (!ch) throw new Error(`Channel ${channel} not found`);
      channelId = ch.id;
    }

    const data = await this.slackRequest<any>('chat.postMessage', {
      channel: channelId,
      text,
      thread_ts: options?.threadTs,
      blocks: options?.blocks,
      unfurl_links: options?.unfurlLinks ?? false,
    });

    return {
      ts: data.ts,
      text: data.message.text,
      channel: data.channel,
    };
  }

  /**
   * Send direct message to user
   */
  async sendDirectMessage(userId: string, text: string): Promise<SlackMessage> {
    // Open DM channel first
    const dmData = await this.slackRequest<any>('conversations.open', {
      users: userId,
    });

    return this.sendMessage(dmData.channel.id, text);
  }

  /**
   * Get channel history
   */
  async getChannelHistory(
    channel: string,
    limit: number = 50
  ): Promise<any[]> {
    let channelId = channel;
    if (channel.startsWith('#')) {
      const ch = await this.getChannelByName(channel);
      if (!ch) throw new Error(`Channel ${channel} not found`);
      channelId = ch.id;
    }

    const data = await this.slackRequest<any>('conversations.history', {
      channel: channelId,
      limit: limit.toString(),
    });

    return data.messages;
  }

  // ==========================================================================
  // User Methods
  // ==========================================================================

  /**
   * List users
   */
  async listUsers(): Promise<SlackUser[]> {
    const data = await this.slackRequest<any>('users.list');

    return data.members
      .filter((u: any) => !u.deleted && !u.is_bot && u.id !== 'USLACKBOT')
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        realName: u.real_name || u.name,
        email: u.profile?.email,
        title: u.profile?.title,
        phone: u.profile?.phone,
        isAdmin: u.is_admin,
        isBot: u.is_bot,
        avatar: u.profile?.image_72,
      }));
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<SlackUser | null> {
    try {
      const data = await this.slackRequest<any>('users.lookupByEmail', { email });
      const u = data.user;
      return {
        id: u.id,
        name: u.name,
        realName: u.real_name || u.name,
        email: u.profile?.email,
        title: u.profile?.title,
        phone: u.profile?.phone,
        isAdmin: u.is_admin,
        isBot: u.is_bot,
        avatar: u.profile?.image_72,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get team info
   */
  async getTeamInfo(): Promise<{ id: string; name: string; domain: string }> {
    const data = await this.slackRequest<any>('team.info');
    return {
      id: data.team.id,
      name: data.team.name,
      domain: data.team.domain,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

export function isSlackConfigured(): boolean {
  return !!(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET
  );
}

export function getSlackConfig(): SlackConfig | null {
  if (!isSlackConfigured()) return null;

  return {
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/slack/callback`,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  };
}
