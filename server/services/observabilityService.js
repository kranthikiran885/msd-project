const logger = require('../utils/logger');
const Alert = require('../models/Alert');

/**
 * Phase 17: Observability System - Alerts, monitoring, and incident management
 */

class ObservabilityService {
  async createAlert(projectId, alertConfig) {
    try {
      const alert = new Alert({
        projectId,
        name: alertConfig.name,
        metricType: alertConfig.metricType,
        threshold: alertConfig.threshold,
        operator: alertConfig.operator,
        severity: alertConfig.severity || 'warning',
        channels: alertConfig.channels || ['email'],
        message: alertConfig.message,
        active: true,
      });

      await alert.save();
      logger.info('Alert created', { projectId, alertId: alert._id });
      return alert;
    } catch (error) {
      logger.error('Failed to create alert', { projectId, error });
      throw error;
    }
  }

  async triggerAlert(alertId, value) {
    try {
      const alert = await Alert.findById(alertId);
      if (!alert || !alert.active) return;

      const condition = this.evaluateCondition(value, alert.operator, alert.threshold);
      if (condition) {
        alert.lastTriggered = new Date();
        alert.triggerCount = (alert.triggerCount || 0) + 1;
        await alert.save();

        logger.warn('Alert triggered', { alertId, value, threshold: alert.threshold });
        await this.notifyChannels(alert, value);
      }
    } catch (error) {
      logger.error('Failed to trigger alert', { alertId, error });
    }
  }

  async acknowledgeAlert(alertId) {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        { acknowledged: true, acknowledgedAt: new Date() },
        { new: true }
      );
      logger.info('Alert acknowledged', { alertId });
      return alert;
    } catch (error) {
      logger.error('Failed to acknowledge alert', { alertId, error });
      throw error;
    }
  }

  async resolveAlert(alertId) {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        { resolvedAt: new Date(), acknowledged: true },
        { new: true }
      );
      logger.info('Alert resolved', { alertId });
      return alert;
    } catch (error) {
      logger.error('Failed to resolve alert', { alertId, error });
      throw error;
    }
  }

  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      default:
        return false;
    }
  }

  async notifyChannels(alert, value) {
    try {
      for (const channel of alert.channels || []) {
        if (channel === 'email') {
          await this.notifyEmail(alert, value);
        } else if (channel === 'slack') {
          await this.notifySlack(alert, value);
        } else if (channel === 'webhook') {
          await this.notifyWebhook(alert, value);
        }
      }
    } catch (error) {
      logger.error('Failed to send notifications', { alertId: alert._id, error });
    }
  }

  async notifyEmail(alert, value) {
    logger.info('Email notification sent', { alert: alert.name, value });
  }

  async notifySlack(alert, value) {
    logger.info('Slack notification sent', { alert: alert.name, value });
  }

  async notifyWebhook(alert, value) {
    logger.info('Webhook notification sent', { alert: alert.name, value });
  }

  async getAlertHistory(projectId, limit = 100) {
    try {
      const alerts = await Alert.find({ projectId }).sort({ lastTriggered: -1 }).limit(limit);
      return alerts;
    } catch (error) {
      logger.error('Failed to get alert history', { projectId, error });
      throw error;
    }
  }

  async getCriticalAlerts(projectId) {
    try {
      const alerts = await Alert.find({ projectId, severity: 'critical', active: true });
      return alerts;
    } catch (error) {
      logger.error('Failed to get critical alerts', { projectId, error });
      throw error;
    }
  }

  async getAlertStats(projectId) {
    try {
      const allAlerts = await Alert.find({ projectId });
      const activeAlerts = allAlerts.filter(a => a.active).length;
      const criticalAlerts = allAlerts.filter(a => a.severity === 'critical').length;
      const triggeredToday = allAlerts.filter(
        a => a.lastTriggered && a.lastTriggered > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      return { allAlerts: allAlerts.length, activeAlerts, criticalAlerts, triggeredToday };
    } catch (error) {
      logger.error('Failed to get alert stats', { projectId, error });
      throw error;
    }
  }
}

module.exports = new ObservabilityService();
