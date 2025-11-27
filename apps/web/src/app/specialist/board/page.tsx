'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { Header } from '@/components/Header';
import { formatDate } from '@/lib/utils';
import { Edit2, Check, Eye, FileText, CheckCircle2, Clock, Send } from 'lucide-react';

interface Report {
  id: string;
  type: string;
  status: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  draftText?: string | null;
  artifactUrl?: string | null;
  client?: { name: string };
}

const STATUSES = ['DRAFT', 'QC', 'APPROVAL', 'PUBLISHED'];

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', icon: FileText, color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  QC: { label: 'Quality Control', icon: CheckCircle2, color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  APPROVAL: { label: 'Approval', icon: Clock, color: 'purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  PUBLISHED: { label: 'Published', icon: Send, color: 'green', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
};

export default function SpecialistBoardPage() {
  const [reports, setReports] = useState<Record<string, Report[]>>({
    DRAFT: [],
    QC: [],
    APPROVAL: [],
    PUBLISHED: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports');
      if (!response.ok) {
        throw new Error('Failed to load reports');
      }
      const data: Report[] = await response.json();

      const grouped: Record<string, Report[]> = {
        DRAFT: [],
        QC: [],
        APPROVAL: [],
        PUBLISHED: [],
      };

      data.forEach((report: Report) => {
        if (grouped[report.status]) {
          grouped[report.status].push(report);
        }
      });

      setReports(grouped);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const moveReport = async (reportId: string, newStatus: string) => {
    try {
      // This function is not used in the current mock data loading,
      // but keeping it as it was in the original file.
      // In a real scenario, you would call an API client here.
      console.log(`Moving report ${reportId} to status: ${newStatus}`);
      // For now, we'll just reload reports to simulate the effect
      loadReports();
    } catch (error) {
      console.error('Failed to move report:', error);
    }
  };

  const totalReports = Object.values(reports).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="page-container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2 tracking-tight">DELIVERY BOARD</h1>
          <p className="text-gray-600 text-sm uppercase tracking-wide">Manage report approvals and publications</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`
                flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-wide
                border-b-2 transition-all duration-200 whitespace-nowrap
                ${activeTab === 'ALL' 
                  ? 'border-black text-black bg-white' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <FileText className="w-4 h-4" />
              <span>All Reports</span>
              {totalReports > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-bold
                  ${activeTab === 'ALL' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}
                `}>
                  {totalReports}
                </span>
              )}
            </button>
            {STATUSES.map((status) => {
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
              const Icon = config.icon;
              const count = reports[status].length;
              
              return (
                <button
                  key={status}
                  onClick={() => setActiveTab(status)}
                  className={`
                    flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-wide
                    border-b-2 transition-all duration-200 whitespace-nowrap
                    ${activeTab === status 
                      ? 'border-black text-black bg-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{config.label}</span>
                  {count > 0 && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-bold
                      ${activeTab === status ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}
                    `}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STATUSES.map((status) => {
            const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            const Icon = config.icon;
            const count = reports[status].length;
            
            return (
              <Card key={status} className={`border-2 ${config.border} bg-white hover:shadow-lg transition-all duration-200 rounded-3xl`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{config.label}</p>
                      <p className={`text-3xl font-bold mt-2 ${config.text}`}>{count}</p>
                    </div>
                    <div className={`w-14 h-14 ${config.bg} rounded-2xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${config.text}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Kanban Board or List View */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-pulse text-gray-500 uppercase tracking-wide">Laddar rapporter...</div>
          </div>
        ) : activeTab === 'ALL' ? (
          // List view for all reports
          <div className="space-y-4">
            {STATUSES.map((status) => {
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
              if (reports[status].length === 0) return null;
              
              return (
                <div key={status} className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${config.bg} rounded-2xl flex items-center justify-center`}>
                      <config.icon className={`w-5 h-5 ${config.text}`} />
                    </div>
                    <h2 className="text-xl font-bold text-black uppercase tracking-wide">{config.label}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
                      {reports[status].length}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reports[status].map((report) => (
                      <Card
                        key={report.id}
                        className={`border-2 ${config.border} bg-white hover:shadow-xl transition-all duration-300 rounded-3xl cursor-pointer group`}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-bold">{report.type.replace(/_/g, ' ')}</CardTitle>
                          {report.client && (
                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{report.client.name}</p>
                          )}
                          <CardDescription className="text-xs">
                            {formatDate(typeof report.periodStart === 'string' ? report.periodStart : report.periodStart.toISOString())} – {formatDate(typeof report.periodEnd === 'string' ? report.periodEnd : report.periodEnd.toISOString())}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2 flex-wrap mb-3">
                            {report.draftText && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold uppercase tracking-wide">
                                Draft
                              </span>
                            )}
                            {report.artifactUrl && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold uppercase tracking-wide">
                                PDF Ready
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {status !== 'PUBLISHED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 border-2 border-gray-300 hover:border-gray-400 rounded-2xl uppercase tracking-wide font-semibold transition-all duration-200 hover:scale-105"
                                onClick={() => window.location.href = `/specialist/${report.id}/edit`}
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </Button>
                            )}

                            {status !== 'PUBLISHED' && (
                              <Button
                                size="sm"
                                className="gap-2 bg-black text-white hover:bg-gray-900 rounded-2xl uppercase tracking-wide font-semibold transition-all duration-200 hover:scale-105"
                                onClick={() => {
                                  const nextStatus = STATUSES[STATUSES.indexOf(status) + 1];
                                  moveReport(report.id, nextStatus);
                                }}
                              >
                                <Check className="w-3 h-3" />
                                Move Next
                              </Button>
                            )}

                            {status === 'PUBLISHED' && report.artifactUrl && (
                              <Button
                                size="sm"
                                className="gap-2 bg-black text-white hover:bg-gray-900 rounded-2xl uppercase tracking-wide font-semibold transition-all duration-200 hover:scale-105"
                                onClick={() => window.open(report.artifactUrl || undefined)}
                              >
                                <Eye className="w-3 h-3" />
                                View PDF
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
            {totalReports === 0 && (
              <Card className="border-2 border-dashed border-gray-300 bg-white rounded-3xl">
                <CardContent className="text-center py-20">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-xl font-bold text-black uppercase tracking-wide mb-2">No Reports</p>
                  <p className="text-gray-600 text-sm uppercase tracking-wide">No reports available at this time.</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // Kanban view for specific status
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {STATUSES.map((status) => {
              const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
              const showAll = activeTab === 'ALL' || activeTab === status;
              
              if (!showAll) return null;
              
              return (
                <div key={status} className={`${config.bg} border-2 ${config.border} rounded-3xl p-4 min-h-[500px]`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center`}>
                      <config.icon className={`w-5 h-5 ${config.text}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-black uppercase tracking-wide text-sm">{config.label}</h3>
                      <p className="text-xs text-gray-600">{reports[status].length} reports</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {reports[status].map((report) => (
                      <Card
                        key={report.id}
                        className="cursor-move hover:shadow-xl transition-all duration-300 rounded-3xl border-2 border-white bg-white group"
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-bold">{report.type.replace(/_/g, ' ')}</CardTitle>
                          {report.client && (
                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{report.client.name}</p>
                          )}
                          <CardDescription className="text-xs">
                            {formatDate(typeof report.periodStart === 'string' ? report.periodStart : report.periodStart.toISOString())} – {formatDate(typeof report.periodEnd === 'string' ? report.periodEnd : report.periodEnd.toISOString())}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2 flex-wrap mb-3">
                            {report.draftText && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold uppercase tracking-wide">
                                Draft
                              </span>
                            )}
                            {report.artifactUrl && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold uppercase tracking-wide">
                                PDF Ready
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {status !== 'PUBLISHED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 border-2 border-gray-300 hover:border-gray-400 rounded-2xl uppercase tracking-wide font-semibold transition-all duration-200 hover:scale-105"
                                onClick={() => window.location.href = `/specialist/${report.id}/edit`}
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </Button>
                            )}

                            {status !== 'PUBLISHED' && (
                              <Button
                                size="sm"
                                className="gap-2 bg-black text-white hover:bg-gray-900 rounded-2xl uppercase tracking-wide font-semibold transition-all duration-200 hover:scale-105"
                                onClick={() => {
                                  const nextStatus = STATUSES[STATUSES.indexOf(status) + 1];
                                  moveReport(report.id, nextStatus);
                                }}
                              >
                                <Check className="w-3 h-3" />
                                Move
                              </Button>
                            )}

                            {status === 'PUBLISHED' && report.artifactUrl && (
                              <Button
                                size="sm"
                                className="gap-2 bg-black text-white hover:bg-gray-900 rounded-2xl uppercase tracking-wide font-semibold transition-all duration-200 hover:scale-105"
                                onClick={() => window.open(report.artifactUrl || undefined)}
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {reports[status].length === 0 && (
                      <div className="text-center py-12 text-gray-500 text-sm uppercase tracking-wide">
                        No reports
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
