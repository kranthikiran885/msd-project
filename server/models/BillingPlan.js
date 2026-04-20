const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const billingPlanSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  planName: { type: String, enum: ['free', 'starter', 'professional', 'enterprise'], default: 'free' },
  status: { type: String, enum: ['active', 'suspended', 'cancelled'], default: 'active' },
  billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  
  // Pricing
  basePrice: { type: Number, default: 0 },
  usagePrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
  
  // Features
  features: {
    deployments: { type: Number, default: 10 },
    storage: { type: Number, default: 50 }, // GB
    bandwidth: { type: Number, default: 100 }, // GB
    databases: { type: Number, default: 1 },
    supportLevel: { type: String, enum: ['community', 'standard', 'priority'] },
  },
  
  // Billing details
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  nextBillingDate: Date,
  lastPaymentDate: Date,
  paymentMethod: String,
  
  // Usage tracking
  usage: {
    deployments: { type: Number, default: 0 },
    storage: { type: Number, default: 0 },
    bandwidth: { type: Number, default: 0 },
    updatedAt: Date,
  },
  
  // Invoices
  invoices: [{
    invoiceId: String,
    amount: Number,
    date: Date,
    status: String,
    pdfUrl: String,
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

billingPlanSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('BillingPlan', billingPlanSchema);
