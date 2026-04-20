const LoadBalancer = require('../models/LoadBalancer');
const LoadBalancerSession = require('../models/LoadBalancerSession');
const Deployment = require('../models/Deployment');
const Container = require('../models/Container');
const crypto = require('crypto');

class LoadBalancingService {
  constructor() {
    this.sessionStore = new Map();
    this.connectionCounts = new Map();
    this.lastSelected = new Map();
  }

  /**
   * Create or update load balancer configuration for a deployment
   */
  async createLoadBalancer(deploymentId, config) {
    try {
      const deployment = await Deployment.findById(deploymentId);
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      let loadBalancer = await LoadBalancer.findOne({ deploymentId });

      if (loadBalancer) {
        Object.assign(loadBalancer, config);
        await loadBalancer.save();
      } else {
        loadBalancer = new LoadBalancer({
          ...config,
          deploymentId,
          projectId: deployment.projectId
        });
        await loadBalancer.save();
      }

      console.log(`[v0-lb] LoadBalancer created/updated for deployment ${deploymentId}`);
      return loadBalancer;
    } catch (error) {
      console.error('[v0-lb] Error creating load balancer:', error);
      throw error;
    }
  }

  /**
   * Get load balancer configuration
   */
  async getLoadBalancer(deploymentId) {
    try {
      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (!loadBalancer) {
        throw new Error('Load balancer not configured for this deployment');
      }
      return loadBalancer;
    } catch (error) {
      console.error('[v0-lb] Error getting load balancer:', error);
      throw error;
    }
  }

  /**
   * Register upstream server (container replica)
   */
  async registerUpstream(deploymentId, upstreamInfo) {
    try {
      const loadBalancer = await this.getLoadBalancer(deploymentId);

      // Check if upstream already exists
      const exists = loadBalancer.upstreams.find(
        u => u.host === upstreamInfo.host && u.port === upstreamInfo.port
      );

      if (!exists) {
        loadBalancer.upstreams.push({
          id: upstreamInfo.containerId,
          host: upstreamInfo.host,
          port: upstreamInfo.port,
          weight: upstreamInfo.weight || 1,
          maxConnections: upstreamInfo.maxConnections || 100,
          healthy: true
        });
        await loadBalancer.save();
      }

      return loadBalancer;
    } catch (error) {
      console.error('[v0-lb] Error registering upstream:', error);
      throw error;
    }
  }

  /**
   * Unregister upstream server
   */
  async unregisterUpstream(deploymentId, host, port) {
    try {
      const loadBalancer = await this.getLoadBalancer(deploymentId);

      loadBalancer.upstreams = loadBalancer.upstreams.filter(
        u => !(u.host === host && u.port === port)
      );

      await loadBalancer.save();
      return loadBalancer;
    } catch (error) {
      console.error('[v0-lb] Error unregistering upstream:', error);
      throw error;
    }
  }

  /**
   * Select upstream server based on load balancing strategy
   */
  async selectUpstream(deploymentId, clientIp, sessionId = null) {
    try {
      const loadBalancer = await this.getLoadBalancer(deploymentId);
      const healthyUpstreams = loadBalancer.upstreams.filter(u => u.healthy);

      if (healthyUpstreams.length === 0) {
        throw new Error('No healthy upstreams available');
      }

      let selected;

      // Check for existing session
      if (loadBalancer.sessionPersistence.enabled && sessionId) {
        const session = await this.getSession(sessionId);
        if (session) {
          selected = session.assignedUpstream;
          await this.updateSessionActivity(sessionId);
          return selected;
        }
      }

      // Select based on strategy
      switch (loadBalancer.strategy) {
        case 'least-connections':
          selected = this.selectLeastConnections(healthyUpstreams, deploymentId);
          break;
        case 'ip-hash':
          selected = this.selectByIpHash(healthyUpstreams, clientIp);
          break;
        case 'weighted':
          selected = this.selectWeighted(healthyUpstreams);
          break;
        case 'least-response-time':
          selected = this.selectLeastResponseTime(healthyUpstreams);
          break;
        case 'round-robin':
        default:
          selected = this.selectRoundRobin(healthyUpstreams, deploymentId);
      }

      // Store session if persistence is enabled
      if (loadBalancer.sessionPersistence.enabled && sessionId) {
        await this.createSession(deploymentId, sessionId, clientIp, selected);
      }

      return selected;
    } catch (error) {
      console.error('[v0-lb] Error selecting upstream:', error);
      throw error;
    }
  }

  /**
   * Round-robin selection
   */
  selectRoundRobin(upstreams, deploymentId) {
    if (!this.lastSelected.has(deploymentId)) {
      this.lastSelected.set(deploymentId, 0);
    }

    let index = this.lastSelected.get(deploymentId);
    const selected = upstreams[index % upstreams.length];
    
    this.lastSelected.set(deploymentId, (index + 1) % upstreams.length);
    return selected;
  }

  /**
   * Least connections selection
   */
  selectLeastConnections(upstreams, deploymentId) {
    return upstreams.reduce((min, current) => {
      const currentConns = current.activeConnections || 0;
      const minConns = min.activeConnections || 0;
      return currentConns < minConns ? current : min;
    });
  }

  /**
   * IP hash selection (sticky routing)
   */
  selectByIpHash(upstreams, clientIp) {
    const hash = crypto
      .createHash('md5')
      .update(clientIp)
      .digest('hex');
    const index = parseInt(hash, 16) % upstreams.length;
    return upstreams[index];
  }

