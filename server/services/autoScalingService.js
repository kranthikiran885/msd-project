const mongoose = require('mongoose');
const Deployment = require('../models/Deployment');
const DeploymentVersion = require('../models/DeploymentVersion');
const Container = require('../models/Container');
const ScalingPolicy = require('../models/ScalingPolicy');
const ScalingEvent = require('../models/ScalingEvent');
const logService = require('./logService');

class AutoScalingService {
    /**
     * Create or update scaling policy for a deployment
     */
    async createScalingPolicy(deploymentId, policy = {}) {
        const {
            minReplicas = 1,
            maxReplicas = 10,
            targetCpuUtilization = 70,
            targetMemoryUtilization = 80,
            targetRequestsPerSecond = null,
            scaleUpThreshold = 70,
            scaleDownThreshold = 30,
            scaleUpCooldown = 60000, // 1 minute
            scaleDownCooldown = 300000, // 5 minutes
            metricsCheckInterval = 30000, // 30 seconds
            enabled = true
        } = policy;

        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        let scalingPolicy = await ScalingPolicy.findOne({ deploymentId });

        if (scalingPolicy) {
            // Update existing
            scalingPolicy.minReplicas = minReplicas;
            scalingPolicy.maxReplicas = maxReplicas;
            scalingPolicy.targetCpuUtilization = targetCpuUtilization;
            scalingPolicy.targetMemoryUtilization = targetMemoryUtilization;
            scalingPolicy.targetRequestsPerSecond = targetRequestsPerSecond;
            scalingPolicy.scaleUpThreshold = scaleUpThreshold;
            scalingPolicy.scaleDownThreshold = scaleDownThreshold;
            scalingPolicy.scaleUpCooldown = scaleUpCooldown;
            scalingPolicy.scaleDownCooldown = scaleDownCooldown;
            scalingPolicy.metricsCheckInterval = metricsCheckInterval;
            scalingPolicy.enabled = enabled;
            scalingPolicy.updatedAt = new Date();
        } else {
            // Create new
            scalingPolicy = await ScalingPolicy.create({
                deploymentId,
                projectId: deployment.projectId,
                minReplicas,
                maxReplicas,
                targetCpuUtilization,
                targetMemoryUtilization,
                targetRequestsPerSecond,
                scaleUpThreshold,
                scaleDownThreshold,
                scaleUpCooldown,
                scaleDownCooldown,
                metricsCheckInterval,
                enabled,
                createdAt: new Date()
            });
        }

        await scalingPolicy.save();

        await logService.addLog(deploymentId, 'info', `Scaling policy created/updated: ${minReplicas}-${maxReplicas} replicas`);

        return scalingPolicy;
    }

    /**
     * Start auto-scaling monitoring for a deployment
     */
    async startAutoScaling(deploymentId, policyId = null) {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        let scalingPolicy = policyId
            ? await ScalingPolicy.findById(policyId)
            : await ScalingPolicy.findOne({ deploymentId });

        if (!scalingPolicy) {
            scalingPolicy = await this.createScalingPolicy(deploymentId);
        }

        if (!scalingPolicy.enabled) {
            scalingPolicy.enabled = true;
            await scalingPolicy.save();
        }

        // Start background scaling loop
        this.runScalingLoop(deploymentId, scalingPolicy._id).catch(error => {
            console.error(`[v0-scaling] Error in scaling loop for ${deploymentId}:`, error);
        });

        await logService.addLog(deploymentId, 'info', 'Auto-scaling started');

        return { status: 'auto-scaling-started', policyId: scalingPolicy._id };
    }

