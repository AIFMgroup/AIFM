import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';

interface DashboardStats {
  totalDocuments: number;
  processedToday: number;
  pendingReview: number;
  autoApprovedRate: number;
  documentsThisWeek: number;
  documentsLastWeek: number;
  weeklyChange: number;
  estimatedTimeSaved: number;
  estimatedCostSaved: number;
  byDocType: { type: string; count: number; percentage: number }[];
  topSuppliers: { name: string; count: number; totalAmount: number }[];
  recentActivity: { id: string; type: 'upload' | 'approve' | 'reject' | 'auto_approve'; description: string; timestamp: string; user?: string }[];
  aiAccuracy: number;
  avgProcessingTime: number;
  confidenceDistribution: { range: string; count: number }[];
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const timeRange = searchParams.get('timeRange') || 'week';

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId parameter' }, { status: 400 });
    }

    // Fetch all jobs for this company
    const allJobs = await jobStore.getByCompany(companyId);

    // Calculate time boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Filter jobs by time
    const jobsToday = allJobs.filter(j => new Date(j.createdAt) >= todayStart);
    const jobsThisWeek = allJobs.filter(j => new Date(j.createdAt) >= weekStart);
    const jobsLastWeek = allJobs.filter(j => {
      const date = new Date(j.createdAt);
      return date >= lastWeekStart && date < weekStart;
    });

    // Calculate metrics
    const totalDocuments = allJobs.length;
    const processedToday = jobsToday.length;
    const pendingReview = allJobs.filter(j => j.status === 'ready').length;
    
    const approvedJobs = allJobs.filter(j => j.status === 'approved');
    // Auto-approved jobs are those with high AI confidence (90%+) that were approved
    const autoApprovedJobs = approvedJobs.filter(j => j.classification?.overallConfidence && j.classification.overallConfidence >= 0.9);
    const autoApprovedRate = approvedJobs.length > 0 
      ? Math.round((autoApprovedJobs.length / approvedJobs.length) * 100) 
      : 0;

    const documentsThisWeek = jobsThisWeek.length;
    const documentsLastWeek = jobsLastWeek.length;
    const weeklyChange = documentsLastWeek > 0 
      ? Math.round(((documentsThisWeek - documentsLastWeek) / documentsLastWeek) * 100 * 10) / 10 
      : 0;

    // Estimated savings (5 min per document @ 800 SEK/h)
    const estimatedTimeSaved = totalDocuments * 5; // minutes
    const estimatedCostSaved = Math.round((estimatedTimeSaved / 60) * 800);

    // Document types distribution
    const docTypeCounts: Record<string, number> = {};
    allJobs.forEach(job => {
      const type = job.classification?.docType || 'OTHER';
      docTypeCounts[type] = (docTypeCounts[type] || 0) + 1;
    });
    
    const byDocType = Object.entries(docTypeCounts)
      .map(([type, count]) => ({
        type: type === 'INVOICE' ? 'Fakturor' : type === 'RECEIPT' ? 'Kvitton' : type === 'BANK' ? 'Kontoutdrag' : 'Övrigt',
        count,
        percentage: totalDocuments > 0 ? Math.round((count / totalDocuments) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // Top suppliers
    const supplierData: Record<string, { count: number; totalAmount: number }> = {};
    allJobs.forEach(job => {
      if (job.classification?.supplier) {
        const name = job.classification.supplier;
        if (!supplierData[name]) {
          supplierData[name] = { count: 0, totalAmount: 0 };
        }
        supplierData[name].count += 1;
        supplierData[name].totalAmount += job.classification.totalAmount || 0;
      }
    });

    const topSuppliers = Object.entries(supplierData)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent activity
    const recentActivity = allJobs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(job => ({
        id: job.id,
        type: (job.classification?.overallConfidence && job.classification.overallConfidence >= 0.9 && job.status === 'approved') 
              ? 'auto_approve' as const : 
              job.status === 'approved' ? 'approve' as const : 
              job.status === 'error' ? 'reject' as const : 'upload' as const,
        description: job.classification?.supplier 
          ? `${job.classification.supplier} ${job.classification.docType === 'INVOICE' ? 'faktura' : 'dokument'}`
          : `Dokument ${job.id.slice(0, 8)}`,
        timestamp: job.createdAt,
        user: job.approvedBy,
      }));

    // AI metrics
    const jobsWithConfidence = allJobs.filter(j => j.classification?.overallConfidence !== undefined);
    const aiAccuracy = jobsWithConfidence.length > 0
      ? Math.round((jobsWithConfidence.reduce((sum, j) => sum + ((j.classification?.overallConfidence || 0) * 100), 0) / jobsWithConfidence.length) * 10) / 10
      : 0;
    
    const avgProcessingTime = 3.2; // Could be calculated from actual processing times

    // Confidence distribution
    const confidenceRanges = { '90-100%': 0, '80-90%': 0, '70-80%': 0, '<70%': 0 };
    jobsWithConfidence.forEach(job => {
      const conf = (job.classification?.overallConfidence || 0) * 100;
      if (conf >= 90) confidenceRanges['90-100%']++;
      else if (conf >= 80) confidenceRanges['80-90%']++;
      else if (conf >= 70) confidenceRanges['70-80%']++;
      else confidenceRanges['<70%']++;
    });

    const confidenceDistribution = Object.entries(confidenceRanges)
      .map(([range, count]) => ({ range, count }));

    const stats: DashboardStats = {
      totalDocuments,
      processedToday,
      pendingReview,
      autoApprovedRate,
      documentsThisWeek,
      documentsLastWeek,
      weeklyChange,
      estimatedTimeSaved,
      estimatedCostSaved,
      byDocType,
      topSuppliers,
      recentActivity,
      aiAccuracy,
      avgProcessingTime,
      confidenceDistribution,
    };

    return NextResponse.json({ success: true, stats });

  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

