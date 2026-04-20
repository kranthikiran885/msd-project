const express = require('express');
const router = express.Router();
const loadbalancerController = require('../controllers/loadbalancerController');
const { authenticate } = require('../middleware/auth');

// Create or update load balancer configuration
router.post(
    '/:deploymentId/config',
    authenticate,
    loadbalancerController.createLoadBalancer
);

// Get load balancer configuration
router.get(
    '/:deploymentId/config',
    authenticate,
    loadbalancerController.getLoadBalancer
);

// Register upstream server
router.post(
    '/:deploymentId/upstream/register',
    authenticate,
    loadbalancerController.registerUpstream
);

// Unregister upstream server
router.post(
    '/:deploymentId/upstream/unregister',
    authenticate,
    loadbalancerController.unregisterUpstream
);

// Select upstream for request
router.post(
    '/:deploymentId/select',
    authenticate,
    loadbalancerController.selectUpstream
);

// Update upstream health
router.post(
    '/:deploymentId/upstream/health',
    authenticate,
    loadbalancerController.updateUpstreamHealth
);

// Start health checking
router.post(
    '/:deploymentId/health/start',
    authenticate,
    loadbalancerController.startHealthChecking
);

// Stop health checking
router.post(
    '/:deploymentId/health/stop',
    authenticate,
    loadbalancerController.stopHealthChecking
);

// Get health status
router.get(
    '/:deploymentId/health/status',
    authenticate,
    loadbalancerController.getHealthStatus
);

// Get statistics
router.get(
    '/:deploymentId/stats',
    authenticate,
    loadbalancerController.getStatistics
);

// Create session (for sticky routing)
router.post(
    '/:deploymentId/session',
    authenticate,
    loadbalancerController.createSession
);

// Get session
router.get(
    '/:deploymentId/session/:sessionId',
    authenticate,
    loadbalancerController.getSession
);

// Update session activity
router.post(
    '/:deploymentId/session/:sessionId/ping',
    authenticate,
    loadbalancerController.updateSessionActivity
);

module.exports = router;
