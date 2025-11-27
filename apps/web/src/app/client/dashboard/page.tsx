'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Download, Eye } from 'lucide-react';

// Mock user for testing
const userId = 'test-client-001';

interface DataFeed {
  id: string;
  source: string;
  status: string;
  lastSyncAt?: string;
  lastError?: string;
}

interface Report {
  id: string;
  type: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  artifactUrl?: string;
}

export default function ClientDashboardPage() {
  const [dataFeeds, setDataFeeds] = useState<DataFeed[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API calls
      const feedsRes = { items: [
        { id: 'feed-1', source: 'Bank A', status: 'SYNCED', lastSyncAt: '2023-10-27T10:00:00Z' },
        { id: 'feed-2', source: 'Bank B', status: 'ERROR', lastSyncAt: '2023-10-26T14:30:00Z', lastError: 'Connection failed' },
        { id: 'feed-3', source: 'Credit Card X', status: 'SYNCED', lastSyncAt: '2023-10-27T09:00:00Z' },
      ] };
      const reportsRes = { items: [
        { id: 'report-1', type: 'Balance Sheet', status: 'PUBLISHED', periodStart: '2023-01-01', periodEnd: '2023-12-31', artifactUrl: 'https://example.com/balance-sheet.pdf' },
        { id: 'report-2', type: 'Income Statement', status: 'DRAFT', periodStart: '2023-07-01', periodEnd: '2023-07-31' },
        { id: 'report-3', type: 'Cash Flow', status: 'PUBLISHED', periodStart: '2023-06-01', periodEnd: '2023-06-30', artifactUrl: 'https://example.com/cash-flow.pdf' },
      ] };
      setDataFeeds(feedsRes.items || []);
      setReports(reportsRes.items || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (feedId: string) => {
    try {
      // TODO: Replace with actual API call
      console.log('Syncing feed:', feedId);
      loadData();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      // TODO: Implement file upload to S3
      console.log('Uploading file:', uploadFile.name);
      loadData();
    } catch (error) {
      console.error('Failed to upload:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="section-title">Client Dashboard</h1>
        <p className="section-subtitle">Manage your data feeds and view reports</p>
      </div>

      {/* Data Feeds Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Data Feeds</h2>
          <Button size="sm">
            Connect Feed
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Laddar...</div>
        ) : dataFeeds.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No data feeds configured yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataFeeds.map((feed) => (
              <Card key={feed.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{feed.source}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {feed.lastSyncAt
                          ? `Last synced: ${feed.lastSyncAt}`
                          : 'Never synced'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${feed.status === 'SYNCED' ? 'bg-success/10 text-success' : feed.status === 'ERROR' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                      {feed.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {feed.lastError && (
                    <div className="mb-4 p-3 bg-danger/10 text-danger rounded text-sm">
                      {feed.lastError}
                    </div>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSync(feed.id)}
                    className="w-full"
                  >
                    Sync Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Manual Upload Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Manual Upload</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ladda upp CSV/XLSX-fil</CardTitle>
            <p className="text-sm text-muted-foreground">Importera bokföringsdata från kalkylblad</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  id="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={!uploadFile}
                >
                  Upload File
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Reports Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Reports</h2>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No reports available yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{report.type}</h3>
                      <p className="text-sm text-muted-foreground">
                        {report.periodStart} to {report.periodEnd}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${report.status === 'PUBLISHED' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {report.status}
                      </span>
                      {report.status === 'PUBLISHED' && report.artifactUrl && (
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                      {report.status === 'DRAFT' && (
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
