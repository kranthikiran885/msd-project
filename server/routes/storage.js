const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const { authenticate } = require('../middleware/auth');

// Volume management
router.post('/volumes/create', authenticate, storageController.createVolume);
router.get('/volumes/:projectId', authenticate, storageController.listVolumes);
router.get('/volumes/:volumeId/details', authenticate, storageController.getVolume);
router.put('/volumes/:volumeId/resize', authenticate, storageController.resizeVolume);
router.delete('/volumes/:volumeId', authenticate, storageController.deleteVolume);

// Snapshot management
router.post('/snapshots/create', authenticate, storageController.createSnapshot);
router.get('/snapshots/volume/:volumeId', authenticate, storageController.listSnapshots);
router.post('/snapshots/:snapshotId/restore', authenticate, storageController.restoreSnapshot);
router.delete('/snapshots/:snapshotId', authenticate, storageController.deleteSnapshot);
router.post('/snapshots/:snapshotId/copy', authenticate, storageController.copySnapshot);
router.post('/volumes/:volumeId/snapshot-schedule', authenticate, storageController.scheduleSnapshots);

// Backup management
router.post('/backups/create', authenticate, storageController.createBackup);
router.get('/backups/volume/:volumeId', authenticate, storageController.listBackups);
router.post('/backups/:backupId/restore', authenticate, storageController.restoreBackup);
router.post('/backups/:backupId/copy-region', authenticate, storageController.copyBackupToRegion);
router.post('/volumes/:volumeId/backup-schedule', authenticate, storageController.scheduleBackups);

// Monitoring and cost
router.get('/volumes/:volumeId/usage', authenticate, storageController.getVolumeUsage);
router.get('/snapshots/:snapshotId/cost', authenticate, storageController.getSnapshotCost);
router.get('/backups/:backupId/cost', authenticate, storageController.getBackupCost);
router.get('/project/:projectId/storage-stats', authenticate, storageController.getStorageStats);

module.exports = router;
