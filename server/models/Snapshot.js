const mongoose = require('mongoose');
const { Schema } = mongoose;

const snapshotSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  volumeId: { type: Schema.Types.ObjectId, ref: 'Volume', required: true, index: true },
  
  name: { type: String, required: true, index: true },
  description: String,
  
  // Snapshot metadata
  sourceVolume: {
    volumeId: mongoose.Schema.Types.ObjectId,
    volumeName: String,
    volumeSize: Number
  },
  
  // Snapshot details
  size: { type: Number, required: true }, // Size at time of snapshot
  sizeGb: Number,
  dataSize: Number, // Actual data size (for deduplication)
  
  // Type and mode
  type: {
    type: String,
    enum: ['full', 'incremental', 'differential'],
    default: 'incremental'
  },
  
  mode: {
    type: String,
    enum: ['crash-consistent', 'application-consistent'],
    default: 'crash-consistent'
  },
  
  // Storage details
  storageLocation: String,
  storageClass: {
    type: String,
    enum: ['standard', 'archive'],
    default: 'standard'
  },
  
  // Metadata and versioning
  parentSnapshotId: mongoose.Schema.Types.ObjectId,
  chainDepth: { type: Number, default: 1 },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed', 'deleting'],
    default: 'pending',
    index: true
  },
  
  progress: { type: Number, default: 0 }, // 0-100 percentage
  
  // Timeline
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
  expiresAt: Date,
  
  // Restoration
  restoreInfo: {
    canRestore: { type: Boolean, default: false },
    restoredFrom: {
      snapshotId: mongoose.Schema.Types.ObjectId,
      timestamp: Date
    },
    restoreCount: { type: Number, default: 0 },
    lastRestoreTime: Date
  },
  
  // Verification
  checksumAlgorithm: String,
  checksumValue: String,
  verificationStatus: {
    type: String,
    enum: ['not-verified', 'verified', 'failed'],
    default: 'not-verified'
  },
  
  // Tags and labels
  labels: { type: Map, of: String },
  tags: [String],
  
  // Retention policy
  retentionPolicy: {
    type: String,
    enum: ['manual', 'automatic', 'locked'],
    default: 'automatic'
  },
  
  // Encryption
  encryption: {
    enabled: { type: Boolean, default: false },
    algorithm: String,
    keyId: mongoose.Schema.Types.ObjectId
  },
  
  // Deduplication metadata
  deduplication: {
    enabled: { type: Boolean, default: false },
    deduplicatedSize: Number,
    deduplicationRatio: Number
  },
  
  // Metadata
  metadata: { type: Map, of: String },
  
  // Error tracking
  error: {
    code: String,
    message: String,
    details: String
  }
});

// Indexes
snapshotSchema.index({ projectId: 1, status: 1 });
snapshotSchema.index({ volumeId: 1, createdAt: -1 });
snapshotSchema.index({ expiresAt: 1 });

// TTL index for automatic cleanup of expired snapshots
snapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Snapshot', snapshotSchema);
