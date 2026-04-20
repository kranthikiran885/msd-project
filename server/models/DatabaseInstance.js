const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const databaseInstanceSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  engine: { type: String, enum: ['postgresql', 'mysql', 'mongodb', 'redis'], required: true },
  version: { type: String, required: true },
  instanceClass: String,
  allocatedStorage: { type: Number, default: 100 }, // GB
  multiAZ: { type: Boolean, default: false },
  backupRetentionDays: { type: Number, default: 7 },
  publiclyAccessible: { type: Boolean, default: false },
  status: { type: String, enum: ['creating', 'available', 'modifying', 'deleting'], default: 'creating' },
  region: { type: String, default: 'us-east-1' },
  endpoint: String,
  port: Number,
  masterUsername: String,
  readReplicas: [{ type: Schema.Types.ObjectId, ref: 'DatabaseInstance' }],
  sourceDbId: { type: Schema.Types.ObjectId, ref: 'DatabaseInstance' },
  replicaOf: { type: Schema.Types.ObjectId, ref: 'DatabaseInstance' },
  restoredFromSnapshot: String,
  modifyPending: { type: Boolean, default: false },
  monitoringMetrics: {
    enabled: { type: Boolean, default: false },
    granularity: Number,
    metrics: [String],
  },
  costEstimate: {
    monthlyCost: Number,
    annualCost: Number,
    updatedAt: Date,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

databaseInstanceSchema.index({ projectId: 1, status: 1 });
databaseInstanceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DatabaseInstance', databaseInstanceSchema);
