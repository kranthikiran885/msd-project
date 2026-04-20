const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * COMPREHENSIVE SYSTEM AUDIT
 * Analyzes all backend components, build system, deployment pipeline, and integration points
 */

class SystemAudit {
  constructor() {
    this.auditResults = {
      timestamp: new Date().toISOString(),
      phases: [],
      summary: {},
      issues: [],
      recommendations: [],
    };
    this.baseDir = '/vercel/share/v0-project';
  }

  // Phase 1: Codebase Analysis
  async analyzeBackendAPIs() {
    console.log('[AUDIT] Phase 1: Analyzing Backend APIs...');
    const issues = [];
    const routes = path.join(this.baseDir, 'server/routes');
    
    const routeFiles = fs.readdirSync(routes).filter(f => f.endsWith('.js'));
    
    for (const file of routeFiles) {
      const filePath = path.join(routes, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check for proper error handling
      if (!content.includes('try') && !content.includes('catch')) {
        issues.push({
          severity: 'MEDIUM',
          file: file,
          issue: 'Missing error handling in route',
          fix: 'Wrap route handlers in try-catch blocks',
        });
      }
      
      // Check for proper authentication
      if (content.includes('router.') && !content.includes('authenticate')) {
        if (!file.includes('public') && !file.includes('auth')) {
          issues.push({
            severity: 'HIGH',
            file: file,
            issue: 'Route missing authentication middleware',
            fix: 'Add authenticate middleware to protected routes',
          });
        }
      }
    }
    
    return { issues, routeFiles: routeFiles.length };
  }

  // Analyze services
  async analyzeServices() {
    console.log('[AUDIT] Analyzing Services...');
    const services = path.join(this.baseDir, 'server/services');
    const serviceFiles = fs.readdirSync(services).filter(f => f.endsWith('.js'));
    
    const issues = [];
    const coverage = {
      withLogging: 0,
      withErrorHandling: 0,
      withValidation: 0,
    };
    
    for (const file of serviceFiles) {
      const filePath = path.join(services, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (content.includes('console.log') || content.includes('logger')) {
        coverage.withLogging++;
      }
      if (content.includes('try') || content.includes('catch')) {
        coverage.withErrorHandling++;
      }
      if (content.includes('validate') || content.includes('check')) {
        coverage.withValidation++;
      }
    }
    
    return { serviceFiles: serviceFiles.length, coverage, issues };
  }

  // Analyze models
  async analyzeDataModels() {
    console.log('[AUDIT] Analyzing Data Models...');
    const models = path.join(this.baseDir, 'server/models');
    const modelFiles = fs.readdirSync(models).filter(f => f.endsWith('.js'));
    
    const issues = [];
    const modelStats = {
      total: modelFiles.length,
      withIndexes: 0,
      withValidation: 0,
      withHooks: 0,
    };
    
    for (const file of modelFiles) {
      const filePath = path.join(models, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (content.includes('index')) modelStats.withIndexes++;
      if (content.includes('validate') || content.includes('Schema')) modelStats.withValidation++;
      if (content.includes('pre(') || content.includes('post(')) modelStats.withHooks++;
    }
    
    return { modelStats, issues };
  }

  // Check Docker configuration
  async analyzeDockerSetup() {
    console.log('[AUDIT] Analyzing Docker Setup...');
    const issues = [];
    
    const dockerfilePath = path.join(this.baseDir, 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      
      if (!content.includes('HEALTHCHECK')) {
        issues.push({
          severity: 'MEDIUM',
          issue: 'Docker missing HEALTHCHECK instruction',
          fix: 'Add HEALTHCHECK to Dockerfile for container monitoring',
        });
      }
      
      if (!content.includes('USER')) {
        issues.push({
          severity: 'HIGH',
          issue: 'Docker running as root user',
          fix: 'Add USER instruction to run as non-root',
        });
      }
    }
    
    return { dockerConfigured: true, issues };
  }

  // Check Kubernetes configuration
  async analyzeKubernetesSetup() {
    console.log('[AUDIT] Analyzing Kubernetes Setup...');
    const k8sPath = path.join(this.baseDir, 'k8s');
    const issues = [];
    
    if (fs.existsSync(k8sPath)) {
      const k8sFiles = fs.readdirSync(k8sPath);
      
      for (const file of k8sFiles) {
        const filePath = path.join(k8sPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        if (!content.includes('livenessProbe') || !content.includes('readinessProbe')) {
          issues.push({
            severity: 'MEDIUM',
            file: file,
            issue: 'Missing health probes in K8s deployment',
            fix: 'Add livenessProbe and readinessProbe',
          });
        }
        
        if (!content.includes('resources:') || !content.includes('limits')) {
          issues.push({
            severity: 'MEDIUM',
            file: file,
            issue: 'Missing resource limits in K8s deployment',
            fix: 'Add CPU and memory limits',
          });
        }
      }
    }
    
    return { k8sConfigured: fs.existsSync(k8sPath), issues };
  }

  // Check deployment pipeline
  async analyzeDeploymentPipeline() {
    console.log('[AUDIT] Analyzing Deployment Pipeline...');
    const issues = [];
    
    const deploymentService = path.join(this.baseDir, 'server/services/deploymentService.js');
    if (fs.existsSync(deploymentService)) {
      const content = fs.readFileSync(deploymentService, 'utf-8');
      
      if (!content.includes('rollback')) {
        issues.push({
          severity: 'HIGH',
          issue: 'Deployment service missing rollback capability',
          fix: 'Add automatic rollback on deployment failure',
        });
      }
    }
    
    return { pipelineAnalyzed: true, issues };
  }

  // Check GitHub integration
  async analyzeGitHubIntegration() {
    console.log('[AUDIT] Analyzing GitHub Integration...');
    const issues = [];
    
    const gitService = path.join(this.baseDir, 'server/services/gitIntegrationService.js');
    if (fs.existsSync(gitService)) {
      const content = fs.readFileSync(gitService, 'utf-8');
      
      if (!content.includes('webhook') && !content.includes('push')) {
        issues.push({
          severity: 'MEDIUM',
          issue: 'GitHub integration may be missing webhook support',
          fix: 'Verify webhook endpoint implementation',
        });
      }
    }
    
    return { gitIntegrationAnalyzed: true, issues };
  }

  // Check error handling
  async analyzeErrorHandling() {
    console.log('[AUDIT] Analyzing Error Handling...');
    const controllersPath = path.join(this.baseDir, 'server/controllers');
    const issues = [];
    
    const controllers = fs.readdirSync(controllersPath).filter(f => f.endsWith('.js'));
    let totalMethods = 0;
    let withErrorHandling = 0;
    
    for (const file of controllers) {
      const filePath = path.join(controllersPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const methodMatches = content.match(/async\s+\w+\s*\(/g) || [];
      const errorHandling = content.match(/catch|throw new Error|res\.status\(4\d\d\)/g) || [];
      
      totalMethods += methodMatches.length;
      if (errorHandling.length > 0) withErrorHandling += methodMatches.length;
    }
    
    if (withErrorHandling / totalMethods < 0.8) {
      issues.push({
        severity: 'MEDIUM',
        issue: `Only ${Math.round((withErrorHandling / totalMethods) * 100)}% of methods have error handling`,
        fix: 'Add comprehensive error handling to all async methods',
      });
    }
    
    return { totalMethods, withErrorHandling, issues };
  }

  async runFullAudit() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║       PHASE 1: FULL SYSTEM AUDIT IN PROGRESS           ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    const apis = await this.analyzeBackendAPIs();
    const services = await this.analyzeServices();
    const models = await this.analyzeDataModels();
    const docker = await this.analyzeDockerSetup();
    const k8s = await this.analyzeKubernetesSetup();
    const deployment = await this.analyzeDeploymentPipeline();
    const github = await this.analyzeGitHubIntegration();
    const errorHandling = await this.analyzeErrorHandling();
    
    const allIssues = [
      ...apis.issues,
      ...docker.issues,
      ...k8s.issues,
      ...deployment.issues,
      ...github.issues,
      ...errorHandling.issues,
    ];
    
    this.auditResults.phases.push({
      name: 'Phase 1: System Audit',
      status: 'COMPLETE',
      details: {
        apiRoutes: apis.routeFiles,
        services: services.serviceFiles,
        models: models.modelStats,
        dockerConfigured: docker.dockerConfigured,
        k8sConfigured: k8s.k8sConfigured,
        errorHandlingCoverage: `${Math.round((errorHandling.withErrorHandling / errorHandling.totalMethods) * 100)}%`,
      },
    });
    
    this.auditResults.issues.push(...allIssues);
    
    console.log('\n✓ Audit Complete');
    console.log(`  Found ${allIssues.length} issues`);
    console.log(`  Critical: ${allIssues.filter(i => i.severity === 'CRITICAL').length}`);
    console.log(`  High: ${allIssues.filter(i => i.severity === 'HIGH').length}`);
    console.log(`  Medium: ${allIssues.filter(i => i.severity === 'MEDIUM').length}`);
    
    return this.auditResults;
  }
}

module.exports = SystemAudit;
