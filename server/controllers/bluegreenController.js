const BaseController = require('./BaseController');
const blueGreenDeploymentService = require('../services/blueGreenDeploymentService');
const healthCheckManager = require('../services/healthCheckManager');

class BluegreenController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async startBlueGreenDeployment(req, res) {
        try {
            const { deploymentId } = req.params;
            const options = req.body;

            const result = await blueGreenDeploymentService.startBlueGreenDeployment(deploymentId, options);

            res.json({
                success: true,
                message: 'Blue-green deployment started',
                data: result
            });
        } catch (error) {
            console.error('[v0-bluegreen-controller] Error starting blue-green deployment:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getDeploymentStatus(req, res) {
        try {
            const { deploymentId } = req.params;

            const status = await blueGreenDeploymentService.getDeploymentStatus(deploymentId);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('[v0-bluegreen-controller] Error getting deployment status:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async switchTraffic(req, res) {
        try {
            const { deploymentId } = req.params;
            const options = req.body;

            const result = await blueGreenDeploymentService.switchTraffic(deploymentId, options);

            res.json({
                success: true,
                message: 'Traffic switched successfully',
                data: result
            });
        } catch (error) {
            console.error('[v0-bluegreen-controller] Error switching traffic:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getHealthChecks(req, res) {
        try {
            const { deploymentId } = req.params;
            const { limit = 100 } = req.query;

            // Get deployment to find green version
            const Deployment = require('../models/Deployment');
            const deployment = await Deployment.findById(deploymentId);

            if (!deployment || !deployment.blueGreenState?.greenVersionId) {
                return res.json({
                    success: true,
                    message: 'No active blue-green deployment',
                    data: { checks: [] }
                });
            }

            const history = await healthCheckManager.getHealthHistory(
                deployment.blueGreenState.greenVersionId,
                { limit: parseInt(limit) }
            );

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('[v0-bluegreen-controller] Error getting health checks:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async rollbackDeployment(req, res) {
        try {
            const { deploymentId } = req.params;
            const { reason = 'Manual rollback' } = req.body;

            const result = await blueGreenDeploymentService.rollbackDeployment(deploymentId, reason);

            res.json({
                success: true,
                message: 'Deployment rolled back',
                data: result
            });
        } catch (error) {
            console.error('[v0-bluegreen-controller] Error rolling back deployment:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new BluegreenController();
