const express = require('express');
const router = express.Router();
const canaryController = require('../controllers/canaryController');
const authMiddleware = require('../middleware/auth');

// Start canary release
router.post(
    '/:deploymentId/start',
    authMiddleware,
    canaryController.startCanaryRelease
);

// Get canary status
router.get(
    '/:deploymentId/status',
    authMiddleware,
    canaryController.getCanaryStatus
);

// Get canary metrics
router.get(
    '/:deploymentId/metrics',
    authMiddleware,
    canaryController.getCanaryMetrics
);

// Promote canary to production
router.post(
    '/:deploymentId/promote',
    authMiddleware,
    canaryController.promoteCanary
);

// Rollback canary
router.post(
    '/:deploymentId/rollback',
    authMiddleware,
    canaryController.rollbackCanary
);

// Update canary configuration
router.put(
    '/:deploymentId/config',
    authMiddleware,
    canaryController.updateCanaryConfig
);

module.exports = router;
