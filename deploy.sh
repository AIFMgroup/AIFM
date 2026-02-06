#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     AIFM Frontend - AWS CodeBuild Deploy           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
S3_BUCKET="aifm-codebuild-source"
PROJECT_NAME="aifm-frontend-build"
REGION="eu-north-1"

# Navigate to project directory
cd "$(dirname "$0")"

echo -e "${YELLOW}📦 Packaging source code...${NC}"

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
SOURCE_ZIP="$TEMP_DIR/source.zip"

# Create zip file excluding unnecessary files
zip -r "$SOURCE_ZIP" . \
  -x "*.git*" \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "*.env*" \
  -x "*.DS_Store" \
  -x "apps/web/node_modules/*" \
  -x "apps/web/.next/*" \
  -x "packages/*/node_modules/*" \
  > /dev/null

echo -e "${GREEN}✓ Source packaged ($(du -h "$SOURCE_ZIP" | cut -f1))${NC}"

echo -e "${YELLOW}☁️  Uploading to S3...${NC}"

# Upload to S3
aws s3 cp "$SOURCE_ZIP" "s3://$S3_BUCKET/source.zip" --region "$REGION" > /dev/null

echo -e "${GREEN}✓ Uploaded to s3://$S3_BUCKET/source.zip${NC}"

# Cleanup temp directory
rm -rf "$TEMP_DIR"

echo -e "${YELLOW}🚀 Starting CodeBuild...${NC}"

# Start the build
BUILD_ID=$(aws codebuild start-build \
  --project-name "$PROJECT_NAME" \
  --region "$REGION" \
  --query 'build.id' \
  --output text)

echo -e "${GREEN}✓ Build started: ${BUILD_ID}${NC}"
echo ""
echo -e "${BLUE}📊 Build Progress:${NC}"
echo -e "   Console: https://${REGION}.console.aws.amazon.com/codesuite/codebuild/projects/${PROJECT_NAME}/build/${BUILD_ID}"
echo ""

# Monitor build progress
echo -e "${YELLOW}⏳ Waiting for build to complete...${NC}"
echo ""

while true; do
  BUILD_STATUS=$(aws codebuild batch-get-builds \
    --ids "$BUILD_ID" \
    --region "$REGION" \
    --query 'builds[0].buildStatus' \
    --output text)
  
  BUILD_PHASE=$(aws codebuild batch-get-builds \
    --ids "$BUILD_ID" \
    --region "$REGION" \
    --query 'builds[0].currentPhase' \
    --output text)
  
  case $BUILD_STATUS in
    "IN_PROGRESS")
      echo -ne "\r   Status: ${YELLOW}$BUILD_STATUS${NC} | Phase: ${BLUE}$BUILD_PHASE${NC}          "
      sleep 5
      ;;
    "SUCCEEDED")
      echo ""
      echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}║  ✓ BUILD SUCCEEDED!                                ║${NC}"
      echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
      echo ""
      echo -e "${BLUE}🌐 Site: https://d31zvrvfawczta.cloudfront.net${NC}"
      echo ""
      break
      ;;
    "FAILED"|"FAULT"|"STOPPED"|"TIMED_OUT")
      echo ""
      echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
      echo -e "${RED}║  ✗ BUILD FAILED: $BUILD_STATUS                     ║${NC}"
      echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
      echo ""
      echo -e "Check logs: https://${REGION}.console.aws.amazon.com/codesuite/codebuild/projects/${PROJECT_NAME}/build/${BUILD_ID}/log"
      exit 1
      ;;
  esac
done
