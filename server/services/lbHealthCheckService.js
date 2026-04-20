const axios = require('axios');
const LoadBalancer = require('../models/LoadBalancer');
const loadBalancingService = require('./loadBalancingService');

class LBHealthCheckService {
  constructor() {
    this.activeChecks = new Map();
    this.checkHistory = new Map();
  }

  /**
   * Start health checking for a load balancer
   */
  async startHealthChecking(deploymentId) {
    try {
      if (this.activeChecks.has(deploymentId)) {
        console.log(`[v0-lb-health] Health checks already running for ${deploymentId}`);
        return;
      }

      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (!loadBalancer || !loadBalancer.healthCheck.enabled) {
        throw new Error('Load balancer or health checks not configured');
      }

      const interval = loadBalancer.healthCheck.interval;
      
      // Start health check loop
      const checkInterval = setInterval(() => {
        this.runHealthChecks(deploymentId);
      }, interval);

      this.activeChecks.set(deploymentId, checkInterval);
      
      // Run initial check immediately
      await this.runHealthChecks(deploymentId);

      console.log(`[v0-lb-health] Health checking started for ${deploymentId}`);
      return checkInterval;
    } catch (error) {
      console.error('[v0-lb-health] Error starting health checks:', error);
      throw error;
    }
  }

  /**
   * Stop health checking
   */
  stopHealthChecking(deploymentId) {
    try {
      if (this.activeChecks.has(deploymentId)) {
        clearInterval(this.activeChecks.get(deploymentId));
        this.activeChecks.delete(deploymentId);
        console.log(`[v0-lb-health] Health checking stopped for ${deploymentId}`);
      }
    } catch (error) {
      console.error('[v0-lb-health] Error stopping health checks:', error);
      throw error;
    }
  }

  /**
   * Run health checks for all upstreams
   */
  async runHealthChecks(deploymentId) {
    try {
      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (!loadBalancer) return;

      const checks = loadBalancer.upstreams.map(upstream =>
        this.checkUpstream(deploymentId, upstream, loadBalancer.healthCheck)
      );

      await Promise.allSettled(checks);
    } catch (error) {
      console.error('[v0-lb-health] Error running health checks:', error);
    }
  }

  /**
   * Check single upstream health
   */
  async checkUpstream(deploymentId, upstream, healthConfig) {
    try {
      const startTime = Date.now();
      const url = `${healthConfig.protocol}://${upstream.host}:${upstream.port}${healthConfig.path}`;

      const response = await axios.get(url, {
        timeout: healthConfig.timeout,
        validateStatus: () => true // Don't throw on any status
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status >= 200 && response.status < 300;

      // Update health status
      await this.updateUpstreamStatus(
        deploymentId,
        upstream.host,
        upstream.port,
        isHealthy,
        responseTime
      );

      return { upstream, healthy: isHealthy, responseTime };
    } catch (error) {
      console.error(
        `[v0-lb-health] Health check failed for ${upstream.host}:${upstream.port}:`,
        error.message
      );

      // Mark as unhealthy
      await this.updateUpstreamStatus(deploymentId, upstream.host, upstream.port, false);
      return { upstream, healthy: false, error: error.message };
    }
  }

  /**
   * Update upstream health status and track failures
   */
  async updateUpstreamStatus(deploymentId, host, port, healthy, responseTime = null) {
    try {
      const key = `${deploymentId}:${host}:${port}`;
      
      if (!this.checkHistory.has(key)) {
        this.checkHistory.set(key, {
          successCount: 0,
          failureCount: 0,
          lastCheck: null,
          currentStatus: null
        });
      }

      const history = this.checkHistory.get(key);
      
      if (healthy) {
        history.successCount++;
        history.failureCount = 0;
      } else {
        history.failureCount++;
        history.successCount = 0;
      }

      history.lastCheck = new Date();

      // Get load balancer config
      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (!loadBalancer) return;

      const healthConfig = loadBalancer.healthCheck;
      const upstream = loadBalancer.upstreams.find(
        u => u.host === host && u.port === port
      );

      if (!upstream) return;

      let statusChanged = false;

      // Determine if we should change the status
      if (healthy && history.successCount >= healthConfig.healthyThreshold) {
        if (!upstream.healthy) {
          statusChanged = true;
          upstream.healthy = true;
          upstream.downSince = null;
          console.log(
            `[v0-lb-health] Upstream ${host}:${port} marked as HEALTHY`
          );
        }
      } else if (!healthy && history.failureCount >= healthConfig.unhealthyThreshold) {
        if (upstream.healthy) {
          statusChanged = true;
          upstream.healthy = false;
          upstream.downSince = new Date();
          console.log(
            `[v0-lb-health] Upstream ${host}:${port} marked as UNHEALTHY`
          );
        }
      }

      // Update response time
      if (responseTime !== null) {
        upstream.averageResponseTime = upstream.averageResponseTime 
          ? upstream.averageResponseTime * 0.7 + responseTime * 0.3
          : responseTime;
      }

      upstream.lastHealthCheck = new Date();

      if (statusChanged) {
        await loadBalancer.save();
        
        // Trigger event or alert if needed
        await this.handleStatusChange(deploymentId, upstream, upstream.healthy);
      } else if (responseTime !== null) {
        // Still save response time updates
        await loadBalancer.save();
      }
    } catch (error) {
      console.error('[v0-lb-health] Error updating upstream status:', error);
    }
  }

  /**
   * Handle upstream status change
   */
  async handleStatusChange(deploymentId, upstream, isHealthy) {
    try {
      if (isHealthy) {
        console.log(`[v0-lb-health] Upstream ${upstream.host}:${upstream.port} is back online`);
      } else {
        console.log(`[v0-lb-health] Upstream ${upstream.host}:${upstream.port} is offline`);
      }

      // Could trigger notifications, metrics, alerts, etc.
    } catch (error) {
      console.error('[v0-lb-health] Error handling status change:', error);
    }
  }

  /**
   * Get health check results
   */
  async getHealthStatus(deploymentId) {
    try {
      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (!loadBalancer) {
        throw new Error('Load balancer not found');
      }

      const status = {
        loadBalancerId: loadBalancer._id,
        deploymentId,
        checkedAt: new Date(),
        healthCheckConfig: loadBalancer.healthCheck,
        upstreams: loadBalancer.upstreams.map(u => {
          const key = `${deploymentId}:${u.host}:${u.port}`;
          const history = this.checkHistory.get(key);
          
          return {
            host: u.host,
            port: u.port,
            healthy: u.healthy,
            downSince: u.downSince,
            lastHealthCheck: u.lastHealthCheck,
            averageResponseTime: u.averageResponseTime,
            recentCheckHistory: history ? {
              successCount: history.successCount,
              failureCount: history.failureCount,
              lastCheck: history.lastCheck
            } : null
          };
        })
      };

      return status;
    } catch (error) {
      console.error('[v0-lb-health] Error getting health status:', error);
      throw error;
    }
  }

  /**
   * Get all active health checks
   */
  getActiveChecks() {
    const active = [];
    for (const [deploymentId, interval] of this.activeChecks.entries()) {
      active.push({
        deploymentId,
        status: 'running'
      });
    }
    return active;
  }
}

module.exports = new LBHealthCheckService();
