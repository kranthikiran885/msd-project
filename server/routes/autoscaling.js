const express = require('express');
const router = express.Router();
const autoscalingController = require('../controllers/autoscalingController');
const authMiddleware = require('../middleware/auth');

// Create or update scaling policy
router.post(
    '/:deploymentId/policy',
    authMiddleware,
    autoscalingController.createScalingPolicy
);

// Get scaling policy
router.get(
    '/:deploymentId/policy',
    authMiddleware,
    autoscalingController.getScalingPolicy
);

// Start auto-scaling
router.post(
    '/:deploymentId/start',
    authMiddleware,
    autoscalingController.startAutoScaling
);

// Stop auto-scaling
router.post(
    '/:deploymentId/stop',
    authMiddleware,
    autoscalingController.stopAutoScaling
);

// Get scaling status
router.get(
    '/:deploymentId/status',
    authMiddleware,
    autoscalingController.getScalingStatus
);

// Get scaling history
router.get(
    '/:deploymentId/history',
    authMiddleware,
    autoscalingController.getScalingHistory
);

// Manual scale
router.post(
    '/:deploymentId/scale',
    authMiddleware,
    autoscalingController.manualScale
);

module.exports = router;
