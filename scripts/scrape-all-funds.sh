#!/bin/bash
# Master script: scrape IR documents for all funds listed in fund-manifest.txt
# Runs one company at a time, one fund at a time, logging progress.
# Usage: bash scripts/scrape-all-funds.sh 2>&1 | tee scripts/scrape-all-funds.log

set -euo pipefail
cd "$(dirname "$0")/.."

MANIFEST="scripts/fund-manifest.txt"
LOG_DIR="scripts"
TOTAL_FUNDS=$(wc -l < "$MANIFEST" | tr -d ' ')
FUND_NUM=0

echo "=========================================="
echo " AIFM Holding Document Scraper"
echo " Funds: $TOTAL_FUNDS"
echo " Started: $(date)"
echo "=========================================="

while IFS=$'\t' read -r FUND_NAME HOLDINGS_FILE COMPANY_COUNT; do
  FUND_NUM=$((FUND_NUM + 1))
  FUND_SLUG=$(echo "$FUND_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')
  FUND_LOG="${LOG_DIR}/${FUND_SLUG}-scrape.log"

  echo ""
  echo "=========================================="
  echo " Fund $FUND_NUM/$TOTAL_FUNDS: $FUND_NAME"
  echo " Holdings file: $HOLDINGS_FILE ($COMPANY_COUNT companies)"
  echo " Log: $FUND_LOG"
  echo " Time: $(date)"
  echo "=========================================="

  COMPANY_NUM=0

  while IFS= read -r COMPANY_NAME || [[ -n "$COMPANY_NAME" ]]; do
    COMPANY_NAME=$(echo "$COMPANY_NAME" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ -z "$COMPANY_NAME" ]; then
      continue
    fi

    COMPANY_NUM=$((COMPANY_NUM + 1))
    echo ""
    echo "[Fund $FUND_NUM/$TOTAL_FUNDS] [Company $COMPANY_NUM/$COMPANY_COUNT] $FUND_NAME -> $COMPANY_NAME"

    npx tsx scripts/scrape-holding-docs.ts \
      --name "$COMPANY_NAME" \
      --fundId "$FUND_SLUG" \
      2>&1 || echo "  *** Error processing $COMPANY_NAME (continuing)"

    sleep 1

  done < "scripts/$HOLDINGS_FILE"

  echo ""
  echo "  Fund $FUND_NAME complete ($COMPANY_NUM/$COMPANY_COUNT companies processed)"

done < "$MANIFEST"

echo ""
echo "=========================================="
echo " ALL FUNDS COMPLETE"
echo " Finished: $(date)"
echo "=========================================="
