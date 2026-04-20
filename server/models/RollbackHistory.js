const mongoose = require('mongoose');

const rollbackHistorySchema = new mongoose.Schema(
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
        fromVersionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeploymentVersion'
        },
        fromVersion: String,
        toVersionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeploymentVersion',
            required: true
        },
        toVersion: {
            type: String,
            required: true
        },
        reason: {
            type: String,
            required: true
        },
        initiatedBy: String, // userId or 'system'
        completionMethod: {
            type: String,
            enum: ['immediate', 'gradual', 'scheduled'],
            default: null
        },
        status: {
            type: String,
            enum: ['in-progress', 'completed', 'failed', 'cancelled'],
            default: 'in-progress'
        },
        timestamp: { type: Date, default: Date.now, index: true },
        completedAt: Date,
        cancelledAt: Date,
        cancellationReason: String,
        duration: Number, // milliseconds
        errorMessage: String,
        rollbackSteps: [
            {
                step: Number,
                timestamp: Date,
                action: String,
                status: String,
                details: mongoose.Schema.Types.Mixed
            }
        ]
    },
    { timestamps: true }
);

rollbackHistorySchema.index({ deploymentId: 1, timestamp: -1 });
rollbackHistorySchema.index({ projectId: 1, timestamp: -1 });
rollbackHistorySchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('RollbackHistory', rollbackHistorySchema);
