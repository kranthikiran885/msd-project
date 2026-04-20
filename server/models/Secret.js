const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const secretSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  value: { type: String, required: true }, // Encrypted in production
  type: { type: String, enum: ['api_key', 'password', 'token', 'certificate', 'other'], default: 'other' },
  environments: [{ type: String }], // production, staging, development
  rotationPolicy: {
    enabled: { type: Boolean, default: false },
    interval: String, // daily, weekly, monthly
    lastRotated: Date,
    nextRotation: Date,
  },
  accessLog: [{
    accessedAt: Date,
    accessedBy: String,
    action: String,
  }],
  tags: { type: Map, of: String },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

secretSchema.index({ projectId: 1, name: 1 });
secretSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Secret', secretSchema);
