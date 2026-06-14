import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  name: {
    type: String,
    required: true,
    trim: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  
  // ========== CONTEST TYPE ==========
  type: {
    type: String,
    enum: ['head_to_head', 'multiplayer', 'mega', 'private', 'free'],
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  
  // ========== ENTRY DETAILS ==========
  entryFee: {
    type: Number,
    required: true,
    min: 0
  },
  prizePool: {
    type: Number,
    required: true
  },
  guaranteedPrize: {
    type: Boolean,
    default: false
  },
  
  // ========== WINNER DISTRIBUTION ==========
  prizeDistribution: [{
    rank: {
      from: Number,
      to: Number
    },
    prize: Number,
    percentage: Number
  }],
  
  // ========== PLAYER LIMITS ==========
  maxPlayers: {
    type: Number,
    required: true
  },
  currentPlayers: {
    type: Number,
    default: 0
  },
  minPlayersToStart: {
    type: Number,
    default: 2
  },
  
  // ========== PARTICIPANTS ==========
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bet'
    },
    rank: Number,
    points: { type: Number, default: 0 },
    prize: { type: Number, default: 0 },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ========== RULES ==========
  maxTeamsPerUser: {
    type: Number,
    default: 1
  },
  confirmBy: Date,
  
  // ========== METADATA ==========
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  inviteCode: String,
  
  // ========== TIMESTAMPS ==========
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  startedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// ========== INDEXES ==========
contestSchema.index({ game: 1, status: 1 });
contestSchema.index({ type: 1 });
contestSchema.index({ entryFee: 1 });
contestSchema.index({ 'participants.user': 1 });

// ========== VIRTUALS ==========
contestSchema.virtual('remainingSpots').get(function() {
  return this.maxPlayers - this.currentPlayers;
});

contestSchema.virtual('isFull').get(function() {
  return this.currentPlayers >= this.maxPlayers;
});

contestSchema.virtual('canStart').get(function() {
  return this.currentPlayers >= this.minPlayersToStart;
});

// ========== METHODS ==========
contestSchema.methods.joinContest = async function(userId, teamId) {
  if (this.currentPlayers >= this.maxPlayers) {
    throw new Error('Contest is full');
  }
  
  const alreadyJoined = this.participants.some(p => p.user.toString() === userId.toString());
  if (alreadyJoined && this.maxTeamsPerUser === 1) {
    throw new Error('Already joined this contest');
  }
  
  this.participants.push({
    user: userId,
    team: teamId
  });
  
  this.currentPlayers += 1;
  
  return this.save();
};

contestSchema.methods.updateLeaderboard = async function() {
  // Sort participants by points and assign ranks
  this.participants.sort((a, b) => b.points - a.points);
  
  let currentRank = 1;
  let previousPoints = null;
  
  this.participants.forEach((participant, index) => {
    if (previousPoints !== null && participant.points < previousPoints) {
      currentRank = index + 1;
    }
    
    participant.rank = currentRank;
    previousPoints = participant.points;
    
    // Assign prize based on rank
    const prizeTier = this.prizeDistribution.find(
      tier => currentRank >= tier.from && currentRank <= tier.to
    );
    
    if (prizeTier) {
      participant.prize = prizeTier.prize;
    }
  });
  
  return this.save();
};

// ========== MIDDLEWARE ==========
contestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Contest = mongoose.models.Contest || mongoose.model('Contest', contestSchema);
export default Contest;