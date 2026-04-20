const BaseController = require('./BaseController');
const storageService = require('../services/storageService');
const snapshotService = require('../services/snapshotService');
const backupService = require('../services/backupService');
const Volume = require('../models/Volume');
const Snapshot = require('../models/Snapshot');
const Backup = require('../models/Backup');
const logger = require('../utils/logger');

class StorageController extends BaseController {
  async createVolume(req, res) {
    try {
      const { projectId, name, size, storageType, region, backupEnabled } = req.body;
      const volume = await storageService.createVolume(projectId, {
        name,
        size,
        storageType,
        region,
        backupEnabled,
      });
      return this.success(res, volume, 201);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async listVolumes(req, res) {
    try {
      const { projectId } = req.params;
      const volumes = await Volume.find({ projectId });
      return this.success(res, volumes);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async getVolume(req, res) {
    try {
      const { volumeId } = req.params;
      const volume = await Volume.findById(volumeId);
      if (!volume) return this.error(res, 'Volume not found', 404);
      return this.success(res, volume);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async resizeVolume(req, res) {
    try {
      const { volumeId } = req.params;
      const { newSize } = req.body;
      const volume = await storageService.resizeVolume(volumeId, newSize);
      return this.success(res, volume);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async deleteVolume(req, res) {
    try {
      const { volumeId } = req.params;
      const result = await storageService.deleteVolume(volumeId);
      return this.success(res, result);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async createSnapshot(req, res) {
    try {
      const { volumeId, metadata } = req.body;
      const snapshot = await snapshotService.createSnapshot(volumeId, metadata);
      return this.success(res, snapshot, 201);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async listSnapshots(req, res) {
    try {
      const { volumeId } = req.params;
      const { status, type, limit } = req.query;
      const snapshots = await snapshotService.listSnapshots(volumeId, {
        status,
        type,
        limit: parseInt(limit) || 100,
      });
      return this.success(res, snapshots);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async restoreSnapshot(req, res) {
    try {
      const { snapshotId } = req.params;
      const { targetVolumeId } = req.body;
      const volume = await snapshotService.restoreFromSnapshot(snapshotId, targetVolumeId);
      return this.success(res, volume);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async deleteSnapshot(req, res) {
    try {
      const { snapshotId } = req.params;
      const result = await snapshotService.deleteSnapshot(snapshotId);
      return this.success(res, result);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async copySnapshot(req, res) {
    try {
      const { snapshotId } = req.params;
      const { targetRegion } = req.body;
      const snapshot = await snapshotService.copySnapshot(snapshotId, targetRegion);
      return this.success(res, snapshot);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async scheduleSnapshots(req, res) {
    try {
      const { volumeId } = req.params;
      const schedule = req.body;
      const volume = await snapshotService.scheduleAutoSnapshot(volumeId, schedule);
      return this.success(res, volume);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async createBackup(req, res) {
    try {
      const { volumeId, backupConfig } = req.body;
      const backup = await backupService.createBackup(volumeId, backupConfig);
      return this.success(res, backup, 201);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async listBackups(req, res) {
    try {
      const { volumeId } = req.params;
      const { status, type, limit } = req.query;
      const backups = await backupService.listBackups(volumeId, {
        status,
        type,
        limit: parseInt(limit) || 50,
      });
      return this.success(res, backups);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async restoreBackup(req, res) {
    try {
      const { backupId } = req.params;
      const { targetVolumeId } = req.body;
      const volume = await backupService.restoreFromBackup(backupId, targetVolumeId);
      return this.success(res, volume);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async scheduleBackups(req, res) {
    try {
      const { volumeId } = req.params;
      const schedule = req.body;
      const volume = await backupService.scheduleBackups(volumeId, schedule);
      return this.success(res, volume);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async copyBackupToRegion(req, res) {
    try {
      const { backupId } = req.params;
      const { targetRegion } = req.body;
      const backup = await backupService.copyBackupToRegion(backupId, targetRegion);
      return this.success(res, backup);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async getVolumeUsage(req, res) {
    try {
      const { volumeId } = req.params;
      const usage = await storageService.getVolumeUsage(volumeId);
      return this.success(res, usage);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async getSnapshotCost(req, res) {
    try {
      const { snapshotId } = req.params;
      const cost = await snapshotService.getSnapshotCost(snapshotId);
      return this.success(res, cost);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async getBackupCost(req, res) {
    try {
      const { backupId } = req.params;
      const cost = await backupService.getBackupCost(backupId);
      return this.success(res, cost);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }

  async getStorageStats(req, res) {
    try {
      const { projectId } = req.params;
      const stats = await storageService.getStorageStats(projectId);
      return this.success(res, stats);
    } catch (error) {
      return this.error(res, error.message, 400);
    }
  }
}

module.exports = new StorageController();
