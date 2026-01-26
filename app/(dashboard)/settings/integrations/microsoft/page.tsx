'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, Calendar, Users, FileText, CheckCircle2, XCircle,
  RefreshCw, ExternalLink, Shield, Clock, Settings,
  ChevronRight, AlertTriangle, Loader2, Link2, Unlink
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface MicrosoftIntegration {
  connected: boolean;
  email?: string;
  displayName?: string;
  connectedAt?: string;
  lastSync?: string;
  scopes: string[];
  syncSettings: {
    calendar: boolean;
    mail: boolean;
    contacts: boolean;
    files: boolean;
  };
}

interface CalendarEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  attendees: string[];
  isAllDay: boolean;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_INTEGRATION: MicrosoftIntegration = {
  connected: false,
  scopes: [],
  syncSettings: {
    calendar: true,
    mail: true,
    contacts: false,
    files: false,
  },
};

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    subject: 'Styrelsemöte Q1',
    start: '2025-01-10T09:00:00',
    end: '2025-01-10T11:00:00',
    location: 'Konferensrum A',
    attendees: ['anna@nordic.se', 'erik@aifm.se'],
    isAllDay: false,
  },
  {
    id: 'evt-2',
    subject: 'Kundmöte - Tech Solutions',
    start: '2025-01-10T14:00:00',
    end: '2025-01-10T15:00:00',
    location: 'Teams',
    attendees: ['johan@techsolutions.se'],
    isAllDay: false,
  },
  {
    id: 'evt-3',
    subject: 'Compliance Review',
    start: '2025-01-11T10:00:00',
    end: '2025-01-11T12:00:00',
    attendees: [],
    isAllDay: false,
  },
];

const MOCK_EMAILS: EmailMessage[] = [
  {
    id: 'mail-1',
    subject: 'Re: Förvaltningsavtal 2025',
    from: 'anna.svensson@nordic.se',
    receivedAt: '2025-01-08T14:30:00',
    isRead: false,
    hasAttachments: true,
  },
  {
    id: 'mail-2',
    subject: 'Kvartalsrapport Q4 2024',
    from: 'reporting@fortnox.se',
    receivedAt: '2025-01-08T09:15:00',
    isRead: true,
    hasAttachments: true,
  },
  {
    id: 'mail-3',
    subject: 'Invitation: Due Diligence Meeting',
    from: 'lars.pettersson@globalcapital.com',
    receivedAt: '2025-01-07T16:45:00',
    isRead: true,
    hasAttachments: false,
  },
];

// ============================================================================
// Feature Card Component
// ============================================================================

interface FeatureCardProps {
  icon: typeof Mail;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  connected: boolean;
}

