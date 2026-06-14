import mongoose from 'mongoose';
import TRANSACTION_TYPES from '../Utils/constants.js';
import TRANSACTION_STATUS from '../Utils/constants.js';
import  PAYMENT_METHODS from '../Utils/constants.js';
import IDGenerator from '../Utils/generateId.js';

const transactionSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  reference: {
    type: String,
    unique: true,
    default: () => IDGenerator.generateTransactionRef()
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(TRANSACTION_TYPES),
    required: true
  },
  
  // ========== AMOUNT DETAILS ==========
  amount: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  
  // ========== BALANCE INFO ==========
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // ========== STATUS ==========
  status: {
    type: String,
    enum: Object.values(TRANSACTION_STATUS),
    default: TRANSACTION_STATUS.PENDING
  },
  
  // ========== PAYMENT INFO ==========
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS)
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'paytm', 'phonepe', 'google_pay', 'manual']
  },
  gatewayReference: String,
  gatewayResponse: mongoose.Schema.Types.Mixed,
  
  // ========== RELATED ENTITIES ==========
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  },
  bet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bet'
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ========== DESCRIPTION ==========
  description: String,
  remark: String,
  
  // ========== VERIFICATION ==========
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  
  // ========== METADATA ==========
  ipAddress: String,
  deviceInfo: String,
  metadata: mongoose.Schema.Types.Mixed,
  
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
  failedAt: Date,
  refundedAt: Date
}, {
  timestamps: true
});

// ========== INDEXES ==========
// transactionSchema.index({ user: 1, createdAt: -1 });
// transactionSchema.index({ reference: 1 }, { unique: true });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ game: 1 });
transactionSchema.index({ createdAt: -1 });

// ========== METHODS ==========
transactionSchema.methods.complete = async function(gatewayResponse) {
  this.status = TRANSACTION_STATUS.COMPLETED;
  this.completedAt = new Date();
  this.gatewayResponse = gatewayResponse;
  
  return this.save();
};

transactionSchema.methods.fail = async function(reason) {
  this.status = TRANSACTION_STATUS.FAILED;
  this.failedAt = new Date();
  this.remark = reason;
  
  return this.save();
};

transactionSchema.methods.refund = async function(amount, reason) {
  this.status = TRANSACTION_STATUS.REFUNDED;
  this.refundedAt = new Date();
  this.netAmount = amount;
  this.remark = reason;
  
  return this.save();
};

// ========== STATICS ==========
transactionSchema.statics.getUserTransactions = function(userId, filters = {}, page = 1, limit = 20) {
  const query = { user: userId, ...filters };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

transactionSchema.statics.getDailyStats = async function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: TRANSACTION_STATUS.COMPLETED
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$netAmount' },
        totalFee: { $sum: '$fee' }
      }
    }
  ]);
  
  return stats;
};

// ========== MIDDLEWARE ==========
transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default Transaction;