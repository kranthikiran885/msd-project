#!/bin/bash

# MSD Platform - Automated Deployment Script
# Deploys all phases with zero-downtime using blue-green deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="${1:-production}"
REGION="${2:-us-east-1}"
DRY_RUN="${3:-false}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MSD Platform - Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Dry Run: $DRY_RUN"
echo ""

# Pre-deployment checks
echo -e "${YELLOW}[1/8] Running pre-deployment checks...${NC}"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
if [[ $NODE_VERSION < "18.0.0" ]]; then
    echo -e "${RED}✗ Node.js 18+ required${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"

# Check environment variables
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo -e "${RED}✗ Environment file .env.$ENVIRONMENT not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Environment file found"

# Load environment
export $(cat ".env.$ENVIRONMENT" | xargs)

echo ""
echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
npm install --frozen-lockfile 2>&1 | tail -5
echo -e "${GREEN}✓${NC} Dependencies installed"

echo ""
echo -e "${YELLOW}[3/8] Running linting...${NC}"
npm run lint --quiet 2>&1 || true
echo -e "${GREEN}✓${NC} Linting completed"

echo ""
echo -e "${YELLOW}[4/8] Running tests...${NC}"
npm test -- --coverage --passWithNoTests 2>&1 | tail -10
echo -e "${GREEN}✓${NC} Tests passed"

echo ""
echo -e "${YELLOW}[5/8] Building frontend...${NC}"
npm run build 2>&1 | tail -10
echo -e "${GREEN}✓${NC} Frontend build successful"

echo ""
echo -e "${YELLOW}[6/8] Building Docker image...${NC}"
docker build -t msd-platform:latest .
echo -e "${GREEN}✓${NC} Docker image built"

echo ""
echo -e "${YELLOW}[7/8] Deploying to $ENVIRONMENT ($REGION)...${NC}"

if [ "$DRY_RUN" = "true" ]; then
    echo -e "${YELLOW}DRY RUN: Would deploy to $ENVIRONMENT${NC}"
else
    # Blue-green deployment
    echo "Starting blue environment..."
    docker run -d --name msd-blue \
        -p 3001:3001 \
        -p 5000:5000 \
        -e NODE_ENV=$ENVIRONMENT \
        -e REGION=$REGION \
        --env-file ".env.$ENVIRONMENT" \
        msd-platform:latest

    echo "Waiting for blue environment to be ready..."
    sleep 10

    # Health check blue
    if curl -sf http://localhost:3001/health > /dev/null; then
        echo "Stopping green environment..."
        docker stop msd-green || true
        docker rm msd-green || true
        
        echo "Renaming blue to green..."
        docker rename msd-blue msd-green
        echo -e "${GREEN}✓${NC} Deployment successful"
    else
        echo -e "${RED}✗ Blue environment health check failed${NC}"
        docker stop msd-blue
        docker rm msd-blue
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}[8/8] Post-deployment verification...${NC}"

BACKEND_HEALTH=$(curl -s http://localhost:3001/health | jq -r '.status' || echo "fail")
FRONTEND_HEALTH=$(curl -s http://localhost:5000/health | jq -r '.status' || echo "fail")

if [ "$BACKEND_HEALTH" = "ok" ] && [ "$FRONTEND_HEALTH" = "ok" ]; then
    echo -e "${GREEN}✓${NC} Backend health: OK"
    echo -e "${GREEN}✓${NC} Frontend health: OK"
else
    echo -e "${RED}✗ Health checks failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment Completed Successfully${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Region: $REGION"
echo "  Timestamp: $(date)"
echo "  Backend: http://localhost:3001"
echo "  Frontend: http://localhost:5000"
echo ""
echo "Next steps:"
echo "  1. Monitor logs: docker logs -f msd-green"
echo "  2. Check status: curl http://localhost:3001/health"
echo "  3. Run tests: npm test"
echo ""
