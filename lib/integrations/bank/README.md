# Bank Integration for NAV Reconciliation

This module provides integration with SEB and Swedbank for automated NAV reconciliation in the AIFM fund administration system.

## Overview

The bank integration system compares NAV data from the internal Fund Registry against custody data from SEB and Swedbank to identify discrepancies.

```
Fund Registry Data  <-->  Bank Custody Data  =  Reconciliation Report
       ↓                         ↓
   - Holdings               - Positions
   - Cash Balance           - Cash Balance
   - NAV Value              - Market Value
   - Total AUM              - Total Value
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Routes                                   │
├─────────────────────────────────────────────────────────────────────┤
│  /api/bank/seb/positions        │  SEB custody positions            │
│  /api/bank/seb/balances         │  SEB account balances             │
│  /api/bank/seb/transactions     │  SEB transactions                 │
│  /api/bank/seb/test-connection  │  Test SEB API connection          │
│  /api/bank/seb/custody-summary  │  Full custody report              │
│  /api/bank/swedbank/process-pdf │  Process Swedbank PDF             │
│  /api/bank/swedbank/email-webhook │  AWS SES email webhook          │
│  /api/bank/reconciliation       │  Run NAV reconciliation           │
│  /api/bank/documents            │  List stored documents            │
│  /api/bank/documents/[key]      │  Get/download specific document   │
├─────────────────────────────────────────────────────────────────────┤
│                    Integration Clients                               │
├─────────────────────────────────────────────────────────────────────┤
│  lib/integrations/bank/seb-client.ts        │  SEB API client       │
│  lib/integrations/bank/swedbank-pdf-processor.ts │  Swedbank PDF    │
│  lib/integrations/bank/reconciliation-engine.ts  │  Reconciliation  │
│  lib/integrations/bank/storage-service.ts   │  Document storage     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Storage

All bank data is stored in S3 with automatic archiving to Glacier. The storage structure:

```
aifm-bank-data-{env}-{account-id}/
├── swedbank/
│   ├── emails/           # Raw emails from Swedbank
│   │   └── 2026/01/26/
│   │       └── {message-id}.eml
│   ├── pdfs/             # Original PDF custody reports
│   │   └── 2026/01/26/
│   │       └── {timestamp}-custody-report.pdf
│   └── processed/        # Extracted JSON data
│       └── 2026/01/26/
│           └── {timestamp}-report.json
├── seb/
│   ├── positions/        # Daily position snapshots
│   │   └── 2026/01/26/
│   │       └── {account-id}-positions.json
│   ├── balances/         # Daily balance snapshots
│   │   └── 2026/01/26/
│   │       └── {account-id}-balances.json
│   └── transactions/     # Transaction history
│       └── 2026/01/26/
│           └── {account-id}-transactions.json
├── reconciliation/
│   ├── reports/          # Reconciliation results (JSON)
│   │   └── 2026/01/26/
│   │       └── {fund-id}-{timestamp}.json
│   └── exports/          # Excel exports
│       └── 2026/01/26/
│           └── {fund-id}-{timestamp}.xlsx
```

### Storage Lifecycle

| Age | Storage Class | Use Case |
|-----|---------------|----------|
| 0-90 days | Standard | Active data, frequently accessed |
| 90-365 days | Standard-IA | Infrequent access, still operational |
| 365+ days | Glacier | Archival, compliance retention |
| 7 years | Expired | Deleted after retention period |

### Deploy Storage Infrastructure

```bash
./scripts/deploy-bank-storage.sh prod
```

This creates:
- S3 bucket for bank data with encryption and versioning
- S3 bucket for email ingestion
- Lambda for email processing
- Lifecycle policies for archiving

## Environment Variables

### SEB Integration

```bash
# OAuth2 credentials from SEB Developer Portal
SEB_CLIENT_ID=your-client-id
SEB_CLIENT_SECRET=your-client-secret

# API Configuration
SEB_API_URL=https://api.seb.se           # Production
SEB_USE_SANDBOX=false                     # Set to 'true' for sandbox

