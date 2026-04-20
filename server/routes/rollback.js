const express = require('express');
const router = express.Router();
const rollbackController = require('../controllers/rollbackController');
const authMiddleware = require('../middleware/auth');

// Get available versions for rollback
router.get(
    '/:deploymentId/available-versions',
    authMiddleware,
    rollbackController.getAvailableVersions
);

// Rollback to specific version
router.post(
    '/:deploymentId/to-version/:versionId',
    authMiddleware,
    rollbackController.rollbackToVersion
);

// Quick rollback (to previous version)
router.post(
    '/:deploymentId/quick',
    authMiddleware,
    rollbackController.quickRollback
);

// Rollback to specific timestamp
router.post(
    '/:deploymentId/to-timestamp',
    authMiddleware,
    rollbackController.rollbackToTimestamp
);

// Get rollback history
router.get(
    '/:deploymentId/history',
    authMiddleware,
    rollbackController.getRollbackHistory
);

// Get rollback details
router.get(
    '/record/:rollbackId',
    authMiddleware,
    rollbackController.getRollbackDetails
);

// Cancel rollback in progress
router.post(
    '/record/:rollbackId/cancel',
    authMiddleware,
    rollbackController.cancelRollback
);

// Compare versions
router.get(
    '/compare/:versionId1/:versionId2',
    authMiddleware,
    rollbackController.compareVersions
);

module.exports = router;
