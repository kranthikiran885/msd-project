const BaseController = require('./BaseController');
const loadBalancingService = require('../services/loadBalancingService');
const lbHealthCheckService = require('../services/lbHealthCheckService');
const crypto = require('crypto');

class LoadBalancerController extends BaseController {
    constructor() {
        super();
        BaseController.bindMethods(this);
    }

    async createLoadBalancer(req, res) {
        try {
            const { deploymentId } = req.params;
            const config = req.body;

            const result = await loadBalancingService.createLoadBalancer(deploymentId, config);

            res.json({
                success: true,
                message: 'Load balancer configured',
                data: result
            });
        } catch (error) {
            console.error('[v0-lb] Error creating load balancer:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getLoadBalancer(req, res) {
        try {
            const { deploymentId } = req.params;

            const lb = await loadBalancingService.getLoadBalancer(deploymentId);

            res.json({
                success: true,
                data: lb
            });
        } catch (error) {
            console.error('[v0-lb] Error getting load balancer:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async registerUpstream(req, res) {
        try {
            const { deploymentId } = req.params;
            const upstreamInfo = req.body;

            const result = await loadBalancingService.registerUpstream(deploymentId, upstreamInfo);

            res.json({
                success: true,
                message: 'Upstream registered',
                data: result
            });
        } catch (error) {
            console.error('[v0-lb] Error registering upstream:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async unregisterUpstream(req, res) {
        try {
            const { deploymentId } = req.params;
            const { host, port } = req.body;

            const result = await loadBalancingService.unregisterUpstream(deploymentId, host, port);

            res.json({
                success: true,
                message: 'Upstream unregistered',
                data: result
            });
        } catch (error) {
            console.error('[v0-lb] Error unregistering upstream:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async selectUpstream(req, res) {
        try {
            const { deploymentId } = req.params;
            const { clientIp, sessionId } = req.body;

            if (!clientIp) {
                return res.status(400).json({
                    success: false,
                    message: 'clientIp is required'
                });
            }

            const upstream = await loadBalancingService.selectUpstream(
                deploymentId,
                clientIp,
                sessionId
            );

            res.json({
                success: true,
                data: upstream
            });
        } catch (error) {
            console.error('[v0-lb] Error selecting upstream:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateUpstreamHealth(req, res) {
        try {
            const { deploymentId } = req.params;
            const { host, port, healthy, responseTime } = req.body;

            const result = await loadBalancingService.updateUpstreamHealth(
                deploymentId,
                host,
                port,
                healthy,
                responseTime
            );

            res.json({
                success: true,
                message: 'Upstream health updated',
                data: result
            });
        } catch (error) {
            console.error('[v0-lb] Error updating health:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async startHealthChecking(req, res) {
        try {
            const { deploymentId } = req.params;

            const result = await lbHealthCheckService.startHealthChecking(deploymentId);

            res.json({
                success: true,
                message: 'Health checking started',
                data: { deploymentId, status: 'running' }
            });
        } catch (error) {
            console.error('[v0-lb] Error starting health checks:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async stopHealthChecking(req, res) {
        try {
            const { deploymentId } = req.params;

            lbHealthCheckService.stopHealthChecking(deploymentId);

            res.json({
                success: true,
                message: 'Health checking stopped',
                data: { deploymentId, status: 'stopped' }
            });
        } catch (error) {
            console.error('[v0-lb] Error stopping health checks:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getHealthStatus(req, res) {
        try {
            const { deploymentId } = req.params;

            const status = await lbHealthCheckService.getHealthStatus(deploymentId);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('[v0-lb] Error getting health status:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getStatistics(req, res) {
        try {
            const { deploymentId } = req.params;

            const stats = await loadBalancingService.getStatistics(deploymentId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('[v0-lb] Error getting statistics:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async createSession(req, res) {
        try {
            const { deploymentId } = req.params;
            const { clientIp } = req.body;

            if (!clientIp) {
                return res.status(400).json({
                    success: false,
                    message: 'clientIp is required'
                });
            }

            // Generate session ID
            const sessionId = crypto.randomBytes(16).toString('hex');

            // Select upstream for this session
            const upstream = await loadBalancingService.selectUpstream(deploymentId, clientIp);

            // Create session with sticky routing
            const session = await loadBalancingService.createSession(
                deploymentId,
                sessionId,
                clientIp,
                upstream
            );

            res.json({
                success: true,
                message: 'Session created',
                data: {
                    sessionId,
                    assignedUpstream: upstream
                }
            });
        } catch (error) {
            console.error('[v0-lb] Error creating session:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getSession(req, res) {
        try {
            const { deploymentId, sessionId } = req.params;

            const session = await loadBalancingService.getSession(sessionId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }

            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            console.error('[v0-lb] Error getting session:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateSessionActivity(req, res) {
        try {
            const { deploymentId, sessionId } = req.params;

            const session = await loadBalancingService.updateSessionActivity(sessionId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }

            res.json({
                success: true,
                message: 'Session updated',
                data: session
            });
        } catch (error) {
            console.error('[v0-lb] Error updating session:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new LoadBalancerController();
