import mongoose from 'mongoose';

const gameStatsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // ========== OVERALL STATS ==========
  overall: {
    totalGamesPlayed: { type: Number, default: 0 },
    totalGamesWon: { type: Number, default: 0 },
    totalGamesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }, // Percentage
    totalBetsPlaced: { type: Number, default: 0 },
    totalBetsWon: { type: Number, default: 0 },
    totalBetsLost: { type: Number, default: 0 },
    betWinRate: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 },
    currentWinStreak: { type: Number, default: 0 },
    worstLossStreak: { type: Number, default: 0 },
    bestWinAmount: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    averageBetAmount: { type: Number, default: 0 }
  },

  // ========== CRICKET STATS ==========
  cricket: {
    matchesPlayed: { type: Number, default: 0 },
    matchesWon: { type: Number, default: 0 },
    matchesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalBets: { type: Number, default: 0 },
    betsWon: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    bestWin: { type: Number, default: 0 },
    teamsCreated: { type: Number, default: 0 },
    // Specific bet types
    matchWinnerBets: { type: Number, default: 0 },
    matchWinnerWins: { type: Number, default: 0 },
    tossWinnerBets: { type: Number, default: 0 },
    tossWinnerWins: { type: Number, default: 0 },
    topBatsmanBets: { type: Number, default: 0 },
    topBatsmanWins: { type: Number, default: 0 },
    topBowlerBets: { type: Number, default: 0 },
    topBowlerWins: { type: Number, default: 0 },
    totalRunsBets: { type: Number, default: 0 },
    totalRunsWins: { type: Number, default: 0 },
    // Favorite teams
    favoriteTeam: String,
    teamStats: [{
      teamName: String,
      betsPlaced: Number,
      betsWon: Number,
      totalEarnings: Number
    }]
  },

  // ========== FOOTBALL STATS ==========
  football: {
    matchesPlayed: { type: Number, default: 0 },
    matchesWon: { type: Number, default: 0 },
    matchesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalBets: { type: Number, default: 0 },
    betsWon: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    bestWin: { type: Number, default: 0 },
    // Specific bet types
    matchResultBets: { type: Number, default: 0 },
    matchResultWins: { type: Number, default: 0 },
    totalGoalsBets: { type: Number, default: 0 },
    totalGoalsWins: { type: Number, default: 0 },
    firstGoalScorerBets: { type: Number, default: 0 },
    firstGoalScorerWins: { type: Number, default: 0 },
    correctScoreBets: { type: Number, default: 0 },
    correctScoreWins: { type: Number, default: 0 }
  },

  // ========== TEEN PATTI STATS ==========
  teenpatti: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    bestWin: { type: Number, default: 0 },
    handsPlayed: { type: Number, default: 0 },
    handsWon: { type: Number, default: 0 },
    // Game variants
    classic: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    joker: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    muflis: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    // Side bets
    sideBets: {
      pairPlus: {
        bets: { type: Number, default: 0 },
        wins: { type: Number, default: 0 }
      },
      straightFlush: {
        bets: { type: Number, default: 0 },
        wins: { type: Number, default: 0 }
      }
    }
  },

  // ========== LUDO STATS ==========
  ludo: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    bestWin: { type: Number, default: 0 },
    totalTokensHome: { type: Number, default: 0 }, // Tokens that reached home
    // Game modes
    classic2Player: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    classic4Player: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    quickMode: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    }
  },

  // ========== POKER STATS ==========
  poker: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    bestWin: { type: Number, default: 0 },
    handsFolded: { type: Number, default: 0 },
    // Hand rankings achieved
    handRankings: {
      royalFlush: { type: Number, default: 0 },
      straightFlush: { type: Number, default: 0 },
      fourOfAKind: { type: Number, default: 0 },
      fullHouse: { type: Number, default: 0 },
      flush: { type: Number, default: 0 },
      straight: { type: Number, default: 0 },
      threeOfAKind: { type: Number, default: 0 },
      twoPair: { type: Number, default: 0 },
      onePair: { type: Number, default: 0 }
    }
  },

  // ========== RUMMY STATS ==========
  rummy: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    bestWin: { type: Number, default: 0 },
    // Game variants
    pointsRummy: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    poolRummy: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    },
    dealsRummy: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 }
    }
  },

  // ========== MONTHLY PROGRESS ==========
  monthlyStats: [{
    month: {
      type: String, // Format: "2024-01"
      required: true
    },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalBets: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 }
  }],

  // ========== ACHIEVEMENTS ==========
  achievements: [{
    name: String,
    description: String,
    unlockedAt: Date,
    type: {
      type: String,
      enum: ['milestone', 'streak', 'earnings', 'games', 'special']
    }
  }],

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
// gameStatsSchema.index({ user: 1 });
gameStatsSchema.index({ 'overall.winRate': -1 });
gameStatsSchema.index({ 'overall.totalEarnings': -1 });
gameStatsSchema.index({ 'monthlyStats.month': 1 });

