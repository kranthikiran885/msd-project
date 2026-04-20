const axios = require('axios');
const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const EventEmitter = require('events');

// Test configuration
const TEST_CONFIG = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',
  testTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Test data
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User',
};

const testProjectData = {
  name: `test-project-${Date.now()}`,
  description: 'Test project for E2E validation',
  githubRepo: 'https://github.com/vercel/next.js',
  branch: 'main',
};

// Helper functions
class TestHelper {
  static async retryRequest(fn, attempts = TEST_CONFIG.retryAttempts, delay = TEST_CONFIG.retryDelay) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.log(`[RETRY] Attempt ${i + 1}/${attempts} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  static generateUniqueId() {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static async healthCheck(url) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  static createTestLogger(suiteName) {
    return {
      log: (message) => console.log(`[${suiteName}] ${message}`),
      success: (message) => console.log(`[${suiteName}] ✅ ${message}`),
      error: (message, error) => console.error(`[${suiteName}] ❌ ${message}`, error?.message || ''),
      warning: (message) => console.warn(`[${suiteName}] ⚠️ ${message}`),
    };
  }
}

// Test Suites
describe('MSD Platform E2E Integration Tests', function () {
  this.timeout(TEST_CONFIG.testTimeout);
  let authToken = null;
  let projectId = null;
  let deploymentId = null;

  before(async function () {
    console.log('\n🚀 Starting MSD Platform E2E Tests\n');
    console.log(`Backend: ${TEST_CONFIG.backendUrl}`);
    console.log(`Frontend: ${TEST_CONFIG.frontendUrl}\n`);

    // Health checks
    const backendHealthy = await TestHelper.healthCheck(TEST_CONFIG.backendUrl);
    const frontendHealthy = await TestHelper.healthCheck(TEST_CONFIG.frontendUrl);

    if (!backendHealthy) {
      throw new Error(`❌ Backend health check failed: ${TEST_CONFIG.backendUrl}`);
    }
    if (!frontendHealthy) {
      throw new Error(`❌ Frontend health check failed: ${TEST_CONFIG.frontendUrl}`);
    }

    console.log('✅ All services healthy\n');
  });

  // Test Suite 1: Auth & GitHub Integration
  describe('1. AUTH + GITHUB INTEGRATION TEST', function () {
    const logger = TestHelper.createTestLogger('Auth');

    it('should register new user', async function () {
      logger.log('Registering new user...');
      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(`${TEST_CONFIG.backendUrl}/api/auth/register`, {
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        });
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('token');
      expect(response.data).to.have.property('user');
      expect(response.data.user.email).to.equal(testUser.email);

      authToken = response.data.token;
      logger.success(`User registered: ${testUser.email}`);
    });

    it('should login user successfully', async function () {
      logger.log('Logging in user...');
      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(`${TEST_CONFIG.backendUrl}/api/auth/login`, {
          email: testUser.email,
          password: testUser.password,
        });
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('token');
      authToken = response.data.token;
      logger.success('Login successful');
    });

    it('should retrieve GitHub repositories', async function () {
      if (!authToken) this.skip();
      logger.log('Fetching GitHub repositories...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.get(`${TEST_CONFIG.backendUrl}/api/github/repos`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      });

      expect(response.status).to.equal(200);
      expect(Array.isArray(response.data)).to.be.true;
      logger.success(`Retrieved ${response.data.length} repositories`);
    });

    it('should fetch repository branches', async function () {
      if (!authToken) this.skip();
      logger.log('Fetching repository branches...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.get(
          `${TEST_CONFIG.backendUrl}/api/github/repos/vercel/next.js/branches`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(200);
      expect(Array.isArray(response.data)).to.be.true;
      expect(response.data.length).to.be.greaterThan(0);
      logger.success(`Retrieved ${response.data.length} branches`);
    });
  });

  // Test Suite 2: Deployment Flow
  describe('2. DEPLOYMENT FLOW (CORE E2E)', function () {
    const logger = TestHelper.createTestLogger('Deployment');

    it('should create project', async function () {
      if (!authToken) this.skip();
      logger.log('Creating project...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(`${TEST_CONFIG.backendUrl}/api/projects`, testProjectData, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      projectId = response.data._id;
      logger.success(`Project created: ${projectId}`);
    });

    it('should initiate deployment', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Initiating deployment...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/deployments`,
          {
            projectId,
            branch: 'main',
            environment: 'production',
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      expect(response.data.status).to.be.oneOf(['pending', 'queued', 'building']);
      deploymentId = response.data._id;
      logger.success(`Deployment created: ${deploymentId}`);
    });

