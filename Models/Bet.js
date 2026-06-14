import mongoose from 'mongoose';

import TRANSACTION_STATUS from '../Utils/constants.js';
import BET_TYPES from '../Utils/constants.js';

const betSchema = new mongoose.Schema({
  // ========== USER INFO ==========
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ========== GAME INFO ==========
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  gameType: {
    type: String,
    required: true
  },
  
  // ========== BET DETAILS ==========
  betType: {
    type: String,
    enum: Object.values(BET_TYPES),
    required: true
  },
  betOption: {
    type: String,
    required: true
  },
  odds: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 10
  },
  potentialWin: {
    type: Number,
    required: true
  },
  
  // ========== FANTASY TEAM (For Dream11 type) ==========
  fantasyTeam: {
    name: String,
    players: [{
      name: String,
      role: String,
      team: String,
      isCaptain: { type: Boolean, default: false },
      isViceCaptain: { type: Boolean, default: false },
      points: { type: Number, default: 0 }
    }],
    totalPoints: { type: Number, default: 0 }
  },
  
  // ========== STATUS ==========
  status: {
    type: String,
    enum: ['pending', 'active', 'won', 'lost', 'refunded', 'cancelled'],
    default: 'pending'
  },
  result: {
    won: Boolean,
    winAmount: Number,
    declaredAt: Date,
    settledAt: Date
  },
  
  // ========== TRANSACTION REFERENCE ==========
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // ========== METADATA ==========
  ipAddress: String,
  deviceInfo: String,
  location: String,
  
  // ========== TIMESTAMPS ==========
  placedAt: {
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
betSchema.index({ user: 1, game: 1 });
betSchema.index({ game: 1, status: 1 });
betSchema.index({ status: 1 });
betSchema.index({ placedAt: -1 });
betSchema.index({ 'fantasyTeam.totalPoints': -1 });

// ========== METHODS ==========
betSchema.methods.settleBet = async function(won, winAmount) {
  this.status = won ? 'won' : 'lost';
  this.result = {
    won,
    winAmount: won ? winAmount : 0,
    declaredAt: new Date(),
    settledAt: new Date()
  };
  
  return this.save();
};

betSchema.methods.refund = async function() {
  this.status = 'refunded';
  this.result = {
    won: false,
    winAmount: this.amount,
    declaredAt: new Date()
  };
  
  return this.save();
};

// ========== STATICS ==========
betSchema.statics.getUserBets = function(userId, page = 1, limit = 20) {
  return this.find({ user: userId })
    .populate('game', 'name type startTime status')
    .sort({ placedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

betSchema.statics.getGameBets = function(gameId) {
  return this.find({ game: gameId })
    .populate('user', 'fullName uid')
    .sort({ placedAt: -1 });
};

betSchema.statics.getLeaderboard = function(gameId, limit = 50) {
  return this.find({ 
    game: gameId, 
    'fantasyTeam.totalPoints': { $gt: 0 } 
  })
    .populate('user', 'fullName uid profilePicture')
    .sort({ 'fantasyTeam.totalPoints': -1 })
    .limit(limit);
};

// ========== MIDDLEWARE ==========
betSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate potential win if not provided
  if (!this.potentialWin) {
    this.potentialWin = this.amount * this.odds;
  }
  
  next();
});

const Bet = mongoose.models.Bet || mongoose.model('Bet', betSchema);
export default Bet;