    /**
     * Main scaling decision loop
     */
    async runScalingLoop(deploymentId, policyId) {
        const scalingPolicy = await ScalingPolicy.findById(policyId);
        if (!scalingPolicy || !scalingPolicy.enabled) return;

        let lastScaleUpTime = Date.now();
        let lastScaleDownTime = Date.now();

        while (true) {
            try {
                const policy = await ScalingPolicy.findById(policyId);
                if (!policy || !policy.enabled) break;

                // Collect metrics
                const metrics = await this.collectDeploymentMetrics(deploymentId);
                if (!metrics) {
                    await this.delay(policy.metricsCheckInterval);
                    continue;
                }

                // Make scaling decision
                const decision = this.makeScalingDecision(metrics, policy);

                // Check cooldown before scaling
                const now = Date.now();
                const canScaleUp = now - lastScaleUpTime >= policy.scaleUpCooldown;
                const canScaleDown = now - lastScaleDownTime >= policy.scaleDownCooldown;

                if (decision.action === 'scale-up' && canScaleUp) {
                    await this.scaleUp(deploymentId, decision.targetReplicas, decision.reason);
                    lastScaleUpTime = now;
                } else if (decision.action === 'scale-down' && canScaleDown) {
                    await this.scaleDown(deploymentId, decision.targetReplicas, decision.reason);
                    lastScaleDownTime = now;
                }

                // Record metrics
                await ScalingEvent.create({
                    deploymentId,
                    policyId,
                    metrics,
                    decision,
                    currentReplicas: await this.getCurrentReplicaCount(deploymentId),
                    timestamp: new Date()
                });

                await this.delay(policy.metricsCheckInterval);
            } catch (error) {
                console.error(`[v0-scaling] Error in scaling loop:`, error);
                await this.delay(30000);
            }
        }
    }

    /**
     * Collect deployment metrics from all replicas
     */
    async collectDeploymentMetrics(deploymentId) {
        try {
            const containers = await Container.find({
                deploymentVersionId: await this.getActiveVersionId(deploymentId),
                status: 'running'
            });

            if (containers.length === 0) {
                return null;
            }

            // Aggregate metrics from all containers
            let totalCpu = 0;
            let totalMemory = 0;
            let totalRequests = 0;
            let totalErrors = 0;
            let totalLatency = 0;

            containers.forEach(container => {
                if (container.metrics) {
                    totalCpu += container.metrics.cpuUsage || 0;
                    totalMemory += container.metrics.memoryUsage || 0;
                    totalRequests += container.metrics.networkIn || 0;
                    totalErrors += container.metrics.errors || 0;
                    totalLatency += container.metrics.latency || 0;
                }
            });

            const avgCpu = totalCpu / containers.length;
            const avgMemory = totalMemory / containers.length;
            const avgLatency = totalLatency / containers.length;
            const requestsPerSecond = totalRequests / 30; // Per 30 second check interval
            const errorRate = containers.length > 0 ? (totalErrors / totalRequests) * 100 : 0;

            return {
                cpuUtilization: avgCpu,
                memoryUtilization: avgMemory,
                requestsPerSecond,
                errorRate,
                averageLatency: avgLatency,
                totalContainers: containers.length,
                healthyContainers: containers.filter(c => c.healthStatus === 'healthy').length,
                unhealthyContainers: containers.filter(c => c.healthStatus === 'unhealthy').length
            };
        } catch (error) {
            console.error('[v0-scaling] Error collecting metrics:', error);
            return null;
        }
    }

