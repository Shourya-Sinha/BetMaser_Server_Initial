import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // ========== BALANCES ==========
  mainBalance: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  bonusBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  winningBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  lockedAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // ========== TOTALS ==========
  totalDeposited: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  totalWon: {
    type: Number,
    default: 0
  },
  totalLost: {
    type: Number,
    default: 0
  },

  // ========== BETTING LIMITS ==========
  limits: {
    dailyDeposit: { type: Number, default: 0 },
    dailyWithdrawal: { type: Number, default: 0 },
    dailyBetAmount: { type: Number, default: 0 },
    maxSingleBet: { type: Number, default: 5000 },
    dailyLimit: { type: Number, default: 10000 },
    weeklyLimit: { type: Number, default: 50000 },
    monthlyLimit: { type: Number, default: 200000 }
  },

  // ========== RESET TRACKING ==========
  lastResetDate: {
    daily: Date,
    weekly: Date,
    monthly: Date
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

// ========== VIRTUALS ==========
walletSchema.virtual('totalBalance').get(function() {
  return this.mainBalance + this.bonusBalance + this.winningBalance;
});

walletSchema.virtual('availableBalance').get(function() {
  return this.totalBalance - this.lockedAmount;
});

walletSchema.virtual('withdrawableBalance').get(function() {
  return this.mainBalance + this.winningBalance;
});

// ========== INDEXES ==========
// walletSchema.index({ user: 1 });
walletSchema.index({ 'mainBalance': -1 });
walletSchema.index({ updatedAt: -1 });

// ========== METHODS ==========
walletSchema.methods.addMoney = async function(amount, type = 'main') {
  if (amount <= 0) throw new Error('Amount must be positive');
  
  switch(type) {
    case 'main':
      this.mainBalance += amount;
      this.totalDeposited += amount;
      break;
    case 'bonus':
      this.bonusBalance += amount;
      break;
    case 'winning':
      this.winningBalance += amount;
      this.totalWon += amount;
      break;
  }
  
  return this.save();
};

walletSchema.methods.deductMoney = async function(amount, type = 'main') {
  if (amount <= 0) throw new Error('Amount must be positive');
  
  switch(type) {
    case 'main':
      if (this.mainBalance < amount) throw new Error('Insufficient balance');
      this.mainBalance -= amount;
      break;
    case 'bonus':
      if (this.bonusBalance < amount) throw new Error('Insufficient bonus balance');
      this.bonusBalance -= amount;
      break;
    case 'winning':
      if (this.winningBalance < amount) throw new Error('Insufficient winning balance');
      this.winningBalance -= amount;
      break;
  }
  
  return this.save();
};

walletSchema.methods.lockAmount = async function(amount) {
  if (this.availableBalance < amount) throw new Error('Insufficient available balance');
  
  // Deduct from bonus first, then main, then winnings
  let remaining = amount;
  
  if (this.bonusBalance > 0) {
    const deductFromBonus = Math.min(this.bonusBalance, remaining);
    this.bonusBalance -= deductFromBonus;
    remaining -= deductFromBonus;
  }
  
  if (remaining > 0 && this.mainBalance > 0) {
    const deductFromMain = Math.min(this.mainBalance, remaining);
    this.mainBalance -= deductFromMain;
    remaining -= deductFromMain;
  }
  
  if (remaining > 0 && this.winningBalance > 0) {
    const deductFromWinnings = Math.min(this.winningBalance, remaining);
    this.winningBalance -= deductFromWinnings;
    remaining -= deductFromWinnings;
  }
  
  this.lockedAmount += amount;
  return this.save();
};

walletSchema.methods.unlockAmount = async function(amount) {
  if (this.lockedAmount < amount) throw new Error('Invalid unlock amount');
  this.lockedAmount -= amount;
  this.mainBalance += amount; // Return to main balance
  return this.save();
};

walletSchema.methods.resetDailyLimits = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!this.lastResetDate.daily || this.lastResetDate.daily < today) {
    this.limits.dailyDeposit = 0;
    this.limits.dailyWithdrawal = 0;
    this.limits.dailyBetAmount = 0;
    this.lastResetDate.daily = today;
  }
  
  return this.save();
};

// ========== MIDDLEWARE ==========
walletSchema.pre('save', function(next) {
  // Ensure no negative balances
  if (this.mainBalance < 0) this.mainBalance = 0;
  if (this.bonusBalance < 0) this.bonusBalance = 0;
  if (this.winningBalance < 0) this.winningBalance = 0;
  if (this.lockedAmount < 0) this.lockedAmount = 0;
  
  this.updatedAt = Date.now();
  // next();
});

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
export default Wallet;