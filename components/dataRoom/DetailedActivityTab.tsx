'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Eye, Download, Upload, Trash2, UserPlus, 
  Settings, Folder, Clock, Monitor, Smartphone, Tablet,
  FileText, Search, Calendar, BarChart3, Users, Loader2,
  ChevronDown, Filter, FileDown, Shield
} from 'lucide-react';

interface DetailedActivity {
  id: string;
  documentId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCompany?: string;
  action: string;
  actionDetails?: string;
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  deviceType: string;
  browser?: string;
  operatingSystem?: string;
  ipAddress?: string;
  accessMethod: string;
  watermarkApplied: boolean;
  watermarkTrackingCode?: string;
}

interface ActivitySummary {
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
    lastActive: string;
  }>;
  accessByDevice: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };
}

interface Props {
  roomId: string;
}

export default function DetailedActivityTab({ roomId }: Props) {
  const [activities, setActivities] = useState<DetailedActivity[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'summary'>('list');
  const [filter, setFilter] = useState({
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('includeSummary', 'true');
      if (filter.action) params.set('action', filter.action);
      if (filter.userId) params.set('userId', filter.userId);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);
      
      const response = await fetch(`/api/data-rooms/${roomId}/activity?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
    setIsLoading(false);
  }, [roomId, filter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);
      
      const response = await fetch(`/api/data-rooms/${roomId}/activity/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aktivitetslogg_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  // Get action icon
  const getActionIcon = (action: string) => {
    const icons: Record<string, React.ReactNode> = {
      VIEW_DOCUMENT: <Eye className="w-4 h-4 text-blue-500" />,
      DOWNLOAD_DOCUMENT: <Download className="w-4 h-4 text-emerald-500" />,
      UPLOAD_DOCUMENT: <Upload className="w-4 h-4 text-purple-500" />,
      DELETE: <Trash2 className="w-4 h-4 text-red-500" />,
      INVITE_SENT: <UserPlus className="w-4 h-4 text-amber-500" />,
      SETTINGS_CHANGED: <Settings className="w-4 h-4 text-gray-500" />,
      FOLDER_CREATED: <Folder className="w-4 h-4 text-amber-500" />,
      NDA_SIGNED: <Shield className="w-4 h-4 text-emerald-500" />,
      SHARE_LINK_CREATED: <FileText className="w-4 h-4 text-blue-500" />,
    };
    return icons[action] || <Activity className="w-4 h-4 text-gray-400" />;
  };

  // Get device icon
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-3.5 h-3.5" />;
      case 'tablet': return <Tablet className="w-3.5 h-3.5" />;
      default: return <Monitor className="w-3.5 h-3.5" />;
    }
  };

  // Format duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Get action label
  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      VIEW_DOCUMENT: 'Visade dokument',
      DOWNLOAD_DOCUMENT: 'Laddade ner',
      UPLOAD_DOCUMENT: 'Laddade upp',
      DELETE: 'Raderade',
      INVITE_SENT: 'Bjöd in medlem',
      SETTINGS_CHANGED: 'Ändrade inställningar',
      FOLDER_CREATED: 'Skapade mapp',
      NDA_SIGNED: 'Signerade NDA',
      SHARE_LINK_CREATED: 'Skapade delningslänk',
      ENTER_ROOM: 'Gick in i rummet',
      EXIT_ROOM: 'Lämnade rummet',
    };
    return labels[action] || action;
  };

  if (isLoading) {
    return (
      <div className="p-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-aifm-gold animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-aifm-charcoal">Aktivitetslogg</h3>
            <p className="text-sm text-aifm-charcoal/40 mt-0.5">
              Detaljerad spårning av all aktivitet i datarummet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-aifm-gold/10 text-aifm-gold' : 'hover:bg-gray-100 text-aifm-charcoal/40'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-aifm-charcoal/70 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Exportera CSV
            </button>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'list' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/50'
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setView('summary')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'summary' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/50'
                }`}
              >
                Översikt
              </button>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
            <select
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/30"
            >
              <option value="">Alla åtgärder</option>
              <option value="VIEW_DOCUMENT">Visningar</option>
              <option value="DOWNLOAD_DOCUMENT">Nedladdningar</option>
              <option value="UPLOAD_DOCUMENT">Uppladdningar</option>
              <option value="NDA_SIGNED">NDA-signeringar</option>
              <option value="SHARE_LINK_CREATED">Delade länkar</option>
            </select>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/30"
            />
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-aifm-gold/30"
            />
            <button
              onClick={() => setFilter({ action: '', userId: '', startDate: '', endDate: '' })}
              className="px-3 py-2 text-sm text-aifm-charcoal/50 hover:text-aifm-charcoal transition-colors"
            >
              Rensa filter
            </button>
          </div>
        )}
      </div>

      {view === 'summary' && summary ? (
        /* Summary View */
        <div className="p-6 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Eye className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Visningar</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{summary.totalViews}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Nedladdningar</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{summary.totalDownloads}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Unika användare</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{summary.uniqueUsers}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Total tid</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{formatDuration(summary.totalSessionTime)}</p>
            </div>
          </div>
          
          {/* Device breakdown */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-aifm-charcoal mb-3">Enhetsfördelning</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-aifm-charcoal/40" />
                <span className="text-sm text-aifm-charcoal">Desktop: {summary.accessByDevice.desktop}</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-aifm-charcoal/40" />
                <span className="text-sm text-aifm-charcoal">Mobil: {summary.accessByDevice.mobile}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tablet className="w-4 h-4 text-aifm-charcoal/40" />
                <span className="text-sm text-aifm-charcoal">Surfplatta: {summary.accessByDevice.tablet}</span>
              </div>
            </div>
          </div>
          
          {/* Most viewed documents */}
          {summary.mostViewedDocuments.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-aifm-charcoal mb-3">Mest visade dokument</h4>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase">Dokument</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase">Visningar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase">Snitt tid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.mostViewedDocuments.map((doc) => (
                      <tr key={doc.documentId}>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal">{doc.documentName}</td>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal text-right">{doc.viewCount}</td>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal/60 text-right">{formatDuration(doc.avgDuration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Active users */}
          {summary.activeUsers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-aifm-charcoal mb-3">Aktiva användare</h4>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase">Användare</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase">Visningar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase">Nedladdningar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase">Senast</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.activeUsers.map((user) => (
                      <tr key={user.userId}>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal">{user.userName}</td>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal text-right">{user.viewCount}</td>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal text-right">{user.downloadCount}</td>
                        <td className="px-4 py-3 text-sm text-aifm-charcoal/60 text-right">
                          {new Date(user.lastActive).toLocaleDateString('sv-SE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div className="divide-y divide-gray-50">
          {activities.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-aifm-charcoal/20" />
              </div>
              <p className="text-aifm-charcoal/50 font-medium">Ingen aktivitet ännu</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getActionIcon(activity.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-aifm-charcoal">{activity.userName}</span>
                      <span className="text-aifm-charcoal/40">{getActionLabel(activity.action)}</span>
                      {activity.actionDetails && (
                        <span className="text-aifm-charcoal">{activity.actionDetails}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-aifm-charcoal/40">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.startTime).toLocaleString('sv-SE')}
                      </span>
                      {activity.durationSeconds && (
                        <span>{formatDuration(activity.durationSeconds)}</span>
                      )}
                      <span className="flex items-center gap-1">
                        {getDeviceIcon(activity.deviceType)}
                        {activity.browser}
                      </span>
                      {activity.accessMethod !== 'direct' && (
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-aifm-charcoal/50">
                          {activity.accessMethod === 'shared_link' ? 'Via länk' : activity.accessMethod}
                        </span>
                      )}
                      {activity.watermarkApplied && activity.watermarkTrackingCode && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Shield className="w-3 h-3" />
                          {activity.watermarkTrackingCode}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {activity.ipAddress && (
                    <div className="text-xs text-aifm-charcoal/30">{activity.ipAddress}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}







