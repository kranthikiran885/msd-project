const mongoose = require('mongoose');
const Deployment = require('../models/Deployment');
const DeploymentVersion = require('../models/DeploymentVersion');
const RollbackHistory = require('../models/RollbackHistory');
const Container = require('../models/Container');
const logService = require('./logService');

class RollbackManager {
    /**
     * Get available versions to rollback to
     */
    async getAvailableVersions(deploymentId, options = {}) {
        const { limit = 10 } = options;

        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        // Get all versions for this deployment
        const versions = await DeploymentVersion.find({
            deploymentId: deploymentId
        })
            .sort({ activatedAt: -1 })
            .limit(limit)
            .lean();

        return versions.map(v => ({
            versionId: v._id,
            version: v.version,
            status: v.status,
            activatedAt: v.activatedAt,
            retiredAt: v.retiredAt,
            trafficPercentage: v.trafficPercentage,
            containerImage: v.containerImage,
            healthStatus: v.healthStatus,
            commitSha: v.commitSha
        }));
    }

    /**
     * Perform immediate rollback to a specific version
     */
    async rollbackToVersion(deploymentId, targetVersionId, options = {}) {
        const { reason = 'Manual rollback', immediate = true } = options;

        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        const targetVersion = await DeploymentVersion.findById(targetVersionId);
        if (!targetVersion) throw new Error('Target version not found');

        if (targetVersion.deploymentId.toString() !== deploymentId) {
            throw new Error('Target version does not belong to this deployment');
        }

        // Get current active version
        const currentVersion = await DeploymentVersion.findOne({
            deploymentId: deploymentId,
            status: 'active'
        });

        try {
            // Record rollback in history
            const rollbackRecord = await RollbackHistory.create({
                deploymentId: deployment._id,
                projectId: deployment.projectId,
                fromVersionId: currentVersion?._id || null,
                fromVersion: currentVersion?.version || 'unknown',
                toVersionId: targetVersion._id,
                toVersion: targetVersion.version,
                reason,
                initiatedBy: options.userId || 'system',
                timestamp: new Date()
            });

            if (immediate) {
                // Immediate rollback
                await this.performImmediateRollback(deploymentId, targetVersionId, rollbackRecord._id);
            } else {
                // Gradual rollback (similar to canary in reverse)
                await this.performGradualRollback(deploymentId, targetVersionId, rollbackRecord._id);
            }

            deployment.status = 'success';
            await deployment.save();

            await logService.addLog(deploymentId, 'warn', `Rolled back to version ${targetVersion.version}: ${reason}`);

            return {
                rollbackId: rollbackRecord._id,
                deploymentId: deployment._id,
                fromVersion: currentVersion?.version || 'none',
                toVersion: targetVersion.version,
                status: immediate ? 'completed' : 'in-progress'
            };
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Rollback failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Perform immediate rollback - switch all traffic instantly
     */
    async performImmediateRollback(deploymentId, targetVersionId, rollbackRecordId) {
        const targetVersion = await DeploymentVersion.findById(targetVersionId);
        if (!targetVersion) throw new Error('Target version not found');

        // Get current active version
        const currentVersion = await DeploymentVersion.findOne({
            deploymentId: deploymentId,
            status: 'active'
        });

        // Update version statuses
        targetVersion.status = 'active';
        targetVersion.trafficPercentage = 100;
        targetVersion.activatedAt = new Date();
        await targetVersion.save();

        if (currentVersion) {
            currentVersion.status = 'retired';
            currentVersion.trafficPercentage = 0;
            currentVersion.retiredAt = new Date();
            await currentVersion.save();
        }

        // Update deployment
        const deployment = await Deployment.findById(deploymentId);
        deployment.status = 'success';
        await deployment.save();

        // Update load balancer
        await this.updateLoadBalancerForRollback(deploymentId, targetVersion);

        // Record completion
        const rollbackRecord = await RollbackHistory.findById(rollbackRecordId);
        rollbackRecord.completedAt = new Date();
        rollbackRecord.completionMethod = 'immediate';
        await rollbackRecord.save();
    }

    /**
     * Perform gradual rollback - slowly shift traffic back to previous version
     */
    async performGradualRollback(deploymentId, targetVersionId, rollbackRecordId, options = {}) {
        const { steps = [50, 100], stepDuration = 120000 } = options; // 2 minute steps

        const targetVersion = await DeploymentVersion.findById(targetVersionId);
        if (!targetVersion) throw new Error('Target version not found');

        const currentVersion = await DeploymentVersion.findOne({
            deploymentId: deploymentId,
            status: 'active'
        });

        if (!currentVersion) throw new Error('No current active version found');

        try {
            // Gradually shift traffic
            for (const percentage of steps) {
                targetVersion.trafficPercentage = percentage;
                currentVersion.trafficPercentage = 100 - percentage;

                await targetVersion.save();
                await currentVersion.save();

                await logService.addLog(deploymentId, 'info', `Gradual rollback: ${percentage}% to version ${targetVersion.version}`);

                // Update load balancer
                await this.updateLoadBalancerForRollback(deploymentId, targetVersion, currentVersion);

                // Wait before next step if not final
                if (percentage < steps[steps.length - 1]) {
                    await this.delay(stepDuration);
                }
            }

            // Mark target as active
            targetVersion.status = 'active';
            targetVersion.activatedAt = new Date();
            await targetVersion.save();

            // Mark current as retired
            currentVersion.status = 'retired';
            currentVersion.retiredAt = new Date();
            await currentVersion.save();

            // Record completion
            const rollbackRecord = await RollbackHistory.findById(rollbackRecordId);
            rollbackRecord.completedAt = new Date();
            rollbackRecord.completionMethod = 'gradual';
            await rollbackRecord.save();

            await logService.addLog(deploymentId, 'info', `Gradual rollback completed to version ${targetVersion.version}`);
        } catch (error) {
            await logService.addLog(deploymentId, 'error', `Gradual rollback failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Quick rollback to previous version (last known good)
     */
    async quickRollback(deploymentId, options = {}) {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) throw new Error('Deployment not found');

        // Get last known good version (most recent non-failed version before current)
        const versions = await DeploymentVersion.find({
            deploymentId: deploymentId,
            status: { $in: ['active', 'retired', 'standby'] }
        })
            .sort({ activatedAt: -1 })
            .limit(2);

        if (versions.length < 2) {
            throw new Error('No previous version available for rollback');
        }

        // Second most recent is the previous version
        const previousVersion = versions[1];

        return await this.rollbackToVersion(deploymentId, previousVersion._id, {
            reason: options.reason || 'Quick rollback',
            immediate: true,
            userId: options.userId
        });
    }

    /**
     * Rollback to a specific timestamp
     */
    async rollbackToTimestamp(deploymentId, targetTimestamp, options = {}) {
        const targetDate = new Date(targetTimestamp);

        // Find version that was active at that time
        const version = await DeploymentVersion.findOne({
            deploymentId: deploymentId,
            activatedAt: { $lte: targetDate },
            $or: [
                { retiredAt: null },
                { retiredAt: { $gte: targetDate } }
            ]
        })
            .sort({ activatedAt: -1 });

        if (!version) {
            throw new Error('No version found for that timestamp');
        }

        return await this.rollbackToVersion(deploymentId, version._id, {
            reason: options.reason || `Rollback to ${targetDate.toISOString()}`,
            immediate: options.immediate !== false,
            userId: options.userId
        });
    }

    /**
     * Get rollback history
     */
    async getRollbackHistory(deploymentId, options = {}) {
        const { limit = 50, skip = 0 } = options;

        const rollbacks = await RollbackHistory.find({ deploymentId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await RollbackHistory.countDocuments({ deploymentId });

        return {
            deploymentId,
            rollbacks,
            pagination: {
                total,
                skip,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get specific rollback details
     */
    async getRollbackDetails(rollbackId) {
        const rollback = await RollbackHistory.findById(rollbackId)
            .populate('deploymentId', 'projectId version')
            .populate('fromVersionId', 'version commitSha containerImage')
            .populate('toVersionId', 'version commitSha containerImage');

        if (!rollback) throw new Error('Rollback not found');

        return rollback;
    }

    /**
     * Cancel a rollback in progress
     */
    async cancelRollback(rollbackId, options = {}) {
        const rollback = await RollbackHistory.findById(rollbackId);
        if (!rollback) throw new Error('Rollback not found');

        if (rollback.completedAt) {
            throw new Error('Cannot cancel a completed rollback');
        }

        rollback.cancelledAt = new Date();
        rollback.cancellationReason = options.reason || 'Manual cancellation';
        rollback.status = 'cancelled';
        await rollback.save();

        await logService.addLog(rollback.deploymentId, 'warn', `Rollback cancelled: ${rollback.cancellationReason}`);

        return { status: 'cancelled', rollbackId };
    }

    /**
     * Get version comparison for rollback decision
     */
    async compareVersions(versionId1, versionId2) {
        const version1 = await DeploymentVersion.findById(versionId1).lean();
        const version2 = await DeploymentVersion.findById(versionId2).lean();

        if (!version1 || !version2) {
            throw new Error('One or both versions not found');
        }

        return {
            version1: {
                id: version1._id,
                version: version1.version,
                commitSha: version1.commitSha,
                activatedAt: version1.activatedAt,
                healthStatus: version1.healthStatus,
                containerImage: version1.containerImage
            },
            version2: {
                id: version2._id,
                version: version2.version,
                commitSha: version2.commitSha,
                activatedAt: version2.activatedAt,
                healthStatus: version2.healthStatus,
                containerImage: version2.containerImage
            },
            differences: {
                imageDifferent: version1.containerImage !== version2.containerImage,
                commitDifferent: version1.commitSha !== version2.commitSha,
                timeDifference: Math.abs(version1.activatedAt - version2.activatedAt) / (1000 * 60) // minutes
            }
        };
    }

    /**
     * Update load balancer configuration for rollback
     */
    async updateLoadBalancerForRollback(deploymentId, targetVersion, currentVersion = null) {
        const config = {
            deploymentId,
            activeVersion: {
                id: targetVersion._id,
                weight: targetVersion.trafficPercentage
            }
        };

        if (currentVersion) {
            config.previousVersion = {
                id: currentVersion._id,
                weight: currentVersion.trafficPercentage
            };
        }

        // In production, update actual load balancer (Nginx, HAProxy, etc.)
        console.log('[v0-rollback] Updated load balancer for rollback:', config);

        return config;
    }

    /**
     * Helper to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new RollbackManager();
