'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, 
  BookOpen, 
  MessageSquare, 
  Users, 
  TrendingUp,
  Clock,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Shield,
  Calendar,
  Sparkles,
  Database,
} from 'lucide-react';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge/categories';

interface AdminStats {
  timeRange: string;
  knowledge: {
    total: number;
    recent: number;
    byCategory: Record<string, number>;
    topContributors: Array<{ userId: string; email: string; count: number }>;
  };
  chat: {
    total: number;
    recent: number;
    byUser: Record<string, number>;
  };
  aiUsage: {
    totalRequests: number;
    recentRequests: number;
    avgResponseTime: number;
  };
  generatedAt: string;
}

const TIME_RANGES = [
  { value: '24h', label: '24 timmar' },
  { value: '7d', label: '7 dagar' },
  { value: '30d', label: '30 dagar' },
];

export default function AdminStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/stats?range=${timeRange}`);
      
      if (response.status === 403) {
        setError('Du har inte administratörsrättigheter');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta statistik');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const getCategoryName = (id: string) => {
    return KNOWLEDGE_CATEGORIES.find(c => c.id === id)?.name || id;
  };

  if (error === 'Du har inte administratörsrättigheter') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Åtkomst nekad</h1>
          <p className="text-gray-600 mb-6">
            Du har inte behörighet att se admin-dashboarden.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2d2a26] text-white rounded-lg hover:bg-[#4a4540] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till chatten
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/chat" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2d2a26] to-[#4a4540] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Plattformsstatistik</h1>
                  <p className="text-sm text-gray-500">AI & kunskapsbas</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Time Range Selector */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                {TIME_RANGES.map(range => (
                  <button
                    key={range.value}
                    onClick={() => setTimeRange(range.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      timeRange === range.value
                        ? 'bg-white text-[#2d2a26] shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              
              <button
                onClick={loadStats}
                disabled={isLoading}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Uppdatera"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadStats}
              className="mt-4 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              Försök igen
            </button>
          </div>
        ) : stats && (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Delad kunskap</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.knowledge.total}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  <span className="text-green-600 font-medium">+{stats.knowledge.recent}</span> senaste {timeRange === '24h' ? '24 timmarna' : timeRange === '7d' ? '7 dagarna' : '30 dagarna'}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Chattsamtal</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.chat.total}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  <span className="text-green-600 font-medium">+{stats.chat.recent}</span> nya samtal
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">AI-förfrågningar</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.aiUsage.totalRequests}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  <span className="text-green-600 font-medium">+{stats.aiUsage.recentRequests}</span> nya
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Genomsn. svarstid</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.aiUsage.avgResponseTime > 0 
                        ? `${(stats.aiUsage.avgResponseTime / 1000).toFixed(1)}s`
                        : '—'
                      }
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">AI-svarstid</p>
              </div>
            </div>

            {/* Knowledge by Category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-gray-400" />
                  Kunskap per kategori
                </h2>
                <div className="space-y-3">
                  {KNOWLEDGE_CATEGORIES.map(category => {
                    const count = stats.knowledge.byCategory[category.id] || 0;
                    const percentage = stats.knowledge.total > 0 
                      ? Math.round((count / stats.knowledge.total) * 100) 
                      : 0;
                    
                    return (
                      <div key={category.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{category.name}</span>
                          <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              category.id === 'clients' ? 'bg-blue-500' :
                              category.id === 'negotiations' ? 'bg-green-500' :
                              category.id === 'compliance' ? 'bg-purple-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  Topp bidragsgivare
                </h2>
                {stats.knowledge.topContributors.length === 0 ? (
                  <p className="text-gray-500 text-sm">Ingen data ännu</p>
                ) : (
                  <div className="space-y-3">
                    {stats.knowledge.topContributors.map((contributor, index) => (
                      <div 
                        key={contributor.userId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-orange-400' :
                            'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {contributor.email}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {contributor.count} bidrag
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Users */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                Aktiva användare
              </h2>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {Object.keys(stats.chat.byUser).length}
              </div>
              <p className="text-sm text-gray-500">
                Unika användare som har chattsamtal
              </p>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400">
              <p className="flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3" />
                Uppdaterad {new Date(stats.generatedAt).toLocaleString('sv-SE')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
