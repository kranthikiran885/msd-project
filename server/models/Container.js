const mongoose = require('mongoose');

const containerSchema = new mongoose.Schema(
    {
        deploymentVersionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeploymentVersion',
            required: true,
            index: true
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['pending', 'starting', 'running', 'stopping', 'stopped', 'failed', 'restarting'],
            default: 'pending',
            index: true
        },
        slot: {
            type: String,
            enum: ['blue', 'green', 'stable', 'canary'],
            default: 'production'
        },
        containerId: String, // Docker container ID
        containerName: String,
        imageId: String, // Docker image ID
        imageName: String,
        port: { type: Number, default: 3000 },
        hostname: String,
        ipAddress: String,
        resourceConfig: {
            cpu: { type: String, default: '0.5' }, // CPU cores
            memory: { type: String, default: '512m' }, // Memory limit
            ephemeralStorage: { type: String, default: '1gb' }
        },
        healthStatus: {
            type: String,
            enum: ['unknown', 'healthy', 'unhealthy'],
            default: 'unknown'
        },
        lastHealthCheck: Date,
        metrics: {
            cpuUsage: Number,
            memoryUsage: Number,
            networkIn: Number,
            networkOut: Number
        },
        logs: {
            stdout: [String],
            stderr: [String]
        },
        startedAt: Date,
        stoppedAt: Date,
        failureReason: String,
        restartCount: { type: Number, default: 0 },
        lastRestartAt: Date,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

containerSchema.index({ deploymentVersionId: 1, status: 1 });
containerSchema.index({ projectId: 1, status: 1 });
containerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Container', containerSchema);
