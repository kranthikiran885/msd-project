#!/usr/bin/env node

/**
 * MSD Platform - Health Check Script
 * Monitors all services and generates status report
 */

const axios = require('axios');
const { spawn } = require('child_process');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';
const CHECK_INTERVAL = 30000; // 30 seconds
const TIMEOUT = 5000;

class HealthChecker {
  constructor() {
    this.status = {
      backend: { healthy: false, latency: 0, lastChecked: null },
      frontend: { healthy: false, latency: 0, lastChecked: null },
      database: { healthy: false, latency: 0, lastChecked: null },
      redis: { healthy: false, latency: 0, lastChecked: null },
      services: {},
    };
    this.alerts = [];
    this.startTime = Date.now();
  }

  async checkService(url, name) {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${url}/health`, {
        timeout: TIMEOUT,
      });
      const latency = Date.now() - startTime;
      
      this.status[name] = {
        healthy: response.status === 200,
        latency,
        lastChecked: new Date().toISOString(),
        statusCode: response.status,
      };

      if (latency > 1000) {
        this.alerts.push({
          level: 'warning',
          service: name,
          message: `High latency: ${latency}ms`,
          timestamp: new Date().toISOString(),
        });
      }

      return true;
    } catch (error) {
      this.status[name] = {
        healthy: false,
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };

      this.alerts.push({
        level: 'error',
        service: name,
        message: `Service unavailable: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      return false;
    }
  }

  async checkPhaseEndpoints() {
    console.log('\n📋 Checking Phase Endpoints...\n');

    const phases = [
      { phase: 10, endpoint: '/api/bluegreen', name: 'Zero-Downtime' },
      { phase: 11, endpoint: '/api/autoscaling', name: 'Auto Scaling' },
      { phase: 12, endpoint: '/api/loadbalancer', name: 'Load Balancer' },
      { phase: 13, endpoint: '/api/storage', name: 'Storage' },
      { phase: 14, endpoint: '/api/databases', name: 'Database as Service' },
      { phase: 15, endpoint: '/api/secrets', name: 'Secrets' },
      { phase: 16, endpoint: '/api/domains', name: 'Domains' },
      { phase: 17, endpoint: '/api/alerts', name: 'Observability' },
      { phase: 18, endpoint: '/api/cipeline', name: 'CI/CD' },
      { phase: 19, endpoint: '/api/billing', name: 'Billing' },
      { phase: 20, endpoint: '/api/regions', name: 'Multi-Region' },
      { phase: 21, endpoint: '/api/intelligence', name: 'Intelligence' },
    ];

    this.status.services = {};

    for (const phase of phases) {
      try {
        const response = await axios.get(`${BACKEND_URL}${phase.endpoint}`, {
          timeout: TIMEOUT,
          headers: { Authorization: 'Bearer test-token' },
        });
        
        this.status.services[phase.endpoint] = {
          phase: phase.phase,
          name: phase.name,
          status: 'operational',
          statusCode: response.status,
        };
        
        console.log(`  ✅ Phase ${phase.phase}: ${phase.name}`);
      } catch (error) {
        if (error.response?.status === 401) {
          // Auth error is OK for health check
          this.status.services[phase.endpoint] = {
            phase: phase.phase,
            name: phase.name,
            status: 'operational',
            statusCode: error.response.status,
          };
          console.log(`  ✅ Phase ${phase.phase}: ${phase.name} (auth required)`);
        } else {
          this.status.services[phase.endpoint] = {
            phase: phase.phase,
            name: phase.name,
            status: 'unavailable',
            error: error.message,
          };
          console.log(`  ❌ Phase ${phase.phase}: ${phase.name} - ${error.message}`);
        }
      }
    }
  }

  async checkDatabaseConnection() {
    console.log('\n🗄️  Checking Database Connection...\n');
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/health/db`, {
        timeout: TIMEOUT,
      });

      if (response.data.database?.healthy) {
        this.status.database = {
          healthy: true,
          latency: response.data.database.latency,
          lastChecked: new Date().toISOString(),
        };
        console.log(`  ✅ MongoDB connected`);
        console.log(`     Latency: ${response.data.database.latency}ms`);
      }
    } catch (error) {
      console.log(`  ❌ Database check failed: ${error.message}`);
    }
  }

  async checkRedisConnection() {
    console.log('\n💾 Checking Redis Connection...\n');
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/health/redis`, {
        timeout: TIMEOUT,
      });

      if (response.data.redis?.healthy) {
        this.status.redis = {
          healthy: true,
          latency: response.data.redis.latency,
          lastChecked: new Date().toISOString(),
        };
        console.log(`  ✅ Redis connected`);
        console.log(`     Latency: ${response.data.redis.latency}ms`);
      }
    } catch (error) {
      console.log(`  ⚠️  Redis check failed: ${error.message}`);
    }
  }

  generateReport() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const serviceCount = Object.keys(this.status.services).length;
    const operationalCount = Object.values(this.status.services).filter(s => s.status === 'operational').length;

    return `
╔════════════════════════════════════════════════════════════╗
║          MSD Platform - Health Check Report               ║
║                   ${new Date().toLocaleString()}                        ║
╚════════════════════════════════════════════════════════════╝

📊 OVERALL STATUS
  Backend:     ${this.status.backend.healthy ? '✅ Healthy' : '❌ Down'} (${this.status.backend.latency}ms)
  Frontend:    ${this.status.frontend.healthy ? '✅ Healthy' : '❌ Down'} (${this.status.frontend.latency}ms)
  Database:    ${this.status.database.healthy ? '✅ Connected' : '⚠️  Disconnected'}
  Redis:       ${this.status.redis.healthy ? '✅ Connected' : '⚠️  Disconnected'}

📈 PHASE STATUS
  Total Phases:      12
  Operational:       ${operationalCount}/${serviceCount}
  Uptime:            ${uptime}s

⚠️  ALERTS (${this.alerts.length})
${
  this.alerts.length > 0
    ? this.alerts.map(a => `  [${a.level.toUpperCase()}] ${a.service}: ${a.message}`).join('\n')
    : '  No alerts'
}

💡 RECOMMENDATIONS
${
  !this.status.backend.healthy
    ? '  • Backend service is down, restart with: npm run dev:backend\n'
    : ''
}
${
  !this.status.frontend.healthy
    ? '  • Frontend service is down, restart with: npm run dev\n'
    : ''
}
${
  this.status.backend.latency > 1000
    ? '  • High backend latency detected, check performance metrics\n'
    : ''
}
${
  operationalCount < serviceCount
    ? '  • Some phase endpoints are unavailable, check logs\n'
    : ''
}
${
  this.alerts.length === 0 && 
  this.status.backend.healthy && 
  this.status.frontend.healthy &&
  operationalCount === serviceCount
    ? '  ✅ All systems operational - no action required\n'
    : ''
}

═══════════════════════════════════════════════════════════════
`;
  }

  async run() {
    console.clear();
    console.log('\n🏥 MSD Platform Health Check\n');

    await Promise.all([
      this.checkService(BACKEND_URL, 'backend'),
      this.checkService(FRONTEND_URL, 'frontend'),
    ]);

    await this.checkDatabaseConnection();
    await this.checkRedisConnection();
    await this.checkPhaseEndpoints();

    console.log(this.generateReport());

    // Return exit code based on health
    const isHealthy =
      this.status.backend.healthy &&
      this.status.frontend.healthy &&
      Object.values(this.status.services).every(s => s.status === 'operational');

    return isHealthy ? 0 : 1;
  }

  startContinuousMonitoring() {
    this.run();
    
    setInterval(async () => {
      console.clear();
      await this.run();
    }, CHECK_INTERVAL);
  }
}

// Main execution
const checker = new HealthChecker();
const continuous = process.argv.includes('--continuous');

if (continuous) {
  console.log('Starting continuous monitoring (Ctrl+C to stop)...\n');
  checker.startContinuousMonitoring();
} else {
  checker.run().then(exitCode => process.exit(exitCode));
}

module.exports = HealthChecker;
