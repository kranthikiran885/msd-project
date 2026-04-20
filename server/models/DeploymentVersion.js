const mongoose = require('mongoose');

const deploymentVersionSchema = new mongoose.Schema(
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
        version: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'standby', 'active', 'retired', 'failed'],
            default: 'pending',
            index: true
        },
        slotType: {
            type: String,
            enum: ['blue', 'green', 'stable', 'canary', 'production'],
            default: 'production'
        },
        containerImage: String,
        containerUrl: String,
        port: { type: Number, default: 3000 },
        containerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Container'
        },
        environmentVariables: mongoose.Schema.Types.Mixed,
        trafficPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        healthStatus: {
            type: String,
            enum: ['unknown', 'healthy', 'unhealthy', 'degraded'],
            default: 'unknown'
        },
        degradationReason: String,
        healthChecks: [
            {
                timestamp: Date,
                attempt: Number,
                healthy: Boolean,
                reason: String,
                responseTime: Number
            }
        ],
        commitSha: String,
        commitMessage: String,
        buildLog: String,
        createdAt: { type: Date, default: Date.now },
        activatedAt: Date,
        retiredAt: Date,
        failedAt: Date,
        failureReason: String,
        metrics: {
            cpuUsage: Number,
            memoryUsage: Number,
            requestCount: Number,
            errorCount: Number,
            averageLatency: Number
        }
    },
    { timestamps: true }
);

deploymentVersionSchema.index({ deploymentId: 1, status: 1 });
deploymentVersionSchema.index({ projectId: 1, status: 1 });
deploymentVersionSchema.index({ createdAt: -1 });
deploymentVersionSchema.index({ activatedAt: -1 });

module.exports = mongoose.model('DeploymentVersion', deploymentVersionSchema);
