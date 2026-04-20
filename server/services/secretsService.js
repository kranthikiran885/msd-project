const logger = require('../utils/logger');
const Secret = require('../models/Secret');
const crypto = require('crypto');

/**
 * Secrets Management Service - Encrypted secret storage with rotation and audit
 */

class SecretsService {
  /**
   * Create or update a secret
   */
  async upsertSecret(projectId, secretName, secretValue, config = {}) {
    try {
      const encrypted = this.encryptValue(secretValue);
      
      let secret = await Secret.findOne({ projectId, name: secretName });
      
      if (secret) {
        secret.value = encrypted;
        secret.updatedAt = new Date();
      } else {
        secret = new Secret({
          projectId,
          name: secretName,
          value: encrypted,
          type: config.type || 'other',
          environments: config.environments || ['production'],
          rotationPolicy: config.rotationPolicy || { enabled: false },
          tags: config.tags || {},
          expiresAt: config.expiresAt,
        });
      }

      await secret.save();
      logger.info('Secret saved', { projectId, secretName });
      return secret;
    } catch (error) {
      logger.error('Failed to save secret', { projectId, secretName, error });
      throw error;
    }
  }

  /**
   * Retrieve secret (decrypted)
   */
  async getSecret(projectId, secretName) {
    try {
      const secret = await Secret.findOne({ projectId, name: secretName });
      if (!secret) throw new Error('Secret not found');

      // Log access
      secret.accessLog.push({
        accessedAt: new Date(),
        accessedBy: 'system',
        action: 'read',
      });
      await secret.save();

      return {
        name: secret.name,
        value: this.decryptValue(secret.value),
        type: secret.type,
        environments: secret.environments,
      };
    } catch (error) {
      logger.error('Failed to retrieve secret', { projectId, secretName, error });
      throw error;
    }
  }

  /**
   * List all secrets (values hidden)
   */
  async listSecrets(projectId) {
    try {
      const secrets = await Secret.find({ projectId }).select('-value');
      return secrets.map(s => ({
        id: s._id,
        name: s.name,
        type: s.type,
        environments: s.environments,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));
    } catch (error) {
      logger.error('Failed to list secrets', { projectId, error });
      throw error;
    }
  }

  /**
   * Delete secret
   */
  async deleteSecret(projectId, secretName) {
    try {
      const result = await Secret.deleteOne({ projectId, name: secretName });
      if (result.deletedCount === 0) throw new Error('Secret not found');
      
      logger.info('Secret deleted', { projectId, secretName });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete secret', { projectId, secretName, error });
      throw error;
    }
  }

  /**
   * Rotate secret
   */
  async rotateSecret(projectId, secretName, newValue) {
    try {
      const secret = await Secret.findOne({ projectId, name: secretName });
      if (!secret) throw new Error('Secret not found');

      secret.value = this.encryptValue(newValue);
      secret.rotationPolicy.lastRotated = new Date();
      
      if (secret.rotationPolicy.interval) {
        const nextDate = new Date();
        if (secret.rotationPolicy.interval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (secret.rotationPolicy.interval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (secret.rotationPolicy.interval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        secret.rotationPolicy.nextRotation = nextDate;
      }

      await secret.save();
      logger.info('Secret rotated', { projectId, secretName });
      return secret;
    } catch (error) {
      logger.error('Failed to rotate secret', { projectId, secretName, error });
      throw error;
    }
  }

  /**
   * Enable secret rotation
   */
  async enableRotation(projectId, secretName, interval) {
    try {
      const secret = await Secret.findOne({ projectId, name: secretName });
      if (!secret) throw new Error('Secret not found');

      secret.rotationPolicy = {
        enabled: true,
        interval,
        lastRotated: new Date(),
        nextRotation: this.calculateNextRotation(new Date(), interval),
      };

      await secret.save();
      logger.info('Secret rotation enabled', { projectId, secretName, interval });
      return secret;
    } catch (error) {
      logger.error('Failed to enable rotation', { projectId, secretName, error });
      throw error;
    }
  }

  /**
   * Get access audit log
   */
  async getAccessLog(projectId, secretName) {
    try {
      const secret = await Secret.findOne({ projectId, name: secretName });
      if (!secret) throw new Error('Secret not found');

      return secret.accessLog.sort((a, b) => b.accessedAt - a.accessedAt);
    } catch (error) {
      logger.error('Failed to get access log', { projectId, secretName, error });
      throw error;
    }
  }

  /**
   * Encrypt value
   */
  encryptValue(value) {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.SECRET_KEY || 'default-key');
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt value
   */
  decryptValue(encrypted) {
    const decipher = crypto.createDecipher('aes-256-cbc', process.env.SECRET_KEY || 'default-key');
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  calculateNextRotation(lastDate, interval) {
    const nextDate = new Date(lastDate);
    if (interval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
    else if (interval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (interval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }
}

module.exports = new SecretsService();
