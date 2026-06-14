import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: 50
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  
  // ========== PLAYERS SELECTION ==========
  players: [{
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    name: String,
    role: String,
    team: String,
    image: String,
    credits: Number,
    isCaptain: {
      type: Boolean,
      default: false
    },
    isViceCaptain: {
      type: Boolean,
      default: false
    },
    points: {
      type: Number,
      default: 0
    },
    // Live points breakdown
    pointsBreakdown: {
      batting: { type: Number, default: 0 },
      bowling: { type: Number, default: 0 },
      fielding: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 }
    }
  }],
  
  // ========== TEAM COMPOSITION ==========
  composition: {
    batsmen: { type: Number, default: 0 },
    bowlers: { type: Number, default: 0 },
    allRounders: { type: Number, default: 0 },
    wicketKeepers: { type: Number, default: 0 }
  },
  
  // ========== STATS ==========
  totalCredits: {
    type: Number,
    default: 0,
    max: 100
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  rank: Number,
  previousRank: Number,
  
  // ========== STATUS ==========
  isComplete: {
    type: Boolean,
    default: false
  },
  isValid: {
    type: Boolean,
    default: true
  },
  validationErrors: [String],
  
  // ========== MATCH INFO ==========
  matchInfo: {
    matchId: String,
    matchName: String,
    team1: String,
    team2: String,
    selectedTeam: String
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
teamSchema.index({ user: 1, game: 1 });
teamSchema.index({ game: 1, totalPoints: -1 });
teamSchema.index({ user: 1, createdAt: -1 });

// ========== VIRTUALS ==========
teamSchema.virtual('captain').get(function() {
  return this.players.find(p => p.isCaptain);
});

teamSchema.virtual('viceCaptain').get(function() {
  return this.players.find(p => p.isViceCaptain);
});

teamSchema.virtual('playerCount').get(function() {
  return this.players.length;
});

// ========== METHODS ==========
teamSchema.methods.addPlayer = async function(playerData) {
  if (this.players.length >= 11) {
    throw new Error('Maximum 11 players allowed');
  }
  
  const totalCredits = this.players.reduce((sum, p) => sum + p.credits, 0);
  if (totalCredits + playerData.credits > 100) {
    throw new Error('Exceeds 100 credits limit');
  }
  
  // Check role limits
  const roleCount = this.players.filter(p => p.role === playerData.role).length;
  const roleLimits = {
    batsman: 6,
    bowler: 6,
    'all-rounder': 4,
    'wicket-keeper': 4
  };
  
  if (roleCount >= roleLimits[playerData.role]) {
    throw new Error(`Maximum ${roleLimits[playerData.role]} ${playerData.role}s allowed`);
  }
  
  this.players.push(playerData);
  this.totalCredits = totalCredits + playerData.credits;
  
  // Update composition
  this.composition[playerData.role === 'all-rounder' ? 'allRounders' : 
                   playerData.role === 'wicket-keeper' ? 'wicketKeepers' :
                   playerData.role + 's'] += 1;
  
  return this.save();
};

teamSchema.methods.removePlayer = async function(playerId) {
  const player = this.players.find(p => p.playerId.toString() === playerId.toString());
  if (!player) throw new Error('Player not found in team');
  
  this.players = this.players.filter(p => p.playerId.toString() !== playerId.toString());
  this.totalCredits -= player.credits;
  
  // Update composition
  this.composition[player.role === 'all-rounder' ? 'allRounders' : 
                   player.role === 'wicket-keeper' ? 'wicketKeepers' :
                   player.role + 's'] -= 1;
  
  return this.save();
};

teamSchema.methods.setCaptain = async function(playerId) {
  // Remove existing captain
  this.players.forEach(p => p.isCaptain = false);
  
  const player = this.players.find(p => p.playerId.toString() === playerId.toString());
  if (!player) throw new Error('Player not found');
  
  player.isCaptain = true;
  return this.save();
};

teamSchema.methods.setViceCaptain = async function(playerId) {
  // Remove existing vice-captain
  this.players.forEach(p => p.isViceCaptain = false);
  
  const player = this.players.find(p => p.playerId.toString() === playerId.toString());
  if (!player) throw new Error('Player not found');
  
  if (player.isCaptain) throw new Error('Captain cannot be vice-captain');
  
  player.isViceCaptain = true;
  return this.save();
};

teamSchema.methods.validateTeam = function() {
  const errors = [];
  
  if (this.players.length !== 11) {
    errors.push('Team must have exactly 11 players');
  }
  
  if (!this.players.some(p => p.isCaptain)) {
    errors.push('Captain must be selected');
  }
  
  if (!this.players.some(p => p.isViceCaptain)) {
    errors.push('Vice-captain must be selected');
  }
  
  if (this.composition.wicketKeepers < 1) {
    errors.push('At least 1 wicket-keeper required');
  }
  
  if (this.composition.batsmen < 3) {
    errors.push('At least 3 batsmen required');
  }
  
  if (this.composition.bowlers < 3) {
    errors.push('At least 3 bowlers required');
  }
  
  if (this.composition.allRounders < 1) {
    errors.push('At least 1 all-rounder required');
  }
  
  this.validationErrors = errors;
  this.isValid = errors.length === 0;
  
  return this.isValid;
};

teamSchema.methods.updatePoints = async function(matchStats) {
  for (const player of this.players) {
    const stats = matchStats[player.playerId];
    if (stats) {
      let points = 0;
      
      // Batting points
      points += (stats.runs || 0) * 1;
      points += (stats.fours || 0) * 1;
      points += (stats.sixes || 0) * 2;
      if (stats.runs >= 30) points += 4; // 30 runs bonus
      if (stats.runs >= 50) points += 8; // 50 runs bonus
      if (stats.runs >= 100) points += 16; // Century bonus
      
      // Bowling points
      points += (stats.wickets || 0) * 25;
      points += (stats.maidens || 0) * 8;
      if (stats.wickets >= 3) points += 4; // 3 wicket bonus
      if (stats.wickets >= 5) points += 8; // 5 wicket bonus
      
      // Fielding points
      points += (stats.catches || 0) * 8;
      points += (stats.stumpings || 0) * 12;
      points += (stats.runOuts || 0) * 6;
      
      // Apply captain/vice-captain multiplier
      if (player.isCaptain) points *= 2;
      if (player.isViceCaptain) points *= 1.5;
      
      player.points = points;
    }
  }
  
  this.totalPoints = this.players.reduce((sum, p) => sum + (p.points || 0), 0);
  return this.save();
};

// ========== STATICS ==========
teamSchema.statics.getUserTeams = function(userId, gameId) {
  return this.find({ user: userId, game: gameId })
    .sort({ createdAt: -1 });
};

teamSchema.statics.getLeaderboard = function(gameId, limit = 50) {
  return this.find({ game: gameId, isComplete: true })
    .populate('user', 'fullName uid profilePicture')
    .sort({ totalPoints: -1 })
    .limit(limit);
};

// ========== MIDDLEWARE ==========
teamSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.isComplete = this.players.length === 11;
  this.validateTeam();
  next();
});

const Team = mongoose.models.Team || mongoose.model('Team', teamSchema);
export default Team;