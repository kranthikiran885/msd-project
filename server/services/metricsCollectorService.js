const mongoose = require('mongoose');
const Container = require('../models/Container');
const Metric = require('../models/Metric');
const logService = require('./logService');

class MetricsCollectorService {
    /**
     * Start collecting metrics for a deployment
     */
    async startMetricsCollection(deploymentId, options = {}) {
        const {
            collectionInterval = 10000, // 10 seconds
            retentionPeriod = 86400000, // 24 hours
            aggregationWindow = 300000 // 5 minutes
        } = options;

        // Start background metrics collection
        this.runMetricsCollectionLoop(deploymentId, {
            collectionInterval,
            retentionPeriod,
            aggregationWindow
        }).catch(error => {
            console.error(`[v0-metrics] Error in metrics collection for ${deploymentId}:`, error);
        });

        return { status: 'metrics-collection-started' };
    }

    /**
     * Main metrics collection loop
     */
    async runMetricsCollectionLoop(deploymentId, config) {
        while (true) {
            try {
                // Collect metrics from all running containers
                const containers = await Container.find({
                    projectId: await this.getProjectIdForDeployment(deploymentId),
                    status: 'running'
                });

                for (const container of containers) {
                    const metrics = await this.collectContainerMetrics(container);
                    await this.storeMetrics(container._id, deploymentId, metrics);
                }

                // Cleanup old metrics
                await this.cleanupOldMetrics(deploymentId, config.retentionPeriod);

                await this.delay(config.collectionInterval);
            } catch (error) {
                console.error('[v0-metrics] Error in collection loop:', error);
                await this.delay(30000);
            }
        }
    }

    /**
     * Collect metrics from a single container
     */
    async collectContainerMetrics(container) {
        try {
            // In production, this would fetch from Docker API or container monitoring agent
            // For now, simulate metrics based on container state

            const baselineMetrics = {
                cpuUsage: Math.random() * 100,
                memoryUsage: Math.random() * 100,
                networkIn: Math.random() * 1000000,
                networkOut: Math.random() * 1000000,
                diskUsage: Math.random() * 100,
                processCount: Math.floor(Math.random() * 50) + 1,
                fileDescriptors: Math.floor(Math.random() * 256) + 50
            };

            // Update container's metrics
            container.metrics = {
                cpuUsage: baselineMetrics.cpuUsage,
                memoryUsage: baselineMetrics.memoryUsage,
                networkIn: baselineMetrics.networkIn,
                networkOut: baselineMetrics.networkOut
            };
            await container.save();

            return {
                timestamp: new Date(),
                containerId: container._id,
                containerName: container.containerName,
                ...baselineMetrics
            };
        } catch (error) {
            console.error('[v0-metrics] Error collecting container metrics:', error);
            return null;
        }
    }

    /**
     * Store metrics in database
     */
    async storeMetrics(containerId, deploymentId, metrics) {
        if (!metrics) return;

        try {
            await Metric.create({
                deploymentId,
                containerId,
                timestamp: metrics.timestamp,
                cpu: metrics.cpuUsage,
                memory: metrics.memoryUsage,
                networkIn: metrics.networkIn,
                networkOut: metrics.networkOut,
                diskUsage: metrics.diskUsage,
                processCount: metrics.processCount,
                fileDescriptors: metrics.fileDescriptors
            });
        } catch (error) {
            console.error('[v0-metrics] Error storing metrics:', error);
        }
    }

