const BaseController = require('./BaseController');
const canaryReleaseService = require('../services/canaryReleaseService');

class CanaryController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async startCanaryRelease(req, res) {
        try {
            const { deploymentId } = req.params;
            const options = req.body;

            const result = await canaryReleaseService.startCanaryRelease(deploymentId, options);

            res.json({
                success: true,
                message: 'Canary release started',
                data: result
            });
        } catch (error) {
            console.error('[v0-canary-controller] Error starting canary release:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getCanaryStatus(req, res) {
        try {
            const { deploymentId } = req.params;

            const status = await canaryReleaseService.getCanaryStatus(deploymentId);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('[v0-canary-controller] Error getting canary status:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getCanaryMetrics(req, res) {
        try {
            const { deploymentId } = req.params;
            const CanaryRelease = require('../models/CanaryRelease');

            const canaryRelease = await CanaryRelease.findOne({ deploymentId });

            if (!canaryRelease) {
                return res.json({
                    success: true,
                    message: 'No active canary release',
                    data: { metrics: [] }
                });
            }

            res.json({
                success: true,
                data: {
                    canaryReleaseId: canaryRelease._id,
                    metrics: canaryRelease.metrics,
                    summary: {
                        totalMetricsCollected: canaryRelease.metrics.length,
                        healthyChecks: canaryRelease.metrics.filter(m => m.healthy).length,
                        unhealthyChecks: canaryRelease.metrics.filter(m => !m.healthy).length
                    }
                }
            });
        } catch (error) {
            console.error('[v0-canary-controller] Error getting canary metrics:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async promoteCanary(req, res) {
        try {
            const { deploymentId } = req.params;
            const options = req.body;

            const result = await canaryReleaseService.manualPromoteCanary(deploymentId);

            res.json({
                success: true,
                message: 'Canary promoted to production',
                data: result
            });
        } catch (error) {
            console.error('[v0-canary-controller] Error promoting canary:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async rollbackCanary(req, res) {
        try {
            const { deploymentId } = req.params;
            const { reason = 'Manual rollback' } = req.body;

            const result = await canaryReleaseService.manualRollbackCanary(deploymentId, reason);

            res.json({
                success: true,
                message: 'Canary rolled back',
                data: result
            });
        } catch (error) {
            console.error('[v0-canary-controller] Error rolling back canary:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateCanaryConfig(req, res) {
        try {
            const { deploymentId } = req.params;
            const { canaryPercentage, maxErrorRate, autoPromoteThreshold } = req.body;

            const CanaryRelease = require('../models/CanaryRelease');
            const canaryRelease = await CanaryRelease.findOne({ deploymentId });

            if (!canaryRelease) {
                return res.status(404).json({
                    success: false,
                    message: 'No active canary release found'
                });
            }

            if (canaryPercentage !== undefined) {
                canaryRelease.canaryPercentage = canaryPercentage;
            }

            if (maxErrorRate !== undefined) {
                canaryRelease.configuration.maxErrorRate = maxErrorRate;
            }

            if (autoPromoteThreshold !== undefined) {
                canaryRelease.configuration.autoPromoteThreshold = autoPromoteThreshold;
            }

            await canaryRelease.save();

            res.json({
                success: true,
                message: 'Canary configuration updated',
                data: canaryRelease
            });
        } catch (error) {
            console.error('[v0-canary-controller] Error updating canary config:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new CanaryController();
