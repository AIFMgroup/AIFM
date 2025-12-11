/**
 * Mock Data Service
 * Provides realistic mock data for demonstration purposes
 * Can be used when external APIs are unavailable or for demo mode
 */

// Always use mock data when database is empty, or if explicitly enabled
export const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || process.env.NODE_ENV === 'development';

// Mock data for demonstration
export const mockData = {
  clients: [
    {
      id: 'mock-client-1',
      name: 'Nordic Tech Fund',
      orgNo: '556000-0001',
      tier: 'XL',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'mock-client-2',
      name: 'Scandinavia Investment Partners',
      orgNo: '556000-0002',
      tier: 'LARGE',
      createdAt: new Date('2024-02-20'),
    },
    {
      id: 'mock-client-3',
      name: 'Baltic Capital Management',
      orgNo: '556000-0003',
      tier: 'MEDIUM',
      createdAt: new Date('2024-03-10'),
    },
  ],

  tasks: [
    {
      id: 'mock-task-1',
      clientId: 'mock-client-1',
      kind: 'BANK_RECON',
      status: 'NEEDS_REVIEW',
      client: { name: 'Nordic Tech Fund' },
      assignee: { name: 'Anna Svensson', email: 'anna@aifm.se' },
      flags: [],
      createdAt: new Date(),
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      payload: {
        period: 'Q4 2024',
        expectedBalance: 125000000,
        actualBalance: 124950000,
        discrepancy: 50000,
      },
    },
    {
      id: 'mock-task-2',
      clientId: 'mock-client-1',
      kind: 'KYC_REVIEW',
      status: 'IN_PROGRESS',
      client: { name: 'Nordic Tech Fund' },
      assignee: { name: 'Carl Johansson', email: 'carl@aifm.se' },
      flags: [],
      createdAt: new Date(),
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      payload: {
        investorId: 'inv-001',
        documentSet: 'KYC_2024_Q1',
        documentsCount: 5,
        verifiedCount: 3,
      },
    },
    {
      id: 'mock-task-3',
      clientId: 'mock-client-2',
      kind: 'REPORT_DRAFT',
      status: 'QUEUED',
      client: { name: 'Scandinavia Investment Partners' },
      assignee: null,
      flags: [],
      createdAt: new Date(),
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      payload: {
        reportType: 'FUND_ACCOUNTING',
        periodStart: '2024-10-01',
        periodEnd: '2024-12-31',
      },
    },
    {
      id: 'mock-task-4',
      clientId: 'mock-client-1',
      kind: 'BANK_RECON',
      status: 'COMPLETED',
      client: { name: 'Nordic Tech Fund' },
      assignee: { name: 'Anna Svensson', email: 'anna@aifm.se' },
      flags: [],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      payload: {
        period: 'Q3 2024',
        expectedBalance: 120000000,
        actualBalance: 120000000,
        discrepancy: 0,
      },
    },
    {
      id: 'mock-task-5',
      clientId: 'mock-client-3',
      kind: 'RISK_ANALYSIS',
      status: 'IN_PROGRESS',
      client: { name: 'Baltic Capital Management' },
      assignee: { name: 'Eva Larsson', email: 'eva@aifm.se' },
      flags: [],
      createdAt: new Date(),
      dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      payload: {
        period: 'Q4 2024',
        riskLevel: 'MEDIUM',
        var95: 2500000,
      },
    },
  ],

  documents: [
    {
      id: 'mock-doc-1',
      fileName: 'Q4_2024_Bank_Statement.pdf',
      title: 'Q4 2024 Bank Statement',
      fileType: 'application/pdf',
      fileSize: 2456789,
      status: 'INDEXED',
      category: 'BANK_STATEMENT',
      uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      client: { id: 'mock-client-1', name: 'Nordic Tech Fund' },
      storageUrl: '/mock-documents/bank-statement.pdf',
    },
    {
      id: 'mock-doc-2',
      fileName: 'KYC_Investor_001.pdf',
      title: 'KYC Documents - Investor 001',
      fileType: 'application/pdf',
      fileSize: 1234567,
      status: 'PROCESSING',
      category: 'KYC',
      uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      client: { id: 'mock-client-1', name: 'Nordic Tech Fund' },
      storageUrl: '/mock-documents/kyc-investor.pdf',
    },
    {
      id: 'mock-doc-3',
      fileName: 'Fund_Accounting_Report_Q4.pdf',
      title: 'Fund Accounting Report Q4 2024',
      fileType: 'application/pdf',
      fileSize: 3456789,
      status: 'INDEXED',
      category: 'REPORT',
      uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      client: { id: 'mock-client-2', name: 'Scandinavia Investment Partners' },
      storageUrl: '/mock-documents/report-q4.pdf',
    },
    {
      id: 'mock-doc-4',
      fileName: 'Risk_Assessment_2024.xlsx',
      title: 'Risk Assessment 2024',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSize: 987654,
      status: 'INDEXED',
      category: 'RISK_ASSESSMENT',
      uploadedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      client: { id: 'mock-client-3', name: 'Baltic Capital Management' },
      storageUrl: '/mock-documents/risk-assessment.xlsx',
    },
  ],

  reports: [
    {
      id: 'mock-report-1',
      clientId: 'mock-client-1',
      type: 'FUND_ACCOUNTING',
      status: 'DRAFT',
      periodStart: new Date('2024-10-01'),
      periodEnd: new Date('2024-12-31'),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      client: { name: 'Nordic Tech Fund' },
      draftText: `
# Nordic Tech Fund - Q4 2024 Report

## Summary
- NAV: SEK 125,000,000
- Inflows: SEK 50,000,000
- Management Fees: SEK 5,000,000
- Performance: +12.5%

## Holdings
1. Tech Company A - 35%
2. Tech Company B - 28%
3. Tech Company C - 22%
4. Cash - 15%

## Risk Assessment
Overall risk profile: Medium
Concentration: Moderate
Liquidity: Good
      `,
      draftMetrics: {
        nav: 125000000,
        inflow: 50000000,
        performancePercent: 12.5,
        holdingCount: 4,
      },
    },
    {
      id: 'mock-report-2',
      clientId: 'mock-client-2',
      type: 'INVESTOR_REPORT',
      status: 'QC',
      periodStart: new Date('2024-10-01'),
      periodEnd: new Date('2024-12-31'),
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      client: { name: 'Scandinavia Investment Partners' },
      finalText: `
# Scandinavia Investment Partners - Q4 2024 Investor Report

## Performance Summary
- NAV: EUR 75,000,000
- Return: +8.2%
- Dividend: EUR 1,200,000

## Portfolio Performance
Outperformed benchmark by 2.1%

## Risk Metrics
Value at Risk (95%): EUR 2,100,000
      `,
    },
  ],

  complianceChecks: [
    {
      id: 'mock-check-1',
      documentId: 'mock-doc-1',
      policyId: 'policy-1',
      status: 'COMPLIANT',
      score: 0.95,
      checkedAt: new Date(),
      notes: 'All required fields verified',
      gaps: [],
      evidence: [
        'Account number verified',
        'Balance matches ledger',
        'All transactions accounted for',
      ],
      document: {
        id: 'mock-doc-1',
        fileName: 'Q4_2024_Bank_Statement.pdf',
        title: 'Q4 2024 Bank Statement',
        client: { name: 'Nordic Tech Fund' },
      },
      policy: {
        id: 'policy-1',
        name: 'Bank Statement Verification',
        requirement: 'Bank statements must be verified monthly',
        category: 'BANKING',
      },
    },
    {
      id: 'mock-check-2',
      documentId: 'mock-doc-2',
      policyId: 'policy-2',
      status: 'NEEDS_REVIEW',
      score: 0.75,
      checkedAt: new Date(),
      notes: 'Missing proof of address document',
      gaps: [
        'Proof of address document missing',
        'Source of funds verification incomplete',
      ],
      evidence: [
        'Passport verified',
        'Identity confirmed',
      ],
      document: {
        id: 'mock-doc-2',
        fileName: 'KYC_Investor_001.pdf',
        title: 'KYC Documents - Investor 001',
        client: { name: 'Nordic Tech Fund' },
      },
      policy: {
        id: 'policy-2',
        name: 'KYC Documentation',
        requirement: 'All KYC documents must be complete',
        category: 'KYC',
      },
    },
    {
      id: 'mock-check-3',
      documentId: 'mock-doc-3',
      policyId: 'policy-3',
      status: 'COMPLIANT',
      score: 0.98,
      checkedAt: new Date(),
      notes: 'All reporting requirements met',
      gaps: [],
      evidence: [
        'Submitted within deadline',
        'All required sections included',
        'Auditor approval obtained',
      ],
      document: {
        id: 'mock-doc-3',
        fileName: 'Fund_Accounting_Report_Q4.pdf',
        title: 'Fund Accounting Report Q4 2024',
        client: { name: 'Scandinavia Investment Partners' },
      },
      policy: {
        id: 'policy-3',
        name: 'Financial Reporting',
        requirement: 'Reports must be submitted quarterly',
        category: 'REPORTING',
      },
    },
  ],

  dataFeeds: [
    {
      id: 'mock-feed-1',
      clientId: 'mock-client-1',
      source: 'FORTNOX',
      status: 'ACTIVE',
      configJson: {
        apiKey: '***',
        clientId: '12345',
        lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      client: { name: 'Nordic Tech Fund' },
    },
    {
      id: 'mock-feed-2',
      clientId: 'mock-client-1',
      source: 'BANK_SWEDBANK',
      status: 'ACTIVE',
      configJson: {
        accountId: '***',
        lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      lastSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      client: { name: 'Nordic Tech Fund' },
    },
    {
      id: 'mock-feed-3',
      clientId: 'mock-client-2',
      source: 'FORTNOX',
      status: 'ACTIVE',
      configJson: {
        apiKey: '***',
        clientId: '67890',
        lastSync: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      client: { name: 'Scandinavia Investment Partners' },
    },
    {
      id: 'mock-feed-4',
      clientId: 'mock-client-2',
      source: 'SKV',
      status: 'ERROR',
      configJson: {
        apiKey: '***',
        lastSync: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      client: { name: 'Scandinavia Investment Partners' },
      lastError: 'Connection timeout',
    },
  ],

  policies: [
    {
      id: 'policy-1',
      name: 'Bank Statement Verification',
      description: 'Monthly verification of bank statements',
      category: 'BANKING',
      rules: {
        frequency: 'monthly',
        requiredFields: ['accountNumber', 'balance', 'transactions'],
      },
      requirements: {
        verification: 'required',
        documentation: 'mandatory',
      },
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'policy-2',
      name: 'KYC Documentation',
      description: 'Complete KYC documentation for all investors',
      category: 'KYC',
      rules: {
        requiredDocuments: ['passport', 'proofOfAddress', 'sourceOfFunds'],
        verificationLevel: 'enhanced',
      },
      requirements: {
        reviewPeriod: '90 days',
        updateFrequency: 'annually',
      },
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'policy-3',
      name: 'Financial Reporting',
      description: 'Quarterly financial reports must be submitted',
      category: 'REPORTING',
      rules: {
        frequency: 'quarterly',
        deadline: '30 days after quarter end',
        format: 'PDF',
      },
      requirements: {
        audit: 'required',
        approval: 'mandatory',
      },
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'policy-4',
      name: 'Risk Management',
      description: 'Risk assessment and monitoring requirements',
      category: 'RISK',
      rules: {
        assessmentFrequency: 'quarterly',
        varCalculation: 'required',
        stressTesting: 'annually',
      },
      requirements: {
        documentation: 'mandatory',
        review: 'required',
      },
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],

  regulations: [
    {
      id: 'reg-1',
      name: 'AIFM Directive',
      authority: 'EU',
      category: 'FUND_MANAGEMENT',
      content: 'Alternative Investment Fund Managers Directive',
      externalUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0061',
      effectiveDate: new Date('2013-07-22'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'reg-2',
      name: 'MiFID II',
      authority: 'EU',
      category: 'MARKET_CONDUCT',
      content: 'Markets in Financial Instruments Directive II',
      externalUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014L0065',
      effectiveDate: new Date('2018-01-03'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'reg-3',
      name: 'GDPR',
      authority: 'EU',
      category: 'DATA_PROTECTION',
      content: 'General Data Protection Regulation',
      externalUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679',
      effectiveDate: new Date('2018-05-25'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'reg-4',
      name: 'Finansinspektionens Förordning',
      authority: 'FI',
      category: 'REGULATORY',
      content: 'Swedish Financial Supervisory Authority regulations',
      externalUrl: 'https://www.fi.se/',
      effectiveDate: new Date('2024-01-01'),
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],

  documentStats: {
    byStatus: {
      INDEXED: 3,
      PROCESSING: 1,
      PENDING: 0,
      ERROR: 0,
      ARCHIVED: 0,
    },
    byCategory: {
      BANK_STATEMENT: 1,
      KYC: 1,
      REPORT: 1,
      RISK_ASSESSMENT: 1,
    },
    byType: {
      'application/pdf': 3,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 1,
    },
    uploadsOverTime: [
      { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 1 },
      { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 1 },
      { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 1 },
      { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 1 },
    ],
  },

  riskProfiles: [
    {
      id: 'mock-risk-1',
      clientId: 'mock-client-1',
      period: new Date('2024-10-01').toISOString(),
      var95: 3500000, // 3.5M SEK - medium risk
      concentration: {
        top5: [
          { name: 'Tech Company A', percentage: 35 },
          { name: 'Tech Company B', percentage: 28 },
          { name: 'Tech Company C', percentage: 22 },
          { name: 'Tech Company D', percentage: 10 },
          { name: 'Cash', percentage: 5 },
        ],
      },
      limitBreaches: {
        'Single Position Limit': false,
        'Concentration Limit': false,
        'Leverage Limit': false,
      },
      stressTest: {
        scenario1: { impact: -12.5 },
        scenario2: { impact: -8.3 },
      },
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      client: { name: 'Nordic Tech Fund' },
    },
    {
      id: 'mock-risk-2',
      clientId: 'mock-client-2',
      period: new Date('2024-10-01').toISOString(),
      var95: 2100000, // 2.1M EUR - medium risk
      concentration: {
        top5: [
          { name: 'Financial Services A', percentage: 30 },
          { name: 'Real Estate B', percentage: 25 },
          { name: 'Industrial C', percentage: 20 },
          { name: 'Bonds', percentage: 15 },
          { name: 'Cash', percentage: 10 },
        ],
      },
      limitBreaches: {
        'Single Position Limit': true,
        'Concentration Limit': false,
        'Leverage Limit': false,
      },
      stressTest: {
        scenario1: { impact: -10.2 },
        scenario2: { impact: -6.8 },
      },
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      client: { name: 'Scandinavia Investment Partners' },
    },
    {
      id: 'mock-risk-3',
      clientId: 'mock-client-3',
      period: new Date('2024-10-01').toISOString(),
      var95: 2500000, // 2.5M SEK - medium risk
      concentration: {
        top5: [
          { name: 'Energy Company A', percentage: 40 },
          { name: 'Utility Company B', percentage: 30 },
          { name: 'Infrastructure C', percentage: 20 },
          { name: 'Cash', percentage: 10 },
        ],
      },
      limitBreaches: {
        'Single Position Limit': false,
        'Concentration Limit': true,
        'Leverage Limit': false,
      },
      stressTest: {
        scenario1: { impact: -15.5 },
        scenario2: { impact: -9.2 },
      },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      client: { name: 'Baltic Capital Management' },
    },
    {
      id: 'mock-risk-4',
      clientId: 'mock-client-1',
      period: new Date('2024-11-01').toISOString(),
      var95: 6200000, // 6.2M SEK - high risk
      concentration: {
        top5: [
          { name: 'Tech Company A', percentage: 45 },
          { name: 'Tech Company B', percentage: 35 },
          { name: 'Tech Company C', percentage: 15 },
          { name: 'Cash', percentage: 5 },
        ],
      },
      limitBreaches: {
        'Single Position Limit': true,
        'Concentration Limit': true,
        'Leverage Limit': false,
      },
      stressTest: {
        scenario1: { impact: -18.5 },
        scenario2: { impact: -12.3 },
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      client: { name: 'Nordic Tech Fund' },
    },
  ],

  systemActivity: {
    recentTasks: [
      {
        id: 'mock-task-1',
        kind: 'BANK_RECON',
        status: 'NEEDS_REVIEW',
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        client: { name: 'Nordic Tech Fund' },
        assignee: { name: 'Anna Svensson', email: 'anna@aifm.se' },
        flags: [],
      },
      {
        id: 'mock-task-2',
        kind: 'KYC_REVIEW',
        status: 'IN_PROGRESS',
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        client: { name: 'Nordic Tech Fund' },
        assignee: { name: 'Carl Johansson', email: 'carl@aifm.se' },
        flags: [],
      },
      {
        id: 'mock-task-3',
        kind: 'REPORT_DRAFT',
        status: 'QUEUED',
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        client: { name: 'Scandinavia Investment Partners' },
        assignee: null,
        flags: [],
      },
    ],
    stats: {
      totalTasks: 5,
      tasksByStatus: {
        QUEUED: 1,
        IN_PROGRESS: 2,
        NEEDS_REVIEW: 1,
        COMPLETED: 1,
      },
      tasksByKind: {
        BANK_RECON: 2,
        KYC_REVIEW: 1,
        REPORT_DRAFT: 1,
        RISK_ANALYSIS: 1,
      },
    },
    recentReports: [
      {
        id: 'mock-report-1',
        type: 'FUND_ACCOUNTING',
        status: 'DRAFT',
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        client: { name: 'Nordic Tech Fund' },
      },
      {
        id: 'mock-report-2',
        type: 'INVESTOR_REPORT',
        status: 'QC',
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        client: { name: 'Scandinavia Investment Partners' },
      },
    ],
    activity: [
      {
        id: 'mock-task-1',
        kind: 'BANK_RECON',
        status: 'NEEDS_REVIEW',
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        client: { name: 'Nordic Tech Fund' },
      },
      {
        id: 'mock-task-2',
        kind: 'KYC_REVIEW',
        status: 'IN_PROGRESS',
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        client: { name: 'Nordic Tech Fund' },
      },
    ],
  },

  adminStats: {
    clients: 3,
    tasks: 5,
    reports: 2,
    investors: 8,
    documents: 4,
    policies: 4,
    regulations: 4,
    taskStats: {
      QUEUED: 1,
      IN_PROGRESS: 2,
      NEEDS_REVIEW: 1,
      COMPLETED: 1,
    },
    reportStats: {
      DRAFT: 1,
      QC: 1,
    },
    documentStats: {
      INDEXED: 3,
      PROCESSING: 1,
    },
    complianceStats: {
      total: 3,
      compliant: 2,
      nonCompliant: 0,
      needsReview: 1,
      score: 0.89,
    },
    recentDocuments: [
      {
        id: 'mock-doc-2',
        fileName: 'KYC_Investor_001.pdf',
        title: 'KYC Documents - Investor 001',
        status: 'PROCESSING',
        uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        client: { id: 'mock-client-1', name: 'Nordic Tech Fund' },
      },
      {
        id: 'mock-doc-1',
        fileName: 'Q4_2024_Bank_Statement.pdf',
        title: 'Q4 2024 Bank Statement',
        status: 'INDEXED',
        uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        client: { id: 'mock-client-1', name: 'Nordic Tech Fund' },
      },
    ],
  },
};

/**
 * Check if mock data should be used
 */
export function shouldUseMockData(): boolean {
  return USE_MOCK_DATA || process.env.NODE_ENV === 'development';
}

/**
 * Get mock data with optional filtering
 */
export function getMockData<T extends keyof typeof mockData>(
  type: T,
  filter?: (item: any) => boolean
): typeof mockData[T] {
  const data = mockData[type];
  if (filter && Array.isArray(data)) {
    return data.filter(filter) as typeof mockData[T];
  }
  return data;
}

/**
 * Mock delay to simulate API calls
 */
export async function mockDelay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

