const BaseController = require('./BaseController');
const metricsCollectorService = require('../services/metricsCollectorService');

class MetricsCollectorController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async startMetricsCollection(req, res) {
        try {
            const { deploymentId } = req.params;
            const options = req.body;

            const result = await metricsCollectorService.startMetricsCollection(deploymentId, options);

            res.json({
                success: true,
                message: 'Metrics collection started',
                data: result
            });
        } catch (error) {
            console.error('[v0-metrics] Error starting collection:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getContainerMetrics(req, res) {
        try {
            const { containerId } = req.params;
            const { limit = 100, lastHours = 1 } = req.query;

            const metrics = await metricsCollectorService.getContainerMetrics(containerId, {
                limit: parseInt(limit),
                lastHours: parseInt(lastHours)
            });

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('[v0-metrics] Error getting container metrics:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getDeploymentMetrics(req, res) {
        try {
            const { deploymentId } = req.params;
            const { limit = 100, lastHours = 1 } = req.query;

            const metrics = await metricsCollectorService.getDeploymentMetrics(deploymentId, {
                limit: parseInt(limit),
                lastHours: parseInt(lastHours)
            });

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('[v0-metrics] Error getting deployment metrics:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getMetricsSummary(req, res) {
        try {
            const { deploymentId } = req.params;

            const summary = await metricsCollectorService.getMetricsSummary(deploymentId);

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            console.error('[v0-metrics] Error getting summary:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getMetricsPercentiles(req, res) {
        try {
            const { deploymentId } = req.params;
            const { lastHours = 1, metric = 'cpu' } = req.query;

            const percentiles = await metricsCollectorService.getMetricsPercentiles(deploymentId, {
                lastHours: parseInt(lastHours),
                metric
            });

            res.json({
                success: true,
                data: percentiles
            });
        } catch (error) {
            console.error('[v0-metrics] Error getting percentiles:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async exportMetricsToCSV(req, res) {
        try {
            const { deploymentId } = req.params;
            const { lastHours = 24 } = req.query;

            const csv = await metricsCollectorService.exportMetricsToCSV(deploymentId, {
                lastHours: parseInt(lastHours)
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="metrics-${deploymentId}-${Date.now()}.csv"`);
            res.send(csv);
        } catch (error) {
            console.error('[v0-metrics] Error exporting CSV:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new MetricsCollectorController();
