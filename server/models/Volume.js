const mongoose = require('mongoose');
const { Schema } = mongoose;

const volumeSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', index: true },
  
  name: { type: String, required: true, index: true },
  description: String,
  
  // Volume configuration
  type: {
    type: String,
    enum: ['emptyDir', 'hostPath', 'nfs', 'block', 'network'],
    default: 'emptyDir',
    required: true
  },
  
  size: { type: Number, required: true }, // In bytes
  sizeGb: { type: Number }, // In GB (calculated)
  
  // Storage class/tier
  storageClass: {
    type: String,
    enum: ['standard', 'fast', 'ssd', 'archive'],
    default: 'standard'
  },
  
  // Volume source configuration
  source: {
    // For hostPath
    hostPath: String,
    
    // For NFS
    nfsServer: String,
    nfsPath: String,
    nfsVersion: { type: String, default: 'nfs3' },
    
    // For block storage
    blockDevicePath: String,
    
    // For network storage
    networkPath: String,
    networkProtocol: { type: String, enum: ['smb', 'cifs'], default: 'smb' }
  },
  
  // Mount configuration
  mounts: [{
    containerId: mongoose.Schema.Types.ObjectId,
    containerName: String,
    mountPath: String,
    readOnly: { type: Boolean, default: false },
    subPath: String, // Mount subdirectory
    propagation: {
      type: String,
      enum: ['None', 'HostToContainer', 'Bidirectional'],
      default: 'None'
    }
  }],
  
  // Backup configuration
  backup: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'], default: 'daily' },
    retentionDays: { type: Number, default: 30 },
    lastBackupTime: Date,
    lastBackupId: mongoose.Schema.Types.ObjectId,
    backupLocation: String,
    isIncremental: { type: Boolean, default: true }
  },
  
  // Snapshots for point-in-time recovery
  snapshots: [{
    snapshotId: mongoose.Schema.Types.ObjectId,
    name: String,
    description: String,
    size: Number,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    tags: [String]
  }],
  
  // Usage and metrics
  metrics: {
    usedBytes: { type: Number, default: 0 },
    usedGb: { type: Number, default: 0 },
    usagePercentage: { type: Number, default: 0 },
    inodesUsed: { type: Number, default: 0 },
    inodesTotal: Number,
    lastMetricsUpdate: Date,
    readOps: { type: Number, default: 0 },
    writeOps: { type: Number, default: 0 },
    readBytes: { type: Number, default: 0 },
    writeBytes: { type: Number, default: 0 }
  },
  
  // Access control
  permissions: {
    uid: { type: Number, default: 0 },
    gid: { type: Number, default: 0 },
    mode: { type: String, default: '0755' }
  },
  
  // Lifecycle and status
  status: {
    type: String,
    enum: ['creating', 'available', 'in-use', 'deleting', 'failed'],
    default: 'creating',
    index: true
  },
  
  // Reclaim policy (what happens when volume is unbound)
  reclaimPolicy: {
    type: String,
    enum: ['Retain', 'Delete', 'Recycle'],
    default: 'Delete'
  },
  
  // Performance parameters
  performance: {
    iops: Number, // For block devices
    throughput: Number, // MB/s
    latencyMs: Number
  },
  
  // Encryption
  encryption: {
    enabled: { type: Boolean, default: false },
    algorithm: { type: String, default: 'AES-256' },
    keyId: mongoose.Schema.Types.ObjectId
  },
  
  // Replication
  replication: {
    enabled: { type: Boolean, default: false },
    replicas: { type: Number, default: 1 },
    replicationTargets: [String] // Node IDs or zones
  },
  
  // Labels and tags
  labels: { type: Map, of: String },
  tags: [String],
  
  // Status tracking
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastAccessedAt: Date
});

// Indexes
volumeSchema.index({ projectId: 1, status: 1 });
volumeSchema.index({ deploymentId: 1 });
volumeSchema.index({ name: 1, projectId: 1 });

// Pre-save hook to calculate sizes
volumeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.sizeGb = (this.size / (1024 * 1024 * 1024)).toFixed(2);
  if (this.metrics.usedBytes !== undefined) {
    this.metrics.usedGb = (this.metrics.usedBytes / (1024 * 1024 * 1024)).toFixed(2);
    this.metrics.usagePercentage = ((this.metrics.usedBytes / this.size) * 100).toFixed(2);
  }
  next();
});

module.exports = mongoose.model('Volume', volumeSchema);
