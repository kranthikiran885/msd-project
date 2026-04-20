# MSD Platform - Quick Start Guide

## 🚀 Start the Server

```bash
npm start
# Server runs on http://localhost:3000
```

---

## 📋 Key API Endpoints Reference

### Phase 10: Zero-Downtime Deployments
```bash
# Deploy with blue-green (zero downtime)
POST /api/bluegreen/deploy
{
  "deploymentId": "dep-123",
  "version": "2.0",
  "healthCheckUrl": "/health"
}

# Start canary release (10% traffic → 100%)
POST /api/canary/release
{
  "deploymentId": "dep-123",
  "canaryVersion": "2.0",
  "trafficPercentage": 10
}

# Instant rollback
POST /api/rollback/instant
{
  "deploymentId": "dep-123",
  "previousVersion": "1.0"
}
```

### Phase 11: Auto Scaling
```bash
# Create scaling policy
POST /api/autoscaling/policy
{
  "projectId": "proj-123",
  "targetCPU": 70,
  "maxReplicas": 10,
  "minReplicas": 2
}

# View scaling events
GET /api/autoscaling/events/proj-123
```

### Phase 12: Load Balancing
```bash
# Create load balancer
POST /api/loadbalancer/create
{
  "projectId": "proj-123",
  "strategy": "least-response-time",
  "upstreams": ["replica-1", "replica-2"]
}

# Change strategy
PUT /api/loadbalancer/lb-123/strategy
{
  "strategy": "ip-hash"
}
```

### Phase 13: Persistent Storage
```bash
# Create volume
POST /api/storage/volumes/create
{
  "projectId": "proj-123",
  "name": "app-data",
  "size": 100,
  "storageType": "ssd"
}

# Create snapshot
POST /api/storage/snapshots/create
{
  "volumeId": "vol-123",
  "description": "backup"
}

# Restore from snapshot
POST /api/storage/snapshots/snap-123/restore
{
  "targetVolumeId": "vol-456"
}
```

### Phase 14: Database as Service
```bash
# Create managed database
POST /api/databases/create
{
  "projectId": "proj-123",
  "engine": "postgresql",
  "instanceClass": "db.t3.small",
  "multiAZ": true
}

# Create read replica
POST /api/databases/db-123/replica
{
  "region": "eu-west-1"
}
```

### Phase 15: Secrets Management
```bash
# Store secret
POST /api/secrets/create
{
  "name": "DB_PASSWORD",
  "value": "secure-pass",
  "rotationPolicy": "monthly"
}

# Retrieve secret (decrypted)
GET /api/secrets/secret-123
```

### Phase 16: Custom Domains + SSL
```bash
# Add domain with auto-SSL
POST /api/domains/add
{
  "projectId": "proj-123",
  "domain": "myapp.com",
  "autoRenew": true
}

# Verify domain
POST /api/domains/dom-123/verify

# Generate SSL certificate (automatic)
POST /api/domains/dom-123/ssl/generate
```

### Phase 17: Observability
```bash
# Create alert
POST /api/alerts/create
{
  "projectId": "proj-123",
  "name": "High CPU",
  "metricType": "cpu",
  "threshold": 80,
  "channels": ["email", "slack"]
}

# View alert history
GET /api/alerts/proj-123/history
```

### Phase 18: CI/CD Pipeline
```bash
# Create pipeline
POST /api/pipelines/create
{
  "projectId": "proj-123",
  "stages": [
    {
      "name": "build",
      "steps": [{"name": "npm install", "script": "npm install"}]
    },
    {
      "name": "test",
      "steps": [{"name": "npm test", "script": "npm test"}]
    }
  ]
}

# Execute pipeline
POST /api/pipelines/pipe-123/execute
```

### Phase 19: Billing & Multi-Tenancy
```bash
# Upgrade plan
POST /api/billing/plan/upgrade
{
  "projectId": "proj-123",
  "newPlan": "professional"
}

# Track usage
POST /api/billing/usage/track
{
  "projectId": "proj-123",
  "deployments": 45,
  "storage": 250
}

# Get billing info
GET /api/billing/breakdown/proj-123
```

