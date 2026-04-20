const express = require('express');
const router = express.Router();
const bluegreenController = require('../controllers/bluegreenController');
const authMiddleware = require('../middleware/auth');

// Start blue-green deployment
router.post(
    '/:deploymentId/start',
    authMiddleware,
    bluegreenController.startBlueGreenDeployment
);

// Get deployment status
router.get(
    '/:deploymentId/status',
    authMiddleware,
    bluegreenController.getDeploymentStatus
);

// Switch traffic to green
router.post(
    '/:deploymentId/switch-traffic',
    authMiddleware,
    bluegreenController.switchTraffic
);

// Get health check results
router.get(
    '/:deploymentId/health-checks',
    authMiddleware,
    bluegreenController.getHealthChecks
);

// Rollback deployment
router.post(
    '/:deploymentId/rollback',
    authMiddleware,
    bluegreenController.rollbackDeployment
);

module.exports = router;
