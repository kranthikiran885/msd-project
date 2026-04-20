# MSD Platform - Complete Setup & Testing Guide

## Overview

This guide covers the complete setup, integration, and testing of the MSD Platform with all 12 phases (10-21) implemented with production-grade code.

## Prerequisites

- Node.js 18+ 
- npm or pnpm
- Docker (for containerized deployment)
- MongoDB (local or Atlas)
- Redis (optional, for caching)
- Git

## Quick Start

### 1. Installation

```bash
# Clone and navigate to project
cd /vercel/share/v0-project

# Install all dependencies
npm run install:all

# Or install manually
npm install
cd server && npm install && cd ..
```

### 2. Environment Setup

Create `.env.development` and `.env.production` files:

```bash
# Backend Configuration
BACKEND_URL=http://localhost:3001
MONGODB_URI=mongodb://localhost:27017/msd-platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
GITHUB_OAUTH_ID=your-github-app-id
GITHUB_OAUTH_SECRET=your-github-app-secret

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_ENVIRONMENT=development

# Deployment
NODE_ENV=development
DOCKER_REGISTRY=your-registry
AWS_REGION=us-east-1
```

### 3. Start Services

```bash
# Option 1: Development mode (both services)
npm run dev:full

# Option 2: Individual services
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev
```

### 4. Verify Health

```bash
# Check service health
npm run health-check

# Continuous monitoring
npm run health-check:watch
```

## Testing

### Integration Tests

Run comprehensive E2E tests covering all 12 phases:

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm test -- tests/integration.test.js --grep "Phase 10"

# Watch mode for development
npm test -- --watch
```

### Performance Testing

Test system performance, latency, and stress:

```bash
# Run performance tests
npm run test:performance

# Results include:
# - Load testing with varying concurrency
# - Latency percentiles (p95, p99)
# - Stress testing (gradual load increase)
# - Payload size analysis
# - Bottleneck identification
```

### Full Test Suite

```bash
# Run all tests with coverage
npm run test:all

# Generate coverage report
npm test -- --coverage
```

### Automated Test Execution

```bash
# Run complete test suite with detailed report
npm run test:run

# Outputs:
# - test-report-TIMESTAMP.json
# - test-execution-TIMESTAMP.log
# - Detailed test results for all 12 phases
```

## Phase Implementation Status

### Phase 10: Zero-Downtime Deployments ✅
- Blue-green deployment service
- Canary release engine
- Health check monitoring
- Rollback capability
- Tests: Deployment flow, traffic switching, version history

### Phase 11: Auto Scaling Engine ✅
- Intelligent metric-based scaling
- Cooldown periods
- Replica limit enforcement
- Scaling event history
- Tests: Policy creation, metrics collection, scaling events

### Phase 12: Advanced Load Balancing ✅
- 5 load balancing strategies
- Health checking service
- Session persistence (sticky routing)
- Upstream registration
- Tests: Load balancer config, health checks, session affinity

### Phase 13: Persistent Storage & Volumes ✅
- Volume lifecycle management
- Snapshot creation and management
- Incremental backup support
- Point-in-time recovery
- Tests: Volume creation, snapshots, backups

### Phase 14: Database as a Service ✅
- Multi-engine support (PostgreSQL, MySQL, MongoDB, Redis)
- Read replicas and Multi-AZ
- Automated backups (7-35 days)
- Instance scaling
- Tests: Database creation, backups, restore

### Phase 15: Secrets Management ✅
- AES-256 encryption
- Automatic rotation policies
- Environment-specific secrets
- Audit trail
- Tests: Secret creation, encryption, rotation

### Phase 16: Custom Domains + SSL ✅
- Domain verification (DNS/HTTP)
- Let's Encrypt integration
- Automatic renewal (30 days before expiry)
- Wildcard support
- Tests: Domain setup, SSL certification, renewal

### Phase 17: Observability System ✅
- Multi-channel alerts (email, Slack, PagerDuty)
- Alert acknowledgment tracking
- Severity levels
- Audit logging
- Tests: Alert creation, log retrieval, notifications

### Phase 18: CI/CD Advanced Pipeline ✅
- Multi-stage builds
- Pipeline triggers (push, PR, tag, schedule, manual)
- Conditional execution
- Artifact management
- Tests: Pipeline creation, build execution, deployment

### Phase 19: Multi-Tenancy + Billing ✅
- 4 billing tiers (Free, Starter, Professional, Enterprise)
- Usage-based metering
- Automatic overage billing
- Invoice generation
- Tests: Plan management, usage tracking, invoicing

### Phase 20: Global Edge (Multi-Region) ✅
- Multi-cloud support (AWS, GCP, Azure, Cloudflare)
- 5 available regions
- Automatic failover
- Latency-based routing
- Tests: Multi-region deployment, failover, CDN

### Phase 21: Platform Intelligence ✅
- Performance analysis
- Anomaly detection
- 30-day forecasting
- Cost optimization
- Tests: Insights generation, forecast accuracy, anomaly detection

## API Endpoints Reference

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Phase 10: Deployments
- `POST /api/deployments` - Create deployment
- `GET /api/deployments/:id` - Get deployment
- `POST /api/deployments/:id/rollback` - Rollback deployment
- `GET /api/bluegreen` - Blue-green status
- `POST /api/canary` - Create canary release

### Phase 11: Auto Scaling
- `POST /api/autoscaling` - Create scaling policy
- `GET /api/autoscaling` - List policies
- `GET /api/metrics/deployment/:id/summary` - Get metrics

### Phase 12: Load Balancing
- `POST /api/loadbalancer` - Create load balancer
- `GET /api/loadbalancer/:id/health` - Health status
- `POST /api/loadbalancer/:id/upstreams` - Add upstream

### Phase 13: Storage
- `POST /api/storage/volumes` - Create volume
- `POST /api/storage/volumes/:id/snapshot` - Create snapshot
- `GET /api/storage/volumes/:id/snapshots` - List snapshots

### Phase 14: Databases
- `POST /api/databases` - Create database
- `POST /api/databases/:id/backup` - Create backup
- `GET /api/databases/:id/backups` - List backups

### Phase 15: Secrets
- `POST /api/secrets` - Create secret
- `GET /api/secrets` - List secrets
- `POST /api/secrets/:id/rotate` - Rotate secret

### Phase 16: Domains
- `POST /api/domains` - Add domain
- `POST /api/domains/:id/verify` - Verify domain
- `GET /api/domains/:id/ssl` - SSL status

### Phase 17: Observability
- `POST /api/alerts` - Create alert
- `GET /api/alerts` - List alerts
- `GET /api/logs` - Get logs

### Phase 18: CI/CD
- `POST /api/cipeline` - Create pipeline
- `POST /api/cipeline/:id/trigger` - Trigger build
- `GET /api/cipeline/:id/history` - Build history

### Phase 19: Billing
- `GET /api/billing` - Get current plan
- `POST /api/billing/plan` - Update plan
- `GET /api/billing/invoices` - Get invoices

### Phase 20: Multi-Region
- `GET /api/regions` - List regions
- `GET /api/regions/status/:projectId` - Regional status

### Phase 21: Intelligence
- `GET /api/intelligence/insights/:projectId` - Get insights
- `GET /api/intelligence/forecasts/:projectId` - Get forecasts
- `GET /api/intelligence/anomalies/:projectId` - Detect anomalies

## Deployment

### Development

```bash
# Start dev environment
npm run dev:full

