#!/bin/bash

# =============================================================================
# Create DynamoDB Tables for NAV Pipeline (flows, prices, pipeline runs)
# =============================================================================

AWS_REGION=${AWS_REGION:-eu-north-1}
BILLING_MODE="PAY_PER_REQUEST"

echo "Creating DynamoDB tables for NAV Pipeline in region: $AWS_REGION"
echo "============================================================="

# -----------------------------------------------------------------------------
# Table 1: aifm-nav-flows
# Daily Sub/Red transactions (subscriptions/redemptions)
# PK: DATE#YYYY-MM-DD
# SK: FLOW#<timestamp>-<idx>
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-nav-flows..."

aws dynamodb create-table \
    --table-name aifm-nav-flows \
    --attribute-definitions \
        AttributeName=pk,AttributeType=S \
        AttributeName=sk,AttributeType=S \
    --key-schema \
        AttributeName=pk,KeyType=HASH \
        AttributeName=sk,KeyType=RANGE \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-nav-flows created successfully"
else
    echo "! Table aifm-nav-flows may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Table 2: aifm-nav-prices
# Imported NAV prices (from CSV/XLS)
# PK: DATE#YYYY-MM-DD
# SK: PRICE#<fundId>#<shareClassId>
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-nav-prices..."

aws dynamodb create-table \
    --table-name aifm-nav-prices \
    --attribute-definitions \
        AttributeName=pk,AttributeType=S \
        AttributeName=sk,AttributeType=S \
    --key-schema \
        AttributeName=pk,KeyType=HASH \
        AttributeName=sk,KeyType=RANGE \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-nav-prices created successfully"
else
    echo "! Table aifm-nav-prices may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Table 3: aifm-nav-pipeline
# Pipeline run tracking
# PK: DATE#YYYY-MM-DD
# SK: RUN#<timestamp>
# -----------------------------------------------------------------------------

echo ""
echo "Creating table: aifm-nav-pipeline..."

aws dynamodb create-table \
    --table-name aifm-nav-pipeline \
    --attribute-definitions \
        AttributeName=pk,AttributeType=S \
        AttributeName=sk,AttributeType=S \
    --key-schema \
        AttributeName=pk,KeyType=HASH \
        AttributeName=sk,KeyType=RANGE \
    --billing-mode $BILLING_MODE \
    --region $AWS_REGION \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Table aifm-nav-pipeline created successfully"
else
    echo "! Table aifm-nav-pipeline may already exist or failed to create"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo "============================================================="
echo "NAV Pipeline tables created!"
echo ""
echo "Tables:"
echo "  - aifm-nav-flows      (Daily Sub/Red transactions)"
echo "  - aifm-nav-prices     (Imported NAV prices)"
echo "  - aifm-nav-pipeline   (Pipeline run tracking)"
echo ""
echo "Next steps:"
echo "  1. Run this script: bash scripts/create-nav-pipeline-tables.sh"
echo "  2. Update ECS task role with DynamoDB permissions for new tables"
echo "  3. Set environment variables if using custom table names:"
echo "     NAV_FLOWS_TABLE, NAV_PRICES_TABLE, NAV_PIPELINE_TABLE"
echo "============================================================="
