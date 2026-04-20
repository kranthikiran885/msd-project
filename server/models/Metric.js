const mongoose = require("mongoose")
const { Schema } = mongoose

const metricSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  deploymentId: { type: Schema.Types.ObjectId, ref: "Deployment", index: true },
  containerId: { type: Schema.Types.ObjectId, ref: "Container", index: true },
  resourceType: { type: String, required: true },
  resourceId: mongoose.Schema.Types.ObjectId,
  metricType: {
    type: String,
    enum: ["invocations", "errors", "duration", "memory", "cpu", "requests", "latency", "throughput"],
    required: true,
  },
  value: { type: Number, required: true },
  unit: String,
  tags: { type: Map, of: String },
  // Container metrics
  cpu: { type: Number }, // Percentage 0-100
  memoryPercent: { type: Number }, // Percentage 0-100
  networkIn: { type: Number }, // Bytes
  networkOut: { type: Number }, // Bytes
  diskUsage: { type: Number }, // Percentage 0-100
  processCount: Number,
  fileDescriptors: Number,
  requestCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  latencyMs: { type: Number }, // milliseconds
  timestamp: { type: Date, default: Date.now },
})

metricSchema.index({ projectId: 1, timestamp: -1 })
metricSchema.index({ projectId: 1, resourceType: 1, timestamp: -1 })
metricSchema.index({ deploymentId: 1, timestamp: -1 })
metricSchema.index({ containerId: 1, timestamp: -1 })
metricSchema.index({ timestamp: -1 })

module.exports = mongoose.models.Metric || mongoose.model("Metric", metricSchema)
