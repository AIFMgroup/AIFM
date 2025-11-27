'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { RefreshCw, AlertTriangle, TrendingDown, BarChart3, Shield, Activity } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { errorToast } from '@/lib/toast';

interface RiskProfile {
  id: string;
  clientId: string;
  client: {
    name: string;
  };
  period: string;
  var95: number | null;
  concentration: any;
  limitBreaches: any;
  stressTest: any;
  createdAt: string;
}

interface RiskData {
  profiles: RiskProfile[];
  totalBreaches: number;
  highRiskClients: number;
  avgVaR: number | null;
}

type RiskTab = 'OVERVIEW' | 'PROFILES' | 'ALERTS' | 'ANALYTICS';

export default function RiskManagementPage() {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RiskTab>('OVERVIEW');

  useEffect(() => {
    loadRiskData();
  }, []);

  const loadRiskData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/risk/profiles');
      if (!response.ok) {
        throw new Error('Failed to load risk data');
      }
      const data = await response.json();
      setRiskData(data);
    } catch (error) {
      console.error('Failed to load risk data:', error);
      errorToast('Failed to load risk data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (var95: number | null): 'low' | 'medium' | 'high' => {
    if (!var95) return 'low';
    if (var95 < 1000000) return 'low'; // < 1M SEK
    if (var95 < 5000000) return 'medium'; // < 5M SEK
    return 'high'; // >= 5M SEK
  };

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
    }
  };

  const getLimitBreachCount = (breaches: any): number => {
    if (!breaches || typeof breaches !== 'object') return 0;
    return Object.values(breaches).filter((v: any) => v === true).length;
  };

  if (loading && !riskData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="page-container py-12 text-center">
          <div className="animate-pulse">Laddar riskdata...</div>
        </div>
      </div>
    );
  }

  const profiles = riskData?.profiles || [];
  const totalBreaches = riskData?.totalBreaches || 0;
  const highRiskClients = riskData?.highRiskClients || 0;
  const avgVaR = riskData?.avgVaR || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="page-container py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-black mb-2 tracking-tight">RISK MANAGEMENT</h1>
            <p className="text-gray-600 text-sm uppercase tracking-wide">Monitor and manage portfolio risks</p>
          </div>
          <Button onClick={loadRiskData} disabled={loading} className="rounded-2xl uppercase tracking-wide">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-wide
                border-b-2 transition-all duration-200 whitespace-nowrap
                ${activeTab === 'OVERVIEW' 
                  ? 'border-black text-black bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('PROFILES')}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-wide
                border-b-2 transition-all duration-200 whitespace-nowrap
                ${activeTab === 'PROFILES' 
                  ? 'border-black text-black bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <Activity className="w-4 h-4" />
              <span>Risk Profiles</span>
              {profiles.length > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-bold
                  ${activeTab === 'PROFILES' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}
                `}>
                  {profiles.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ALERTS')}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-wide
                border-b-2 transition-all duration-200 whitespace-nowrap
                ${activeTab === 'ALERTS' 
                  ? 'border-black text-black bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Alerts</span>
              {totalBreaches > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white
                `}>
                  {totalBreaches}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-wide
                border-b-2 transition-all duration-200 whitespace-nowrap
                ${activeTab === 'ANALYTICS' 
                  ? 'border-black text-black bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <TrendingDown className="w-4 h-4" />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Risk Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-2 border-gray-200 bg-white rounded-3xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm uppercase tracking-wide text-gray-600 mb-2">Total Profiles</CardTitle>
                      <p className="text-3xl font-bold text-black">{profiles.length}</p>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-blue-900" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200 bg-white rounded-3xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm uppercase tracking-wide text-gray-600 mb-2">Avg VaR (95%)</CardTitle>
                      <p className="text-3xl font-bold text-black">
                        {avgVaR ? `${(avgVaR / 1000000).toFixed(2)}M` : 'N/A'}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-blue-900" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200 bg-white rounded-3xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm uppercase tracking-wide text-gray-600 mb-2">Limit Breaches</CardTitle>
                      <p className="text-3xl font-bold text-black">{totalBreaches}</p>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-blue-900" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200 bg-white rounded-3xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm uppercase tracking-wide text-gray-600 mb-2">High Risk Clients</CardTitle>
                      <p className="text-3xl font-bold text-black">{highRiskClients}</p>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-blue-900" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Risk Profiles */}
            <Card className="border-2 border-gray-200 bg-white rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl uppercase tracking-wide">Recent Risk Profiles</CardTitle>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No risk profiles found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profiles.slice(0, 5).map((profile) => {
                      const riskLevel = getRiskLevel(profile.var95);
                      const breaches = getLimitBreachCount(profile.limitBreaches);
                      return (
                        <div
                          key={profile.id}
                          className="p-4 border-2 border-gray-200 rounded-2xl hover:border-gray-300 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-black">{profile.client.name}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getRiskColor(riskLevel)}`}>
                                  {riskLevel.toUpperCase()} RISK
                                </span>
                                {breaches > 0 && (
                                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border-2 border-red-300">
                                    {breaches} BREACHES
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">Period:</span>
                                  <span className="ml-2 font-semibold">{formatDate(profile.period)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">VaR (95%):</span>
                                  <span className="ml-2 font-semibold">
                                    {profile.var95 ? `${(Number(profile.var95) / 1000000).toFixed(2)}M SEK` : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Created:</span>
                                  <span className="ml-2 font-semibold">{formatDate(profile.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'PROFILES' && (
          <div className="space-y-4">
            {profiles.length === 0 ? (
              <Card className="border-2 border-gray-200 bg-white rounded-3xl">
                <CardContent className="py-12 text-center text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No risk profiles found</p>
                </CardContent>
              </Card>
            ) : (
              profiles.map((profile) => {
                const riskLevel = getRiskLevel(profile.var95);
                const breaches = getLimitBreachCount(profile.limitBreaches);
                return (
                  <Card key={profile.id} className="border-2 border-gray-200 bg-white rounded-3xl">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-xl font-bold text-black">{profile.client.name}</CardTitle>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getRiskColor(riskLevel)}`}>
                            {riskLevel.toUpperCase()} RISK
                          </span>
                          {breaches > 0 && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border-2 border-red-300">
                              {breaches} BREACHES
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-600">{formatDate(profile.period)}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-sm uppercase tracking-wide text-gray-600 mb-2">Value at Risk (95%)</h4>
                          <p className="text-2xl font-bold text-black">
                            {profile.var95 ? `${(Number(profile.var95) / 1000000).toFixed(2)}M SEK` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm uppercase tracking-wide text-gray-600 mb-2">Limit Breaches</h4>
                          <p className="text-2xl font-bold text-black">{breaches}</p>
                          {profile.limitBreaches && typeof profile.limitBreaches === 'object' && (
                            <ul className="mt-2 space-y-1 text-sm text-gray-600">
                              {Object.entries(profile.limitBreaches)
                                .filter(([_, breached]) => breached === true)
                                .map(([limit, _]) => (
                                  <li key={limit}>• {limit}</li>
                                ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm uppercase tracking-wide text-gray-600 mb-2">Created</h4>
                          <p className="text-sm font-semibold text-black">{formatDate(profile.createdAt)}</p>
                        </div>
                      </div>
                      {profile.concentration && typeof profile.concentration === 'object' && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h4 className="text-sm uppercase tracking-wide text-gray-600 mb-3">Top 5 Holdings</h4>
                          <div className="space-y-2">
                            {Array.isArray(profile.concentration.top5) ? (
                              profile.concentration.top5.map((holding: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                                  <span className="font-semibold">{holding.name || holding.position || `Position ${idx + 1}`}</span>
                                  <span className="text-gray-600">{holding.percentage || holding.percent || 'N/A'}%</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-600">No concentration data available</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'ALERTS' && (
          <div className="space-y-4">
            {profiles.filter(p => {
              const breaches = getLimitBreachCount(p.limitBreaches);
              const riskLevel = getRiskLevel(p.var95);
              return breaches > 0 || riskLevel === 'high';
            }).length === 0 ? (
              <Card className="border-2 border-gray-200 bg-white rounded-3xl">
                <CardContent className="py-12 text-center text-gray-500">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No risk alerts at this time</p>
                </CardContent>
              </Card>
            ) : (
              profiles
                .filter(p => {
                  const breaches = getLimitBreachCount(p.limitBreaches);
                  const riskLevel = getRiskLevel(p.var95);
                  return breaches > 0 || riskLevel === 'high';
                })
                .map((profile) => {
                  const riskLevel = getRiskLevel(profile.var95);
                  const breaches = getLimitBreachCount(profile.limitBreaches);
                  return (
                    <Card key={profile.id} className={`border-2 ${riskLevel === 'high' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'} rounded-3xl`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`w-5 h-5 ${riskLevel === 'high' ? 'text-red-600' : 'text-yellow-600'}`} />
                            <CardTitle className="text-xl font-bold text-black">{profile.client.name}</CardTitle>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getRiskColor(riskLevel)}`}>
                              {riskLevel.toUpperCase()} RISK
                            </span>
                          </div>
                          <span className="text-sm text-gray-600">{formatDate(profile.period)}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {breaches > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm uppercase tracking-wide text-gray-700 mb-2">Limit Breaches Detected</h4>
                            <ul className="space-y-2">
                              {profile.limitBreaches && typeof profile.limitBreaches === 'object' && 
                                Object.entries(profile.limitBreaches)
                                  .filter(([_, breached]) => breached === true)
                                  .map(([limit, _]) => (
                                    <li key={limit} className="flex items-center gap-2 text-sm">
                                      <AlertTriangle className="w-4 h-4 text-red-600" />
                                      <span className="font-semibold">{limit}</span>
                                    </li>
                                  ))}
                            </ul>
                          </div>
                        )}
                        {riskLevel === 'high' && (
                          <div>
                            <h4 className="text-sm uppercase tracking-wide text-gray-700 mb-2">High Risk Level</h4>
                            <p className="text-sm text-gray-700">
                              VaR (95%) is {profile.var95 ? `${(Number(profile.var95) / 1000000).toFixed(2)}M SEK` : 'N/A'}, 
                              indicating elevated risk exposure.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>
        )}

        {activeTab === 'ANALYTICS' && (
          <div className="space-y-6">
            <Card className="border-2 border-gray-200 bg-white rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl uppercase tracking-wide">Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {profiles.filter(p => getRiskLevel(p.var95) === 'low').length}
                    </div>
                    <p className="text-sm uppercase tracking-wide text-gray-600">Low Risk</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600 mb-2">
                      {profiles.filter(p => getRiskLevel(p.var95) === 'medium').length}
                    </div>
                    <p className="text-sm uppercase tracking-wide text-gray-600">Medium Risk</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600 mb-2">
                      {profiles.filter(p => getRiskLevel(p.var95) === 'high').length}
                    </div>
                    <p className="text-sm uppercase tracking-wide text-gray-600">High Risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200 bg-white rounded-3xl">
              <CardHeader>
                <CardTitle className="text-xl uppercase tracking-wide">VaR Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No data available</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm uppercase tracking-wide text-gray-600 mb-2">Average VaR</h4>
                        <p className="text-2xl font-bold text-black">
                          {avgVaR ? `${(avgVaR / 1000000).toFixed(2)}M SEK` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm uppercase tracking-wide text-gray-600 mb-2">Total Profiles</h4>
                        <p className="text-2xl font-bold text-black">{profiles.length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

