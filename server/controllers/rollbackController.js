const BaseController = require('./BaseController');
const rollbackManager = require('../services/rollbackManager');

class RollbackController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async getAvailableVersions(req, res) {
        try {
            const { deploymentId } = req.params;
            const { limit = 10 } = req.query;

            const versions = await rollbackManager.getAvailableVersions(deploymentId, {
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                data: {
                    deploymentId,
                    versions
                }
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error getting available versions:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async rollbackToVersion(req, res) {
        try {
            const { deploymentId, versionId } = req.params;
            const options = {
                reason: req.body.reason || 'Manual rollback',
                immediate: req.body.immediate !== false,
                userId: req.user?.id
            };

            const result = await rollbackManager.rollbackToVersion(deploymentId, versionId, options);

            res.json({
                success: true,
                message: 'Rollback initiated',
                data: result
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error rolling back to version:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async quickRollback(req, res) {
        try {
            const { deploymentId } = req.params;
            const options = {
                reason: req.body.reason || 'Quick rollback',
                userId: req.user?.id
            };

            const result = await rollbackManager.quickRollback(deploymentId, options);

            res.json({
                success: true,
                message: 'Quick rollback initiated',
                data: result
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error performing quick rollback:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async rollbackToTimestamp(req, res) {
        try {
            const { deploymentId } = req.params;
            const { timestamp } = req.body;

            if (!timestamp) {
                return res.status(400).json({
                    success: false,
                    message: 'Timestamp is required'
                });
            }

            const options = {
                reason: req.body.reason || `Rollback to ${new Date(timestamp).toISOString()}`,
                immediate: req.body.immediate !== false,
                userId: req.user?.id
            };

            const result = await rollbackManager.rollbackToTimestamp(deploymentId, timestamp, options);

            res.json({
                success: true,
                message: 'Rollback to timestamp initiated',
                data: result
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error rolling back to timestamp:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getRollbackHistory(req, res) {
        try {
            const { deploymentId } = req.params;
            const { limit = 50, skip = 0 } = req.query;

            const history = await rollbackManager.getRollbackHistory(deploymentId, {
                limit: parseInt(limit),
                skip: parseInt(skip)
            });

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error getting rollback history:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getRollbackDetails(req, res) {
        try {
            const { rollbackId } = req.params;

            const details = await rollbackManager.getRollbackDetails(rollbackId);

            res.json({
                success: true,
                data: details
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error getting rollback details:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async cancelRollback(req, res) {
        try {
            const { rollbackId } = req.params;
            const { reason } = req.body;

            const result = await rollbackManager.cancelRollback(rollbackId, { reason });

            res.json({
                success: true,
                message: 'Rollback cancelled',
                data: result
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error cancelling rollback:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async compareVersions(req, res) {
        try {
            const { versionId1, versionId2 } = req.params;

            const comparison = await rollbackManager.compareVersions(versionId1, versionId2);

            res.json({
                success: true,
                data: comparison
            });
        } catch (error) {
            console.error('[v0-rollback-controller] Error comparing versions:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new RollbackController();
