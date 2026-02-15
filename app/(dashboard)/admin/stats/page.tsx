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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-aifm-charcoal/[0.03] p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-aifm-charcoal tracking-tight mb-2">Åtkomst nekad</h1>
          <p className="text-aifm-charcoal/40 mb-6">
            Du har inte behörighet att se admin-dashboarden.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till chatten
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/chat" 
                className="p-2 hover:bg-aifm-charcoal/[0.03] rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-aifm-charcoal/40" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Plattformsstatistik</h1>
                  <p className="text-sm text-aifm-charcoal/40">AI & kunskapsbas</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Time Range Selector */}
              <div className="flex items-center gap-1 p-1 bg-aifm-charcoal/[0.03] rounded-xl">
                {TIME_RANGES.map(range => (
                  <button
                    key={range.value}
                    onClick={() => setTimeRange(range.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      timeRange === range.value
                        ? 'bg-white text-aifm-charcoal shadow-sm'
                        : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              
              <button
                onClick={loadStats}
                disabled={isLoading}
                className="p-2 hover:bg-aifm-charcoal/[0.03] rounded-xl transition-colors"
                title="Uppdatera"
              >
                <RefreshCw className={`w-5 h-5 text-aifm-charcoal/40 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadStats}
              className="mt-4 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-all"
            >
              Försök igen
            </button>
          </div>
        ) : stats && (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm text-aifm-charcoal/40">Delad kunskap</p>
                    <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.knowledge.total}</p>
                  </div>
                </div>
                <p className="text-xs text-aifm-charcoal/40">
                  <span className="text-green-600 font-medium">+{stats.knowledge.recent}</span> senaste {timeRange === '24h' ? '24 timmarna' : timeRange === '7d' ? '7 dagarna' : '30 dagarna'}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-aifm-charcoal/40">Chattsamtal</p>
                    <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.chat.total}</p>
                  </div>
                </div>
                <p className="text-xs text-aifm-charcoal/40">
                  <span className="text-green-600 font-medium">+{stats.chat.recent}</span> nya samtal
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-aifm-charcoal/40">AI-förfrågningar</p>
                    <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.aiUsage.totalRequests}</p>
                  </div>
                </div>
                <p className="text-xs text-aifm-charcoal/40">
                  <span className="text-green-600 font-medium">+{stats.aiUsage.recentRequests}</span> nya
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-aifm-charcoal/40">Genomsn. svarstid</p>
                    <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">
                      {stats.aiUsage.avgResponseTime > 0 
                        ? `${(stats.aiUsage.avgResponseTime / 1000).toFixed(1)}s`
                        : '—'
                      }
                    </p>
                  </div>
                </div>
                <p className="text-xs text-aifm-charcoal/40">AI-svarstid</p>
              </div>
            </div>

            {/* Knowledge by Category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
                <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-aifm-charcoal/40" />
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
                          <span className="text-sm font-medium text-aifm-charcoal/70">{category.name}</span>
                          <span className="text-sm text-aifm-charcoal/40">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-aifm-charcoal/[0.03] rounded-full overflow-hidden">
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
              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
                <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-aifm-charcoal/40" />
                  Topp bidragsgivare
                </h2>
                {stats.knowledge.topContributors.length === 0 ? (
                  <p className="text-aifm-charcoal/40 text-sm">Ingen data ännu</p>
                ) : (
                  <div className="space-y-3">
                    {stats.knowledge.topContributors.map((contributor, index) => (
                      <div 
                        key={contributor.userId}
                        className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                            index === 0 ? 'bg-aifm-gold' :
                            index === 1 ? 'bg-aifm-charcoal/40' :
                            index === 2 ? 'bg-orange-400' :
                            'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium text-aifm-charcoal/70">
                            {contributor.email}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-aifm-gold/15 text-aifm-charcoal rounded-full">
                          {contributor.count} bidrag
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Users */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-aifm-charcoal/40" />
                Aktiva användare
              </h2>
              <div className="text-3xl font-semibold tracking-tight text-aifm-charcoal mb-2">
                {Object.keys(stats.chat.byUser).length}
              </div>
              <p className="text-sm text-aifm-charcoal/40">
                Unika användare som har chattsamtal
              </p>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-aifm-charcoal/30">
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