function FeatureCard({ icon: Icon, title, description, enabled, onToggle, connected }: FeatureCardProps) {
  return (
    <div className={`p-4 rounded-xl border ${enabled && connected ? 'border-[#c0a280] bg-[#c0a280]/5' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            enabled && connected ? 'bg-[#c0a280]/20 text-[#c0a280]' : 'bg-gray-100 text-gray-500'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={!connected}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            enabled && connected ? 'bg-[#c0a280]' : 'bg-gray-300'
          } ${!connected ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span 
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
              enabled && connected ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function MicrosoftIntegrationPage() {
  const [integration, setIntegration] = useState<MicrosoftIntegration>(MOCK_INTEGRATION);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'calendar' | 'mail'>('settings');

  // Simulate connection
  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIntegration({
      ...integration,
      connected: true,
      email: 'erik.lindberg@aifm.se',
      displayName: 'Erik Lindberg',
      connectedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      scopes: ['Calendars.ReadWrite', 'Mail.Read', 'Contacts.Read', 'Files.Read'],
    });
    setEvents(MOCK_EVENTS);
    setEmails(MOCK_EMAILS);
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    setIntegration(MOCK_INTEGRATION);
    setEvents([]);
    setEmails([]);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIntegration({
      ...integration,
      lastSync: new Date().toISOString(),
    });
    setIsSyncing(false);
  };

  const toggleSyncSetting = (key: keyof MicrosoftIntegration['syncSettings']) => {
    setIntegration({
      ...integration,
      syncSettings: {
        ...integration.syncSettings,
        [key]: !integration.syncSettings[key],
      },
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#0078d4] to-[#00bcf2] rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" viewBox="0 0 23 23">
              <path fill="currentColor" d="M1 1h10v10H1zM12 1h10v10H12zM1 12h10v10H1zM12 12h10v10H12z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Microsoft 365</h1>
            <p className="text-gray-500">Synkronisera kalender, e-post och kontakter</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className={`p-4 rounded-xl border ${
          integration.connected 
            ? 'bg-green-50 border-green-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {integration.connected ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
              <div>
                {integration.connected ? (
                  <>
                    <p className="font-medium text-green-800">Ansluten som {integration.displayName}</p>
                    <p className="text-sm text-green-600">{integration.email}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-700">Inte ansluten</p>
                    <p className="text-sm text-gray-500">Anslut för att synkronisera data</p>
                  </>
                )}
              </div>
            </div>
            
            {integration.connected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Synkar...' : 'Synka nu'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Unlink className="w-4 h-4" />
                  Koppla från
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0078d4] rounded-lg hover:bg-[#006cbe] transition-colors disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ansluter...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Anslut Microsoft 365
                  </>
                )}
              </button>
            )}
          </div>

          {integration.lastSync && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-green-200 text-sm text-green-600">
              <Clock className="w-4 h-4" />
              Senast synkad: {formatDate(integration.lastSync)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-gray-100 rounded-lg">
        {[
          { id: 'settings', label: 'Inställningar', icon: Settings },
          { id: 'calendar', label: 'Kalender', icon: Calendar },
          { id: 'mail', label: 'E-post', icon: Mail },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Synkroniseringsinställningar</h2>
          
          <FeatureCard
            icon={Calendar}
            title="Kalendersynkronisering"
            description="Synka möten och events till CRM-kalendern"
            enabled={integration.syncSettings.calendar}
            onToggle={() => toggleSyncSetting('calendar')}
            connected={integration.connected}
          />
          
          <FeatureCard
            icon={Mail}
            title="E-postintegration"
            description="Visa e-postmeddelanden kopplade till kontakter"
            enabled={integration.syncSettings.mail}
            onToggle={() => toggleSyncSetting('mail')}
            connected={integration.connected}
          />
          
          <FeatureCard
            icon={Users}
            title="Kontaktsynkronisering"
            description="Importera och synka kontakter från Outlook"
            enabled={integration.syncSettings.contacts}
            onToggle={() => toggleSyncSetting('contacts')}
            connected={integration.connected}
          />
          
          <FeatureCard
            icon={FileText}
            title="OneDrive-integration"
            description="Länka dokument från OneDrive/SharePoint"
            enabled={integration.syncSettings.files}
            onToggle={() => toggleSyncSetting('files')}
            connected={integration.connected}
          />

          {/* Permissions */}
          {integration.connected && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-700">Beviljade behörigheter</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {integration.scopes.map((scope) => (
                  <span 
                    key={scope}
                    className="px-2 py-1 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-600"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Kommande möten</h2>
            <button className="text-sm text-[#0078d4] hover:underline flex items-center gap-1">
              Öppna i Outlook
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {!integration.connected ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Anslut Microsoft 365 för att visa kalender</p>
            </div>
          ) : events.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Inga kommande möten</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div 
                  key={event.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{event.subject}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(event.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(event.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            📍 {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(event.start).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                  {event.attendees.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {event.attendees.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mail Tab */}
      {activeTab === 'mail' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Senaste e-post</h2>
            <button className="text-sm text-[#0078d4] hover:underline flex items-center gap-1">
              Öppna i Outlook
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {!integration.connected ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Anslut Microsoft 365 för att visa e-post</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Ingen e-post att visa</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div 
                  key={email.id}
                  className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    email.isRead ? 'border-gray-200' : 'border-[#0078d4] bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!email.isRead && (
                          <div className="w-2 h-2 bg-[#0078d4] rounded-full flex-shrink-0" />
                        )}
                        <h3 className={`truncate ${email.isRead ? 'text-gray-700' : 'font-medium text-gray-900'}`}>
                          {email.subject}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{email.from}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {email.hasAttachments && (
                        <FileText className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-500">
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



