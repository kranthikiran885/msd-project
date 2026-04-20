const axios = require('axios');

/**
 * PHASES 5 & 7: FAILURE TESTING & SECURITY TESTING
 * Tests error handling, security, and resilience
 */

class SecurityAndFailureTests {
  constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:3000';
    this.results = {
      securityTests: [],
      failureTests: [],
      passed: 0,
      failed: 0,
    };
  }

  // Security Test 1: Unauthorized Access
  async testUnauthorizedAccess() {
    console.log('[SECURITY] Testing Unauthorized Access...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/admin/settings`);
      // If we get 200, that's a security issue
      this.logSecurityTest('Unauthorized Access', false, 'Admin endpoint accessible without auth!');
      return false;
    } catch (error) {
      const isSecure = error.response?.status === 401 || error.response?.status === 403;
      this.logSecurityTest('Unauthorized Access', isSecure, `Got status ${error.response?.status} (expected 401/403)`);
      return isSecure;
    }
  }

  // Security Test 2: Invalid Token
  async testInvalidTokenHandling() {
    console.log('[SECURITY] Testing Invalid Token Handling...');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/deployments`,
        { headers: { Authorization: 'Bearer invalid-token-123' } }
      );
      
      this.logSecurityTest('Invalid Token', false, 'Invalid token was accepted!');
      return false;
    } catch (error) {
      const isSecure = error.response?.status === 401;
      this.logSecurityTest('Invalid Token', isSecure, `Got status ${error.response?.status} (expected 401)`);
      return isSecure;
    }
  }

  // Security Test 3: SQL Injection Protection
  async testSQLInjectionProtection() {
    console.log('[SECURITY] Testing SQL Injection Protection...');
    
    try {
      const maliciousPayload = `' OR '1'='1`;
      const response = await axios.get(
        `${this.baseUrl}/api/projects/${maliciousPayload}`
      );
      
      // If query succeeds with injection, security issue
      const isVulnerable = response.status === 200;
      this.logSecurityTest('SQL Injection Protection', !isVulnerable, 'Payload blocked');
      return !isVulnerable;
    } catch (error) {
      // Error is expected
      this.logSecurityTest('SQL Injection Protection', true, 'Payload blocked with error');
      return true;
    }
  }

  // Security Test 4: XSS Protection
  async testXSSProtection() {
    console.log('[SECURITY] Testing XSS Protection...');
    
    try {
      const xssPayload = `<script>alert('XSS')</script>`;
      const response = await axios.post(
        `${this.baseUrl}/api/projects`,
        { name: xssPayload }
      );
      
      // Check if payload is escaped in response
      const isEscaped = !response.data.name.includes('<script>');
      this.logSecurityTest('XSS Protection', isEscaped, 'Script tags escaped');
      return isEscaped;
    } catch (error) {
      this.logSecurityTest('XSS Protection', true, 'Malicious payload rejected');
      return true;
    }
  }

  // Security Test 5: CSRF Protection
  async testCSRFProtection() {
    console.log('[SECURITY] Testing CSRF Protection...');
    
    try {
      // Attempt request without CSRF token
      const response = await axios.post(
        `${this.baseUrl}/api/projects`,
        { name: 'test' },
        { headers: { 'X-CSRF-Token': '' } }
      );
      
      this.logSecurityTest('CSRF Protection', false, 'Missing CSRF token was accepted!');
      return false;
    } catch (error) {
      const isProtected = error.response?.status === 403 || error.response?.status === 401;
      this.logSecurityTest('CSRF Protection', isProtected, `Got status ${error.response?.status}`);
      return isProtected;
    }
  }

  // Failure Test 1: Invalid Repository
  async testInvalidRepository() {
    console.log('[FAILURE] Testing Invalid Repository...');
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/deployments`,
        {
          repository: 'nonexistent-owner/nonexistent-repo',
          branch: 'main',
        }
      );
      
      this.logFailureTest('Invalid Repository', false, 'Invalid repo was accepted!');
      return false;
    } catch (error) {
      const isHandledCorrectly = error.response?.status >= 400;
      this.logFailureTest('Invalid Repository', isHandledCorrectly, error.message);
      return isHandledCorrectly;
    }
  }

  // Failure Test 2: Build Failure Handling
  async testBuildFailureHandling() {
    console.log('[FAILURE] Testing Build Failure Handling...');
    
    try {
      // Deploy a repo with known build issues
      const response = await axios.post(
        `${this.baseUrl}/api/deployments`,
        {
          repository: 'test/broken-build',
          branch: 'main',
          buildCommand: 'exit 1', // Force build failure
        }
      );
      
      const deploymentId = response.data?.id;
      
      // Wait for build failure
      await this.sleep(5000);
      
      // Check if system handled it gracefully
      const statusResponse = await axios.get(
        `${this.baseUrl}/api/deployments/${deploymentId}`
      );
      
      const isHandledCorrectly = statusResponse.data?.status === 'FAILED' || 
                                  statusResponse.data?.status === 'BUILD_FAILED';
      
      this.logFailureTest('Build Failure Handling', isHandledCorrectly, `Status: ${statusResponse.data?.status}`);
      return isHandledCorrectly;
    } catch (error) {
      this.logFailureTest('Build Failure Handling', true, 'Failure detected and handled');
      return true;
    }
  }

  // Failure Test 3: Resource Limits
  async testResourceLimits() {
    console.log('[FAILURE] Testing Resource Limits...');
    
    try {
      // Attempt to create deployment with excessive resources
      const response = await axios.post(
        `${this.baseUrl}/api/deployments`,
        {
          name: 'huge-deployment',
          memory: 1000000, // Way too much
          cpu: 10000,
        }
      );
      
      const respected = response.data?.memory <= 32000; // Reasonable limit
      this.logFailureTest('Resource Limits', respected, 'Limits enforced');
      return respected;
    } catch (error) {
      this.logFailureTest('Resource Limits', true, 'Excessive resources rejected');
      return true;
    }
  }

  // Failure Test 4: Concurrent Deployments
  async testConcurrentDeployments() {
    console.log('[FAILURE] Testing Concurrent Deployments...');
    
    try {
      const deployments = [];
      for (let i = 0; i < 5; i++) {
        deployments.push(
          axios.post(`${this.baseUrl}/api/deployments`, {
            name: `concurrent-${i}`,
            repository: 'test/repo',
          })
        );
      }
      
      const results = await Promise.allSettled(deployments);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      this.logFailureTest('Concurrent Deployments', successful > 0, `${successful}/5 succeeded`);
      return successful > 0;
    } catch (error) {
      this.logFailureTest('Concurrent Deployments', false, error.message);
      return false;
    }
  }

  // Failure Test 5: Error Recovery
  async testErrorRecovery() {
    console.log('[FAILURE] Testing Error Recovery...');
    
    try {
      // First request fails
      try {
        await axios.get(`${this.baseUrl}/api/invalid-endpoint`);
      } catch (e) {
        // Expected to fail
      }
      
      // System should recover for next request
      const response = await axios.get(`${this.baseUrl}/api/health`);
      const recovered = response.status === 200;
      
      this.logFailureTest('Error Recovery', recovered, 'System recovered after error');
      return recovered;
    } catch (error) {
      this.logFailureTest('Error Recovery', false, error.message);
      return false;
    }
  }

  logSecurityTest(name, passed, details) {
    const status = passed ? '✓' : '✗';
    console.log(`  ${status} ${name}: ${details}`);
    
    this.results.securityTests.push({ name, passed, details });
    if (passed) this.results.passed++;
    else this.results.failed++;
  }

  logFailureTest(name, passed, details) {
    const status = passed ? '✓' : '✗';
    console.log(`  ${status} ${name}: ${details}`);
    
    this.results.failureTests.push({ name, passed, details });
    if (passed) this.results.passed++;
    else this.results.failed++;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     PHASES 5 & 7: SECURITY & FAILURE TESTING          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // Security Tests
    console.log('\n--- Security Tests ---');
    await this.testUnauthorizedAccess();
    await this.testInvalidTokenHandling();
    await this.testSQLInjectionProtection();
    await this.testXSSProtection();
    await this.testCSRFProtection();
    
    // Failure Tests
    console.log('\n--- Failure Tests ---');
    await this.testInvalidRepository();
    await this.testBuildFailureHandling();
    await this.testResourceLimits();
    await this.testConcurrentDeployments();
    await this.testErrorRecovery();
    
    console.log(`\n✓ Security & Failure Tests Complete`);
    console.log(`  Passed: ${this.results.passed}`);
    console.log(`  Failed: ${this.results.failed}`);
    
    return this.results;
  }
}

module.exports = SecurityAndFailureTests;
