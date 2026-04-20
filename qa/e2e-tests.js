const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * PHASES 2-4: REAL E2E TESTING WITH GITHUB REPOSITORIES
 * Tests actual deployment flow with real GitHub repos
 */

class E2ETesting {
  constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:3000';
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      passed: 0,
      failed: 0,
      issues: [],
    };
    this.testGitHubRepos = [
      {
        owner: 'facebook',
        repo: 'react',
        type: 'React',
        description: 'Popular React library'
      },
      {
        owner: 'nodejs',
        repo: 'node',
        type: 'Node.js',
        description: 'Node.js runtime'
      },
    ];
  }

  // Test 1: GitHub OAuth Login
  async testGitHubOAuth() {
    console.log('[TEST] Testing GitHub OAuth...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/auth/github`);
      
      this.logTest('GitHub OAuth Endpoint', response.status === 200 || response.status === 302, 'OAuth endpoint responsive');
      return true;
    } catch (error) {
      this.logTest('GitHub OAuth Endpoint', false, error.message);
      return false;
    }
  }

  // Test 2: Repository Fetching
  async testRepositoryFetch(token) {
    console.log('[TEST] Testing Repository Fetch...');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/projects/repos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const hasRepos = response.data && response.data.length > 0;
      this.logTest('Repository Fetch', hasRepos, `Fetched ${response.data?.length || 0} repositories`);
      return response.data;
    } catch (error) {
      this.logTest('Repository Fetch', false, error.message);
      return null;
    }
  }

  // Test 3: Deployment Creation
  async testDeploymentCreation(repoData) {
    console.log('[TEST] Testing Deployment Creation...');
    
    if (!repoData) {
      this.logTest('Deployment Creation', false, 'No repository data available');
      return null;
    }
    
    try {
      const deploymentPayload = {
        name: `test-deploy-${Date.now()}`,
        repository: `${repoData.owner}/${repoData.name}`,
        branch: repoData.default_branch || 'main',
        buildCommand: 'npm install && npm run build',
        startCommand: 'npm start',
        environment: { NODE_ENV: 'production' },
      };
      
      const response = await axios.post(
        `${this.baseUrl}/api/deployments`,
        deploymentPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const isValid = response.data && response.data.id;
      this.logTest('Deployment Creation', isValid, `Created deployment: ${response.data?.id}`);
      return response.data;
    } catch (error) {
      this.logTest('Deployment Creation', false, error.message);
      return null;
    }
  }

  // Test 4: Build Pipeline
  async testBuildPipeline(deploymentId) {
    console.log('[TEST] Testing Build Pipeline...');
    
    if (!deploymentId) {
      this.logTest('Build Pipeline', false, 'No deployment ID');
      return null;
    }
    
    try {
      // Poll deployment status
      const maxAttempts = 30; // 5 minutes with 10s intervals
      let attempt = 0;
      let deployment = null;
      
      while (attempt < maxAttempts) {
        const response = await axios.get(
          `${this.baseUrl}/api/deployments/${deploymentId}`
        );
        
        deployment = response.data;
        
        if (deployment.status === 'BUILDING') {
          console.log(`  [BUILDING] Attempt ${attempt + 1}/${maxAttempts}...`);
          await this.sleep(10000); // 10 seconds
          attempt++;
        } else {
          break;
        }
      }
      
      const buildSuccessful = deployment?.status === 'SUCCESS' || deployment?.status === 'RUNNING';
      this.logTest('Build Pipeline', buildSuccessful, `Build status: ${deployment?.status}`);
      return deployment;
    } catch (error) {
      this.logTest('Build Pipeline', false, error.message);
      return null;
    }
  }

  // Test 5: Container Execution
  async testContainerExecution(deploymentId) {
    console.log('[TEST] Testing Container Execution...');
    
    if (!deploymentId) {
      this.logTest('Container Execution', false, 'No deployment ID');
      return null;
    }
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/deployments/${deploymentId}/containers`
      );
      
      const hasRunningContainer = response.data && response.data.length > 0;
      this.logTest(
        'Container Execution',
        hasRunningContainer,
        `Running ${response.data?.length || 0} containers`
      );
      return response.data;
    } catch (error) {
      this.logTest('Container Execution', false, error.message);
      return null;
    }
  }

  // Test 6: Public URL Accessibility
  async testPublicURL(deploymentId) {
    console.log('[TEST] Testing Public URL Accessibility...');
    
    if (!deploymentId) {
      this.logTest('Public URL', false, 'No deployment ID');
      return false;
    }
    
    try {
      const deploymentResponse = await axios.get(
        `${this.baseUrl}/api/deployments/${deploymentId}`
      );
      
      const url = deploymentResponse.data?.url;
      
      if (!url) {
        this.logTest('Public URL', false, 'No URL generated');
        return false;
      }
      
      const urlResponse = await axios.get(url, { timeout: 5000 });
      this.logTest('Public URL Accessibility', urlResponse.status === 200, `URL: ${url}`);
      return true;
    } catch (error) {
      this.logTest('Public URL Accessibility', false, error.message);
      return false;
    }
  }

  // Test 7: Logs Streaming
  async testLogsStreaming(deploymentId) {
    console.log('[TEST] Testing Logs Streaming...');
    
    if (!deploymentId) {
      this.logTest('Logs Streaming', false, 'No deployment ID');
      return false;
    }
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/deployments/${deploymentId}/logs`
      );
      
      const hasLogs = response.data && Array.isArray(response.data) && response.data.length > 0;
      this.logTest('Logs Streaming', hasLogs, `Retrieved ${response.data?.length || 0} log entries`);
      return hasLogs;
    } catch (error) {
      this.logTest('Logs Streaming', false, error.message);
      return false;
    }
  }

  // Test 8: Status Updates
  async testStatusUpdates(deploymentId) {
    console.log('[TEST] Testing Status Updates...');
    
    if (!deploymentId) {
      this.logTest('Status Updates', false, 'No deployment ID');
      return false;
    }
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/deployments/${deploymentId}/status`
      );
      
      const hasValidStatus = response.data && response.data.status;
      this.logTest('Status Updates', hasValidStatus, `Status: ${response.data?.status}`);
      return hasValidStatus;
    } catch (error) {
      this.logTest('Status Updates', false, error.message);
      return false;
    }
  }

  // Test 9: Scaling Operations
  async testScaling(deploymentId) {
    console.log('[TEST] Testing Scaling Operations...');
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/autoscaling/${deploymentId}/scale`,
        { replicas: 3 }
      );
      
      this.logTest('Scaling Operations', response.status === 200, 'Scaling initiated');
      return true;
    } catch (error) {
      this.logTest('Scaling Operations', false, error.message);
      return false;
    }
  }

  // Test 10: API Rate Limiting
  async testRateLimiting() {
    console.log('[TEST] Testing Rate Limiting...');
    
    try {
      const requests = [];
      for (let i = 0; i < 105; i++) {
        requests.push(axios.get(`${this.baseUrl}/api/health`));
      }
      
      const results = await Promise.allSettled(requests);
      const rateLimited = results.some(r => r.status === 'rejected' && r.reason.response?.status === 429);
      
      this.logTest('Rate Limiting', rateLimited, 'Rate limiting enforced');
      return rateLimited;
    } catch (error) {
      this.logTest('Rate Limiting', false, error.message);
      return false;
    }
  }

  // Logging helper
  logTest(name, passed, details) {
    const status = passed ? '✓' : '✗';
    console.log(`  ${status} ${name}: ${details}`);
    
    this.results.tests.push({
      name,
      passed,
      details,
      timestamp: new Date().toISOString(),
    });
    
    if (passed) this.results.passed++;
    else this.results.failed++;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║       PHASES 2-4: END-TO-END TESTING IN PROGRESS       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // OAuth
    const oauthSuccess = await this.testGitHubOAuth();
    
    // Repository Fetch
    const repos = await this.testRepositoryFetch('test-token');
    
    // Deployment Creation
    const deployment = await this.testDeploymentCreation(repos?.[0]);
    
    if (deployment) {
      // Build Pipeline
      await this.testBuildPipeline(deployment.id);
      
      // Container Execution
      await this.testContainerExecution(deployment.id);
      
      // Public URL
      await this.testPublicURL(deployment.id);
      
      // Logs
      await this.testLogsStreaming(deployment.id);
      
      // Status
      await this.testStatusUpdates(deployment.id);
      
      // Scaling
      await this.testScaling(deployment.id);
    }
    
    // Rate Limiting
    await this.testRateLimiting();
    
    console.log(`\n✓ E2E Tests Complete`);
    console.log(`  Passed: ${this.results.passed}`);
    console.log(`  Failed: ${this.results.failed}`);
    
    return this.results;
  }
}

module.exports = E2ETesting;
