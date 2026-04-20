const mongoose = require('mongoose');

const healthCheckSchema = new mongoose.Schema(
    {
        versionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeploymentVersion',
            required: true,
            index: true
        },
        deploymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Deployment',
            required: true,
            index: true
        },
        healthy: {
            type: Boolean,
            required: true,
            index: true
        },
        statusCode: Number,
        responseTime: { type: Number, default: 0 },
        error: String,
        endpoint: { type: String, default: '/health' },
        timestamp: { type: Date, default: Date.now, index: true },
        checkNumber: Number,
        consecutiveFailures: { type: Number, default: 0 },
        consecutiveSuccesses: { type: Number, default: 0 }
    },
    { timestamps: true }
);

// Index for efficient querying of recent checks
healthCheckSchema.index({ versionId: 1, timestamp: -1 });
healthCheckSchema.index({ deploymentId: 1, timestamp: -1 });
healthCheckSchema.index({ timestamp: -1 }); // For retention cleanup

module.exports = mongoose.model('HealthCheck', healthCheckSchema);
