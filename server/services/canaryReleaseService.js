const mongoose = require('mongoose');
const Deployment = require('../models/Deployment');
const DeploymentVersion = require('../models/DeploymentVersion');
const CanaryRelease = require('../models/CanaryRelease');
const logService = require('./logService');

class CanaryReleaseService {
    /**
     * Start a canary release - gradually roll out new version to subset of traffic
     */
    async startCanaryRelease(deploymentId, options = {}) {
        const {
            canaryPercentage = 5,
            maxErrorRate = 0.05, // 5% error rate threshold
            metricsCheckInterval = 30000, // 30 seconds
            metricsWindow = 300000, // 5 minutes of metrics
            autoPromoteThreshold = 10, // After 10 successful checks, auto promote
            maxDuration = 3600000 // 1 hour max canary duration
        } = options;

        const deployment = await Deployment.findById(deploymentId).populate('projectId');
        if (!deployment) throw new Error('Deployment not found');

        try {
            // Create canary release record
            const canaryRelease = await CanaryRelease.create({
                deploymentId: deployment._id,
                projectId: deployment.projectId._id,
                canaryPercentage,
                status: 'active',
                configuration: {
                    maxErrorRate,
                    metricsCheckInterval,
                    metricsWindow,
                    autoPromoteThreshold,
                    maxDuration
                },
                metrics: [],
                startedAt: new Date()
            });

            // Update deployment status
            deployment.status = 'canary-releasing';
            deployment.canaryReleaseId = canaryRelease._id;
            await deployment.save();

            await logService.addLog(deploymentId, 'info', `Canary release started at ${canaryPercentage}% traffic`);

            // Start metrics monitoring
            this.monitorCanaryMetrics(deployment._id, canaryRelease._id, {
                checkInterval: metricsCheckInterval,
                window: metricsWindow,
                autoPromoteThreshold,
                maxDuration,
                maxErrorRate
            }).catch(error => {
                console.error(`Canary monitoring failed for deployment ${deployment._id}:`, error);
            });

            return {
                canaryReleaseId: canaryRelease._id,
                deploymentId: deployment._id,
                canaryPercentage,
                status: 'active'
            };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Canary release failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Monitor canary metrics and decide whether to promote or rollback
     */
    async monitorCanaryMetrics(deploymentId, canaryReleaseId, config) {
        const deployment = await Deployment.findById(deploymentId);
        const canaryRelease = await CanaryRelease.findById(canaryReleaseId);

        if (!deployment || !canaryRelease) return;

        let successfulCheckCount = 0;
        const startTime = Date.now();

        while (Date.now() - startTime < config.maxDuration) {
            try {
                // Collect metrics for canary and stable versions
                const metrics = await this.collectCanaryMetrics(deploymentId);

                // Analyze metrics
                const analysis = await this.analyzeCanaryMetrics(metrics, config);

                // Store metrics
                canaryRelease.metrics.push({
                    timestamp: new Date(),
                    canaryMetrics: analysis.canaryMetrics,
                    stableMetrics: analysis.stableMetrics,
                    comparison: analysis.comparison,
                    healthy: analysis.isHealthy
                });
                await canaryRelease.save();

                if (analysis.isHealthy) {
                    successfulCheckCount++;
                    await logService.addLog(deploymentId, 'info', `Canary metrics healthy (${successfulCheckCount}/${config.autoPromoteThreshold})`);

                    // Auto-promote if threshold reached
                    if (successfulCheckCount >= config.autoPromoteThreshold) {
                        await logService.addLog(deploymentId, 'info', 'Auto-promoting canary to full release');
                        await this.promoteCanaryToProduction(deploymentId, canaryReleaseId);
                        return;
                    }
                } else {
                    successfulCheckCount = 0;
                    
                    // Check if error rate is too high
                    if (analysis.comparison.errorRateDifference > config.maxErrorRate) {
                        await logService.addLog(deploymentId, 'error', `Canary error rate exceeds threshold: ${analysis.comparison.errorRateDifference}`);
                        await this.rollbackCanary(deploymentId, canaryReleaseId, 'Error rate exceeded');
                        return;
                    }

                    await logService.addLog(deploymentId, 'warn', 'Canary metrics degraded, monitoring...');
                }

                // Wait before next check
                await this.delay(config.checkInterval);
            } catch (error) {
                await logService.addLog(deploymentId, 'error', `Canary monitoring error: ${error.message}`);
                await this.rollbackCanary(deploymentId, canaryReleaseId, `Monitoring error: ${error.message}`);
                throw error;
            }
        }

        // Max duration exceeded, rollback
        await logService.addLog(deploymentId, 'warn', 'Canary max duration exceeded, rolling back');
        await this.rollbackCanary(deploymentId, canaryReleaseId, 'Max duration exceeded');
    }

    /**
     * Collect metrics for canary and stable versions
     */
    async collectCanaryMetrics(deploymentId) {
        const deployment = await Deployment.findById(deploymentId);
        
        if (!deployment || !deployment.canaryReleaseId) {
            throw new Error('No active canary release');
        }

        // This would connect to metrics collection system (Prometheus, DataDog, etc.)
        // For now, return simulated metrics
        
        const metricsData = {
            canary: {
                requestCount: Math.floor(Math.random() * 1000) + 100,
                errorCount: Math.floor(Math.random() * 50),
                p95Latency: Math.floor(Math.random() * 200) + 50,
                p99Latency: Math.floor(Math.random() * 500) + 100,
                cpuUsage: Math.random() * 80,
                memoryUsage: Math.random() * 80,
                errorRate: 0 // Will be calculated
            },
            stable: {
                requestCount: Math.floor(Math.random() * 20000) + 5000,
                errorCount: Math.floor(Math.random() * 200),
                p95Latency: Math.floor(Math.random() * 150) + 50,
                p99Latency: Math.floor(Math.random() * 300) + 100,
                cpuUsage: Math.random() * 70,
                memoryUsage: Math.random() * 70,
                errorRate: 0 // Will be calculated
            }
        };

        // Calculate error rates
        metricsData.canary.errorRate = metricsData.canary.errorCount / metricsData.canary.requestCount;
        metricsData.stable.errorRate = metricsData.stable.errorCount / metricsData.stable.requestCount;

        return metricsData;
    }

    /**
     * Analyze canary metrics and determine health
     */
    async analyzeCanaryMetrics(metrics, config) {
        const canaryMetrics = metrics.canary;
        const stableMetrics = metrics.stable;

        // Compare key metrics
        const errorRateDifference = Math.abs(canaryMetrics.errorRate - stableMetrics.errorRate);
        const p95LatencyDifference = canaryMetrics.p95Latency - stableMetrics.p95Latency;
        const p99LatencyDifference = canaryMetrics.p99Latency - stableMetrics.p99Latency;

        // Determine health
        const isHealthy = 
            errorRateDifference <= config.maxErrorRate &&
            p95LatencyDifference < 100 && // Less than 100ms worse
            p99LatencyDifference < 200; // Less than 200ms worse

        return {
            canaryMetrics,
            stableMetrics,
            comparison: {
                errorRateDifference,
                p95LatencyDifference,
                p99LatencyDifference
            },
            isHealthy
        };
    }

    /**
     * Promote canary to production - gradually increase traffic
     */
    async promoteCanaryToProduction(deploymentId, canaryReleaseId, options = {}) {
        const { steps = [10, 25, 50, 100], stepDuration = 120000 } = options; // 2 minute steps

        const deployment = await Deployment.findById(deploymentId);
        const canaryRelease = await CanaryRelease.findById(canaryReleaseId);

        if (!deployment || !canaryRelease) {
            throw new Error('Deployment or canary release not found');
        }

        try {
            for (const percentage of steps) {
                canaryRelease.canaryPercentage = percentage;
                await canaryRelease.save();

                await logService.addLog(deploymentId, 'info', `Promoting canary to ${percentage}% traffic`);

                // Update load balancer
                await this.updateCanaryTraffic(deploymentId, percentage);

                // Wait before next step if not final
                if (percentage < steps[steps.length - 1]) {
                    await this.delay(stepDuration);
                }
            }

            // Mark as complete
            canaryRelease.status = 'completed';
            canaryRelease.completedAt = new Date();
            canaryRelease.result = 'promoted';
            await canaryRelease.save();

            deployment.status = 'success';
            deployment.canaryReleaseId = null;
            await deployment.save();

            await logService.addLog(deploymentId, 'info', 'Canary promoted to production successfully');

            return { status: 'promoted' };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Promotion failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Rollback canary release
     */
    async rollbackCanary(deploymentId, canaryReleaseId, reason = 'Manual rollback') {
        const deployment = await Deployment.findById(deploymentId);
        const canaryRelease = await CanaryRelease.findById(canaryReleaseId);

        if (!deployment || !canaryRelease) {
            throw new Error('Deployment or canary release not found');
        }

        try {
            // Reset traffic to stable version only
            await this.updateCanaryTraffic(deploymentId, 0);

            canaryRelease.status = 'rolled-back';
            canaryRelease.completedAt = new Date();
            canaryRelease.result = 'rolled-back';
            canaryRelease.rollbackReason = reason;
            await canaryRelease.save();

            deployment.status = 'rolled-back';
            deployment.rollbackReason = reason;
            deployment.canaryReleaseId = null;
            await deployment.save();

            await logService.addLog(deploymentId, 'warn', `Canary rolled back: ${reason}`);

            return { status: 'rolled-back', reason };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Rollback failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update canary traffic percentage
     */
    async updateCanaryTraffic(deploymentId, percentage) {
        // This would update the load balancer configuration
        // Route percentage of traffic to canary version, rest to stable
        
        console.log(`[v0-canary] Updated canary traffic to ${percentage}% for deployment ${deploymentId}`);
        
        // In production, this would generate Nginx/HAProxy config
        return {
            canaryPercentage: percentage,
            stablePercentage: 100 - percentage
        };
    }

    /**
     * Get canary release status
     */
    async getCanaryStatus(deploymentId) {
        const deployment = await Deployment.findById(deploymentId);
        
        if (!deployment || !deployment.canaryReleaseId) {
            return { status: 'no-active-canary' };
        }

        const canaryRelease = await CanaryRelease.findById(deployment.canaryReleaseId);

        if (!canaryRelease) {
            return { status: 'canary-not-found' };
        }

        return {
            deploymentId: deployment._id,
            canaryReleaseId: canaryRelease._id,
            status: canaryRelease.status,
            canaryPercentage: canaryRelease.canaryPercentage,
            result: canaryRelease.result,
            metricsCollected: canaryRelease.metrics.length,
            startedAt: canaryRelease.startedAt,
            completedAt: canaryRelease.completedAt,
            rollbackReason: canaryRelease.rollbackReason,
            latestMetrics: canaryRelease.metrics[canaryRelease.metrics.length - 1] || null
        };
    }

    /**
     * Manual canary promotion
     */
    async manualPromoteCanary(deploymentId) {
        const deployment = await Deployment.findById(deploymentId);
        
        if (!deployment || !deployment.canaryReleaseId) {
            throw new Error('No active canary release');
        }

        return await this.promoteCanaryToProduction(deploymentId, deployment.canaryReleaseId);
    }

    /**
     * Manual canary rollback
     */
    async manualRollbackCanary(deploymentId, reason = 'Manual rollback') {
        const deployment = await Deployment.findById(deploymentId);
        
        if (!deployment || !deployment.canaryReleaseId) {
            throw new Error('No active canary release');
        }

        return await this.rollbackCanary(deploymentId, deployment.canaryReleaseId, reason);
    }

    /**
     * Helper to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new CanaryReleaseService();
