#!/usr/bin/env node

const SystemAudit = require('./system-audit');
const E2ETesting = require('./e2e-tests');
const SecurityTests = require('./security-tests');
const PerformanceTests = require('./performance-tests');
const AutoFix = require('./auto-fix');
const GitHubIntegration = require('./github-integration');
const ReportGenerator = require('./report-generator');
const fs = require('fs');
const path = require('path');

/**
 * MASTER QA ORCHESTRATOR
 * Coordinates all testing phases and generates comprehensive reports
 */

class QAOrchestrator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      phases: {},
      summary: {},
      healthScore: 0,
      deploymentSuccessRate: 0,
    };
  }

  async executePhase1() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASE 1: SYSTEM AUDIT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const audit = new SystemAudit();
    const auditResults = await audit.runFullAudit();
    
    this.results.phases.audit = auditResults;
    return auditResults;
  }

  async executePhases2To4() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASES 2-4: E2E TESTING');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const e2e = new E2ETesting();
    const e2eResults = await e2e.runAllTests();
    
    this.results.phases.e2e = e2eResults;
    return e2eResults;
  }

  async executePhases5And7() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASES 5 & 7: SECURITY & FAILURE TESTING');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const security = new SecurityTests();
    const securityResults = await security.runAllTests();
    
    this.results.phases.security = securityResults;
    return securityResults;
  }

  async executePhase6() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASE 6: PERFORMANCE TESTING');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const performance = new PerformanceTests();
    const perfResults = await performance.runAllTests();
    
    this.results.phases.performance = perfResults;
    return perfResults;
  }

  async executePhase8() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASE 8: AUTO-FIX SYSTEM');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const autoFix = new AutoFix();
    const fixResults = await autoFix.runAutoFixes();
    
    this.results.phases.fixes = fixResults;
    return fixResults;
  }

  async executePhase9() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASE 9: GITHUB INTEGRATION & COMMIT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const github = new GitHubIntegration();
    const commitResults = await github.commitAndPushFixes(this.results.phases.fixes?.fixedIssues || []);
    
    this.results.phases.github = commitResults;
    return commitResults;
  }

  async executePhase10() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('EXECUTING PHASE 10: FINAL REPORT GENERATION');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const report = new ReportGenerator(this.results);
    const finalReport = await report.generateComprehensiveReport();
    
    this.results.finalReport = finalReport;
    return finalReport;
  }

  calculateHealthScore() {
    const auditIssues = this.results.phases.audit?.issues?.length || 0;
    const e2eTests = this.results.phases.e2e?.tests || [];
    const e2ePassRate = e2eTests.length > 0 ? (e2eTests.filter(t => t.passed).length / e2eTests.length) * 100 : 0;
    const perfTests = this.results.phases.performance?.loadTests || [];
    const perfPassRate = perfTests.length > 0 ? (perfTests.filter(t => t.passed).length / perfTests.length) * 100 : 0;
    
    // Health score: 0-100
    const issueScore = Math.max(0, 100 - (auditIssues * 5)); // Each issue -5 points
    const testScore = (e2ePassRate + perfPassRate) / 2;
    const healthScore = (issueScore * 0.4 + testScore * 0.6);
    
    this.results.healthScore = Math.round(healthScore);
    return this.results.healthScore;
  }

  calculateDeploymentSuccessRate() {
    const e2eTests = this.results.phases.e2e?.tests || [];
    if (e2eTests.length === 0) return 0;
    
    const successRate = (e2eTests.filter(t => t.passed).length / e2eTests.length) * 100;
    this.results.deploymentSuccessRate = Math.round(successRate);
    return this.results.deploymentSuccessRate;
  }

  async runCompleteAudit() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║   MSD PLATFORM - COMPREHENSIVE QA SYSTEM INITIATED    ║');
    console.log('║                                                        ║');
    console.log('║   Phases: 1-10 (Complete system validation + repair) ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    try {
      // Phase 1: System Audit
      await this.executePhase1();
      
      // Phases 2-4: E2E Testing
      await this.executePhases2To4();
      
      // Phases 5 & 7: Security & Failure Testing
      await this.executePhases5And7();
      
      // Phase 6: Performance Testing
      await this.executePhase6();
      
      // Phase 8: Auto-Fix
      await this.executePhase8();
      
      // Phase 9: GitHub Integration
      await this.executePhase9();
      
      // Phase 10: Final Report
      await this.executePhase10();
      
      // Calculate metrics
      this.calculateHealthScore();
      this.calculateDeploymentSuccessRate();
      
      // Save results
      this.saveResults();
      
      // Display summary
      this.displaySummary();
      
      return this.results;
    } catch (error) {
      console.error('\n[ERROR] QA orchestration failed:', error.message);
      process.exit(1);
    }
  }

  saveResults() {
    const resultsPath = path.join('/vercel/share/v0-project/qa/results', `qa-report-${Date.now()}.json`);
    const dir = path.dirname(resultsPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    console.log(`\n✓ Results saved to: ${resultsPath}`);
  }

  displaySummary() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    QA EXECUTION SUMMARY               ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log(`System Health Score:       ${this.results.healthScore}/100`);
    console.log(`Deployment Success Rate:   ${this.results.deploymentSuccessRate}%`);
    console.log(`Audit Issues Found:        ${this.results.phases.audit?.issues?.length || 0}`);
    console.log(`Total Bugs Fixed:          ${this.results.phases.fixes?.totalFixed || 0}`);
    console.log(`GitHub Commits Made:       ${this.results.phases.github?.commits || 0}`);
    console.log('\n✓ Full report available in: qa/results/');
  }
}

// Execute if run directly
if (require.main === module) {
  const orchestrator = new QAOrchestrator();
  orchestrator.runCompleteAudit().catch(console.error);
}

module.exports = QAOrchestrator;
