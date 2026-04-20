const mongoose = require('mongoose');
const Deployment = require('../models/Deployment');
const DeploymentVersion = require('../models/DeploymentVersion');
const HealthCheck = require('../models/HealthCheck');
const logService = require('./logService');

class HealthCheckManager {
    /**
     * Configure health checks for a deployment
     */
    async configureHealthChecks(deploymentId, config = {}) {
        const {
            endpoint = '/health',
            interval = 30000, // 30 seconds
            timeout = 10000, // 10 seconds
            unhealthyThreshold = 3,
            healthyThreshold = 2,
            expectedStatusCode = 200,
            expectedBody = null
        } = config;

        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        deployment.healthCheckConfig = {
            endpoint,
            interval,
            timeout,
            unhealthyThreshold,
            healthyThreshold,
            expectedStatusCode,
            expectedBody,
            enabled: true,
            configuredAt: new Date()
        };

        await deployment.save();
        await logService.addLog(deploymentId, 'info', `Health checks configured at ${endpoint}`);

        return deployment.healthCheckConfig;
    }

    /**
     * Start continuous health checks for a deployment version
     */
    async startHealthChecks(versionId, deploymentId, config = {}) {
        const {
            interval = 30000,
            timeout = 10000,
            unhealthyThreshold = 3,
            healthyThreshold = 2
        } = config;

        const version = await DeploymentVersion.findById(versionId);
        if (!version) throw new Error('Version not found');

        // Start background health check process
        this.runHealthCheckLoop(versionId, deploymentId, {
            interval,
            timeout,
            unhealthyThreshold,
            healthyThreshold
        }).catch(error => {
            console.error(`[v0-healthcheck] Error in health check loop for ${versionId}:`, error);
        });

        return { status: 'health-checks-started' };
    }

    /**
     * Health check loop - runs continuously
     */
    async runHealthCheckLoop(versionId, deploymentId, config) {
        let consecutiveFailures = 0;
        let consecutiveSuccesses = 0;
        let lastHealth = null;

        while (true) {
            try {
                const version = await DeploymentVersion.findById(versionId);
                const deployment = await Deployment.findById(deploymentId);

                if (!version || version.status === 'stopped' || version.status === 'failed') {
                    break;
                }

                // Perform health check
                const result = await this.performHealthCheck(versionId, deploymentId, config);

                // Store result
                const healthRecord = await HealthCheck.create({
                    versionId,
                    deploymentId,
                    healthy: result.healthy,
                    statusCode: result.statusCode,
                    responseTime: result.responseTime,
                    error: result.error,
                    timestamp: new Date()
                });

                // Track consecutive results
                if (result.healthy) {
                    consecutiveSuccesses++;
                    consecutiveFailures = 0;

                    // Mark as healthy after threshold
                    if (consecutiveSuccesses >= config.healthyThreshold && lastHealth !== 'healthy') {
                        version.healthStatus = 'healthy';
                        await version.save();
                        await logService.addLog(deploymentId, 'info', `Version ${version.version} is now healthy`);
                        lastHealth = 'healthy';
                    }
                } else {
                    consecutiveFailures++;
                    consecutiveSuccesses = 0;

                    // Mark as unhealthy after threshold
                    if (consecutiveFailures >= config.unhealthyThreshold && lastHealth !== 'unhealthy') {
                        version.healthStatus = 'unhealthy';
                        await version.save();
                        await logService.addLog(deploymentId, 'error', `Version ${version.version} is unhealthy: ${result.error}`);
                        lastHealth = 'unhealthy';
                    }
                }

                // Wait before next check
                await this.delay(config.interval);
            } catch (error) {
                console.error(`[v0-healthcheck] Error in health check loop:`, error);
                await this.delay(config.interval);
            }
        }
    }

