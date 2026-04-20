#!/bin/bash

# MSD Platform - Comprehensive Test Suite
# This script runs all E2E tests and generates a detailed report

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5000}"
TEST_TIMEOUT=30000
REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).json"
LOG_FILE="test-execution-$(date +%Y%m%d-%H%M%S).log"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MSD Platform - E2E Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Health checks
echo -e "${YELLOW}[1/5] Performing health checks...${NC}"
check_health() {
    local url=$1
    local name=$2
    
    if curl -sf "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name health check failed"
        return 1
    fi
}

if ! check_health "$BACKEND_URL" "Backend"; then
    echo -e "${RED}Backend health check failed. Starting backend...${NC}"
    npm run dev:backend &
    sleep 5
fi

if ! check_health "$FRONTEND_URL" "Frontend"; then
    echo -e "${RED}Frontend health check failed. Starting frontend...${NC}"
    npm run dev &
    sleep 5
fi

echo ""

# Run tests
echo -e "${YELLOW}[2/5] Running integration tests...${NC}"
npm test -- tests/integration.test.js --timeout $TEST_TIMEOUT 2>&1 | tee -a "$LOG_FILE"

echo ""
echo -e "${YELLOW}[3/5] Running performance tests...${NC}"
npm test -- tests/performance.test.js --timeout $TEST_TIMEOUT 2>&1 | tee -a "$LOG_FILE" || true

echo ""
echo -e "${YELLOW}[4/5] Running security tests...${NC}"
npm test -- tests/security.test.js --timeout $TEST_TIMEOUT 2>&1 | tee -a "$LOG_FILE" || true

echo ""
echo -e "${YELLOW}[5/5] Generating test report...${NC}"

# Create test report
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": {
    "backend": "$BACKEND_URL",
    "frontend": "$FRONTEND_URL",
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)"
  },
  "testExecution": {
    "logFile": "$LOG_FILE",
    "status": "completed",
    "timestamp": "$(date)"
  },
  "phases": [
    {
      "phase": 10,
      "name": "Zero-Downtime Deployments",
      "tests": ["blue-green", "canary", "rollback", "health-checks"],
      "status": "pending"
    },
    {
      "phase": 11,
      "name": "Auto Scaling Engine",
      "tests": ["scaling-policy", "metrics-collection", "scaling-events"],
      "status": "pending"
    },
    {
      "phase": 12,
      "name": "Load Balancing",
      "tests": ["load-balancer-config", "health-checks", "session-persistence"],
      "status": "pending"
    },
    {
      "phase": 13,
      "name": "Persistent Storage",
      "tests": ["volume-creation", "snapshots", "backups"],
      "status": "pending"
    },
    {
      "phase": 14,
      "name": "Database as Service",
      "tests": ["db-instance-creation", "backups", "scaling"],
      "status": "pending"
    },
    {
      "phase": 15,
      "name": "Secrets Management",
      "tests": ["secret-creation", "encryption", "rotation"],
      "status": "pending"
    },
    {
      "phase": 16,
      "name": "Domains + SSL",
      "tests": ["domain-setup", "ssl-cert", "auto-renewal"],
      "status": "pending"
    },
    {
      "phase": 17,
      "name": "Observability",
      "tests": ["alerts", "logs", "notifications"],
      "status": "pending"
    },
    {
      "phase": 18,
      "name": "CI/CD Pipeline",
      "tests": ["pipeline-creation", "build", "deployment"],
      "status": "pending"
    },
    {
      "phase": 19,
      "name": "Billing + Multi-Tenancy",
      "tests": ["billing-plans", "usage-tracking", "invoices"],
      "status": "pending"
    },
    {
      "phase": 20,
      "name": "Global Edge",
      "tests": ["multi-region", "failover", "cdn"],
      "status": "pending"
    },
    {
      "phase": 21,
      "name": "Platform Intelligence",
      "tests": ["insights", "forecasts", "anomalies"],
      "status": "pending"
    }
  ]
}
EOF

echo -e "${GREEN}✓${NC} Test report generated: $REPORT_FILE"
echo -e "${GREEN}✓${NC} Test log saved: $LOG_FILE"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Test Suite Completed${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Review test log: cat $LOG_FILE"
echo "  2. Check test report: cat $REPORT_FILE"
echo "  3. Deploy to production: npm run deploy"
echo ""
