const BaseController = require('./BaseController');
const autoScalingService = require('../services/autoScalingService');

class AutoscalingController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async createScalingPolicy(req, res) {
        try {
            const { deploymentId } = req.params;
            const policy = req.body;

            const result = await autoScalingService.createScalingPolicy(deploymentId, policy);

            res.json({
                success: true,
                message: 'Scaling policy created',
                data: result
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error creating policy:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getScalingPolicy(req, res) {
        try {
            const { deploymentId } = req.params;

            const policy = await autoScalingService.getScalingPolicy(deploymentId);

            res.json({
                success: true,
                data: policy
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error getting policy:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async startAutoScaling(req, res) {
        try {
            const { deploymentId } = req.params;
            const { policyId } = req.body;

            const result = await autoScalingService.startAutoScaling(deploymentId, policyId);

            res.json({
                success: true,
                message: 'Auto-scaling started',
                data: result
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error starting auto-scaling:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async stopAutoScaling(req, res) {
        try {
            const { deploymentId } = req.params;

            const result = await autoScalingService.stopAutoScaling(deploymentId);

            res.json({
                success: true,
                message: 'Auto-scaling stopped',
                data: result
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error stopping auto-scaling:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getScalingStatus(req, res) {
        try {
            const { deploymentId } = req.params;

            const status = await autoScalingService.getScalingStatus(deploymentId);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error getting status:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getScalingHistory(req, res) {
        try {
            const { deploymentId } = req.params;
            const { limit = 100, lastHours = 24 } = req.query;

            const history = await autoScalingService.getScalingHistory(deploymentId, {
                limit: parseInt(limit),
                lastHours: parseInt(lastHours)
            });

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error getting history:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async manualScale(req, res) {
        try {
            const { deploymentId } = req.params;
            const { targetReplicas, reason } = req.body;

            if (!targetReplicas || targetReplicas < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid targetReplicas required'
                });
            }

            const result = await autoScalingService.manualScale(deploymentId, targetReplicas, reason);

            res.json({
                success: true,
                message: 'Manual scale executed',
                data: result
            });
        } catch (error) {
            console.error('[v0-autoscaling] Error manual scaling:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new AutoscalingController();
