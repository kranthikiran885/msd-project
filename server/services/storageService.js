const Volume = require('../models/Volume');
const Snapshot = require('../models/Snapshot');
const Backup = require('../models/Backup');
const Deployment = require('../models/Deployment');

class StorageService {
  /**
   * Create a persistent volume
   */
  async createVolume(projectId, deploymentId, volumeConfig) {
    try {
      const volume = new Volume({
        projectId,
        deploymentId,
        ...volumeConfig,
        status: 'creating'
      });

      // Validate size
      if (volume.size <= 0) {
        throw new Error('Volume size must be greater than 0');
      }

      await volume.save();

      // Simulate volume creation
      setTimeout(async () => {
        volume.status = 'available';
        await volume.save();
        console.log(`[v0-storage] Volume ${volume.name} created and available`);
      }, 2000);

      console.log(`[v0-storage] Creating volume ${volumeConfig.name}`);
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error creating volume:', error);
      throw error;
    }
  }

  /**
   * Get volume details
   */
  async getVolume(volumeId) {
    try {
      const volume = await Volume.findById(volumeId);
      if (!volume) {
        throw new Error('Volume not found');
      }
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error getting volume:', error);
      throw error;
    }
  }

  /**
   * List volumes for project or deployment
   */
  async listVolumes(projectId, deploymentId = null, query = {}) {
    try {
      const filter = { projectId };
      if (deploymentId) {
        filter.deploymentId = deploymentId;
      }

      const volumes = await Volume.find({ ...filter, ...query })
        .sort({ createdAt: -1 })
        .lean();

      return volumes;
    } catch (error) {
      console.error('[v0-storage] Error listing volumes:', error);
      throw error;
    }
  }

  /**
   * Mount volume to container
   */
  async mountVolume(volumeId, containerId, containerName, mountPath, readOnly = false) {
    try {
      const volume = await this.getVolume(volumeId);

      // Check if already mounted
      const existing = volume.mounts.find(m => m.containerId.toString() === containerId);
      if (existing) {
        throw new Error('Volume already mounted to this container');
      }

      // Add mount
      volume.mounts.push({
        containerId,
        containerName,
        mountPath,
        readOnly
      });

      // Update status if first mount
      if (volume.mounts.length === 1) {
        volume.status = 'in-use';
      }

      await volume.save();

      console.log(`[v0-storage] Volume ${volume.name} mounted to ${containerName}:${mountPath}`);
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error mounting volume:', error);
      throw error;
    }
  }

  /**
   * Unmount volume from container
   */
  async unmountVolume(volumeId, containerId) {
    try {
      const volume = await this.getVolume(volumeId);

      volume.mounts = volume.mounts.filter(
        m => m.containerId.toString() !== containerId
      );

      // Update status if no more mounts
      if (volume.mounts.length === 0) {
        volume.status = 'available';
      }

      await volume.save();

      console.log(`[v0-storage] Volume ${volume.name} unmounted`);
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error unmounting volume:', error);
      throw error;
    }
  }

