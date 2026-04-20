# QA System - Quick Start Guide

## 30 Second Setup

```bash
# 1. Ensure dependencies are installed
npm install

# 2. Start the application
npm run dev:full

# 3. Run QA system in another terminal
npm run qa:full

# 4. View the report
npm run qa:report
```

## What Gets Tested

### Phase 1: System Audit ✓
- Analyzes backend services, models, routes
- Checks Docker/Kubernetes configuration
- Validates error handling coverage

### Phase 2-4: E2E Testing ✓
- Tests GitHub OAuth login
- Validates real repository deployments
- Checks deployment build pipeline
- Verifies container execution
- Confirms public URLs work

### Phase 5: Failure Testing ✓
- Invalid repository handling
- Build failure recovery
- Resource limits enforcement
- Concurrent deployment handling

### Phase 6: Performance Testing ✓
- API response time (target: <500ms)
- Concurrent request handling (50+)
- High throughput testing (100+ RPS)
- Load under sustained conditions

### Phase 7: Security Testing ✓
- Unauthorized access prevention
- SQL injection protection
- XSS attack prevention
- CSRF protection

### Phase 8: Auto-Fix ✓
- Detects and fixes missing error handling
- Adds authentication middleware
- Fixes Docker security issues
- Configures Kubernetes probes

### Phase 9: GitHub Integration ✓
- Creates feature branch
- Commits fixes with details
- Pushes to remote
- Opens draft PR (optional)

### Phase 10: Report Generation ✓
- JSON report for automation
- Markdown report for docs
- HTML interactive dashboard

## Key Commands

```bash
# Full system (all 10 phases)
npm run qa:full

# Just the audit
npm run qa:audit

# Just E2E tests
npm run qa:e2e

# Just security tests
npm run qa:security

# Just performance tests
npm run qa:performance

# Fast mode (reduced testing)
npm run qa:fast

# View latest report
npm run qa:report
```

## Reading the Results

Each run generates:

1. **Health Score** (0-100)
   - 85+: Excellent
   - 75-84: Good
   - 60-74: Fair
   - <60: Needs work

2. **Deployment Success Rate**
   - Target: 95%+

3. **Issues Found & Fixed**
   - List of detected problems
   - Automatic fixes applied

4. **Recommendations**
   - Priority: CRITICAL, HIGH, MEDIUM
   - Actionable items

## Reports Location

After running QA:
```
qa/reports/
├── qa-report-{timestamp}.json
├── qa-report-{timestamp}.md
└── qa-report-{timestamp}.html
```

View the HTML report in your browser for interactive dashboard.

## Environment Variables

Optional but recommended:

```bash
# For GitHub operations
export GITHUB_TOKEN=your_token

# API URL (defaults to http://localhost:3000)
export API_URL=http://your-api.com
```

## Troubleshooting

**Tests failing?**
1. Make sure API is running: `npm run dev:full`
2. Check database connection
3. Wait for services to fully start

**Reports not generated?**
1. Check `qa/reports/` directory exists
2. Verify disk space available
3. Check file permissions

**Auto-fix not working?**
1. Ensure Git is configured
2. Check file write permissions
3. Verify GITHUB_TOKEN if pushing

## Next Steps

1. **Review the full guide:** `QA_SYSTEM_GUIDE.md`
2. **Integrate with CI/CD:** Add to GitHub Actions
3. **Run weekly:** Schedule automated audits
4. **Monitor health:** Track score trends
5. **Act on recommendations:** Implement fixes

## Full Documentation

- **Detailed Guide:** [QA_SYSTEM_GUIDE.md](./QA_SYSTEM_GUIDE.md)
- **Implementation Status:** [QA_SYSTEM_COMPLETE.md](./QA_SYSTEM_COMPLETE.md)

---

**Status:** Ready to use ✓

Start with: `npm run qa:full`