### Phase 20: Global Edge
```bash
# Deploy to multiple regions
POST /api/multiregion/deploy
{
  "projectId": "proj-123",
  "deploymentId": "dep-123",
  "targetRegions": ["us-east-1", "eu-west-1"]
}

# Failover to another region
POST /api/multiregion/failover
{
  "projectId": "proj-123",
  "fromRegion": "us-east-1",
  "toRegion": "us-west-2"
}

# List available regions
GET /api/multiregion/regions
```

### Phase 21: Platform Intelligence
```bash
# Get performance analysis
GET /api/intelligence/analyze/proj-123
# Returns: bottlenecks, recommendations

# Detect anomalies
GET /api/intelligence/anomalies/proj-123
# Returns: metric deviations, alerts

# Forecast resources
GET /api/intelligence/forecast/proj-123
# Returns: 30-day predictions, cost impact

# Cost optimization
GET /api/intelligence/optimize/proj-123
# Returns: reserved instances, spot instances, right-sizing
```

---

## 🔧 Configuration

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/msd
MONGODB_DB_NAME=msd

# Server
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key

# Cloud Providers
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
GCP_PROJECT_ID=xxx
AZURE_SUBSCRIPTION_ID=xxx

# Integrations
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

---

## 📊 Monitoring

### Health Check
```bash
GET /health
```

### Version Info
```bash
GET /version
```

### Prometheus Metrics
```bash
GET /metrics
# Basic auth required
```

---

## 🔐 Security

All endpoints require authentication (JWT token in header):
```bash
Authorization: Bearer <token>
```

---

## 📚 Documentation

- **Full Implementation Guide**: `PHASES_IMPLEMENTATION_SUMMARY.md`
- **Phase 10 Details**: `PHASE_10_IMPLEMENTATION.md`
- **Phase 11 Details**: `PHASE_11_IMPLEMENTATION.md`
- **Phase 12 Details**: `PHASE_12_IMPLEMENTATION.md`
- **Phase 13 Details**: `PHASE_13_IMPLEMENTATION.md`
- **Complete README**: `PHASES_10_21_README.md`

---

## 🚀 Common Workflows

### Deploy a New Version
1. Create deployment
2. Use blue-green or canary for zero-downtime
3. Monitor health checks
4. Rollback if needed (instant 1-click)

### Scale Application
1. Define scaling policy (CPU/Memory)
2. Set min/max replicas
3. Load balancer distributes traffic
4. Auto-scale reacts to metrics

### Enable Backup & Recovery
1. Create volume
2. Schedule snapshots (daily/weekly)
3. Enable automated backups
4. Restore from snapshot if needed

### Add Custom Domain
1. Add domain to project
2. Verify DNS record
3. SSL certificate auto-generated
4. Auto-renews 30 days before expiry

### Set Up Alerting
1. Create alert rule
2. Choose channels (email/Slack)
3. Set metric threshold
4. Receive notifications on trigger

### Deploy to Multiple Regions
1. Select target regions
2. Deploy simultaneously
3. Automatic failover enabled
4. Health checks per region

---

## ⚡ Performance Tips

1. **Use load balancing** with "least-response-time" strategy
2. **Enable auto-scaling** for variable workloads
3. **Use read replicas** for read-heavy databases
4. **Enable caching** with Phase 13 persistent storage
5. **Monitor metrics** using Phase 17 observability

---

## 🐛 Troubleshooting

### Deployment Failed
- Check health check endpoint responds
- Review deployment logs
- Use rollback to previous version

### High CPU
- Check auto-scaling policy thresholds
- Review application code for bottlenecks
- Use Phase 21 intelligence for recommendations

### Database Connection Issues
- Verify database instance is running
- Check security groups/firewall
- Monitor database metrics

### Domain Certificate Issues
- Verify domain DNS records
- Check domain ownership
- Review Let's Encrypt logs

---

## 📞 Support

Check API response codes:
- **200-299**: Success
- **400**: Bad request
- **401**: Unauthorized
- **403**: Forbidden
- **500**: Server error

All errors include detailed messages in response body.

---

## 🎯 Next Steps

1. ✅ Start server
2. ✅ Review Phase 10-12 features (production ready)
3. ✅ Test Phase 13-21 (development ready)
4. ✅ Configure environment variables
5. ✅ Set up monitoring and alerts
6. ✅ Deploy to production

---

**Ready to deploy! 🚀**