// ========== METHODS ==========
gameStatsSchema.methods.updateGameResult = async function(gameType, won, betAmount, winAmount) {
  // Update overall stats
  this.overall.totalGamesPlayed += 1;
  this.overall.totalBetsPlaced += 1;
  
  if (won) {
    this.overall.totalGamesWon += 1;
    this.overall.totalBetsWon += 1;
    this.overall.totalEarnings += winAmount;
    this.overall.currentWinStreak += 1;
    
    if (this.overall.currentWinStreak > this.overall.bestWinStreak) {
      this.overall.bestWinStreak = this.overall.currentWinStreak;
    }
    if (winAmount > this.overall.bestWinAmount) {
      this.overall.bestWinAmount = winAmount;
    }
  } else {
    this.overall.totalGamesLost += 1;
    this.overall.totalBetsLost += 1;
    this.overall.worstLossStreak += 1;
    this.overall.currentWinStreak = 0;
  }
  
  // Update win rates
  this.overall.winRate = (this.overall.totalGamesWon / this.overall.totalGamesPlayed) * 100;
  this.overall.betWinRate = (this.overall.totalBetsWon / this.overall.totalBetsPlaced) * 100;
  
  // Update average bet
  this.overall.averageBetAmount = 
    (this.overall.averageBetAmount * (this.overall.totalBetsPlaced - 1) + betAmount) / 
    this.overall.totalBetsPlaced;
  
  // Update game specific stats
  if (this[gameType]) {
    const stats = this[gameType];
    stats.matchesPlayed = (stats.matchesPlayed || stats.gamesPlayed || 0) + 1;
    stats.totalBets = (stats.totalBets || 0) + 1;
    
    if (won) {
      stats.matchesWon = (stats.matchesWon || stats.gamesWon || 0) + 1;
      stats.betsWon = (stats.betsWon || 0) + 1;
      stats.totalEarnings = (stats.totalEarnings || 0) + winAmount;
      
      if (winAmount > (stats.bestWin || 0)) {
        stats.bestWin = winAmount;
      }
    } else {
      stats.matchesLost = (stats.matchesLost || stats.gamesLost || 0) + 1;
    }
    
    stats.winRate = (stats.matchesWon / stats.matchesPlayed) * 100;
  }
  
  // Update monthly stats
  const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01"
  let monthStat = this.monthlyStats.find(ms => ms.month === currentMonth);
  
  if (!monthStat) {
    monthStat = { month: currentMonth };
    this.monthlyStats.push(monthStat);
  }
  
  monthStat.gamesPlayed = (monthStat.gamesPlayed || 0) + 1;
  monthStat.totalBets = (monthStat.totalBets || 0) + 1;
  
  if (won) {
    monthStat.gamesWon = (monthStat.gamesWon || 0) + 1;
    monthStat.earnings = (monthStat.earnings || 0) + winAmount;
  } else {
    monthStat.losses = (monthStat.losses || 0) + betAmount;
  }
  
  monthStat.netProfit = (monthStat.earnings || 0) - (monthStat.losses || 0);
  
  return this.save();
};

gameStatsSchema.methods.checkAchievements = async function() {
  const newAchievements = [];
  
  // Milestone achievements
  if (this.overall.totalGamesPlayed === 1) {
    newAchievements.push({
      name: 'First Game',
      description: 'Play your first game',
      type: 'milestone'
    });
  }
  
  if (this.overall.totalGamesPlayed === 100) {
    newAchievements.push({
      name: 'Century',
      description: 'Play 100 games',
      type: 'milestone'
    });
  }
  
  if (this.overall.totalGamesPlayed === 1000) {
    newAchievements.push({
      name: 'Veteran',
      description: 'Play 1000 games',
      type: 'milestone'
    });
  }
  
  // Streak achievements
  if (this.overall.currentWinStreak >= 5) {
    newAchievements.push({
      name: 'Hot Streak',
      description: 'Win 5 games in a row',
      type: 'streak'
    });
  }
  
  if (this.overall.currentWinStreak >= 10) {
    newAchievements.push({
      name: 'Unstoppable',
      description: 'Win 10 games in a row',
      type: 'streak'
    });
  }
  
  // Earnings achievements
  if (this.overall.totalEarnings >= 10000) {
    newAchievements.push({
      name: 'Big Winner',
      description: 'Earn ₹10,000 in total',
      type: 'earnings'
    });
  }
  
  // Add new achievements
  for (const achievement of newAchievements) {
    const exists = this.achievements.find(a => a.name === achievement.name);
    if (!exists) {
      achievement.unlockedAt = new Date();
      this.achievements.push(achievement);
    }
  }
  
  return this.save();
};

// ========== MIDDLEWARE ==========
gameStatsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // next();
});

const GameStats = mongoose.models.GameStats || mongoose.model('GameStats', gameStatsSchema);
export default GameStats;