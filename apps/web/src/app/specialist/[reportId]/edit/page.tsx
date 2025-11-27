'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { FormGroup, Label, Textarea } from '@/components/Form';

// Mock user for testing
const userId = 'test-specialist-001';

interface Report {
  id: string;
  type: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  draftText?: string;
  finalText?: string;
  draftMetrics?: any;
}

export default function ReportEditorPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.reportId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId || !reportId) return;
    loadReport();
  }, [userId, reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getReport(reportId);
      setReport(response);
      setText(response.finalText || response.draftText || '');
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.updateReport(reportId, { finalText: text });
      loadReport();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    try {
      setSaving(true);
      await apiClient.signReport(reportId);
      router.push('/specialist/board');
    } catch (error) {
      console.error('Failed to sign:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !report) {
    return <div className="page-container text-center py-12">Laddar rapport...</div>;
  }

  return (
    <div className="page-container">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="section-title">{report.type}</h1>
          <p className="section-subtitle">
            {formatDate(report.periodStart)} – {formatDate(report.periodEnd)} · Status: {report.status}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Editor */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Content</CardTitle>
              <CardDescription>Edit report text here</CardDescription>
            </CardHeader>
            <CardContent>
              <FormGroup>
                <Label htmlFor="text">Text</Label>
                <Textarea
                  id="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter or paste report content..."
                  className="min-h-[400px]"
                />
              </FormGroup>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>

                {report.status === 'APPROVAL' && (
                  <Button
                    onClick={handleSign}
                    disabled={saving}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Sign & Publish
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {report.draftMetrics ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(report.draftMetrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-semibold">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No metrics available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-semibold">{report.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-semibold">{report.type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Period:</span>
                <span className="ml-2 font-semibold">
                  {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
