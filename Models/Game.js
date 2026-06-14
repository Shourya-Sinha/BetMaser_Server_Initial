import mongoose from 'mongoose';
import GAME_TYPES from '..//Utils/constants.js';
import GAME_STATUS from '..//Utils/constants.js';

const gameSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  name: {
    type: String,
    required: [true, 'Game name is required'],
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: Object.values(GAME_TYPES),
    required: [true, 'Game type is required']
  },
  status: {
    type: String,
    enum: Object.values(GAME_STATUS),
    default: GAME_STATUS.UPCOMING
  },
  description: {
    type: String,
    maxlength: 500
  },
  
  // ========== TIMING ==========
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  endTime: Date,
  actualStartTime: Date,
  actualEndTime: Date,
  
  // ========== TEAMS (For Cricket/Football) ==========
  teams: [{
    name: {
      type: String,
      required: true
    },
    shortName: String,
    logo: String,
    players: [{
      name: String,
      role: String, // batsman, bowler, all-rounder, goalkeeper, etc.
      points: { type: Number, default: 0 },
      image: String,
      stats: {
        // Cricket specific
        runs: Number,
        wickets: Number,
        catches: Number,
        fours: Number,
        sixes: Number,
        // Football specific
        goals: Number,
        assists: Number,
        saves: Number,
        yellowCards: Number,
        redCards: Number
      }
    }],
    score: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  
  // ========== BETTING OPTIONS ==========
  bettingOptions: [{
    type: {
      type: String,
      enum: [
        'match_winner', 'toss_winner', 'top_batsman', 'top_bowler',
        'total_runs', 'total_wickets', 'total_sixes', 'total_fours',
        'man_of_match', 'first_innings_score', 'highest_opening_partnership',
        'total_goals', 'first_goal_scorer', 'correct_score',
        'both_teams_to_score', 'half_time_result'
      ]
    },
    name: String,
    options: [{
      value: mongoose.Schema.Types.Mixed,
      odds: Number,
      label: String
    }],
    isActive: { type: Boolean, default: true },
    minBet: { type: Number, default: 10 },
    maxBet: { type: Number, default: 5000 }
  }],
  
  // ========== CONTEST DETAILS ==========
  contestType: {
    type: String,
    enum: ['free', 'paid', 'private', 'public'],
    default: 'paid'
  },
  entryFee: {
    type: Number,
    required: true,
    min: 0
  },
  prizePool: {
    type: Number,
    required: true
  },
  prizeDistribution: [{
    rank: Number,
    prize: Number,
    percentage: Number
  }],
  
  // ========== PLAYER LIMITS ==========
  minPlayers: {
    type: Number,
    default: 2
  },
  maxPlayers: {
    type: Number,
    required: true
  },
  currentPlayers: {
    type: Number,
    default: 0
  },
  maxTeamsPerUser: {
    type: Number,
    default: 1
  },
  
  // ========== FANTASY TEAM RULES (For Dream11 type) ==========
  fantasyRules: {
    enabled: { type: Boolean, default: false },
    totalCredits: { type: Number, default: 100 },
    maxPlayersPerTeam: { type: Number, default: 11 },
    minBatsmen: Number,
    maxBatsmen: Number,
    minBowlers: Number,
    maxBowlers: Number,
    minAllRounders: Number,
    maxAllRounders: Number,
    minWicketKeepers: Number,
    maxWicketKeepers: Number,
    maxPlayersFromOneTeam: Number,
    captainMultiplier: { type: Number, default: 2 },
    viceCaptainMultiplier: { type: Number, default: 1.5 }
  },
  
  // ========== LIVE GAME DATA (For Teen Patti/Ludo) ==========
  liveGameData: {
    roomCode: String,
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    currentRound: Number,
    totalRounds: Number,
    currentPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    turnOrder: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: String,
      cards: [String],
      betAmount: Number
    }],
    potAmount: { type: Number, default: 0 }
  },
  
  // ========== MEDIA ==========
  images: [{
    url: String,
    publicId: String,
    type: {
      type: String,
      enum: ['banner', 'thumbnail', 'background']
    }
  }],
  
  // ========== RESULTS ==========
  result: {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    winningTeam: String,
    declaredAt: Date,
    declaredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ========== STATS ==========
  stats: {
    totalBets: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    totalWinners: { type: Number, default: 0 },
    totalCommission: { type: Number, default: 0 }
  },
  
  // ========== SETTINGS ==========
  settings: {
    allowMultipleTeams: { type: Boolean, default: false },
    showLiveScore: { type: Boolean, default: true },
    autoCancel: { type: Boolean, default: true },
    cancelIfMinPlayersNotMet: { type: Boolean, default: true },
    refundOnCancel: { type: Boolean, default: true }
  },
  
  // ========== METADATA ==========
  tags: [String],
  isFeatured: { type: Boolean, default: false },
  isPopular: { type: Boolean, default: false },
  commission: { type: Number, default: 5 }, // Percentage
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========== INDEXES ==========
gameSchema.index({ type: 1, status: 1 });
gameSchema.index({ startTime: 1 });
gameSchema.index({ status: 1 });
gameSchema.index({ isFeatured: 1 });
gameSchema.index({ 'stats.totalBets': -1 });

// ========== VIRTUALS ==========
gameSchema.virtual('isFull').get(function() {
  return this.currentPlayers >= this.maxPlayers;
});

gameSchema.virtual('remainingSpots').get(function() {
  return this.maxPlayers - this.currentPlayers;
});

gameSchema.virtual('isLive').get(function() {
  return this.status === GAME_STATUS.LIVE;
});

// ========== METHODS ==========
gameSchema.methods.canJoin = function(userId, userBalance) {
  if (this.status !== GAME_STATUS.UPCOMING) {
    return { canJoin: false, reason: 'Game is not open for joining' };
  }
  
  if (this.currentPlayers >= this.maxPlayers) {
    return { canJoin: false, reason: 'Game is full' };
  }
  
  if (userBalance < this.entryFee) {
    return { canJoin: false, reason: 'Insufficient balance' };
  }
  
  return { canJoin: true };
};

gameSchema.methods.startGame = async function() {
  if (this.currentPlayers < this.minPlayers) {
    throw new Error('Not enough players to start game');
  }
  
  this.status = GAME_STATUS.LIVE;
  this.actualStartTime = new Date();
  
  return this.save();
};

gameSchema.methods.endGame = async function(winnerId, winningTeam) {
  this.status = GAME_STATUS.COMPLETED;
  this.actualEndTime = new Date();
  this.result = {
    winner: winnerId,
    winningTeam,
    declaredAt: new Date()
  };
  
  return this.save();
};

// ========== MIDDLEWARE ==========
gameSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-set end time if not provided (24 hours after start)
  if (!this.endTime && this.startTime) {
    this.endTime = new Date(this.startTime.getTime() + 24 * 60 * 60 * 1000);
  }
  
  next();
});

const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);
export default Game;