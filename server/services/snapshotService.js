const logger = require('../utils/logger');
const Snapshot = require('../models/Snapshot');
const Volume = require('../models/Volume');
const Backup = require('../models/Backup');

/**
 * Snapshot Service - Manages volume snapshots and point-in-time recovery
 * Features: Incremental snapshots, compression, encryption, retention policies
 */

class SnapshotService {
  /**
   * Create snapshot of a volume
   */
  async createSnapshot(volumeId, metadata = {}) {
    try {
      const volume = await Volume.findById(volumeId);
      if (!volume) throw new Error('Volume not found');

      const snapshot = new Snapshot({
        volumeId,
        projectId: volume.projectId,
        deploymentId: metadata.deploymentId,
        type: metadata.type || 'manual',
        size: volume.currentSize,
        compression: metadata.compression || 'gzip',
        encrypted: metadata.encrypted !== false,
        retentionDays: metadata.retentionDays || 30,
        tags: metadata.tags || {},
        metadata: metadata,
        status: 'creating',
      });

      await snapshot.save();
      logger.info(`Snapshot created: ${snapshot._id}`, { volumeId });

      // Simulate snapshot creation (in production, this would interact with storage backend)
      snapshot.status = 'available';
      snapshot.completedAt = new Date();
      await snapshot.save();

      return snapshot;
    } catch (error) {
      logger.error('Failed to create snapshot', { volumeId, error });
      throw error;
    }
  }

  /**
   * Restore volume from snapshot
   */
  async restoreFromSnapshot(snapshotId, targetVolumeId = null) {
    try {
      const snapshot = await Snapshot.findById(snapshotId).populate('volumeId');
      if (!snapshot) throw new Error('Snapshot not found');
      if (snapshot.status !== 'available') throw new Error('Snapshot not available');

      const targetVolume = targetVolumeId
        ? await Volume.findById(targetVolumeId)
        : await Volume.findById(snapshot.volumeId);

      if (!targetVolume) throw new Error('Target volume not found');

      targetVolume.status = 'restoring';
      await targetVolume.save();

      // Simulate restoration
      targetVolume.currentSize = snapshot.size;
      targetVolume.status = 'available';
      targetVolume.lastRestoreDate = new Date();
      targetVolume.snapshotId = snapshot._id;
      await targetVolume.save();

      snapshot.restoreCount += 1;
      snapshot.lastRestoreAt = new Date();
      await snapshot.save();

      logger.info('Snapshot restored', { snapshotId, volumeId: targetVolume._id });
      return targetVolume;
    } catch (error) {
      logger.error('Failed to restore snapshot', { snapshotId, error });
      throw error;
    }
  }

  /**
   * Delete snapshot with lifecycle policy
   */
  async deleteSnapshot(snapshotId) {
    try {
      const snapshot = await Snapshot.findById(snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');

      if (snapshot.status === 'in-use') {
        throw new Error('Cannot delete snapshot in use');
      }

      snapshot.status = 'deleting';
      await snapshot.save();

      // Simulate deletion
      await Snapshot.findByIdAndDelete(snapshotId);

      logger.info('Snapshot deleted', { snapshotId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete snapshot', { snapshotId, error });
      throw error;
    }
  }

  /**
   * List snapshots for volume
   */
  async listSnapshots(volumeId, filters = {}) {
    try {
      const query = { volumeId };
      if (filters.status) query.status = filters.status;
      if (filters.type) query.type = filters.type;

      const snapshots = await Snapshot.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 100);

      return snapshots;
    } catch (error) {
      logger.error('Failed to list snapshots', { volumeId, error });
      throw error;
    }
  }

  /**
   * Schedule automatic snapshots
   */
  async scheduleAutoSnapshot(volumeId, schedule) {
    try {
      const volume = await Volume.findById(volumeId);
      if (!volume) throw new Error('Volume not found');

      volume.snapshotSchedule = {
        enabled: true,
        frequency: schedule.frequency, // 'daily', 'weekly', 'monthly'
        time: schedule.time,
        retentionDays: schedule.retentionDays || 30,
        maxSnapshots: schedule.maxSnapshots || 10,
      };

      await volume.save();
      logger.info('Auto snapshot scheduled', { volumeId, schedule });
      return volume;
    } catch (error) {
      logger.error('Failed to schedule auto snapshot', { volumeId, error });
      throw error;
    }
  }

  /**
   * Copy snapshot across regions
   */
  async copySnapshot(snapshotId, targetRegion) {
    try {
      const snapshot = await Snapshot.findById(snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');

      const copiedSnapshot = new Snapshot({
        ...snapshot.toObject(),
        _id: null,
        sourceSnapshotId: snapshotId,
        region: targetRegion,
        replicationStatus: 'replicating',
      });

      await copiedSnapshot.save();
      snapshot.replicatedTo = [...snapshot.replicatedTo, targetRegion];
      await snapshot.save();

      logger.info('Snapshot copy initiated', { snapshotId, targetRegion });
      return copiedSnapshot;
    } catch (error) {
      logger.error('Failed to copy snapshot', { snapshotId, error });
      throw error;
    }
  }

  /**
   * Get snapshot cost estimate
   */
  async getSnapshotCost(snapshotId) {
    try {
      const snapshot = await Snapshot.findById(snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');

      const monthlyCost = (snapshot.size / 1024) * 0.05; // $0.05 per GB-month
      const totalCost = monthlyCost * (snapshot.retentionDays / 30);

      return {
        size: snapshot.size,
        monthlyCost,
        retentionCost: totalCost,
        estimatedAnnualCost: monthlyCost * 12,
      };
    } catch (error) {
      logger.error('Failed to calculate snapshot cost', { snapshotId, error });
      throw error;
    }
  }

  /**
   * Enforce retention policies
   */
  async enforceRetentionPolicies() {
    try {
      const expiredSnapshots = await Snapshot.find({
        createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: 'available',
      });

      for (const snapshot of expiredSnapshots) {
        const volume = await Volume.findById(snapshot.volumeId);
        if (volume && !volume.snapshotSchedule?.enabled) {
          await this.deleteSnapshot(snapshot._id);
        }
      }

      logger.info('Retention policies enforced', { count: expiredSnapshots.length });
      return { deleted: expiredSnapshots.length };
    } catch (error) {
      logger.error('Failed to enforce retention policies', { error });
      throw error;
    }
  }
}

module.exports = new SnapshotService();
