const mongoose = require('mongoose');
const { Schema } = mongoose;

const backupSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  volumeId: { type: Schema.Types.ObjectId, ref: 'Volume', required: true, index: true },
  snapshotId: { type: Schema.Types.ObjectId, ref: 'Snapshot', index: true },
  
  name: { type: String, required: true, index: true },
  description: String,
  
  // Backup source
  source: {
    volumeId: mongoose.Schema.Types.ObjectId,
    volumeName: String,
    volumeSize: Number,
    volumeUsage: Number
  },
  
  // Backup type and method
  type: {
    type: String,
    enum: ['full', 'incremental', 'differential', 'mirror'],
    default: 'incremental'
  },
  
  backupMethod: {
    type: String,
    enum: ['snapshot', 'sync', 'replication'],
    default: 'snapshot'
  },
  
  // Destination
  destination: {
    type: {
      type: String,
      enum: ['local', 's3', 'gcs', 'azure', 'custom'],
      required: true
    },
    location: String,
    bucket: String,
    prefix: String,
    region: String,
    storageClass: String
  },
  
  // Size information
  size: {
    originalSize: Number,
    compressedSize: Number,
    transferredSize: Number,
    compressionRatio: Number,
    deduplicationRatio: Number
  },
  
  // Timing
  scheduledTime: Date,
  startTime: Date,
    endTime: Date,
  estimatedDuration: Number, // milliseconds
  actualDuration: Number,
  
  // Status
  status: {
    type: String,
    enum: ['scheduled', 'running', 'completed', 'failed', 'partial', 'verified'],
    default: 'scheduled',
    index: true
  },
  
  progress: { type: Number, default: 0 }, // 0-100 percentage
  
  // Verification
  verification: {
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending', 'verifying', 'verified', 'failed'],
      default: 'pending'
    },
    checksumAlgorithm: String,
    checksumValue: String,
    verificationTime: Date
  },
  
  // Retention
  retention: {
    deleteAfterDays: Number,
    locked: { type: Boolean, default: false },
    expiresAt: Date
  },
  
  // Encryption in transit/at-rest
  encryption: {
    inTransit: {
      enabled: { type: Boolean, default: true },
      protocol: { type: String, default: 'TLS1.3' }
    },
    atRest: {
      enabled: { type: Boolean, default: false },
      algorithm: String,
      keyId: mongoose.Schema.Types.ObjectId
    }
  },
  
  // Performance metrics
  metrics: {
    throughputMbps: Number,
    ioops: Number,
    networkLatencyMs: Number,
    dedupeRate: Number,
    compressionRate: Number
  },
  
  // Restore information
  restore: {
    restoreCount: { type: Number, default: 0 },
    lastRestoreTime: Date,
    isCloneable: { type: Boolean, default: true },
    clones: [{
      cloneId: mongoose.Schema.Types.ObjectId,
      createdAt: Date,
      status: String
    }]
  },
  
  // Tags and labels
  labels: { type: Map, of: String },
  tags: [String],
  
  // Error handling
  error: {
    code: String,
    message: String,
    retryCount: { type: Number, default: 0 },
    lastRetryTime: Date
  },
  
  // Manifest (list of files/blocks included)
  manifest: {
    fileCount: Number,
    directoryCount: Number,
    blockCount: Number,
    manifestLocation: String,
    manifestHash: String
  },
  
  // Metadata
  metadata: { type: Map, of: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
backupSchema.index({ projectId: 1, status: 1 });
backupSchema.index({ volumeId: 1, createdAt: -1 });
backupSchema.index({ 'retention.expiresAt': 1 });

// TTL index for automatic cleanup
backupSchema.index({ 'retention.expiresAt': 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Backup', backupSchema);