# Default custody account (optional)
SEB_CUSTODY_ACCOUNT_ID=your-account-id

# mTLS certificates (for production)
SEB_MTLS_CERT_PATH=s3://bucket/certs/seb.crt
SEB_MTLS_KEY_PATH=s3://bucket/certs/seb.key
```

### AWS Services (Swedbank PDF Processing)

```bash
# AWS Region
AWS_REGION=eu-north-1

# Bedrock (Claude AI) - may be in different region
BEDROCK_REGION=eu-west-1

# S3 Buckets
BANK_DATA_BUCKET=aifm-bank-data-prod-accountid   # All bank data storage
EMAIL_INGEST_BUCKET=aifm-email-ingest-prod-accountid  # Email ingestion
DATA_BUCKET=aifm-data-accountid                   # Legacy bucket (optional)
EMAIL_BUCKET=aifm-emails-accountid                # Legacy bucket (optional)

# SNS Topic for email notifications
SNS_TOPIC_ARN=arn:aws:sns:eu-north-1:accountid:aifm-bank-email-notifications
```

### LSEG / Refinitiv Integration

```bash
# LSEG API (OAuth2 client credentials)
LSEG_API_KEY=your-api-key
LSEG_API_SECRET=your-api-secret
LSEG_API_URL=https://api.refinitiv.com   # Production
```

### Fund Registry

```bash
# DynamoDB table for persistent fund data
FUND_REGISTRY_TABLE=aifm-fund-registry
```

## SEB Developer Portal Setup

1. **Register at developer.sebgroup.com**
   - Create an account
   - Register your organization

2. **Create an Application**
   - Go to "My Apps" → "Create App"
   - Name: "AIFM NAV Reconciliation"
   - Select APIs: Global Custody (all endpoints)

3. **Get Sandbox Credentials**
   - Copy Client ID and Client Secret
   - Add to environment variables

4. **Request Production Access**
   - Contact SEB to whitelist your IP addresses
   - Configure mTLS certificates
   - Get production credentials

## SEB API Endpoints Used

| Endpoint | Description |
|----------|-------------|
| `GET /custody/v1/accounts/{accountId}/positions` | Custody positions |
| `GET /custody/v1/accounts/{accountId}/cash` | Cash balances |
| `GET /custody/v1/accounts/{accountId}` | Account info |
| `GET /custody/v1/accounts/{accountId}/transactions` | Transactions |

## Swedbank Email Integration Setup

Run the setup script to configure AWS resources:

```bash
./scripts/setup-bank-integration.sh
```

This creates:
- S3 buckets for data and emails
- SNS topic for notifications
- SES receipt rules
- IAM policies

### Email Domain Setup

1. Verify your domain in SES Console
2. Add MX record: `10 inbound-smtp.eu-north-1.amazonaws.com`
3. Configure allowed sender addresses in `email-webhook/route.ts`

## Fund-to-Account Mapping

The SEB client maps fund IDs to SEB custody account IDs:

```typescript
// In seb-client.ts
const DEFAULT_FUND_MAPPINGS: FundAccountMapping[] = [
  { fundId: 'FUND001', fundName: 'AUAG Essential Metals', sebAccountId: 'SEB-001' },
  { fundId: 'FUND002', fundName: 'AuAg Gold Rush', sebAccountId: 'SEB-002' },
  // ...
];
```

In production, these mappings should be stored in DynamoDB or a configuration service.

## Reconciliation Flow

### SEB (API-based)

```
1. Fetch positions from SEB API
2. Fetch NAV data from Fund Registry
3. Compare holdings, cash, NAV
4. Generate reconciliation report
5. Flag discrepancies
```

### Swedbank (PDF-based)

```
1. Receive PDF (email or upload)
2. Extract text with AWS Textract
3. Structure data with Claude AI
4. Compare with Fund Registry
5. Generate reconciliation report
```

## API Usage Examples

### Get SEB Positions

```bash
curl https://your-domain.com/api/bank/seb/positions
```

### Run Reconciliation

```bash
curl -X POST https://your-domain.com/api/bank/reconciliation \
  -H "Content-Type: application/json" \
  -d '{
    "fundId": "FUND001",
    "bankType": "SEB",
    "sebAccountId": "SEB-001",
    "date": "2026-01-26"
  }'