  /**
   * Weighted selection
   */
  selectWeighted(upstreams) {
    const totalWeight = upstreams.reduce((sum, u) => sum + (u.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const upstream of upstreams) {
      random -= (upstream.weight || 1);
      if (random <= 0) {
        return upstream;
      }
    }

    return upstreams[0];
  }

  /**
   * Least response time selection
   */
  selectLeastResponseTime(upstreams) {
    return upstreams.reduce((best, current) => {
      const bestTime = best.averageResponseTime || 0;
      const currentTime = current.averageResponseTime || 0;
      return currentTime < bestTime ? current : best;
    });
  }

  /**
   * Create session for sticky routing
   */
  async createSession(deploymentId, sessionId, clientIp, upstream) {
    try {
      const loadBalancer = await this.getLoadBalancer(deploymentId);
      const ttl = loadBalancer.sessionPersistence.ttl || 3600000;
      const expiresAt = new Date(Date.now() + ttl);

      const session = new LoadBalancerSession({
        loadBalancerId: loadBalancer._id,
        deploymentId,
        sessionId,
        clientIp,
        assignedUpstream: upstream,
        expiresAt
      });

      await session.save();
      this.sessionStore.set(sessionId, session);
      
      return session;
    } catch (error) {
      console.error('[v0-lb] Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get session
   */
  async getSession(sessionId) {
    try {
      // Check in-memory store first
      if (this.sessionStore.has(sessionId)) {
        return this.sessionStore.get(sessionId);
      }

      // Check database
      const session = await LoadBalancerSession.findOne({ sessionId });
      if (session) {
        this.sessionStore.set(sessionId, session);
      }
      return session;
    } catch (error) {
      console.error('[v0-lb] Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId) {
    try {
      const session = await LoadBalancerSession.findOneAndUpdate(
        { sessionId },
        { lastActivity: new Date() },
        { new: true }
      );
      if (session) {
        this.sessionStore.set(sessionId, session);
      }
      return session;
    } catch (error) {
      console.error('[v0-lb] Error updating session:', error);
    }
  }

  /**
   * Update upstream health status
   */
  async updateUpstreamHealth(deploymentId, host, port, healthy, responseTime = null) {
    try {
      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (!loadBalancer) return;

      const upstream = loadBalancer.upstreams.find(
        u => u.host === host && u.port === port
      );

      if (upstream) {
        upstream.healthy = healthy;
        upstream.lastHealthCheck = new Date();

        if (!healthy) {
          upstream.downSince = upstream.downSince || new Date();
        } else {
          upstream.downSince = null;
        }

        if (responseTime !== null) {
          // Update exponential moving average
          upstream.averageResponseTime = upstream.averageResponseTime 
            ? upstream.averageResponseTime * 0.7 + responseTime * 0.3
            : responseTime;
        }

        await loadBalancer.save();
      }

      return loadBalancer;
    } catch (error) {
      console.error('[v0-lb] Error updating upstream health:', error);
      throw error;
    }
  }

  /**
   * Update connection count for upstream
   */
  async updateUpstreamConnections(deploymentId, host, port, delta = 1) {
    try {
      const key = `${deploymentId}:${host}:${port}`;
      const current = this.connectionCounts.get(key) || 0;
      const newCount = Math.max(0, current + delta);
      this.connectionCounts.set(key, newCount);

      // Update in database
      const loadBalancer = await LoadBalancer.findOne({ deploymentId });
      if (loadBalancer) {
        const upstream = loadBalancer.upstreams.find(
          u => u.host === host && u.port === port
        );
        if (upstream) {
          upstream.activeConnections = newCount;
          upstream.totalRequests = (upstream.totalRequests || 0) + 1;
          await loadBalancer.save();
        }
      }

      return newCount;
    } catch (error) {
      console.error('[v0-lb] Error updating connections:', error);
      throw error;
    }
  }

  /**
   * Get load balancer statistics
   */
  async getStatistics(deploymentId) {
    try {
      const loadBalancer = await this.getLoadBalancer(deploymentId);

      const stats = {
        totalRequests: loadBalancer.metrics.totalRequests || 0,
        totalErrors: loadBalancer.metrics.totalErrors || 0,
        averageResponseTime: loadBalancer.metrics.averageResponseTime || 0,
        p95ResponseTime: loadBalancer.metrics.p95ResponseTime || 0,
        p99ResponseTime: loadBalancer.metrics.p99ResponseTime || 0,
        activeConnections: loadBalancer.metrics.activeConnections || 0,
        requestsPerSecond: loadBalancer.metrics.requestsPerSecond || 0,
        upstreams: loadBalancer.upstreams.map(u => ({
          host: u.host,
          port: u.port,
          healthy: u.healthy,
          activeConnections: u.activeConnections || 0,
          totalRequests: u.totalRequests || 0,
          failedRequests: u.failedRequests || 0,
          averageResponseTime: u.averageResponseTime || 0,
          downSince: u.downSince
        }))
      };

      return stats;
    } catch (error) {
      console.error('[v0-lb] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await LoadBalancerSession.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      console.log(`[v0-lb] Cleaned up ${result.deletedCount} expired sessions`);
      return result;
    } catch (error) {
      console.error('[v0-lb] Error cleaning up sessions:', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup job
   */
  startCleanupJob() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 300000); // Every 5 minutes
  }
}

module.exports = new LoadBalancingService();
