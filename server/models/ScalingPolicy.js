const mongoose = require('mongoose');

const scalingPolicySchema = new mongoose.Schema(
    {
        deploymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Deployment',
            required: true,
            unique: true,
            index: true
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        minReplicas: { type: Number, default: 1, min: 1 },
        maxReplicas: { type: Number, default: 10, min: 1 },
        targetCpuUtilization: { type: Number, default: 70, min: 0, max: 100 },
        targetMemoryUtilization: { type: Number, default: 80, min: 0, max: 100 },
        targetRequestsPerSecond: Number,
        scaleUpThreshold: { type: Number, default: 70, min: 0, max: 100 },
        scaleDownThreshold: { type: Number, default: 30, min: 0, max: 100 },
        scaleUpCooldown: { type: Number, default: 60000 }, // milliseconds
        scaleDownCooldown: { type: Number, default: 300000 }, // milliseconds
        metricsCheckInterval: { type: Number, default: 30000 }, // milliseconds
        enabled: { type: Boolean, default: true, index: true },
        policyType: {
            type: String,
            enum: ['cpu-memory', 'request-based', 'custom'],
            default: 'cpu-memory'
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        lastScalingAction: {
            timestamp: Date,
            action: String,
            from: Number,
            to: Number,
            reason: String
        }
    },
    { timestamps: true }
);

scalingPolicySchema.index({ deploymentId: 1, enabled: 1 });
scalingPolicySchema.index({ projectId: 1, enabled: 1 });

module.exports = mongoose.model('ScalingPolicy', scalingPolicySchema);
