const express = require('express');
const router = express.Router();
const healthCheckController = require('../controllers/healthCheckController');
const authMiddleware = require('../middleware/auth');

// Configure health checks for deployment
router.post(
    '/:deploymentId/configure',
    authMiddleware,
    healthCheckController.configureHealthChecks
);

// Start health checks for a version
router.post(
    '/version/:versionId/start',
    authMiddleware,
    healthCheckController.startHealthChecks
);

// Get health history for a version
router.get(
    '/version/:versionId/history',
    authMiddleware,
    healthCheckController.getHealthHistory
);

// Get current health status
router.get(
    '/version/:versionId/status',
    authMiddleware,
    healthCheckController.getHealthStatus
);

// Mark version as degraded
router.post(
    '/version/:versionId/mark-degraded',
    authMiddleware,
    healthCheckController.markVersionDegraded
);

// Mark version as healthy
router.post(
    '/version/:versionId/mark-healthy',
    authMiddleware,
    healthCheckController.markVersionHealthy
);

// Get all health checks for deployment
router.get(
    '/:deploymentId/checks',
    authMiddleware,
    healthCheckController.getDeploymentHealthChecks
);

module.exports = router;
