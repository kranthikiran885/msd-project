const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cipipelineSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'paused', 'disabled'], default: 'active' },
  triggers: {
    onPush: { type: Boolean, default: true },
    onPullRequest: { type: Boolean, default: true },
    onTag: { type: Boolean, default: false },
    schedule: String, // cron expression
  },
  stages: [{
    name: String,
    steps: [{
      name: String,
      script: String,
      timeout: Number,
      allowFailure: { type: Boolean, default: false },
    }],
  }],
  environment: { type: Map, of: String },
  notifications: {
    onSuccess: [String],
    onFailure: [String],
  },
  runs: [{
    runId: String,
    status: String,
    startedAt: Date,
    completedAt: Date,
    duration: Number,
  }],
  createdAt: { type: Date, default: Date.now },
});

cipipelineSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('CIPipeline', cipipelineSchema);