# Run health checks
npm run health-check

# Run tests
npm run test:all
```

### Production

```bash
# Dry run (test deployment without changes)
npm run deploy:dry-run

# Deploy to production
npm run deploy:prod

# Deploy to staging
npm run deploy:staging
```

### Docker Deployment

```bash
# Build Docker image
docker build -t msd-platform:latest .

# Run container
docker run -d \
  -p 3001:3001 \
  -p 5000:5000 \
  --env-file .env.production \
  msd-platform:latest

# Check logs
docker logs -f <container-id>
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Monitor deployment
kubectl get pods
kubectl logs -f deployment/msd-platform

# Rollback if needed
kubectl rollout undo deployment/msd-platform
```

## Monitoring & Observability

### Health Checks

```bash
# Single health check
npm run health-check

# Continuous monitoring (updates every 30s)
npm run health-check:watch

# Check specific services
curl http://localhost:3001/health
curl http://localhost:5000/health
```

### Logs

```bash
# View frontend logs
npm run dev

# View backend logs
npm run dev:backend

# Filter logs by level
npm test -- tests/integration.test.js 2>&1 | grep ERROR
```

### Metrics & Analytics

Access the dashboard at `http://localhost:5000/dashboard`

- Deployment trends
- System performance (CPU, memory, disk)
- Project health status
- Recent activity
- Active alerts

## Troubleshooting

### Service Won't Start

```bash
# Check if ports are in use
lsof -i :3001  # Backend
lsof -i :5000  # Frontend

# Kill process using port
kill -9 <PID>

# Restart services
npm run dev:full
```

### Database Connection Issues

```bash
# Verify MongoDB is running
mongo --eval "db.adminCommand('ping')"

# Check connection string in .env
MONGODB_URI=mongodb://localhost:27017/msd-platform

# Restart MongoDB if needed
brew services restart mongodb-community
```

### Health Check Failures

```bash
# Check individual services
curl -v http://localhost:3001/health
curl -v http://localhost:5000/health

# View detailed logs
npm run health-check

# Check firewall/network
netstat -an | grep 3001
netstat -an | grep 5000
```

### Test Failures

```bash
# Run tests with verbose output
npm test -- --verbose

# Check specific test logs
npm test -- tests/integration.test.js --grep "Auth"

# Clear test cache
npm test -- --clearCache
```

## Performance Optimization

### For Phase 10-12 (Deployments & Load Balancing)
- Enable Docker layer caching
- Use multi-stage builds
- Implement connection pooling
- Enable gzip compression

### For Phase 13-14 (Storage & Databases)
- Use read replicas for databases
- Implement caching layer (Redis)
- Optimize query indexes
- Use SSD for storage

### For Phase 15-16 (Secrets & Domains)
- Cache secret lookups
- Pre-generate SSL certificates
- Use CDN for domain resolution
- Implement certificate pinning

### For Phase 17-21 (Observability, CI/CD, Billing, Global Edge, Intelligence)
- Stream logs instead of buffering
- Compress artifacts
- Use edge caching for analytics
- Implement intelligent routing

## Security Best Practices

- Store secrets in environment variables (never in code)
- Use HTTPS/TLS for all communications
- Implement rate limiting on public endpoints
- Enable CORS only for trusted origins
- Regular security audits and penetration testing
- Keep dependencies updated

## Support & Documentation

- GitHub: https://github.com/kranthikiran885/msd-project
- Issues: Create detailed bug reports with logs
- Discussions: Use GitHub discussions for questions
- Docs: See DOCUMENTATION_INDEX.md for comprehensive guides

## Next Steps

1. ✅ Complete setup and installation
2. ✅ Run health checks
3. ✅ Execute test suite
4. ✅ Review test results
5. ✅ Deploy to staging
6. ✅ Run performance tests in staging
7. ✅ Deploy to production
8. ✅ Monitor production environment
9. ✅ Implement monitoring dashboards
10. ✅ Set up alerting and notifications

---

**Last Updated:** April 20, 2026  
**Version:** 1.0.0  
**Status:** Production Ready