    /**
     * Get metrics for a container
     */
    async getContainerMetrics(containerId, options = {}) {
        const { limit = 100, lastHours = 1 } = options;

        const sinceTime = new Date(Date.now() - lastHours * 60 * 60 * 1000);

        const metrics = await Metric.find({
            containerId,
            timestamp: { $gte: sinceTime }
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        if (metrics.length === 0) {
            return { containerId, metrics: [] };
        }

        // Calculate statistics
        const cpuValues = metrics.map(m => m.cpu).filter(v => v != null);
        const memoryValues = metrics.map(m => m.memory).filter(v => v != null);
        const networkInValues = metrics.map(m => m.networkIn).filter(v => v != null);

        const stats = {
            cpu: {
                current: cpuValues[0] || 0,
                avg: cpuValues.length ? cpuValues.reduce((a, b) => a + b) / cpuValues.length : 0,
                max: Math.max(...cpuValues, 0),
                min: Math.min(...cpuValues, 0)
            },
            memory: {
                current: memoryValues[0] || 0,
                avg: memoryValues.length ? memoryValues.reduce((a, b) => a + b) / memoryValues.length : 0,
                max: Math.max(...memoryValues, 0),
                min: Math.min(...memoryValues, 0)
            },
            networkIn: {
                current: networkInValues[0] || 0,
                total: networkInValues.reduce((a, b) => a + b, 0)
            }
        };

        return {
            containerId,
            metrics,
            statistics: stats,
            timeWindow: `Last ${lastHours} hour(s)`,
            recordCount: metrics.length
        };
    }

    /**
     * Get deployment-wide metrics
     */
    async getDeploymentMetrics(deploymentId, options = {}) {
        const { limit = 100, lastHours = 1 } = options;

        const sinceTime = new Date(Date.now() - lastHours * 60 * 60 * 1000);

        const metrics = await Metric.find({
            deploymentId,
            timestamp: { $gte: sinceTime }
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        // Group by timestamp and aggregate
        const aggregated = this.aggregateMetrics(metrics);

        return {
            deploymentId,
            aggregatedMetrics: aggregated,
            totalDataPoints: metrics.length,
            timeWindow: `Last ${lastHours} hour(s)`
        };
    }

    /**
     * Aggregate metrics by timestamp
     */
    aggregateMetrics(metrics) {
        const grouped = {};

        metrics.forEach(metric => {
            const timestamp = metric.timestamp.getTime();
            if (!grouped[timestamp]) {
                grouped[timestamp] = {
                    timestamp: metric.timestamp,
                    cpuValues: [],
                    memoryValues: [],
                    containerCount: 0
                };
            }
            grouped[timestamp].cpuValues.push(metric.cpu);
            grouped[timestamp].memoryValues.push(metric.memory);
            grouped[timestamp].containerCount += 1;
        });

        return Object.values(grouped).map(group => ({
            timestamp: group.timestamp,
            avgCpu: group.cpuValues.length ? group.cpuValues.reduce((a, b) => a + b) / group.cpuValues.length : 0,
            maxCpu: Math.max(...group.cpuValues, 0),
            avgMemory: group.memoryValues.length ? group.memoryValues.reduce((a, b) => a + b) / group.memoryValues.length : 0,
            maxMemory: Math.max(...group.memoryValues, 0),
            containerCount: group.containerCount
        }));
    }

    /**
     * Get metrics summary for dashboard
     */
    async getMetricsSummary(deploymentId) {
        const recentMetrics = await Metric.find({ deploymentId })
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();

        if (recentMetrics.length === 0) {
            return {
                deploymentId,
                status: 'no-metrics-available'
            };
        }

        const cpuValues = recentMetrics.map(m => m.cpu).filter(v => v != null);
        const memoryValues = recentMetrics.map(m => m.memory).filter(v => v != null);

        const current = recentMetrics[0];

        return {
            deploymentId,
            current: {
                timestamp: current.timestamp,
                cpu: current.cpu,
                memory: current.memory
            },
            aggregates: {
                cpu: {
                    avg: (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(2),
                    max: Math.max(...cpuValues).toFixed(2),
                    min: Math.min(...cpuValues).toFixed(2)
                },
                memory: {
                    avg: (memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length).toFixed(2),
                    max: Math.max(...memoryValues).toFixed(2),
                    min: Math.min(...memoryValues).toFixed(2)
                }
            },
            dataPoints: recentMetrics.length,
            timeRange: `${recentMetrics.length} recent measurements`
        };
    }

    /**
     * Export metrics to CSV
     */
    async exportMetricsToCSV(deploymentId, options = {}) {
        const { lastHours = 24 } = options;

        const sinceTime = new Date(Date.now() - lastHours * 60 * 60 * 1000);

        const metrics = await Metric.find({
            deploymentId,
            timestamp: { $gte: sinceTime }
        })
            .sort({ timestamp: 1 })
            .lean();

        // Build CSV
        const headers = ['Timestamp', 'Container ID', 'CPU (%)', 'Memory (%)', 'Network In (bytes)', 'Network Out (bytes)', 'Disk Usage (%)'];
        const rows = metrics.map(m => [
            m.timestamp.toISOString(),
            m.containerId,
            m.cpu.toFixed(2),
            m.memory.toFixed(2),
            m.networkIn.toFixed(0),
            m.networkOut.toFixed(0),
            m.diskUsage.toFixed(2)
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        return csv;
    }

    /**
     * Cleanup old metrics beyond retention period
     */
    async cleanupOldMetrics(deploymentId, retentionMs) {
        const cutoffTime = new Date(Date.now() - retentionMs);

        const result = await Metric.deleteMany({
            deploymentId,
            timestamp: { $lt: cutoffTime }
        });

        console.log(`[v0-metrics] Cleaned up ${result.deletedCount} old metric records`);
        return result;
    }

    /**
     * Get metric percentiles for SLA tracking
     */
    async getMetricsPercentiles(deploymentId, options = {}) {
        const { lastHours = 1, metric = 'cpu' } = options;

        const sinceTime = new Date(Date.now() - lastHours * 60 * 60 * 1000);

        const metrics = await Metric.find({
            deploymentId,
            timestamp: { $gte: sinceTime }
        })
            .select(metric)
            .sort({ timestamp: -1 })
            .lean();

        if (metrics.length === 0) {
            return { metric, percentiles: {} };
        }

        const values = metrics.map(m => m[metric]).sort((a, b) => a - b);

        return {
            metric,
            percentiles: {
                p50: values[Math.floor(values.length * 0.5)],
                p75: values[Math.floor(values.length * 0.75)],
                p90: values[Math.floor(values.length * 0.9)],
                p95: values[Math.floor(values.length * 0.95)],
                p99: values[Math.floor(values.length * 0.99)]
            },
            samples: values.length
        };
    }

    /**
     * Get project ID for deployment
     */
    async getProjectIdForDeployment(deploymentId) {
        const Deployment = require('../models/Deployment');
        const deployment = await Deployment.findById(deploymentId);
        return deployment ? deployment.projectId : null;
    }

    /**
     * Helper to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new MetricsCollectorService();
