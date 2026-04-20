const fs = require('fs');
const path = require('path');

/**
 * PHASE 10: FINAL REPORT GENERATION
 * Generates comprehensive QA reports
 */

class ReportGenerator {
  constructor(allResults) {
    this.allResults = allResults;
    this.reportDir = path.join('/vercel/share/v0-project/qa/reports');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async generateComprehensiveReport() {
    console.log('\n[REPORT] Generating comprehensive QA report...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      detailedResults: this.generateDetailedResults(),
      recommendations: this.generateRecommendations(),
      metrics: this.generateMetrics(),
    };
    
    // Save as JSON
    const jsonPath = path.join(this.reportDir, `qa-report-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    // Save as markdown
    const mdPath = path.join(this.reportDir, `qa-report-${Date.now()}.md`);
    fs.writeFileSync(mdPath, this.generateMarkdownReport(report));
    
    // Save as HTML
    const htmlPath = path.join(this.reportDir, `qa-report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, this.generateHTMLReport(report));
    
    console.log(`✓ Report saved as:`);
    console.log(`  - JSON: ${jsonPath}`);
    console.log(`  - Markdown: ${mdPath}`);
    console.log(`  - HTML: ${htmlPath}`);
    
    return report;
  }

  generateSummary() {
    const audit = this.allResults.phases.audit || {};
    const e2e = this.allResults.phases.e2e || {};
    const security = this.allResults.phases.security || {};
    const performance = this.allResults.phases.performance || {};
    const fixes = this.allResults.phases.fixes || {};
    
    return {
      timestamp: new Date().toISOString(),
      systemHealthScore: this.allResults.healthScore,
      deploymentSuccessRate: this.allResults.deploymentSuccessRate,
      totalIssuesFound: (audit.issues || []).length,
      totalBugsFixed: fixes.totalFixed || 0,
      testsSummary: {
        e2eTests: e2e.tests?.length || 0,
        e2ePassed: e2e.passed || 0,
        securityTests: (security.securityTests || []).length,
        failureTests: (security.failureTests || []).length,
        performanceTests: performance.loadTests?.length || 0,
      },
      status: this.allResults.healthScore >= 75 ? 'HEALTHY' : 'NEEDS_ATTENTION',
    };
  }

  generateDetailedResults() {
    return {
      phase1Audit: {
        issues: this.allResults.phases.audit?.issues || [],
        servicesAnalyzed: this.allResults.phases.audit?.phases?.[0]?.details?.services,
        modelsAnalyzed: this.allResults.phases.audit?.phases?.[0]?.details?.models,
      },
      phase2To4E2E: {
        tests: this.allResults.phases.e2e?.tests || [],
        passed: this.allResults.phases.e2e?.passed || 0,
        failed: this.allResults.phases.e2e?.failed || 0,
      },
      phase5And7Security: {
        securityTests: this.allResults.phases.security?.securityTests || [],
        failureTests: this.allResults.phases.security?.failureTests || [],
      },
      phase6Performance: {
        loadTests: this.allResults.phases.performance?.loadTests || [],
        stressTests: this.allResults.phases.performance?.stressTests || [],
        metrics: this.allResults.phases.performance?.metrics || {},
      },
      phase8Fixes: {
        totalFixed: this.allResults.phases.fixes?.totalFixed || 0,
        fixedIssues: this.allResults.phases.fixes?.fixedIssues || [],
      },
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const healthScore = this.allResults.healthScore;
    const issues = this.allResults.phases.audit?.issues || [];
    
    // High-priority recommendations
    if (healthScore < 50) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'System Stability',
        description: 'System health score is below 50. Immediate action required.',
        actions: ['Review all failed tests', 'Implement critical fixes', 'Deploy emergency patches'],
      });
    }
    
