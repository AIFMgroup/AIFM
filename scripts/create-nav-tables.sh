#!/bin/bash

# =============================================================================
# Create DynamoDB Tables for NAV Engine
# =============================================================================

AWS_REGION=${AWS_REGION:-eu-north-1}
BILLING_MODE="PAY_PER_REQUEST"  # On-demand pricing

echo "Creating DynamoDB tables for NAV Engine in region: $AWS_REGION"
echo "============================================================="

# -----------------------------------------------------------------------------
# Table 1: aifm-nav-records
# Stores NAV calculation history
# PK: FUND#fundId#SC#shareClassId
# SK: NAV#YYYY-MM-DD
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-nav-records..."

aws dynamodb create-table \
    --table-name aifm-nav-records \
    --attribute-definitions \
        AttributeName=pk,AttributeType=S \
        AttributeName=sk,AttributeType=S \
        AttributeName=navDate,AttributeType=S \
        AttributeName=status,AttributeType=S \
    --key-schema \
        AttributeName=pk,KeyType=HASH \
        AttributeName=sk,KeyType=RANGE \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "navDate-index",
                "KeySchema": [
                    {"AttributeName": "navDate", "KeyType": "HASH"},
                    {"AttributeName": "pk", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "status-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "navDate", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]' \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-nav-records created successfully"
else
    echo "! Table aifm-nav-records may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Table 2: aifm-nav-approvals
# Stores NAV approval workflow
# PK: approvalId
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-nav-approvals..."

aws dynamodb create-table \
    --table-name aifm-nav-approvals \
    --attribute-definitions \
        AttributeName=approvalId,AttributeType=S \
        AttributeName=navDate,AttributeType=S \
        AttributeName=status,AttributeType=S \
    --key-schema \
        AttributeName=approvalId,KeyType=HASH \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "navDate-index",
                "KeySchema": [
                    {"AttributeName": "navDate", "KeyType": "HASH"},
                    {"AttributeName": "approvalId", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "status-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "navDate", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]' \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-nav-approvals created successfully"
else
    echo "! Table aifm-nav-approvals may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Table 3: aifm-nav-runs
# Stores NAV calculation run logs
# PK: runId
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-nav-runs..."

aws dynamodb create-table \
    --table-name aifm-nav-runs \
    --attribute-definitions \
        AttributeName=runId,AttributeType=S \
        AttributeName=navDate,AttributeType=S \
        AttributeName=status,AttributeType=S \
    --key-schema \
        AttributeName=runId,KeyType=HASH \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "navDate-index",
                "KeySchema": [
                    {"AttributeName": "navDate", "KeyType": "HASH"},
                    {"AttributeName": "runId", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "status-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "navDate", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]' \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-nav-runs created successfully"
else
    echo "! Table aifm-nav-runs may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Table 4: aifm-fund-config
# Stores fund configurations
# PK: fundId
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-fund-config..."

aws dynamodb create-table \
    --table-name aifm-fund-config \
    --attribute-definitions \
        AttributeName=fundId,AttributeType=S \
        AttributeName=status,AttributeType=S \
    --key-schema \
        AttributeName=fundId,KeyType=HASH \
    --global-secondary-indexes \
        '[
            {
                "IndexName": "status-index",
                "KeySchema": [
                    {"AttributeName": "status", "KeyType": "HASH"},
                    {"AttributeName": "fundId", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]' \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-fund-config created successfully"
else
    echo "! Table aifm-fund-config may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "============================================================="
echo "Table creation complete!"
echo ""
echo "Tables created:"
echo "  - aifm-nav-records     (NAV history)"
echo "  - aifm-nav-approvals   (Approval workflow)"
echo "  - aifm-nav-runs        (Run logs)"
echo "  - aifm-fund-config     (Fund configuration)"
echo ""
echo "Global Secondary Indexes created on each table:"
echo "  - navDate-index        (Query by date)"
echo "  - status-index         (Query by status)"
echo ""
echo "Next steps:"
echo "  1. Update ECS task role with DynamoDB permissions"
echo "  2. Add environment variables to .env.local"
echo "============================================================="