  /**
   * Update volume metrics
   */
  async updateVolumeMetrics(volumeId, metricsData) {
    try {
      const volume = await this.getVolume(volumeId);

      volume.metrics = {
        ...volume.metrics,
        ...metricsData,
        lastMetricsUpdate: new Date()
      };

      // Calculate usage percentage
      if (volume.metrics.usedBytes !== undefined) {
        volume.metrics.usedGb = (volume.metrics.usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        volume.metrics.usagePercentage = ((volume.metrics.usedBytes / volume.size) * 100).toFixed(2);
      }

      await volume.save();
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error updating metrics:', error);
      throw error;
    }
  }

  /**
   * Resize volume
   */
  async resizeVolume(volumeId, newSize) {
    try {
      if (newSize <= 0) {
        throw new Error('New size must be greater than 0');
      }

      const volume = await this.getVolume(volumeId);

      if (newSize < volume.metrics.usedBytes) {
        throw new Error('New size cannot be smaller than used space');
      }

      const oldSize = volume.size;
      volume.size = newSize;
      volume.sizeGb = (newSize / (1024 * 1024 * 1024)).toFixed(2);

      await volume.save();

      console.log(`[v0-storage] Volume ${volume.name} resized from ${oldSize} to ${newSize} bytes`);
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error resizing volume:', error);
      throw error;
    }
  }

  /**
   * Delete volume
   */
  async deleteVolume(volumeId) {
    try {
      const volume = await this.getVolume(volumeId);

      if (volume.mounts.length > 0) {
        throw new Error('Cannot delete volume while mounted to containers');
      }

      if (volume.reclaimPolicy === 'Retain') {
        volume.status = 'deleting';
        await volume.save();
        throw new Error('Volume is retained, must manually delete');
      }

      await Volume.findByIdAndDelete(volumeId);

      console.log(`[v0-storage] Volume ${volume.name} deleted`);
      return { success: true, message: 'Volume deleted' };
    } catch (error) {
      console.error('[v0-storage] Error deleting volume:', error);
      throw error;
    }
  }

  /**
   * Get volume usage statistics
   */
  async getVolumeStats(volumeId) {
    try {
      const volume = await this.getVolume(volumeId);

      const stats = {
        volumeName: volume.name,
        totalSize: volume.size,
        totalSizeGb: volume.sizeGb,
        usedBytes: volume.metrics.usedBytes,
        usedGb: volume.metrics.usedGb,
        usagePercentage: volume.metrics.usagePercentage,
        availableBytes: volume.size - volume.metrics.usedBytes,
        availableGb: ((volume.size - volume.metrics.usedBytes) / (1024 * 1024 * 1024)).toFixed(2),
        readOps: volume.metrics.readOps,
        writeOps: volume.metrics.writeOps,
        readBytes: volume.metrics.readBytes,
        writeBytes: volume.metrics.writeBytes,
        mounts: volume.mounts.length,
        lastUpdate: volume.metrics.lastMetricsUpdate
      };

      return stats;
    } catch (error) {
      console.error('[v0-storage] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Create snapshot of volume
   */
  async createSnapshot(volumeId, snapshotConfig) {
    try {
      const volume = await this.getVolume(volumeId);

      const snapshot = new Snapshot({
        projectId: volume.projectId,
        volumeId,
        sourceVolume: {
          volumeId,
          volumeName: volume.name,
          volumeSize: volume.size
        },
        size: volume.size,
        ...snapshotConfig,
        status: 'pending'
      });

      await snapshot.save();

      // Simulate snapshot creation
      setTimeout(async () => {
        snapshot.status = 'in-progress';
        snapshot.progress = 50;
        await snapshot.save();

        setTimeout(async () => {
          snapshot.status = 'completed';
          snapshot.progress = 100;
          snapshot.completedAt = new Date();
          await snapshot.save();
          console.log(`[v0-storage] Snapshot ${snapshot.name} completed`);
        }, 3000);
      }, 1000);

      console.log(`[v0-storage] Creating snapshot of volume ${volume.name}`);
      return snapshot;
    } catch (error) {
      console.error('[v0-storage] Error creating snapshot:', error);
      throw error;
    }
  }

  /**
   * Restore volume from snapshot
   */
  async restoreFromSnapshot(snapshotId, volumeConfig) {
    try {
      const snapshot = await Snapshot.findById(snapshotId);
      if (!snapshot) {
        throw new Error('Snapshot not found');
      }

      if (snapshot.status !== 'completed') {
        throw new Error('Snapshot must be completed to restore');
      }

      // Create new volume from snapshot
      const volume = new Volume({
        projectId: snapshot.projectId,
        name: volumeConfig.name || `${snapshot.sourceVolume.volumeName}-restore`,
        size: snapshot.size,
        type: 'snapshot-clone',
        status: 'available'
      });

      await volume.save();

      // Update snapshot restore info
      snapshot.restoreInfo.canRestore = true;
      snapshot.restoreInfo.restoreCount += 1;
      snapshot.restoreInfo.lastRestoreTime = new Date();
      await snapshot.save();

      console.log(`[v0-storage] Volume restored from snapshot ${snapshot.name}`);
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error restoring snapshot:', error);
      throw error;
    }
  }

  /**
   * Delete snapshot
   */
  async deleteSnapshot(snapshotId) {
    try {
      const snapshot = await Snapshot.findById(snapshotId);
      if (!snapshot) {
        throw new Error('Snapshot not found');
      }

      if (snapshot.retentionPolicy === 'locked') {
        throw new Error('Snapshot is locked and cannot be deleted');
      }

      await Snapshot.findByIdAndDelete(snapshotId);

      console.log(`[v0-storage] Snapshot deleted`);
      return { success: true, message: 'Snapshot deleted' };
    } catch (error) {
      console.error('[v0-storage] Error deleting snapshot:', error);
      throw error;
    }
  }

  /**
   * List snapshots for volume
   */
  async listSnapshots(volumeId, query = {}) {
    try {
      const snapshots = await Snapshot.find({ volumeId, ...query })
        .sort({ createdAt: -1 })
        .lean();

      return snapshots;
    } catch (error) {
      console.error('[v0-storage] Error listing snapshots:', error);
      throw error;
    }
  }

  /**
   * Create backup of volume
   */
  async createBackup(volumeId, backupConfig) {
    try {
      const volume = await this.getVolume(volumeId);

      const backup = new Backup({
        projectId: volume.projectId,
        volumeId,
        source: {
          volumeId,
          volumeName: volume.name,
          volumeSize: volume.size,
          volumeUsage: volume.metrics.usedBytes
        },
        ...backupConfig,
        status: 'scheduled'
      });

      await backup.save();

      // Schedule backup execution
      setTimeout(async () => {
        backup.status = 'running';
        backup.startTime = new Date();
        await backup.save();

        setTimeout(async () => {
          backup.status = 'completed';
          backup.endTime = new Date();
          backup.progress = 100;
          await backup.save();
          console.log(`[v0-storage] Backup ${backup.name} completed`);
        }, 5000);
      }, 1000);

      console.log(`[v0-storage] Backup scheduled for volume ${volume.name}`);
      return backup;
    } catch (error) {
      console.error('[v0-storage] Error creating backup:', error);
      throw error;
    }
  }

  /**
   * List backups for volume
   */
  async listBackups(volumeId, query = {}) {
    try {
      const backups = await Backup.find({ volumeId, ...query })
        .sort({ createdAt: -1 })
        .lean();

      return backups;
    } catch (error) {
      console.error('[v0-storage] Error listing backups:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId, volumeConfig) {
    try {
      const backup = await Backup.findById(backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      if (backup.status !== 'completed') {
        throw new Error('Backup must be completed to restore');
      }

      // Create new volume from backup
      const volume = new Volume({
        projectId: backup.projectId,
        name: volumeConfig.name || `${backup.source.volumeName}-backup-restore`,
        size: backup.size.originalSize,
        status: 'available'
      });

      await volume.save();

      // Update backup restore info
      backup.restore.restoreCount += 1;
      backup.restore.lastRestoreTime = new Date();
      await backup.save();

      console.log(`[v0-storage] Volume restored from backup ${backup.name}`);
      return volume;
    } catch (error) {
      console.error('[v0-storage] Error restoring backup:', error);
      throw error;
    }
  }

  /**
   * Clean up expired backups and snapshots
   */
  async cleanupExpiredData() {
    try {
      const now = new Date();

      // Delete expired backups
      const backupResult = await Backup.deleteMany({
        'retention.expiresAt': { $lt: now },
        'retention.locked': false
      });

      // Delete expired snapshots
      const snapshotResult = await Snapshot.deleteMany({
        expiresAt: { $lt: now },
        retentionPolicy: { $ne: 'locked' }
      });

      console.log(
        `[v0-storage] Cleanup: ${backupResult.deletedCount} backups, ${snapshotResult.deletedCount} snapshots`
      );

      return {
        backupsDeleted: backupResult.deletedCount,
        snapshotsDeleted: snapshotResult.deletedCount
      };
    } catch (error) {
      console.error('[v0-storage] Error cleaning up:', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup job
   */
  startCleanupJob(intervalMs = 3600000) { // Default: 1 hour
    setInterval(() => {
      this.cleanupExpiredData();
    }, intervalMs);
  }
}

module.exports = new StorageService();
