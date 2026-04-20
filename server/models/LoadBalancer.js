const mongoose = require('mongoose');
const { Schema } = mongoose;

const loadBalancerSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true, index: true },
  name: { type: String, required: true },
  
  // Load balancing strategy
  strategy: {
    type: String,
    enum: ['round-robin', 'least-connections', 'ip-hash', 'weighted', 'least-response-time'],
    default: 'round-robin',
    required: true
  },
  
  // Health check configuration
  healthCheck: {
    enabled: { type: Boolean, default: true },
    interval: { type: Number, default: 10000 }, // milliseconds
    timeout: { type: Number, default: 5000 },
    unhealthyThreshold: { type: Number, default: 3 },
    healthyThreshold: { type: Number, default: 2 },
    path: { type: String, default: '/health' },
    protocol: { type: String, enum: ['http', 'https'], default: 'http' }
  },
  
  // Upstream servers/replicas
  upstreams: [{
    id: mongoose.Schema.Types.ObjectId,
    host: String,
    port: Number,
    weight: { type: Number, default: 1 },
    maxConnections: { type: Number, default: 100 },
    healthy: { type: Boolean, default: true },
    activeConnections: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    lastHealthCheck: Date,
    downSince: Date
  }],
  
  // Session persistence
  sessionPersistence: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['cookie', 'ip-hash', 'jessionid'], default: 'cookie' },
    cookieName: String,
    ttl: { type: Number, default: 3600000 } // 1 hour in milliseconds
  },
  
  // Rate limiting
  rateLimit: {
    enabled: { type: Boolean, default: false },
    requestsPerSecond: Number,
    burstSize: Number,
    byIp: { type: Boolean, default: true }
  },
  
  // Connection settings
  connectionTimeout: { type: Number, default: 30000 }, // 30 seconds
  keepAliveTimeout: { type: Number, default: 60000 }, // 60 seconds
  maxRequestsPerConnection: { type: Number, default: 1000 },
  
  // Retry configuration
  retryPolicy: {
    enabled: { type: Boolean, default: true },
    maxRetries: { type: Number, default: 2 },
    retryOn: { type: [Number], default: [500, 502, 503, 504] }
  },
  
  // SSL/TLS configuration
  ssl: {
    enabled: { type: Boolean, default: false },
    certId: mongoose.Schema.Types.ObjectId,
    verifyUpstream: { type: Boolean, default: false }
  },
  
  // Metrics and monitoring
  metrics: {
    totalRequests: { type: Number, default: 0 },
    totalErrors: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    p95ResponseTime: { type: Number, default: 0 },
    p99ResponseTime: { type: Number, default: 0 },
    activeConnections: { type: Number, default: 0 },
    requestsPerSecond: { type: Number, default: 0 }
  },
  
  // Configuration
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
loadBalancerSchema.index({ projectId: 1, deploymentId: 1 });
loadBalancerSchema.index({ deploymentId: 1 });
loadBalancerSchema.index({ enabled: 1 });

// Update timestamp on save
loadBalancerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LoadBalancer', loadBalancerSchema);