```

### Process Swedbank PDF

```bash
curl -X POST https://your-domain.com/api/bank/swedbank/process-pdf \
  -F "file=@custody-report.pdf"
```

### List Stored Documents

```bash
# List all documents
curl https://your-domain.com/api/bank/documents

# List reconciliation reports
curl "https://your-domain.com/api/bank/documents?category=reconciliation&subCategory=reports"

# List SEB snapshots with date filter
curl "https://your-domain.com/api/bank/documents?category=seb&fromDate=2026-01-01&toDate=2026-01-31"

# Get with statistics
curl "https://your-domain.com/api/bank/documents?includeStats=true"
```

### Get Document

```bash
# Get JSON document content
curl https://your-domain.com/api/bank/documents/reconciliation|reports|2026|01|26|FUND001-report.json

# Get download URL for PDF
curl "https://your-domain.com/api/bank/documents/swedbank|pdfs|2026|01|26|custody-report.pdf?download=true"
```

## Reconciliation Result Structure

```typescript
interface ReconciliationResult {
  fundId: string;
  fundName: string;
  reconciliationDate: string;
  summary: {
    totalPositions: number;
    matchingPositions: number;
    minorDifferences: number;
    majorDifferences: number;
    overallStatus: 'APPROVED' | 'REVIEW_REQUIRED' | 'FAILED';
  };
  cashComparison: CashComparison;
  positions: PositionComparison[];
  flags: ReconciliationFlag[];
}
```

## UI Pages

| Page | Description |
|------|-------------|
| `/nav-admin` | NAV overview with quick actions |
| `/nav-admin/bank-reconciliation` | SEB API connection / Swedbank PDF upload |
| `/nav-admin/reconciliation` | Reconciliation results, charts, and document browser |

### Reconciliation Page Features

- **Avstämning tab**: Real-time reconciliation results with status badges
- **Dokument tab**: Browse all stored documents (PDFs, JSON, Excel)
- **Historik tab**: View reconciliation history with trends

### Document Browser

The document browser displays all stored bank documents with:
- Category filtering (SEB, Swedbank, Reconciliation)
- Date range filtering
- Search by filename
- Direct download links
- Inline JSON viewer

## Development Mode

When `SEB_CLIENT_ID` is not set or `NODE_ENV=development`, the SEB client automatically uses mock data. This allows development without requiring SEB credentials.

## Deployment

Build and deploy to AWS ECS:

```bash
cd aifm-frontend

# Build Docker image
docker buildx build --platform linux/amd64 -t aifm-frontend:latest .

# Push to ECR
aws ecr get-login-password --region eu-north-1 | docker login --username AWS --password-stdin 798076332693.dkr.ecr.eu-north-1.amazonaws.com
docker tag aifm-frontend:latest 798076332693.dkr.ecr.eu-north-1.amazonaws.com/aifm-frontend:latest
docker push 798076332693.dkr.ecr.eu-north-1.amazonaws.com/aifm-frontend:latest

# Update ECS service
aws ecs update-service --cluster aifm-prod --service AIFM_WEB-service --force-new-deployment --region eu-north-1
```

## Troubleshooting

### SEB Connection Issues

1. Check credentials in environment variables
2. Verify IP whitelist with SEB
3. Check mTLS certificate validity
4. Use sandbox URL for testing

### Swedbank PDF Processing

1. Check AWS Textract permissions
2. Verify Bedrock model access enabled
3. Check S3 bucket policies
4. Review CloudWatch logs for Lambda errors

### Reconciliation Discrepancies

1. Check date alignment (trade date vs settlement date)
2. Verify currency conversion rates
3. Check for pending settlements
4. Review price sources and timing
