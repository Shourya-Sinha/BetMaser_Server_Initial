import mongoose from 'mongoose';

import TRANSACTION_STATUS from '../Utils/constants.js';
import PAYMENT_METHODS from '../Utils/constants.js';

const paymentSchema = new mongoose.Schema({
  // ========== USER INFO ==========
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ========== ORDER INFO ==========
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  receiptId: String,
  
  // ========== AMOUNT ==========
  amount: {
    type: Number,
    required: true,
    min: 100
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // ========== PAYMENT METHOD ==========
  method: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: true
  },
  
  // ========== GATEWAY INFO ==========
  gateway: {
    type: String,
    enum: ['razorpay', 'paytm', 'phonepe', 'google_pay', 'manual'],
    required: true
  },
  gatewayOrderId: String,
  gatewayPaymentId: String,
  gatewaySignature: String,
  
  // ========== STATUS ==========
  status: {
    type: String,
    enum: ['created', 'pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'created'
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    gatewayResponse: mongoose.Schema.Types.Mixed
  }],
  
  // ========== PAYMENT DETAILS ==========
  paymentDetails: {
    // UPI
    upiId: String,
    upiTransactionId: String,
    // Card
    cardNumber: String,
    cardType: String,
    bankName: String,
    // Net Banking
    bankCode: String,
    // Wallet
    walletProvider: String
  },
  
  // ========== RESPONSE ==========
  gatewayResponse: mongoose.Schema.Types.Mixed,
  errorDetails: {
    code: String,
    description: String,
    source: String,
    step: String
  },
  
  // ========== VERIFICATION ==========
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  verifiedBy: String, // system/manual
  
  // ========== RELATED ENTITIES ==========
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // ========== METADATA ==========
  notes: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  deviceInfo: String,
  
  // ========== TIMESTAMPS ==========
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  failedAt: Date
}, {
  timestamps: true
});

// ========== INDEXES ==========
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ unique: true });
paymentSchema.index({ gatewayPaymentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ gateway: 1 });

// ========== METHODS ==========
paymentSchema.methods.updateStatus = async function(status, gatewayResponse = null) {
  this.status = status;
  
  if (gatewayResponse) {
    this.gatewayResponse = gatewayResponse;
  }
  
  this.statusHistory.push({
    status,
    gatewayResponse
  });
  
  if (status === 'completed') {
    this.completedAt = new Date();
  } else if (status === 'failed') {
    this.failedAt = new Date();
  }
  
  return this.save();
};

paymentSchema.methods.verifyPayment = async function() {
  // Implement payment verification logic based on gateway
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = 'system';
  
  return this.save();
};

paymentSchema.methods.refund = async function(amount = null) {
  const refundAmount = amount || this.amount;
  
  this.status = 'refunded';
  this.statusHistory.push({
    status: 'refunded',
    gatewayResponse: { refundAmount }
  });
  
  return this.save();
};

// ========== STATICS ==========
paymentSchema.statics.findByOrderId = function(orderId) {
  return this.findOne({ orderId });
};

paymentSchema.statics.findByGatewayPaymentId = function(gatewayPaymentId) {
  return this.findOne({ gatewayPaymentId });
};

paymentSchema.statics.getUserPayments = function(userId, page = 1, limit = 20) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

paymentSchema.statics.getTodayStats = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: today, $lt: tomorrow }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return stats;
};

// ========== MIDDLEWARE ==========
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate receipt ID if not provided
  if (!this.receiptId) {
    this.receiptId = 'RCPT' + Date.now().toString(36).toUpperCase();
  }
  
  next();
});

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;