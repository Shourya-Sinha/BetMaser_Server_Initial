import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  name: {
    type: String,
    required: [true, 'Player name is required'],
    trim: true
  },
  shortName: {
    type: String,
    trim: true
  },
  image: {
    url: String,
    publicId: String
  },
  
  // ========== PERSONAL INFO ==========
  dateOfBirth: Date,
  nationality: String,
  battingStyle: {
    type: String,
    enum: ['right-hand', 'left-hand']
  },
  bowlingStyle: {
    type: String,
    enum: ['right-arm-fast', 'left-arm-fast', 'right-arm-spin', 'left-arm-spin', 'right-arm-medium', 'left-arm-medium', 'none']
  },
  
  // ========== ROLE ==========
  primaryRole: {
    type: String,
    enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'],
    required: true
  },
  secondaryRole: {
    type: String,
    enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper', 'none'],
    default: 'none'
  },
  
  // ========== TEAM INFO ==========
  currentTeam: {
    name: String,
    shortName: String,
    joinedAt: Date
  },
  previousTeams: [{
    name: String,
    from: Date,
    to: Date
  }],
  
  // ========== CAREER STATS ==========
  careerStats: {
    // Cricket
    batting: {
      matches: { type: Number, default: 0 },
      innings: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      highest: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      centuries: { type: Number, default: 0 },
      fifties: { type: Number, default: 0 },
      fours: { type: Number, default: 0 },
      sixes: { type: Number, default: 0 }
    },
    bowling: {
      matches: { type: Number, default: 0 },
      innings: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      best: { type: String, default: '0/0' },
      average: { type: Number, default: 0 },
      economy: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      fiveWickets: { type: Number, default: 0 }
    },
    fielding: {
      catches: { type: Number, default: 0 },
      stumpings: { type: Number, default: 0 },
      runOuts: { type: Number, default: 0 }
    }
  },
  
  // ========== CURRENT TOURNAMENT STATS ==========
  tournamentStats: {
    tournamentId: String,
    tournamentName: String,
    batting: {
      matches: Number,
      innings: Number,
      runs: Number,
      highest: Number,
      average: Number,
      strikeRate: Number,
      centuries: Number,
      fifties: Number
    },
    bowling: {
      matches: Number,
      innings: Number,
      wickets: Number,
      best: String,
      average: Number,
      economy: Number
    }
  },
  
  // ========== RECENT PERFORMANCE ==========
  recentMatches: [{
    matchId: String,
    matchName: String,
    date: Date,
    opponent: String,
    batting: {
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      dismissal: String
    },
    bowling: {
      overs: Number,
      maidens: Number,
      runs: Number,
      wickets: Number
    },
    fielding: {
      catches: Number,
      stumpings: Number
    },
    points: Number,
    isManOfMatch: { type: Boolean, default: false }
  }],
  
  // ========== FANTASY CREDITS ==========
  fantasyCredits: {
    type: Number,
    default: 8,
    min: 5,
    max: 15
  },
  
  // ========== STATUS ==========
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  injuryStatus: {
    type: String,
    enum: ['fit', 'injured', 'doubtful', 'rested'],
    default: 'fit'
  },
  
  // ========== MEDIA ==========
  images: [{
    url: String,
    publicId: String,
    type: String // profile, action, team
  }],
  
  // ========== SOCIAL ==========
  socialLinks: {
    instagram: String,
    twitter: String
  },
  
  // ========== METADATA ==========
  tags: [String],
  searchKeywords: [String],
  
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
playerSchema.index({ name: 'text', shortName: 'text' });
playerSchema.index({ primaryRole: 1 });
playerSchema.index({ 'currentTeam.name': 1 });
playerSchema.index({ isActive: 1, isAvailable: 1 });
playerSchema.index({ fantasyCredits: 1 });

// ========== VIRTUALS ==========
playerSchema.virtual('fullStats').get(function() {
  return {
    name: this.name,
    role: this.primaryRole,
    team: this.currentTeam.name,
    batting: this.careerStats.batting,
    bowling: this.careerStats.bowling,
    fielding: this.careerStats.fielding
  };
});

// ========== METHODS ==========
playerSchema.methods.updateMatchStats = async function(matchStats) {
  this.recentMatches.push({
    ...matchStats,
    date: new Date()
  });
  
  // Keep only last 10 matches
  if (this.recentMatches.length > 10) {
    this.recentMatches = this.recentMatches.slice(-10);
  }
  
  // Update career stats
  if (matchStats.batting) {
    const bat = this.careerStats.batting;
    bat.matches += 1;
    bat.innings += 1;
    bat.runs += matchStats.batting.runs || 0;
    bat.fours += matchStats.batting.fours || 0;
    bat.sixes += matchStats.batting.sixes || 0;
    if ((matchStats.batting.runs || 0) > bat.highest) {
      bat.highest = matchStats.batting.runs;
    }
    if (matchStats.batting.runs >= 100) bat.centuries += 1;
    else if (matchStats.batting.runs >= 50) bat.fifties += 1;
    bat.average = bat.runs / bat.innings;
    bat.strikeRate = (bat.runs / (bat.innings * 100)) * 100; // Simplified
  }
  
  if (matchStats.bowling) {
    const bowl = this.careerStats.bowling;
    bowl.matches += 1;
    bowl.wickets += matchStats.bowling.wickets || 0;
    bowl.runs += matchStats.bowling.runs || 0;
    if (matchStats.bowling.wickets >= 5) bowl.fiveWickets += 1;
    bowl.average = bowl.runs / (bowl.wickets || 1);
    bowl.economy = bowl.runs / ((bowl.balls || 1) / 6);
  }
  
  return this.save();
};

playerSchema.methods.calculateFantasyCredits = function() {
  // Calculate credits based on recent performance
  let credits = 8; // Base credits
  
  const bat = this.careerStats.batting;
  const bowl = this.careerStats.bowling;
  
  if (bat.average > 40) credits += 2;
  else if (bat.average > 30) credits += 1;
  
  if (bowl.average < 25 && bowl.wickets > 10) credits += 2;
  else if (bowl.average < 30) credits += 1;
  
  if (this.primaryRole === 'all-rounder') credits += 1;
  
  this.fantasyCredits = Math.min(Math.max(credits, 5), 15);
  return this.save();
};

// ========== STATICS ==========
playerSchema.statics.findByTeam = function(teamName) {
  return this.find({ 'currentTeam.name': teamName, isActive: true });
};

playerSchema.statics.findByRole = function(role) {
  return this.find({ primaryRole: role, isActive: true });
};

playerSchema.statics.searchPlayers = function(query) {
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } });
};

// ========== MIDDLEWARE ==========
playerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate search keywords
  this.searchKeywords = [
    this.name.toLowerCase(),
    this.shortName?.toLowerCase(),
    this.currentTeam?.name?.toLowerCase(),
    this.primaryRole
  ].filter(Boolean);
  
  next();
});

const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
export default Player;