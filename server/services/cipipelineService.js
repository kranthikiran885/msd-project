const logger = require('../utils/logger');
const CIPipeline = require('../models/CIPipeline');

/**
 * Phase 18: CI/CD Advanced Pipeline - Multi-stage builds, testing, deployment
 */

class CIPipelineService {
  async createPipeline(projectId, pipelineConfig) {
    try {
      const pipeline = new CIPipeline({
        projectId,
        name: pipelineConfig.name,
        status: 'active',
        triggers: pipelineConfig.triggers || { onPush: true, onPullRequest: true },
        stages: pipelineConfig.stages || [],
        environment: pipelineConfig.environment || {},
        notifications: pipelineConfig.notifications || {},
      });

      await pipeline.save();
      logger.info('CI Pipeline created', { projectId, pipelineId: pipeline._id });
      return pipeline;
    } catch (error) {
      logger.error('Failed to create pipeline', { projectId, error });
      throw error;
    }
  }

  async executePipeline(pipelineId, triggerData) {
    try {
      const pipeline = await CIPipeline.findById(pipelineId);
      if (!pipeline || pipeline.status !== 'active') throw new Error('Pipeline not active');

      const runId = `run-${pipelineId}-${Date.now()}`;
      const run = {
        runId,
        status: 'running',
        startedAt: new Date(),
      };

      pipeline.runs.push(run);
      await pipeline.save();

      // Simulate execution
      setTimeout(async () => {
        const pipelineDoc = await CIPipeline.findById(pipelineId);
        const runIndex = pipelineDoc.runs.findIndex(r => r.runId === runId);
        if (runIndex !== -1) {
          pipelineDoc.runs[runIndex].status = 'completed';
          pipelineDoc.runs[runIndex].completedAt = new Date();
          pipelineDoc.runs[runIndex].duration = Math.random() * 600 + 60; // 1-10 minutes
          await pipelineDoc.save();
        }
      }, 5000);

      logger.info('Pipeline execution started', { pipelineId, runId });
      return { runId, status: 'running' };
    } catch (error) {
      logger.error('Failed to execute pipeline', { pipelineId, error });
      throw error;
    }
  }

  async getRuns(pipelineId, limit = 50) {
    try {
      const pipeline = await CIPipeline.findById(pipelineId);
      if (!pipeline) throw new Error('Pipeline not found');

      return pipeline.runs.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
    } catch (error) {
      logger.error('Failed to get runs', { pipelineId, error });
      throw error;
    }
  }

  async getRun(pipelineId, runId) {
    try {
      const pipeline = await CIPipeline.findById(pipelineId);
      if (!pipeline) throw new Error('Pipeline not found');

      const run = pipeline.runs.find(r => r.runId === runId);
      return run || null;
    } catch (error) {
      logger.error('Failed to get run', { pipelineId, runId, error });
      throw error;
    }
  }

  async addStage(pipelineId, stage) {
    try {
      const pipeline = await CIPipeline.findById(pipelineId);
      if (!pipeline) throw new Error('Pipeline not found');

      pipeline.stages.push(stage);
      await pipeline.save();

      logger.info('Stage added to pipeline', { pipelineId, stageName: stage.name });
      return pipeline;
    } catch (error) {
      logger.error('Failed to add stage', { pipelineId, error });
      throw error;
    }
  }

  async removeStage(pipelineId, stageName) {
    try {
      const pipeline = await CIPipeline.findById(pipelineId);
      if (!pipeline) throw new Error('Pipeline not found');

      pipeline.stages = pipeline.stages.filter(s => s.name !== stageName);
      await pipeline.save();

      logger.info('Stage removed from pipeline', { pipelineId, stageName });
      return pipeline;
    } catch (error) {
      logger.error('Failed to remove stage', { pipelineId, error });
      throw error;
    }
  }

  async updateTriggers(pipelineId, triggers) {
    try {
      const pipeline = await CIPipeline.findByIdAndUpdate(
        pipelineId,
        { triggers },
        { new: true }
      );
      logger.info('Pipeline triggers updated', { pipelineId });
      return pipeline;
    } catch (error) {
      logger.error('Failed to update triggers', { pipelineId, error });
      throw error;
    }
  }

  async getPipelineStats(pipelineId) {
    try {
      const pipeline = await CIPipeline.findById(pipelineId);
      if (!pipeline) throw new Error('Pipeline not found');

      const totalRuns = pipeline.runs.length;
      const successfulRuns = pipeline.runs.filter(r => r.status === 'completed').length;
      const failedRuns = pipeline.runs.filter(r => r.status === 'failed').length;
      const avgDuration = pipeline.runs.reduce((sum, r) => sum + (r.duration || 0), 0) / totalRuns || 0;

      return { totalRuns, successfulRuns, failedRuns, successRate: (successfulRuns / totalRuns * 100).toFixed(2), avgDuration };
    } catch (error) {
      logger.error('Failed to get pipeline stats', { pipelineId, error });
      throw error;
    }
  }
}

module.exports = new CIPipelineService();
