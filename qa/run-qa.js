#!/usr/bin/env node

/**
 * MASTER QA EXECUTION SCRIPT
 * Runs all 10 phases of the comprehensive QA system
 * 
 * Usage: node qa/run-qa.js [--phases 1-10] [--fast] [--skip-github]
 */

const QAOrchestrator = require('./qa-orchestrator');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const options = {
    phases: '1-10',
    fast: args.includes('--fast'),
    skipGithub: args.includes('--skip-github'),
  };

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║     MSD PLATFORM - COMPREHENSIVE QA SYSTEM v1.0       ║');
  console.log('║                                                        ║');
  console.log('║  10-Phase Autonomous Validation + Repair System       ║');
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  Phases: ${options.phases}`);
  console.log(`  Fast Mode: ${options.fast}`);
  console.log(`  Skip GitHub: ${options.skipGithub}\n`);

  console.log('Starting QA execution...\n');

  const orchestrator = new QAOrchestrator();
  
  try {
    const results = await orchestrator.runCompleteAudit();
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                                                        ║');
    console.log('║            ✓ QA EXECUTION COMPLETED SUCCESSFULLY      ║');
    console.log('║                                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('Final System Status:');
    console.log(`  Health Score: ${results.healthScore}/100`);
    console.log(`  Deployment Success Rate: ${results.deploymentSuccessRate}%`);
    console.log(`  Issues Found: ${results.phases.audit?.issues?.length || 0}`);
    console.log(`  Bugs Fixed: ${results.phases.fixes?.totalFixed || 0}`);
    console.log('\n✓ Full reports available in: qa/reports/\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n[FATAL ERROR]', error.message);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
