import mongoose from 'mongoose';
import IDGenerator from '../Utils/generateId.js';

const referralSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // ========== REFERRAL CODE ==========
  referralCode: {
    type: String,
    unique: true,
    default: function() {
      return IDGenerator.generateReferralCode(this.user.toString());
    }
  },

  // ========== REFERRED BY ==========
  referredBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    code: String,
    joinedAt: Date,
    bonusReceived: { type: Boolean, default: false }
  },

  // ========== REFERRAL STATS ==========
  stats: {
    totalReferrals: { type: Number, default: 0 },
    activeReferrals: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    currentMonthReferrals: { type: Number, default: 0 },
    currentMonthEarnings: { type: Number, default: 0 }
  },

  // ========== REFERRAL HISTORY ==========
  referrals: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive'],
      default: 'pending'
    },
    bonusEarned: { type: Number, default: 0 },
    bonusPaid: { type: Boolean, default: false },
    firstDepositAt: Date,
    totalGamesPlayed: { type: Number, default: 0 }
  }],

  // ========== EARNING HISTORY ==========
  earnings: [{
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['signup_bonus', 'deposit_bonus', 'game_commission']
    },
    amount: Number,
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'credited', 'cancelled'],
      default: 'pending'
    }
  }],

  // ========== TIER SYSTEM ==========
  tier: {
    level: {
      type: String,
      enum: ['starter', 'bronze', 'silver', 'gold', 'platinum'],
      default: 'starter'
    },
    requirements: {
      minReferrals: Number,
      minEarnings: Number
    },
    benefits: {
      bonusPercentage: Number,
      additionalBonus: Number
    },
    achievedAt: Date
  },

  // ========== TIMESTAMPS ==========
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ========== INDEXES ==========
// referralSchema.index({ user: 1 });
// referralSchema.index({ referralCode: 1 }, { unique: true });
referralSchema.index({ 'referredBy.user': 1 });
referralSchema.index({ 'stats.totalReferrals': -1 });

// ========== VIRTUALS ==========
referralSchema.virtual('totalPendingEarnings').get(function() {
  return this.earnings
    .filter(e => e.status === 'pending')
    .reduce((total, e) => total + e.amount, 0);
});

referralSchema.virtual('totalCreditedEarnings').get(function() {
  return this.earnings
    .filter(e => e.status === 'credited')
    .reduce((total, e) => total + e.amount, 0);
});

// ========== METHODS ==========
referralSchema.methods.addReferral = async function(referredUserId, bonusAmount) {
  this.referrals.push({
    user: referredUserId,
    bonusEarned: bonusAmount,
    status: 'active'
  });
  
  this.stats.totalReferrals += 1;
  this.stats.currentMonthReferrals += 1;
  
  // Update tier
  await this.checkAndUpdateTier();
  
  return this.save();
};

referralSchema.methods.addEarning = async function(fromUserId, type, amount, description) {
  this.earnings.push({
    fromUser: fromUserId,
    type,
    amount,
    description
  });
  
  if (type === 'game_commission') {
    this.stats.totalEarnings += amount;
    this.stats.currentMonthEarnings += amount;
  }
  
  // Update tier
  await this.checkAndUpdateTier();
  
  return this.save();
};

referralSchema.methods.checkAndUpdateTier = async function() {
  const tiers = {
    starter: { minReferrals: 0, minEarnings: 0, bonusPercentage: 0, additionalBonus: 0 },
    bronze: { minReferrals: 5, minEarnings: 100, bonusPercentage: 5, additionalBonus: 50 },
    silver: { minReferrals: 20, minEarnings: 1000, bonusPercentage: 10, additionalBonus: 200 },
    gold: { minReferrals: 50, minEarnings: 5000, bonusPercentage: 15, additionalBonus: 500 },
    platinum: { minReferrals: 100, minEarnings: 20000, bonusPercentage: 20, additionalBonus: 1000 }
  };
  
  let newTier = 'starter';
  const { totalReferrals, totalEarnings } = this.stats;
  
  for (const [tier, requirements] of Object.entries(tiers)) {
    if (totalReferrals >= requirements.minReferrals && 
        totalEarnings >= requirements.minEarnings) {
      newTier = tier;
    }
  }
  
  if (newTier !== this.tier.level) {
    this.tier = {
      level: newTier,
      requirements: {
        minReferrals: tiers[newTier].minReferrals,
        minEarnings: tiers[newTier].minEarnings
      },
      benefits: {
        bonusPercentage: tiers[newTier].bonusPercentage,
        additionalBonus: tiers[newTier].additionalBonus
      },
      achievedAt: new Date()
    };
  }
};

referralSchema.methods.resetMonthlyStats = function() {
  this.stats.currentMonthReferrals = 0;
  this.stats.currentMonthEarnings = 0;
  return this.save();
};

// ========== STATICS ==========
referralSchema.statics.findByReferralCode = function(code) {
  return this.findOne({ referralCode: code.toUpperCase() });
};

referralSchema.statics.getTopReferrers = function(limit = 10) {
  return this.find()
    .sort({ 'stats.totalReferrals': -1 })
    .limit(limit)
    .populate('user', 'fullName profilePicture');
};

// ========== MIDDLEWARE ==========
referralSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // next();
});

const Referral =
  mongoose.models.Referral ||
  mongoose.model('Referral', referralSchema);

export default Referral;