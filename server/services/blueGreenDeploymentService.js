const mongoose = require('mongoose');
const Deployment = require('../models/Deployment');
const DeploymentVersion = require('../models/DeploymentVersion');
const Container = require('../models/Container');
const logService = require('./logService');

class BlueGreenDeploymentService {
    /**
     * Start a blue-green deployment
     * - Blue: Current production version
     * - Green: New version to be deployed
     */
    async startBlueGreenDeployment(deploymentId, options = {}) {
        const {
            healthCheckInterval = 5000,
            healthCheckTimeout = 30000,
            maxHealthCheckAttempts = 6,
            successThreshold = 4
        } = options;

        const deployment = await Deployment.findById(deploymentId).populate('projectId');
        if (!deployment) throw new Error('Deployment not found');

        try {
            // Get current active version (blue)
            const blueVersion = await this.getActiveVersion(deployment.projectId._id);
            
            // Create green version (new deployment)
            const greenVersion = await DeploymentVersion.create({
                deploymentId: deployment._id,
                projectId: deployment.projectId._id,
                version: deployment.version,
                status: 'standby',
                slotType: 'green',
                containerImage: deployment.providerDeployment?.image || null,
                environmentVariables: deployment.environmentVariables || {},
                healthChecks: [],
                trafficPercentage: 0,
                createdAt: new Date()
            });

            // Update deployment to track blue-green
            deployment.blueGreenState = {
                status: 'in-progress',
                blueVersionId: blueVersion?._id || null,
                greenVersionId: greenVersion._id,
                startedAt: new Date(),
                healthCheckConfig: {
                    interval: healthCheckInterval,
                    timeout: healthCheckTimeout,
                    maxAttempts: maxHealthCheckAttempts,
                    successThreshold
                }
            };
            deployment.status = 'blue-green-deploying';
            await deployment.save();

            // Start green container
            await this.startGreenContainer(deployment, greenVersion);

            // Begin continuous health checks
            this.performHealthChecks(deployment._id, greenVersion._id, {
                interval: healthCheckInterval,
                timeout: healthCheckTimeout,
                maxAttempts: maxHealthCheckAttempts,
                successThreshold
            }).catch(error => {
                console.error(`Health check failed for deployment ${deployment._id}:`, error);
            });

            await logService.addLog(deployment._id, 'info', `Blue-green deployment started. Blue: ${blueVersion?.version || 'none'}, Green: ${greenVersion.version}`);

            return {
                deploymentId: deployment._id,
                blueVersionId: blueVersion?._id,
                greenVersionId: greenVersion._id,
                status: 'in-progress'
            };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Blue-green deployment failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Switch traffic from blue to green after health checks pass
     */
    async switchTraffic(deploymentId, options = {}) {
        const { gradual = true, steps = [5, 10, 50, 100] } = options;

        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        if (!deployment.blueGreenState) {
            throw new Error('No active blue-green deployment');
        }

        const greenVersion = await DeploymentVersion.findById(deployment.blueGreenState.greenVersionId);
        if (!greenVersion) throw new Error('Green version not found');

        try {
            if (gradual) {
                // Gradual traffic shift
                for (const percentage of steps) {
                    await this.setTrafficPercentage(deploymentId, percentage);
                    greenVersion.trafficPercentage = percentage;
                    await greenVersion.save();

                    await logService.addLog(deploymentId, 'info', `Traffic shifted to ${percentage}%`);

                    // Wait before next shift if not final
                    if (percentage < steps[steps.length - 1]) {
                        await this.delay(30000); // 30 seconds between shifts
                    }
                }
            } else {
                // Immediate switch
                await this.setTrafficPercentage(deploymentId, 100);
                greenVersion.trafficPercentage = 100;
                await greenVersion.save();
                await logService.addLog(deploymentId, 'info', 'Traffic switched to green (100%)');
            }

            // Mark green as active
            greenVersion.status = 'active';
            greenVersion.activatedAt = new Date();
            await greenVersion.save();

            // Mark blue as retired
            if (deployment.blueGreenState.blueVersionId) {
                const blueVersion = await DeploymentVersion.findById(deployment.blueGreenState.blueVersionId);
                if (blueVersion) {
                    blueVersion.status = 'retired';
                    blueVersion.retiredAt = new Date();
                    await blueVersion.save();
                }
            }

            deployment.status = 'success';
            deployment.blueGreenState.status = 'completed';
            deployment.blueGreenState.switchedAt = new Date();
            await deployment.save();

            await logService.addLog(deploymentId, 'info', 'Blue-green deployment completed successfully');

            return {
                deploymentId: deployment._id,
                status: 'completed',
                activeVersion: greenVersion._id
            };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Traffic switch failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Perform continuous health checks on green version
     */
    async performHealthChecks(deploymentId, greenVersionId, config) {
        const deployment = await Deployment.findById(deploymentId);
        const greenVersion = await DeploymentVersion.findById(greenVersionId);

        if (!deployment || !greenVersion) return;

        let successCount = 0;
        let failureCount = 0;
        let attempt = 0;

        while (attempt < config.maxAttempts) {
            attempt++;

            try {
                const healthCheckResult = await this.performSingleHealthCheck(greenVersionId, config.timeout);

                if (healthCheckResult.healthy) {
                    successCount++;
                    failureCount = 0; // Reset failures on success
                    await logService.addLog(deploymentId, 'info', `Health check passed (${successCount}/${config.successThreshold})`);
                } else {
                    failureCount++;
                    successCount = 0; // Reset successes on failure
                    await logService.addLog(deploymentId, 'warn', `Health check failed: ${healthCheckResult.reason}`);
                }

                // Store result
                greenVersion.healthChecks.push({
                    timestamp: new Date(),
                    attempt,
                    healthy: healthCheckResult.healthy,
                    reason: healthCheckResult.reason,
                    responseTime: healthCheckResult.responseTime
                });
                await greenVersion.save();

                // Check if we have enough successes
                if (successCount >= config.successThreshold) {
                    await logService.addLog(deploymentId, 'info', 'Health checks passed. Ready to switch traffic.');
                    return { success: true };
                }

                // Check if we have too many failures
                if (failureCount > 2) {
                    throw new Error(`Health checks failed after ${failureCount} consecutive failures`);
                }

                // Wait before next check
                await this.delay(config.interval);
            } catch (error) {
                await logService.addLog(deploymentId, 'error', `Health check error: ${error.message}`);
                
                // Trigger rollback
                await this.rollbackDeployment(deploymentId, 'Health checks failed');
                throw error;
            }
        }

        throw new Error('Max health check attempts exceeded');
    }

    /**
     * Perform a single health check against the green version
     */
    async performSingleHealthCheck(greenVersionId, timeout = 30000) {
        const greenVersion = await DeploymentVersion.findById(greenVersionId).populate('deploymentId');

        if (!greenVersion) throw new Error('Green version not found');

        try {
            // Get container health endpoint (assuming /health or /api/health)
            const healthEndpoint = `http://localhost:${greenVersion.port || 3000}/health`;
            
            const startTime = Date.now();
            
            // Simple health check via HTTP
            const response = await Promise.race([
                fetch(healthEndpoint),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Health check timeout')), timeout)
                )
            ]);

            const responseTime = Date.now() - startTime;
            const healthy = response.status === 200;

            return {
                healthy,
                responseTime,
                reason: healthy ? 'OK' : `HTTP ${response.status}`
            };
        } catch (error) {
            return {
                healthy: false,
                responseTime: timeout,
                reason: error.message
            };
        }
    }

    /**
     * Get the current active version (blue)
     */
    async getActiveVersion(projectId) {
        return await DeploymentVersion.findOne({
            projectId,
            status: 'active'
        }).sort({ activatedAt: -1 });
    }

    /**
     * Start the green (new) container
     */
    async startGreenContainer(deployment, greenVersion) {
        // This would interface with Docker/container runtime
        // For now, mark as starting
        const container = await Container.create({
            deploymentVersionId: greenVersion._id,
            projectId: deployment.projectId._id,
            status: 'starting',
            slot: 'green',
            createdAt: new Date()
        });

        greenVersion.containerId = container._id;
        await greenVersion.save();

        // In production, this would actually spin up a Docker container
        // For now, simulate container startup
        await this.delay(5000);
        container.status = 'running';
        await container.save();

        return container;
    }

    /**
     * Set traffic percentage for green version
     */
    async setTrafficPercentage(deploymentId, percentage) {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment || !deployment.blueGreenState) {
            throw new Error('No active blue-green deployment');
        }

        // Update load balancer/router configuration
        // This would typically update Nginx or similar
        const blueVersion = deployment.blueGreenState.blueVersionId
            ? await DeploymentVersion.findById(deployment.blueGreenState.blueVersionId)
            : null;

        const greenVersion = await DeploymentVersion.findById(deployment.blueGreenState.greenVersionId);

        if (greenVersion) {
            greenVersion.trafficPercentage = percentage;
            await greenVersion.save();
        }

        if (blueVersion) {
            blueVersion.trafficPercentage = 100 - percentage;
            await blueVersion.save();
        }

        // Update load balancer config
        await this.updateLoadBalancerConfig(deploymentId, blueVersion, greenVersion);
    }

    /**
     * Rollback deployment to previous version
     */
    async rollbackDeployment(deploymentId, reason = 'Manual rollback') {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        if (!deployment.blueGreenState) {
            throw new Error('No active blue-green deployment to rollback');
        }

        try {
            // Restore blue version to 100% traffic
            if (deployment.blueGreenState.blueVersionId) {
                const blueVersion = await DeploymentVersion.findById(deployment.blueGreenState.blueVersionId);
                if (blueVersion) {
                    blueVersion.status = 'active';
                    blueVersion.trafficPercentage = 100;
                    await blueVersion.save();
                }
            }

            // Stop and mark green as failed
            const greenVersion = await DeploymentVersion.findById(deployment.blueGreenState.greenVersionId);
            if (greenVersion) {
                greenVersion.status = 'failed';
                greenVersion.failureReason = reason;
                await greenVersion.save();

                // Stop green container
                if (greenVersion.containerId) {
                    const container = await Container.findById(greenVersion.containerId);
                    if (container) {
                        container.status = 'stopped';
                        await container.save();
                    }
                }
            }

            deployment.status = 'rolled-back';
            deployment.rollbackReason = reason;
            deployment.blueGreenState.status = 'rolled-back';
            deployment.blueGreenState.rolledBackAt = new Date();
            await deployment.save();

            await logService.addLog(deploymentId, 'warn', `Deployment rolled back: ${reason}`);

            return {
                deploymentId: deployment._id,
                status: 'rolled-back',
                reason
            };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Rollback failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get blue-green deployment status
     */
    async getDeploymentStatus(deploymentId) {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        if (!deployment.blueGreenState) {
            return { status: 'no-active-bluegreen' };
        }

        const blueVersion = deployment.blueGreenState.blueVersionId
            ? await DeploymentVersion.findById(deployment.blueGreenState.blueVersionId)
            : null;

        const greenVersion = await DeploymentVersion.findById(deployment.blueGreenState.greenVersionId);

        return {
            deploymentId: deployment._id,
            status: deployment.blueGreenState.status,
            blue: blueVersion ? {
                versionId: blueVersion._id,
                version: blueVersion.version,
                status: blueVersion.status,
                trafficPercentage: blueVersion.trafficPercentage,
                activatedAt: blueVersion.activatedAt
            } : null,
            green: greenVersion ? {
                versionId: greenVersion._id,
                version: greenVersion.version,
                status: greenVersion.status,
                trafficPercentage: greenVersion.trafficPercentage,
                healthChecksPassed: greenVersion.healthChecks.filter(h => h.healthy).length,
                healthChecksFailed: greenVersion.healthChecks.filter(h => !h.healthy).length,
                createdAt: greenVersion.createdAt
            } : null,
            startedAt: deployment.blueGreenState.startedAt,
            switchedAt: deployment.blueGreenState.switchedAt,
            rolledBackAt: deployment.blueGreenState.rolledBackAt
        };
    }

    /**
     * Update load balancer configuration
     */
    async updateLoadBalancerConfig(deploymentId, blueVersion, greenVersion) {
        // This would interface with Nginx or similar load balancer
        // Generate upstream configuration with traffic weights
        const config = {
            deployment: deploymentId,
            blue: blueVersion ? {
                container: blueVersion.containerId,
                weight: blueVersion.trafficPercentage
            } : null,
            green: greenVersion ? {
                container: greenVersion.containerId,
                weight: greenVersion.trafficPercentage
            } : null
        };

        // In production, write this config and reload load balancer
        console.log('[v0-bluegreen] Updated load balancer config:', config);
        return config;
    }

    /**
     * Helper to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new BlueGreenDeploymentService();
