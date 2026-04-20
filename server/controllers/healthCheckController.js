const BaseController = require('./BaseController');
const healthCheckManager = require('../services/healthCheckManager');

class HealthCheckController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async configureHealthChecks(req, res) {
        try {
            const { deploymentId } = req.params;
            const config = req.body;

            const result = await healthCheckManager.configureHealthChecks(deploymentId, config);

            res.json({
                success: true,
                message: 'Health checks configured',
                data: result
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error configuring health checks:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async startHealthChecks(req, res) {
        try {
            const { versionId } = req.params;
            const { deploymentId } = req.body;
            const config = req.body.config || {};

            const result = await healthCheckManager.startHealthChecks(versionId, deploymentId, config);

            res.json({
                success: true,
                message: 'Health checks started',
                data: result
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error starting health checks:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getHealthHistory(req, res) {
        try {
            const { versionId } = req.params;
            const { limit = 100, lastHours = 24 } = req.query;

            const history = await healthCheckManager.getHealthHistory(versionId, {
                limit: parseInt(limit),
                lastHours: parseInt(lastHours)
            });

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error getting health history:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getHealthStatus(req, res) {
        try {
            const { versionId } = req.params;

            const status = await healthCheckManager.getHealthStatus(versionId);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error getting health status:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async markVersionDegraded(req, res) {
        try {
            const { versionId } = req.params;
            const { reason = 'Manual degradation' } = req.body;

            const result = await healthCheckManager.markVersionDegraded(versionId, reason);

            res.json({
                success: true,
                message: 'Version marked as degraded',
                data: result
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error marking version degraded:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async markVersionHealthy(req, res) {
        try {
            const { versionId } = req.params;

            const result = await healthCheckManager.markVersionHealthy(versionId);

            res.json({
                success: true,
                message: 'Version marked as healthy',
                data: result
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error marking version healthy:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getDeploymentHealthChecks(req, res) {
        try {
            const { deploymentId } = req.params;
            const { limit = 50 } = req.query;

            const HealthCheck = require('../models/HealthCheck');
            const checks = await HealthCheck.find({ deploymentId })
                .sort({ timestamp: -1 })
                .limit(parseInt(limit))
                .lean();

            res.json({
                success: true,
                data: {
                    deploymentId,
                    totalChecks: checks.length,
                    checks
                }
            });
        } catch (error) {
            console.error('[v0-healthcheck-controller] Error getting deployment health checks:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new HealthCheckController();
