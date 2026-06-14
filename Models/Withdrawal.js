import mongoose from 'mongoose';

import PAYMENT_METHODS  from '../Utils/constants.js';
import TRANSACTION_STATUS from '../Utils/constants.js';

const withdrawalSchema = new mongoose.Schema({
  // ========== USER INFO ==========
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ========== AMOUNT ==========
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [200, 'Minimum withdrawal amount is ₹200'],
    max: [20000, 'Maximum withdrawal amount is ₹20,000']
  },
  processingFee: {
    type: Number,
    default: 0
  },
  netAmount: Number,
  
  // ========== PAYMENT METHOD ==========
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    required: true
  },
  paymentDetails: {
    // UPI
    upiId: String,
    // Bank Transfer
    bankName: String,
    accountNumber: String,
    accountHolderName: String,
    ifscCode: String
  },
  
  // ========== STATUS ==========
  status: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'completed', 'rejected', 'failed'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    remark: String
  }],
  
  // ========== PROCESSING INFO ==========
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  transactionId: String,
  gatewayReference: String,
  
  // ========== REJECTION INFO ==========
  rejectionReason: String,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  
  // ========== VERIFICATION ==========
  otp: {
    code: String,
    expiresAt: Date,
    verifiedAt: Date
  },
  
  // ========== METADATA ==========
  ipAddress: String,
  deviceInfo: String,
  remarks: String,
  
  // ========== TIMESTAMPS ==========
  requestedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
}, {
  timestamps: true
});

// ========== INDEXES ==========
withdrawalSchema.index({ user: 1, status: 1 });
withdrawalSchema.index({ status: 1, requestedAt: -1 });
withdrawalSchema.index({ requestedAt: -1 });

// ========== VIRTUALS ==========
withdrawalSchema.virtual('isProcessing').get(function() {
  return ['pending', 'processing'].includes(this.status);
});

withdrawalSchema.virtual('canCancel').get(function() {
  return this.status === 'pending';
});

// ========== METHODS ==========
withdrawalSchema.methods.approve = async function(adminId, transactionId) {
  this.status = 'approved';
  this.processedBy = adminId;
  this.processedAt = new Date();
  this.transactionId = transactionId;
  
  this.statusHistory.push({
    status: 'approved',
    changedBy: adminId,
    remark: 'Withdrawal approved'
  });
  
  return this.save();
};

withdrawalSchema.methods.reject = async function(adminId, reason) {
  this.status = 'rejected';
  this.rejectedBy = adminId;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  
  this.statusHistory.push({
    status: 'rejected',
    changedBy: adminId,
    remark: reason
  });
  
  return this.save();
};

withdrawalSchema.methods.complete = async function(gatewayReference) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.gatewayReference = gatewayReference;
  
  this.statusHistory.push({
    status: 'completed',
    remark: 'Withdrawal completed'
  });
  
  return this.save();
};

withdrawalSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  };
  return otp;
};

withdrawalSchema.methods.verifyOTP = function(otp) {
  if (!this.otp.code) return false;
  if (this.otp.expiresAt < new Date()) return false;
  return this.otp.code === otp;
};

// ========== STATICS ==========
withdrawalSchema.statics.getPendingWithdrawals = function(page = 1, limit = 20) {
  return this.find({ status: 'pending' })
    .populate('user', 'fullName uid phone')
    .sort({ requestedAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

withdrawalSchema.statics.getUserWithdrawals = function(userId, page = 1, limit = 20) {
  return this.find({ user: userId })
    .sort({ requestedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

withdrawalSchema.statics.getTodayStats = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const stats = await this.aggregate([
    {
      $match: {
        requestedAt: { $gte: today, $lt: tomorrow }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFee: { $sum: '$processingFee' }
      }
    }
  ]);
  
  return stats;
};

// ========== MIDDLEWARE ==========
withdrawalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate processing fee (2% of amount)
  if (this.isModified('amount')) {
    this.processingFee = Math.round(this.amount * 0.02 * 100) / 100;
    this.netAmount = this.amount - this.processingFee;
  }
  
  next();
});

const Withdrawal = mongoose.models.Withdrawal || mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;