    /**
     * Make scaling decision based on metrics and policy
     */
    makeScalingDecision(metrics, policy) {
        const scaleUpReasons = [];
        const scaleDownReasons = [];

        // Check CPU utilization
        if (metrics.cpuUtilization > policy.scaleUpThreshold) {
            scaleUpReasons.push(`CPU usage ${metrics.cpuUtilization.toFixed(1)}% > ${policy.scaleUpThreshold}%`);
        } else if (metrics.cpuUtilization < policy.scaleDownThreshold) {
            scaleDownReasons.push(`CPU usage ${metrics.cpuUtilization.toFixed(1)}% < ${policy.scaleDownThreshold}%`);
        }

        // Check memory utilization
        if (metrics.memoryUtilization > policy.scaleUpThreshold) {
            scaleUpReasons.push(`Memory usage ${metrics.memoryUtilization.toFixed(1)}% > ${policy.scaleUpThreshold}%`);
        } else if (metrics.memoryUtilization < policy.scaleDownThreshold) {
            scaleDownReasons.push(`Memory usage ${metrics.memoryUtilization.toFixed(1)}% < ${policy.scaleDownThreshold}%`);
        }

        // Check request rate if configured
        if (policy.targetRequestsPerSecond && metrics.requestsPerSecond > policy.targetRequestsPerSecond) {
            scaleUpReasons.push(`RPS ${metrics.requestsPerSecond.toFixed(1)} > target ${policy.targetRequestsPerSecond}`);
        }

        // Check error rate
        if (metrics.errorRate > 5) {
            scaleUpReasons.push(`Error rate ${metrics.errorRate.toFixed(1)}% exceeds acceptable threshold`);
        }

        // Calculate target replicas
        let targetReplicas = metrics.totalContainers;

        if (scaleUpReasons.length > 0) {
            // Scale up by 50% or 1 replica, whichever is more
            targetReplicas = Math.ceil(metrics.totalContainers * 1.5);
            targetReplicas = Math.max(targetReplicas, metrics.totalContainers + 1);
        } else if (scaleDownReasons.length > 0 && metrics.totalContainers > policy.minReplicas) {
            // Scale down by 25% or 1 replica, whichever is less
            targetReplicas = Math.floor(metrics.totalContainers * 0.75);
            targetReplicas = Math.max(targetReplicas, policy.minReplicas);
        }

        // Enforce limits
        targetReplicas = Math.min(targetReplicas, policy.maxReplicas);
        targetReplicas = Math.max(targetReplicas, policy.minReplicas);

        // Determine action
        let action = 'no-action';
        let reason = 'Metrics within acceptable range';

        if (targetReplicas > metrics.totalContainers) {
            action = 'scale-up';
            reason = scaleUpReasons.join(', ');
        } else if (targetReplicas < metrics.totalContainers) {
            action = 'scale-down';
            reason = scaleDownReasons.join(', ');
        }

        return {
            action,
            currentReplicas: metrics.totalContainers,
            targetReplicas,
            reason,
            metrics
        };
    }

