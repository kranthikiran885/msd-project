const mongoose = require('mongoose');

const canaryReleaseSchema = new mongoose.Schema(
    {
        deploymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Deployment',
            required: true,
            index: true
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        canaryPercentage: {
            type: Number,
            default: 5,
            min: 1,
            max: 100
        },
        status: {
            type: String,
            enum: ['active', 'completed', 'rolled-back', 'failed'],
            default: 'active',
            index: true
        },
        result: {
            type: String,
            enum: ['promoted', 'rolled-back', 'failed'],
            default: null
        },
        configuration: {
            maxErrorRate: { type: Number, default: 0.05 },
            metricsCheckInterval: { type: Number, default: 30000 },
            metricsWindow: { type: Number, default: 300000 },
            autoPromoteThreshold: { type: Number, default: 10 },
            maxDuration: { type: Number, default: 3600000 }
        },
        metrics: [
            {
                timestamp: Date,
                canaryMetrics: {
                    requestCount: Number,
                    errorCount: Number,
                    p95Latency: Number,
                    p99Latency: Number,
                    cpuUsage: Number,
                    memoryUsage: Number,
                    errorRate: Number
                },
                stableMetrics: {
                    requestCount: Number,
                    errorCount: Number,
                    p95Latency: Number,
                    p99Latency: Number,
                    cpuUsage: Number,
                    memoryUsage: Number,
                    errorRate: Number
                },
                comparison: {
                    errorRateDifference: Number,
                    p95LatencyDifference: Number,
                    p99LatencyDifference: Number
                },
                healthy: Boolean
            }
        ],
        rollbackReason: String,
        startedAt: { type: Date, default: Date.now },
        completedAt: Date,
        promotionStartedAt: Date,
        promotionCompletedAt: Date
    },
    { timestamps: true }
);

canaryReleaseSchema.index({ deploymentId: 1, status: 1 });
canaryReleaseSchema.index({ projectId: 1, status: 1 });
canaryReleaseSchema.index({ startedAt: -1 });

module.exports = mongoose.model('CanaryRelease', canaryReleaseSchema);