    // Security recommendations
    const securityIssues = issues.filter(i => i.severity === 'HIGH');
    if (securityIssues.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Security Improvements',
        description: `Found ${securityIssues.length} security issues`,
        actions: securityIssues.map(i => i.fix),
      });
    }
    
    // Performance recommendations
    if (this.allResults.phases.performance?.metrics?.avgResponseTime > 500) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Performance Optimization',
        description: 'Average response time exceeds target threshold',
        actions: [
          'Optimize database queries',
          'Implement caching',
          'Review slow endpoints',
          'Consider load balancer optimization',
        ],
      });
    }
    
    return recommendations;
  }

  generateMetrics() {
    const performance = this.allResults.phases.performance?.metrics || {};
    
    return {
      apiPerformance: {
        avgResponseTime: `${performance.avgResponseTime?.toFixed(2) || 'N/A'}ms`,
        minResponseTime: `${performance.minResponseTime?.toFixed(2) || 'N/A'}ms`,
        maxResponseTime: `${performance.maxResponseTime?.toFixed(2) || 'N/A'}ms`,
      },
      throughput: {
        requestsPerSecond: `${performance.throughput?.toFixed(2) || 'N/A'} RPS`,
        errorRate: `${performance.errorRate?.toFixed(2) || 'N/A'}%`,
      },
      codeQuality: {
        issuesFound: this.allResults.phases.audit?.issues?.length || 0,
        bugsFixed: this.allResults.phases.fixes?.totalFixed || 0,
        criticalIssues: (this.allResults.phases.audit?.issues || []).filter(i => i.severity === 'CRITICAL').length,
      },
    };
  }

  generateMarkdownReport(report) {
    let md = `# MSD Platform - QA Report\n\n`;
    md += `**Generated:** ${report.timestamp}\n\n`;
    
    md += `## Executive Summary\n\n`;
    md += `- **System Health Score:** ${report.summary.systemHealthScore}/100\n`;
    md += `- **Deployment Success Rate:** ${report.summary.deploymentSuccessRate}%\n`;
    md += `- **Status:** ${report.summary.status}\n`;
    md += `- **Issues Found:** ${report.summary.totalIssuesFound}\n`;
    md += `- **Bugs Fixed:** ${report.summary.totalBugsFixed}\n\n`;
    
    md += `## Test Results\n\n`;
    md += `- **E2E Tests:** ${report.summary.testsSummary.e2ePassed}/${report.summary.testsSummary.e2eTests}\n`;
    md += `- **Security Tests:** ${report.summary.testsSummary.securityTests}\n`;
    md += `- **Failure Tests:** ${report.summary.testsSummary.failureTests}\n`;
    md += `- **Performance Tests:** ${report.summary.testsSummary.performanceTests}\n\n`;
    
    md += `## Key Metrics\n\n`;
    md += `- **Avg Response Time:** ${report.metrics.apiPerformance.avgResponseTime}\n`;
    md += `- **Throughput:** ${report.metrics.throughput.requestsPerSecond}\n`;
    md += `- **Error Rate:** ${report.metrics.throughput.errorRate}\n\n`;
    
    md += `## Recommendations\n\n`;
    report.recommendations.forEach(rec => {
      md += `### ${rec.title}\n`;
      md += `**Priority:** ${rec.priority}\n`;
      md += `${rec.description}\n\n`;
      md += `**Actions:**\n`;
      rec.actions.forEach(action => {
        md += `- ${action}\n`;
      });
      md += `\n`;
    });
    
    return md;
  }

  generateHTMLReport(report) {
    const healthScore = report.summary.systemHealthScore;
    const statusColor = healthScore >= 75 ? 'green' : healthScore >= 50 ? 'orange' : 'red';
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>MSD Platform - QA Report</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { display: inline-block; margin-right: 40px; }
    .metric-label { color: #666; font-size: 14px; }
    .metric-value { font-size: 28px; font-weight: bold; color: #333; }
    .status-${statusColor} { color: ${statusColor === 'green' ? '#10b981' : statusColor === 'orange' ? '#f59e0b' : '#ef4444'}; }
    .recommendations { margin-top: 20px; }
    .recommendation { padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; background: #f9fafb; }
    .critical { border-left-color: #ef4444; }
    .high { border-left-color: #f59e0b; }
    .medium { border-left-color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MSD Platform - QA Report</h1>
      <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="card">
      <h2>System Health Summary</h2>
      <div style="margin-top: 20px;">
        <div class="metric">
          <div class="metric-label">Health Score</div>
          <div class="metric-value status-${statusColor}">${healthScore}/100</div>
        </div>
        <div class="metric">
          <div class="metric-label">Deployment Success</div>
          <div class="metric-value">${report.summary.deploymentSuccessRate}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Issues Found</div>
          <div class="metric-value">${report.summary.totalIssuesFound}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Bugs Fixed</div>
          <div class="metric-value">${report.summary.totalBugsFixed}</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>Test Results</h2>
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px; font-weight: bold;">E2E Tests</td>
          <td style="padding: 10px;">${report.summary.testsSummary.e2ePassed}/${report.summary.testsSummary.e2eTests}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px; font-weight: bold;">Security Tests</td>
          <td style="padding: 10px;">${report.summary.testsSummary.securityTests}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px; font-weight: bold;">Performance Tests</td>
          <td style="padding: 10px;">${report.summary.testsSummary.performanceTests}</td>
        </tr>
      </table>
    </div>
    
    <div class="card">
      <h2>Performance Metrics</h2>
      <div style="margin-top: 15px;">
        <p><strong>Average Response Time:</strong> ${report.metrics.apiPerformance.avgResponseTime}</p>
        <p><strong>Throughput:</strong> ${report.metrics.throughput.requestsPerSecond}</p>
        <p><strong>Error Rate:</strong> ${report.metrics.throughput.errorRate}</p>
      </div>
    </div>
    
    <div class="card">
      <h2>Recommendations</h2>
      <div class="recommendations">
        ${report.recommendations.map(rec => `
          <div class="recommendation ${rec.priority.toLowerCase()}">
            <strong>${rec.title}</strong> (${rec.priority})
            <p>${rec.description}</p>
            <ul style="margin-left: 20px; margin-top: 10px;">
              ${rec.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</body>
</html>
    `;
    
    return html;
  }
}

module.exports = ReportGenerator;
