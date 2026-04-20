const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const databaseBackupSchema = new Schema({
  databaseId: { type: Schema.Types.ObjectId, ref: 'DatabaseInstance', required: true, index: true },
  snapshotId: { type: String, required: true },
  type: { type: String, enum: ['manual', 'automatic', 'final'], default: 'manual' },
  size: Number,
  status: { type: String, enum: ['creating', 'completed', 'failed'], default: 'creating' },
  completedAt: Date,
  retentionDays: { type: Number, default: 7 },
  encrypted: { type: Boolean, default: true },
  storageLocation: String,
  restorePoints: [{ type: Date }],
  createdAt: { type: Date, default: Date.now },
});

databaseBackupSchema.index({ databaseId: 1, createdAt: -1 });

module.exports = mongoose.model('DatabaseBackup', databaseBackupSchema);
