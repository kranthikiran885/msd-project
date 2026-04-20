const mongoose = require('mongoose');
const { Schema } = mongoose;

const loadBalancerSessionSchema = new Schema({
  loadBalancerId: { type: Schema.Types.ObjectId, ref: 'LoadBalancer', required: true, index: true },
  deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true, index: true },
  
  // Session identifier
  sessionId: { type: String, required: true, unique: true, index: true },
  clientIp: { type: String, required: true, index: true },
  
  // Sticky routing
  assignedUpstream: {
    id: mongoose.Schema.Types.ObjectId,
    host: String,
    port: Number
  },
  
  // Session tracking
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  
  // Metrics
  requestCount: { type: Number, default: 0 },
  totalBytesIn: { type: Number, default: 0 },
  totalBytesOut: { type: Number, default: 0 }
});

// TTL index for automatic session cleanup
loadBalancerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update activity timestamp on access
loadBalancerSessionSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

module.exports = mongoose.model('LoadBalancerSession', loadBalancerSessionSchema);