    it('should track deployment progress', async function () {
      if (!authToken || !deploymentId) this.skip();
      logger.log('Tracking deployment progress...');

      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let deployment = null;

      for (let i = 0; i < maxAttempts; i++) {
        const response = await axios.get(
          `${TEST_CONFIG.backendUrl}/api/deployments/${deploymentId}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        deployment = response.data;
        logger.log(`Status: ${deployment.status} (${i + 1}/${maxAttempts})`);

        if (['completed', 'failed', 'error'].includes(deployment.status)) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      expect(deployment).to.exist;
      expect(['completed', 'failed', 'error']).to.include(deployment.status);
      logger.success(`Deployment finished: ${deployment.status}`);
    });

    it('should have generated public URL', async function () {
      if (!authToken || !deploymentId) this.skip();
      logger.log('Verifying public URL...');

      const response = await axios.get(
        `${TEST_CONFIG.backendUrl}/api/deployments/${deploymentId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const deployment = response.data;
      expect(deployment).to.have.property('url');
      expect(deployment.url).to.include('.vercel.app');
      logger.success(`Public URL: ${deployment.url}`);
    });
  });

  // Test Suite 3: Load Balancing
  describe('3. LOAD BALANCER TEST', function () {
    const logger = TestHelper.createTestLogger('LoadBalancer');

    it('should create load balancer configuration', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Creating load balancer...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/loadbalancer`,
          {
            projectId,
            name: `lb-${TestHelper.generateUniqueId()}`,
            strategy: 'round-robin',
            healthCheck: {
              path: '/health',
              interval: 30,
              timeout: 10,
              healthyThreshold: 2,
              unhealthyThreshold: 3,
            },
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      logger.success(`Load balancer created`);
    });
  });

  // Test Suite 4: Auto Scaling
  describe('4. AUTO-SCALING TEST', function () {
    const logger = TestHelper.createTestLogger('AutoScaling');

    it('should configure scaling policy', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Configuring auto-scaling...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/autoscaling`,
          {
            projectId,
            minReplicas: 1,
            maxReplicas: 10,
            cpuThreshold: 70,
            memoryThreshold: 80,
            cooldownPeriod: 300,
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      logger.success('Auto-scaling configured');
    });

    it('should collect metrics', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Collecting metrics...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.get(
          `${TEST_CONFIG.backendUrl}/api/metrics/deployment/${projectId}/summary`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('cpuUsage');
      expect(response.data).to.have.property('memoryUsage');
      logger.success('Metrics collected successfully');
    });
  });

  // Test Suite 5: Secrets Management
  describe('5. SECRETS MANAGEMENT TEST', function () {
    const logger = TestHelper.createTestLogger('Secrets');

    it('should create secret', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Creating secret...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/secrets`,
          {
            projectId,
            key: `TEST_KEY_${Date.now()}`,
            value: 'test-secret-value',
            type: 'string',
            environment: 'production',
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      logger.success('Secret created');
    });

    it('should retrieve secrets (masked)', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Retrieving secrets...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.get(
          `${TEST_CONFIG.backendUrl}/api/secrets?projectId=${projectId}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(200);
      expect(Array.isArray(response.data)).to.be.true;
      logger.success(`Retrieved ${response.data.length} secrets`);
    });
  });

  // Test Suite 6: Domain Management
  describe('6. DOMAIN MANAGEMENT TEST', function () {
    const logger = TestHelper.createTestLogger('Domains');

    it('should add custom domain', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Adding custom domain...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/domains`,
          {
            projectId,
            domain: `test-${Date.now()}.example.com`,
            verification: 'dns',
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      logger.success('Domain added');
    });
  });

  // Test Suite 7: Observability
  describe('7. OBSERVABILITY TEST', function () {
    const logger = TestHelper.createTestLogger('Observability');

    it('should create alert', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Creating alert...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/alerts`,
          {
            projectId,
            name: `alert-${TestHelper.generateUniqueId()}`,
            metricType: 'cpu',
            threshold: 80,
            condition: 'greater_than',
            notifications: { email: true },
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property('_id');
      logger.success('Alert created');
    });

    it('should retrieve logs', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Retrieving logs...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.get(
          `${TEST_CONFIG.backendUrl}/api/logs?projectId=${projectId}&limit=100`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(200);
      expect(Array.isArray(response.data)).to.be.true;
      logger.success(`Retrieved ${response.data.length} logs`);
    });
  });

  // Test Suite 8: CI/CD Pipeline
  describe('8. CI/CD PIPELINE TEST', function () {
    const logger = TestHelper.createTestLogger('CI/CD');

    it('should create CI/CD pipeline', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Creating CI/CD pipeline...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/cipeline`,
          {
            projectId,
            name: `pipeline-${TestHelper.generateUniqueId()}`,
            triggers: ['push', 'pull_request'],
            stages: [
              { name: 'build', commands: ['npm install', 'npm run build'] },
              { name: 'test', commands: ['npm run test'] },
              { name: 'deploy', commands: ['npm run deploy'] },
            ],
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      logger.success('CI/CD pipeline created');
    });
  });

  // Test Suite 9: Storage
  describe('9. STORAGE TEST', function () {
    const logger = TestHelper.createTestLogger('Storage');

    it('should create volume', async function () {
      if (!authToken || !projectId) this.skip();
      logger.log('Creating volume...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.post(
          `${TEST_CONFIG.backendUrl}/api/storage/volumes`,
          {
            projectId,
            name: `volume-${TestHelper.generateUniqueId()}`,
            size: 10, // GB
            type: 'ssd',
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      });

      expect(response.status).to.equal(201);
      logger.success('Volume created');
    });
  });

  // Test Suite 10: Billing
  describe('10. BILLING TEST', function () {
    const logger = TestHelper.createTestLogger('Billing');

    it('should retrieve billing information', async function () {
      if (!authToken) this.skip();
      logger.log('Retrieving billing info...');

      const response = await TestHelper.retryRequest(async () => {
        return await axios.get(`${TEST_CONFIG.backendUrl}/api/billing`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('currentPlan');
      logger.success('Billing information retrieved');
    });
  });

  after(async function () {
    console.log('\n🏁 E2E Tests Completed\n');
  });
});

// Export for external use
module.exports = { TestHelper, TEST_CONFIG };