    /**
     * Scale up deployment
     */
    async scaleUp(deploymentId, targetReplicas, reason = 'Auto scaling') {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        const currentCount = await this.getCurrentReplicaCount(deploymentId);

        try {
            // Create new containers
            const versionId = await this.getActiveVersionId(deploymentId);
            const replicasToAdd = targetReplicas - currentCount;

            for (let i = 0; i < replicasToAdd; i++) {
                const container = await Container.create({
                    deploymentVersionId: versionId,
                    projectId: deployment.projectId,
                    status: 'starting',
                    healthStatus: 'unknown',
                    createdAt: new Date()
                });

                // Simulate container startup
                await this.delay(2000);
                container.status = 'running';
                await container.save();
            }

            await logService.addLog(deploymentId, 'info', `Scaled up from ${currentCount} to ${targetReplicas} replicas. Reason: ${reason}`);

            return { action: 'scaled-up', from: currentCount, to: targetReplicas };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Scale up failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Scale down deployment
     */
    async scaleDown(deploymentId, targetReplicas, reason = 'Auto scaling') {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        const currentCount = await this.getCurrentReplicaCount(deploymentId);

        try {
            // Get active containers
            const versionId = await this.getActiveVersionId(deploymentId);
            const containers = await Container.find({
                deploymentVersionId: versionId,
                status: { $in: ['running', 'stopping'] }
            });

            const replicasToRemove = currentCount - targetReplicas;

            // Remove excess containers (prefer newest)
            for (let i = 0; i < replicasToRemove && containers.length > 0; i++) {
                const container = containers.pop();
                container.status = 'stopping';
                await container.save();

                await this.delay(3000);
                container.status = 'stopped';
                container.stoppedAt = new Date();
                await container.save();
            }

            await logService.addLog(deploymentId, 'info', `Scaled down from ${currentCount} to ${targetReplicas} replicas. Reason: ${reason}`);

            return { action: 'scaled-down', from: currentCount, to: targetReplicas };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Scale down failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get current replica count
     */
    async getCurrentReplicaCount(deploymentId) {
        const versionId = await this.getActiveVersionId(deploymentId);
        if (!versionId) return 0;

        const count = await Container.countDocuments({
            deploymentVersionId: versionId,
            status: { $in: ['running', 'starting', 'restarting'] }
        });

        return count;
    }

    /**
     * Get active version ID for deployment
     */
    async getActiveVersionId(deploymentId) {
        const version = await DeploymentVersion.findOne({
            deploymentId,
            status: 'active'
        });

        return version ? version._id : null;
    }

    /**
     * Get scaling policy
     */
    async getScalingPolicy(deploymentId) {
        const policy = await ScalingPolicy.findOne({ deploymentId });
        return policy;
    }

    /**
     * Get scaling history
     */
    async getScalingHistory(deploymentId, options = {}) {
        const { limit = 100, lastHours = 24 } = options;

        const sinceTime = new Date(Date.now() - lastHours * 60 * 60 * 1000);

        const events = await ScalingEvent.find({
            deploymentId,
            timestamp: { $gte: sinceTime }
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        return {
            deploymentId,
            events,
            summary: {
                totalEvents: events.length,
                scaleUpEvents: events.filter(e => e.decision.action === 'scale-up').length,
                scaleDownEvents: events.filter(e => e.decision.action === 'scale-down').length,
                noActionEvents: events.filter(e => e.decision.action === 'no-action').length,
                timeWindow: `Last ${lastHours} hours`
            }
        };
    }

    /**
     * Get current scaling status
     */
    async getScalingStatus(deploymentId) {
        const policy = await this.getScalingPolicy(deploymentId);
        const currentReplicas = await this.getCurrentReplicaCount(deploymentId);
        const recentEvents = await ScalingEvent.find({ deploymentId })
            .sort({ timestamp: -1 })
            .limit(5)
            .lean();

        return {
            deploymentId,
            policy: policy ? {
                enabled: policy.enabled,
                minReplicas: policy.minReplicas,
                maxReplicas: policy.maxReplicas,
                targetCpuUtilization: policy.targetCpuUtilization,
                targetMemoryUtilization: policy.targetMemoryUtilization
            } : null,
            currentReplicas,
            recentEvents
        };
    }

    /**
     * Stop auto-scaling
     */
    async stopAutoScaling(deploymentId) {
        const policy = await this.getScalingPolicy(deploymentId);
        if (policy) {
            policy.enabled = false;
            await policy.save();
        }

        await logService.addLog(deploymentId, 'info', 'Auto-scaling stopped');
        return { status: 'auto-scaling-stopped' };
    }

    /**
     * Manually trigger scale action
     */
    async manualScale(deploymentId, targetReplicas, reason = 'Manual scale') {
        const policy = await this.getScalingPolicy(deploymentId);
        if (!policy) throw new Error('No scaling policy found');

        if (targetReplicas < policy.minReplicas || targetReplicas > policy.maxReplicas) {
            throw new Error(`Target replicas must be between ${policy.minReplicas} and ${policy.maxReplicas}`);
        }

        const currentCount = await this.getCurrentReplicaCount(deploymentId);

        if (targetReplicas > currentCount) {
            return await this.scaleUp(deploymentId, targetReplicas, reason);
        } else if (targetReplicas < currentCount) {
            return await this.scaleDown(deploymentId, targetReplicas, reason);
        } else {
            return { action: 'no-action', replicas: currentCount };
        }
    }

    /**
     * Helper to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new AutoScalingService();