    /**
     * Perform a single health check
     */
    async performHealthCheck(versionId, deploymentId, config) {
        const version = await DeploymentVersion.findById(versionId).select('port containerUrl');
        const deployment = await Deployment.findById(deploymentId).populate('projectId');

        if (!version) throw new Error('Version not found');

        const endpoint = deployment?.healthCheckConfig?.endpoint || '/health';
        const timeout = deployment?.healthCheckConfig?.timeout || config.timeout || 10000;
        const expectedStatusCode = deployment?.healthCheckConfig?.expectedStatusCode || 200;
        const expectedBody = deployment?.healthCheckConfig?.expectedBody;

        try {
            // Build health check URL
            const baseUrl = version.containerUrl || `http://localhost:${version.port || 3000}`;
            const healthUrl = `${baseUrl}${endpoint}`;

            const startTime = Date.now();

            // Perform HTTP request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(healthUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'MSD-HealthCheck/1.0'
                    }
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;
                const responseBody = await response.text();

                // Check status code
                const statusMatch = response.status === expectedStatusCode;
                const bodyMatch = !expectedBody || responseBody.includes(expectedBody);
                const healthy = statusMatch && bodyMatch;

                return {
                    healthy,
                    statusCode: response.status,
                    responseTime,
                    error: healthy ? null : `Status ${response.status}${!bodyMatch ? ' with unexpected body' : ''}`
                };
            } catch (error) {
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                return {
                    healthy: false,
                    statusCode: 0,
                    responseTime,
                    error: error.name === 'AbortError' ? 'Timeout' : error.message
                };
            }
        } catch (error) {
            return {
                healthy: false,
                statusCode: 0,
                responseTime: 0,
                error: error.message
            };
        }
    }

    /**
     * Get health history for a version
     */
    async getHealthHistory(versionId, options = {}) {
        const { limit = 100, lastHours = 24 } = options;

        const sinceTime = new Date(Date.now() - lastHours * 60 * 60 * 1000);

        const checks = await HealthCheck.find({
            versionId,
            timestamp: { $gte: sinceTime }
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        // Calculate statistics
        const healthy = checks.filter(c => c.healthy).length;
        const unhealthy = checks.filter(c => !c.healthy).length;
        const totalChecks = checks.length;
        const healthPercentage = totalChecks > 0 ? (healthy / totalChecks) * 100 : 0;

        const avgResponseTime = checks.length > 0
            ? checks.reduce((sum, c) => sum + c.responseTime, 0) / checks.length
            : 0;

        return {
            versionId,
            checks,
            summary: {
                totalChecks,
                healthy,
                unhealthy,
                healthPercentage: healthPercentage.toFixed(2),
                avgResponseTime: avgResponseTime.toFixed(0),
                timeWindow: `Last ${lastHours} hours`
            }
        };
    }

    /**
     * Get current health status of a version
     */
    async getHealthStatus(versionId) {
        const version = await DeploymentVersion.findById(versionId);
        if (!version) throw new Error('Version not found');

        // Get latest health checks
        const recentChecks = await HealthCheck.find({ versionId })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        if (recentChecks.length === 0) {
            return {
                versionId,
                status: 'unknown',
                lastCheck: null,
                message: 'No health checks performed yet'
            };
        }

        const latestCheck = recentChecks[0];
        const unhealthyCount = recentChecks.filter(c => !c.healthy).length;

        return {
            versionId,
            status: version.healthStatus || (latestCheck.healthy ? 'healthy' : 'unhealthy'),
            lastCheck: latestCheck.timestamp,
            lastCheckHealthy: latestCheck.healthy,
            recentUnhealthy: unhealthyCount,
            lastError: latestCheck.error,
            avgResponseTime: (recentChecks.reduce((sum, c) => sum + c.responseTime, 0) / recentChecks.length).toFixed(0)
        };
    }

    /**
     * Mark version as degraded (manual)
     */
    async markVersionDegraded(versionId, reason = 'Manual degradation') {
        const version = await DeploymentVersion.findById(versionId);
        if (!version) throw new Error('Version not found');

        version.healthStatus = 'degraded';
        version.degradationReason = reason;
        await version.save();

        return { status: 'marked-degraded', reason };
    }

    /**
     * Mark version as healthy (manual recovery)
     */
    async markVersionHealthy(versionId) {
        const version = await DeploymentVersion.findById(versionId);
        if (!version) throw new Error('Version not found');

        version.healthStatus = 'healthy';
        version.degradationReason = null;
        await version.save();

        return { status: 'marked-healthy' };
    }

    /**
     * Cleanup old health check records (retention policy)
     */
    async cleanupOldHealthChecks(retentionDays = 30) {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        const result = await HealthCheck.deleteMany({
            timestamp: { $lt: cutoffDate }
        });

        console.log(`[v0-healthcheck] Cleaned up ${result.deletedCount} old health check records`);
        return result;
    }

    /**
     * Helper to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new HealthCheckManager();
