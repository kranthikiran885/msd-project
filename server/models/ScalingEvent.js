const mongoose = require('mongoose');

const scalingEventSchema = new mongoose.Schema(
    {
        deploymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Deployment',
            required: true,
            index: true
        },
        policyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ScalingPolicy',
            required: true,
            index: true
        },
        metrics: {
            cpuUtilization: Number,
            memoryUtilization: Number,
            requestsPerSecond: Number,
            errorRate: Number,
            averageLatency: Number,
            totalContainers: Number,
            healthyContainers: Number,
            unhealthyContainers: Number
        },
        decision: {
            action: {
                type: String,
                enum: ['scale-up', 'scale-down', 'no-action'],
                required: true
            },
            currentReplicas: Number,
            targetReplicas: Number,
            reason: String,
            metrics: mongoose.Schema.Types.Mixed
        },
        currentReplicas: Number,
        timestamp: { type: Date, default: Date.now, index: true }
    },
    { timestamps: true }
);

scalingEventSchema.index({ deploymentId: 1, timestamp: -1 });
scalingEventSchema.index({ policyId: 1, timestamp: -1 });

module.exports = mongoose.model('ScalingEvent', scalingEventSchema);
