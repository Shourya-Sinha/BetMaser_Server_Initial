import mongoose from 'mongoose';

const liveGameSchema = new mongoose.Schema({
  // ========== GAME INFO ==========
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  roomCode: {
    type: String,
    required: true,
    unique: true
  },
  
  // ========== GAME STATE ==========
  state: {
    type: String,
    enum: ['waiting', 'starting', 'in_progress', 'paused', 'finished', 'cancelled'],
    default: 'waiting'
  },
  currentRound: {
    type: Number,
    default: 0
  },
  totalRounds: Number,
  
  // ========== PLAYERS ==========
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    seat: Number,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'folded', 'packed', 'waiting', 'disconnected'],
      default: 'active'
    },
    balance: Number,
    currentBet: Number,
    totalBet: Number,
    cards: [String],
    isDealer: Boolean,
    isTurn: Boolean,
    lastAction: {
      type: String,
      enum: ['check', 'call', 'raise', 'fold', 'see', 'pack', 'show']
    },
    lastActionAmount: Number,
    turnOrder: Number
  }],
  
  // ========== TABLE INFO ==========
  table: {
    potAmount: { type: Number, default: 0 },
    currentBet: { type: Number, default: 0 },
    minBet: Number,
    maxBet: Number,
    blind: {
      small: Number,
      big: Number
    },
    communityCards: [String],
    deck: [String],
    burnedCards: [String]
  },
  
  // ========== GAME SPECIFIC DATA ==========
  gameData: {
    // Teen Patti specific
    teenpatti: {
      variant: {
        type: String,
        enum: ['classic', 'joker', 'muflis', 'ak47', '999']
      },
      bootAmount: Number,
      chaalLimit: Number,
      showLimit: Number,
      currentChaals: { type: Number, default: 0 }
    },
    // Ludo specific
    ludo: {
      board: [[Number]],
      dice: [Number],
      currentPlayer: Number,
      tokens: [{
        player: Number,
        position: Number,
        isHome: Boolean,
        isSafe: Boolean,
        hasFinished: Boolean
      }]
    },
    // Poker specific
    poker: {
      variant: {
        type: String,
        enum: ['texas_holdem', 'omaha']
      },
      stage: {
        type: String,
        enum: ['pre_flop', 'flop', 'turn', 'river', 'showdown']
      }
    }
  },
  
  // ========== CHAT ==========
  chat: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    type: {
      type: String,
      enum: ['text', 'emoji', 'system'],
      default: 'text'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ========== ACTIONS LOG ==========
  actionLog: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: String,
    amount: Number,
    round: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ========== SETTINGS ==========
  settings: {
    turnTimer: { type: Number, default: 30 }, // seconds
    autoStart: { type: Boolean, default: true },
    minPlayers: { type: Number, default: 2 },
    maxPlayers: { type: Number, default: 6 },
    allowSpectators: { type: Boolean, default: false },
    spectators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  
  // ========== STATS ==========
  stats: {
    startedAt: Date,
    endedAt: Date,
    totalRounds: { type: Number, default: 0 },
    totalBets: { type: Number, default: 0 },
    averageRoundTime: Number
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
liveGameSchema.index({ unique: true });
liveGameSchema.index({ game: 1 });
liveGameSchema.index({ state: 1 });
liveGameSchema.index({ 'players.user': 1 });

// ========== METHODS ==========
liveGameSchema.methods.addPlayer = async function(userId, seat) {
  if (this.players.length >= this.settings.maxPlayers) {
    throw new Error('Table is full');
  }
  
  if (this.players.find(p => p.user.toString() === userId.toString())) {
    throw new Error('Player already joined');
  }
  
  if (this.players.find(p => p.seat === seat)) {
    throw new Error('Seat is taken');
  }
  
  this.players.push({
    user: userId,
    seat,
    balance: this.table.minBet * 10, // Starting chips
    status: 'active'
  });
  
  // Send system message
  this.chat.push({
    message: 'Player joined the table',
    type: 'system'
  });
  
  return this.save();
};

liveGameSchema.methods.removePlayer = async function(userId) {
  const playerIndex = this.players.findIndex(p => p.user.toString() === userId.toString());
  
  if (playerIndex === -1) {
    throw new Error('Player not found');
  }
  
  this.players.splice(playerIndex, 1);
  
  this.chat.push({
    message: 'Player left the table',
    type: 'system'
  });
  
  // Cancel game if not enough players
  if (this.players.length < this.settings.minPlayers && this.state === 'in_progress') {
    this.state = 'cancelled';
  }
  
  return this.save();
};

liveGameSchema.methods.startRound = async function() {
  if (this.players.length < this.settings.minPlayers) {
    throw new Error('Not enough players');
  }
  
  this.state = 'in_progress';
  this.currentRound += 1;
  this.stats.startedAt = this.stats.startedAt || new Date();
  
  // Initialize deck and deal cards
  this.table.deck = this.generateDeck();
  this.dealCards();
  
  // Set first player turn
  this.players[0].isTurn = true;
  
  return this.save();
};

liveGameSchema.methods.endRound = async function(winnerId) {
  const winner = this.players.find(p => p.user.toString() === winnerId.toString());
  
  if (winner) {
    winner.balance += this.table.potAmount;
  }
  
  // Reset table
  this.table.potAmount = 0;
  this.table.communityCards = [];
  this.players.forEach(p => {
    p.cards = [];
    p.currentBet = 0;
    p.isTurn = false;
    p.status = 'active';
  });
  
  this.stats.totalRounds += 1;
  
  return this.save();
};

liveGameSchema.methods.placeBet = async function(userId, amount) {
  const player = this.players.find(p => p.user.toString() === userId.toString());
  
  if (!player) throw new Error('Player not found');
  if (!player.isTurn) throw new Error('Not your turn');
  if (amount > player.balance) throw new Error('Insufficient balance');
  
  player.balance -= amount;
  player.currentBet += amount;
  this.table.potAmount += amount;
  
  if (amount > this.table.currentBet) {
    this.table.currentBet = amount;
  }
  
  // Move to next player
  this.nextTurn();
  
  return this.save();
};

liveGameSchema.methods.fold = async function(userId) {
  const player = this.players.find(p => p.user.toString() === userId.toString());
  
  if (!player) throw new Error('Player not found');
  
  player.status = 'folded';
  player.lastAction = 'fold';
  
  this.nextTurn();
  
  // Check if only one player remains
  const activePlayers = this.players.filter(p => p.status === 'active');
  if (activePlayers.length === 1) {
    await this.endRound(activePlayers[0].user);
  }
  
  return this.save();
};

liveGameSchema.methods.nextTurn = function() {
  const currentIndex = this.players.findIndex(p => p.isTurn);
  const player = this.players[currentIndex];
  player.isTurn = false;
  
  // Find next active player
  let nextIndex = (currentIndex + 1) % this.players.length;
  while (this.players[nextIndex].status !== 'active') {
    nextIndex = (nextIndex + 1) % this.players.length;
  }
  
  this.players[nextIndex].isTurn = true;
};

liveGameSchema.methods.generateDeck = function() {
  const suits = ['H', 'D', 'C', 'S'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push(`${value}${suit}`);
    }
  }
  
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
};

liveGameSchema.methods.dealCards = function() {
  const activePlayers = this.players.filter(p => p.status === 'active');
  
  // Deal 3 cards to each player for Teen Patti
  for (const player of activePlayers) {
    player.cards = this.table.deck.splice(0, 3);
  }
};

// ========== STATICS ==========
liveGameSchema.statics.findByRoomCode = function(roomCode) {
  return this.findOne({ roomCode });
};

liveGameSchema.statics.getActiveGames = function() {
  return this.find({ state: { $in: ['waiting', 'in_progress'] } })
    .populate('players.user', 'fullName uid profilePicture');
};

liveGameSchema.statics.getUserActiveGame = function(userId) {
  return this.findOne({
    state: { $in: ['waiting', 'in_progress'] },
    'players.user': userId
  });
};

// ========== MIDDLEWARE ==========
liveGameSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const LiveGame = mongoose.models.LiveGame || mongoose.model('LiveGame', liveGameSchema);
export default LiveGame;