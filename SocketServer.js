// ============================================
// BETMASTER - Socket Server Configuration
// ============================================


// ============================================
// BETMASTER - Socket Server Configuration
// ============================================

import { Server as SocketServer } from 'socket.io';
import CLOG from './Utils/Clog.js';
import { LiveGame, Game, Wallet } from './Models/index.js';

class SocketManager {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map();
        this.gameRooms = new Map();
    }

    /**
     * Initialize socket server with HTTP server
     */
    initialize(httpServer) {
        this.io = new SocketServer(httpServer, {
            cors: {
                origin: process.env.ALLOWED_ORIGINS
                    ? process.env.ALLOWED_ORIGINS.split(',')
                    : ['http://localhost:3000', 'http://localhost:8081'],
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            connectTimeout: 45000,
            maxHttpBufferSize: 1e6,
            transports: ['websocket', 'polling'],
            allowUpgrades: true,
            perMessageDeflate: {
                threshold: 1024,
            },
            cookie: false,
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: true,
            },
        });

        this.setupMiddleware();
        this.setupConnectionHandlers();
        this.setupPeriodicTasks();

        this.startCricketScoreBroadcast();

        this.startFootballScoreBroadcast();

        CLOG.success('Socket.IO server initialized');

        return this.io;
    }

    /**
     * Setup authentication middleware
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token ||
                    socket.handshake.query.token;

                if (!token) {
                    socket.userId = null;
                    socket.userRole = null;
                    socket.isAuthenticated = false;
                    return next();
                }

                const JWTUtils = (await import('./Utils/jwtUtils.js')).default;
                const decoded = JWTUtils.verifyToken(token);

                socket.userId = decoded.id;
                socket.userRole = decoded.role;
                socket.isAuthenticated = true;
                socket.joinTime = new Date();

                next();
            } catch (error) {
                socket.userId = null;
                socket.userRole = null;
                socket.isAuthenticated = false;

                CLOG.warn(`Socket auth failed for ${socket.id}:`, error.message);
                next();
            }
        });
    }

    /**
     * Setup all connection event handlers
     */
    setupConnectionHandlers() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
            this.handleGameEvents(socket);
            this.handleBettingEvents(socket);
            this.handleChatEvents(socket);
            this.handleUserEvents(socket);

            // ============ ADD LIVE GAME HANDLERS HERE ============
            this.setupCricketHandlers(socket);
            this.setupLiveGameHandlers(socket);

            this.setupFootballHandlers(socket);

            this.handleDisconnection(socket);
            this.handleErrors(socket);
        });
    }

    // ============================================
    // EXISTING HANDLERS (handleConnection, handleGameEvents, etc.)
    // ... keep all your existing handler methods ...
    // ============================================

    /**
     * Handle new connection
     */
    handleConnection(socket) {
        const userInfo = socket.isAuthenticated
            ? `User: ${socket.userId}`
            : 'Guest';

        CLOG.success(`🟢 Socket connected: ${socket.id} (${userInfo})`);

        if (socket.isAuthenticated) {
            this.connectedUsers.set(socket.userId, {
                socketId: socket.id,
                connectedAt: new Date(),
                lastActive: new Date(),
            });

            socket.join(`user:${socket.userId}`);

            socket.broadcast.emit('user:online', {
                userId: socket.userId,
                timestamp: new Date().toISOString(),
            });
        }

        socket.emit('server:welcome', {
            message: 'Connected to BetMaster Server',
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            authenticated: socket.isAuthenticated,
        });

        socket.emit('server:stats', {
            onlineUsers: this.connectedUsers.size,
            activeRooms: this.gameRooms.size,
        });
    }

    /**
     * Handle game-related events
     */
    handleGameEvents(socket) {
        socket.on('game:join', (data) => {
            const { gameId, gameType } = data;

            if (!gameId) {
                socket.emit('error', { message: 'Game ID is required' });
                return;
            }

            const roomName = `game:${gameId}`;
            socket.join(roomName);

            if (!this.gameRooms.has(gameId)) {
                this.gameRooms.set(gameId, {
                    type: gameType,
                    players: new Set(),
                    createdAt: new Date(),
                });
            }

            this.gameRooms.get(gameId).players.add(socket.userId || socket.id);

            CLOG.info(`🎮 Socket ${socket.id} joined game:${gameId}`);

            socket.to(roomName).emit('game:player-joined', {
                userId: socket.userId,
                gameId,
                timestamp: new Date().toISOString(),
            });

            socket.emit('game:room-info', {
                gameId,
                playerCount: this.gameRooms.get(gameId).players.size,
            });
        });

        socket.on('game:leave', (data) => {
            const { gameId } = data;
            const roomName = `game:${gameId}`;

            socket.leave(roomName);

            if (this.gameRooms.has(gameId)) {
                this.gameRooms.get(gameId).players.delete(socket.userId || socket.id);

                if (this.gameRooms.get(gameId).players.size === 0) {
                    this.gameRooms.delete(gameId);
                }
            }

            CLOG.info(`🎮 Socket ${socket.id} left game:${gameId}`);

            socket.to(roomName).emit('game:player-left', {
                userId: socket.userId,
                gameId,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('game:state-update', (data) => {
            const { gameId, state } = data;

            socket.to(`game:${gameId}`).emit('game:state-changed', {
                gameId,
                state,
                updatedBy: socket.userId,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('game:action', (data) => {
            const { gameId, action, payload } = data;

            socket.to(`game:${gameId}`).emit('game:action', {
                gameId,
                action,
                payload,
                playerId: socket.userId,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('game:spectate', (data) => {
            const { gameId } = data;
            socket.join(`game:${gameId}:spectators`);

            CLOG.info(`👀 Socket ${socket.id} spectating game:${gameId}`);

            socket.emit('game:spectate-started', {
                gameId,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('game:unspectate', (data) => {
            const { gameId } = data;
            socket.leave(`game:${gameId}:spectators`);
        });
    }

    /**
     * Handle betting-related events
     */
    handleBettingEvents(socket) {
        socket.on('bet:place', async (data) => {
            const { gameId, amount, betType, odds } = data;

            if (!gameId || !amount || !betType) {
                socket.emit('bet:error', {
                    message: 'Invalid bet data',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            this.io.to(`game:${gameId}`).emit('bet:update', {
                userId: socket.userId,
                amount,
                betType,
                odds,
                timestamp: new Date().toISOString(),
            });

            CLOG.info(`💰 Bet placed by ${socket.userId} in game ${gameId}: ${amount} on ${betType}`);
        });

        socket.on('bet:settle', (data) => {
            const { gameId, betId, result } = data;

            this.io.to(`game:${gameId}`).emit('bet:settled', {
                betId,
                result,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('bet:odds-update', (data) => {
            const { gameId, odds } = data;

            socket.to(`game:${gameId}`).emit('bet:odds-changed', {
                odds,
                timestamp: new Date().toISOString(),
            });
        });
    }

    /**
     * Handle chat-related events
     */
    handleChatEvents(socket) {
        socket.on('chat:message', (data) => {
            const { gameId, message, type = 'text' } = data;

            const chatMessage = {
                userId: socket.userId,
                message: message.substring(0, 500),
                type,
                timestamp: new Date().toISOString(),
            };

            if (gameId) {
                this.io.to(`game:${gameId}`).emit('chat:message', chatMessage);
            } else {
                this.io.emit('chat:message', chatMessage);
            }
        });

        socket.on('chat:typing', (data) => {
            const { gameId, isTyping } = data;

            socket.to(`game:${gameId}`).emit('chat:typing', {
                userId: socket.userId,
                isTyping,
            });
        });

        socket.on('chat:private', (data) => {
            const { targetUserId, message } = data;

            this.io.to(`user:${targetUserId}`).emit('chat:private', {
                fromUserId: socket.userId,
                message: message.substring(0, 1000),
                timestamp: new Date().toISOString(),
            });
        });
    }

    /**
     * Handle user-related events
     */
    handleUserEvents(socket) {
        socket.on('user:status', (data) => {
            const { status } = data;

            socket.broadcast.emit('user:status-changed', {
                userId: socket.userId,
                status,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('user:friend-request', (data) => {
            const { targetUserId } = data;

            this.io.to(`user:${targetUserId}`).emit('user:friend-request', {
                fromUserId: socket.userId,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('notification:read', (data) => {
            const { notificationId } = data;

            socket.emit('notification:acknowledged', {
                notificationId,
                timestamp: new Date().toISOString(),
            });
        });
    }

    // ============================================
    // LIVE GAME HANDLERS (NEW - ADD THIS ENTIRE SECTION)
    // ============================================

    startCricketScoreBroadcast() {
        // Run immediately
        this.broadcastCricketScores();

        // Then every 30 seconds
        this.cricketScoreInterval = setInterval(() => {
            this.broadcastCricketScores();
        }, 30000);

        CLOG.success('🏏 Cricket score broadcasting started');
    }

    /**
     * Stop cricket score broadcasting
     */
    stopCricketScoreBroadcast() {
        if (this.cricketScoreInterval) {
            clearInterval(this.cricketScoreInterval);
            this.cricketScoreInterval = null;
            CLOG.info('🏏 Cricket score broadcasting stopped');
        }
    }

    /**
     * Fetch and broadcast cricket scores to all connected clients
     */
    async broadcastCricketScores() {
        try {
            // Import dynamically to avoid circular dependencies
            const CricketDataService = (await import('./Services/cricketDataService.js')).default;

            // Fetch live matches
            const liveMatches = await CricketDataService.getLiveMatches();
            const upcomingMatches = await CricketDataService.getUpcomingMatches();
            const allMatches = [...liveMatches, ...upcomingMatches];

            if (allMatches.length === 0) {
                return; // No matches to broadcast
            }

            // Broadcast to ALL connected clients (they filter what they need)
            this.io.emit('cricket:scores-update', {
                matches: allMatches.map(m => ({
                    id: m.id,
                    name: m.name,
                    teams: m.teams,
                    score: m.score,
                    status: m.status,
                    venue: m.venue,
                    overview: m.overview,
                    timestamp: new Date().toISOString(),
                })),
                total: allMatches.length,
                liveCount: liveMatches.length,
                timestamp: new Date().toISOString(),
            });

            CLOG.info(`📡 Broadcast cricket scores: ${liveMatches.length} live, ${upcomingMatches.length} upcoming`);

        } catch (error) {
            CLOG.error('Cricket score broadcast error:', error.message);
        }
    }

    /**
     * Handle cricket-specific socket events
     */
    setupCricketHandlers(socket) {
        // Client subscribes to specific match updates
        socket.on('cricket:subscribe', (data) => {
            const { matchId } = data;

            if (matchId) {
                socket.join(`cricket:${matchId}`);
                CLOG.info(`🏏 Socket ${socket.id} subscribed to cricket match: ${matchId}`);

                socket.emit('cricket:subscribed', {
                    matchId,
                    message: 'Subscribed to match updates',
                    timestamp: new Date().toISOString(),
                });
            }
        });

        // Client unsubscribes from match
        socket.on('cricket:unsubscribe', (data) => {
            const { matchId } = data;

            if (matchId) {
                socket.leave(`cricket:${matchId}`);
                CLOG.info(`🏏 Socket ${socket.id} unsubscribed from cricket match: ${matchId}`);
            }
        });

        // Client requests specific match score immediately
        socket.on('cricket:get-score', async (data) => {
            const { matchId } = data;

            if (!matchId) {
                socket.emit('cricket:error', { message: 'Match ID required' });
                return;
            }

            try {
                const CricketDataService = (await import('./cricketDataService.js')).default;
                const actualMatchId = matchId.replace('cricket-', '');
                const scoreData = await CricketDataService.getMatchScore(actualMatchId);

                socket.emit('cricket:score-detail', {
                    matchId,
                    score: scoreData,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                socket.emit('cricket:error', {
                    message: 'Failed to fetch score',
                    matchId,
                });
            }
        });

        // Subscribe to all live matches
        socket.on('cricket:subscribe-all', () => {
            socket.join('cricket:all');
            CLOG.info(`🏏 Socket ${socket.id} subscribed to ALL cricket matches`);

            socket.emit('cricket:subscribed', {
                matchId: 'all',
                message: 'Subscribed to all cricket updates',
                timestamp: new Date().toISOString(),
            });
        });

        // Unsubscribe from all matches
        socket.on('cricket:unsubscribe-all', () => {
            socket.leave('cricket:all');
        });
    }

    startFootballScoreBroadcast() {
        this.broadcastFootballMatches();
        this.footballScoreInterval = setInterval(() => {
            this.broadcastFootballMatches();
        }, 60000); // Every 60 seconds
        CLOG.success('⚽ Football match broadcasting started');
    }

    stopFootballScoreBroadcast() {
        if (this.footballScoreInterval) {
            clearInterval(this.footballScoreInterval);
        }
    }

    async broadcastFootballMatches() {
        try {
            const FootballDataService = (await import('./Services/footballDataService.js')).default;
            const matches = await FootballDataService.getAllMatches();

            if (matches.length > 0) {
                this.io.emit('football:matches-update', {
                    matches: matches.map(m => ({
                        id: m.id,
                        name: m.name,
                        teams: m.teams,
                        score: m.score,
                        status: m.status,
                        group: m.group,
                        stage: m.stage,
                        venue: m.venue,
                        date: m.date,
                    })),
                    total: matches.length,
                    liveCount: matches.filter(m => m.status === 'live').length,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            CLOG.error('Football broadcast error:', error.message);
        }
    }

    // Add to setupCricketHandlers (or create a new setupFootballHandlers)
    setupFootballHandlers(socket) {
        socket.on('football:subscribe-all', () => {
            socket.join('football:all');
            socket.emit('football:subscribed', { matchId: 'all' });
        });

        socket.on('football:subscribe', (data) => {
            const { matchId } = data;
            socket.join(`football:${matchId}`);
        });

        socket.on('football:unsubscribe', (data) => {
            const { matchId } = data;
            socket.leave(`football:${matchId}`);
        });
    }

    // ============================================
    // GAME LOGIC HELPERS (NEW - ADD THESE METHODS)
    // ============================================
    /**
 * Setup live game handlers for Teen Patti, Ludo, Poker
 */
    setupLiveGameHandlers(socket) {

        // ============ ROOM EVENTS ============

        socket.on('live:join-room', async (data) => {
            const { roomCode } = data;

            if (!roomCode) {
                socket.emit('live:error', { message: 'Room code is required' });
                return;
            }

            try {
                const liveGame = await LiveGame.findByRoomCode(roomCode);

                if (!liveGame) {
                    socket.emit('live:error', { message: 'Room not found' });
                    return;
                }

                socket.join(`live:${liveGame._id}`);

                socket.to(`live:${liveGame._id}`).emit('live:player-joined', {
                    userId: socket.userId,
                    playerCount: liveGame.players.length,
                    timestamp: new Date().toISOString()
                });

                socket.emit('live:state', {
                    roomId: liveGame._id,
                    roomCode: liveGame.roomCode,
                    state: liveGame.state,
                    currentRound: liveGame.currentRound,
                    potAmount: liveGame.table.potAmount,
                    currentBet: liveGame.table.currentBet,
                    players: liveGame.players.map(p => ({
                        seat: p.seat,
                        status: p.status,
                        balance: p.balance,
                        isTurn: p.isTurn,
                        userId: p.user
                    }))
                });

                CLOG.info(`🎮 User ${socket.userId} joined live room: ${roomCode}`);

            } catch (error) {
                CLOG.error('Live room join error:', error);
                socket.emit('live:error', { message: 'Failed to join room' });
            }
        });

        socket.on('live:leave-room', async (data) => {
            const { roomId } = data;
            socket.leave(`live:${roomId}`);
            socket.to(`live:${roomId}`).emit('live:player-left', {
                userId: socket.userId,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('live:player-ready', async (data) => {
            const { roomId } = data;
            try {
                const liveGame = await LiveGame.findById(roomId);
                if (!liveGame) return;

                const player = liveGame.players.find(p => p.user.toString() === socket.userId);
                if (player) {
                    player.status = 'active';
                    await liveGame.save();
                }

                const allReady = liveGame.players.every(p => p.status === 'active');

                this.io.to(`live:${roomId}`).emit('live:player-ready-update', {
                    userId: socket.userId,
                    allReady,
                    readyCount: liveGame.players.filter(p => p.status === 'active').length,
                    totalPlayers: liveGame.players.length
                });

                if (allReady && liveGame.players.length >= liveGame.settings.minPlayers) {
                    await liveGame.startRound();
                    this.io.to(`live:${roomId}`).emit('live:game-started', {
                        roomId,
                        round: liveGame.currentRound,
                        potAmount: liveGame.table.potAmount
                    });
                }
            } catch (error) {
                CLOG.error('Player ready error:', error);
            }
        });

        // ============ TEEN PATTI EVENTS ============

        socket.on('teenpatti:chaal', async (data) => {
            const { roomId, amount } = data;
            try {
                const liveGame = await LiveGame.findById(roomId);
                if (!liveGame || liveGame.state !== 'in_progress') {
                    socket.emit('live:error', { message: 'Game not in progress' });
                    return;
                }

                const player = liveGame.players.find(p => p.user.toString() === socket.userId);
                if (!player || !player.isTurn) {
                    socket.emit('live:error', { message: 'Not your turn' });
                    return;
                }

                const betAmount = amount || liveGame.table.currentBet || liveGame.table.minBet;
                await liveGame.placeBet(socket.userId, betAmount);

                this.io.to(`live:${roomId}`).emit('teenpatti:state-update', {
                    potAmount: liveGame.table.potAmount,
                    currentBet: liveGame.table.currentBet,
                    currentPlayer: liveGame.players.find(p => p.isTurn)?.user,
                    action: 'chaal',
                    amount: betAmount,
                    playerSeat: player.seat
                });
            } catch (error) {
                CLOG.error('Teen Patti chaal error:', error);
                socket.emit('live:error', { message: error.message || 'Action failed' });
            }
        });

        socket.on('teenpatti:show', async (data) => {
            const { roomId } = data;
            try {
                const liveGame = await LiveGame.findById(roomId);
                if (!liveGame) return;

                const player = liveGame.players.find(p => p.user.toString() === socket.userId && p.isTurn);
                if (!player) {
                    socket.emit('live:error', { message: 'Cannot show now' });
                    return;
                }

                const otherPlayer = liveGame.players.find(p => p.status === 'active' && p.user.toString() !== socket.userId);
                if (!otherPlayer) {
                    socket.emit('live:error', { message: 'No opponent to show' });
                    return;
                }

                const playerHand = this.evaluateTeenPattiHand(player.cards);
                const opponentHand = this.evaluateTeenPattiHand(otherPlayer.cards);

                let winner = playerHand.rank > opponentHand.rank ? player :
                    opponentHand.rank > playerHand.rank ? otherPlayer :
                        playerHand.highCard > opponentHand.highCard ? player : otherPlayer;

                await liveGame.endRound(winner.user);

                this.io.to(`live:${roomId}`).emit('teenpatti:showdown', {
                    winner: winner.user,
                    winnerSeat: winner.seat,
                    winnerHand: winner === player ? playerHand : opponentHand,
                    potAmount: liveGame.table.potAmount + liveGame.table.currentBet,
                    players: liveGame.players.map(p => ({
                        userId: p.user,
                        seat: p.seat,
                        cards: p.cards,
                        hand: this.evaluateTeenPattiHand(p.cards)
                    }))
                });
            } catch (error) {
                CLOG.error('Teen Patti show error:', error);
                socket.emit('live:error', { message: 'Show failed' });
            }
        });

        socket.on('teenpatti:pack', async (data) => {
            const { roomId } = data;
            try {
                const liveGame = await LiveGame.findById(roomId);
                if (!liveGame) return;

                const player = liveGame.players.find(p => p.user.toString() === socket.userId);
                if (!player) {
                    socket.emit('live:error', { message: 'Player not found' });
                    return;
                }

                await liveGame.fold(socket.userId);

                this.io.to(`live:${roomId}`).emit('teenpatti:player-packed', {
                    userId: socket.userId,
                    seat: player.seat
                });

                const activePlayers = liveGame.players.filter(p => p.status === 'active');
                if (activePlayers.length === 1) {
                    await liveGame.endRound(activePlayers[0].user);
                    this.io.to(`live:${roomId}`).emit('teenpatti:showdown', {
                        winner: activePlayers[0].user,
                        winnerSeat: activePlayers[0].seat,
                        byDefault: true,
                        potAmount: liveGame.table.potAmount,
                        message: 'Winner by default - all other players folded'
                    });
                }
            } catch (error) {
                CLOG.error('Teen Patti pack error:', error);
                socket.emit('live:error', { message: 'Fold failed' });
            }
        });

        // ============ LUDO EVENTS ============

        socket.on('ludo:roll-dice', async (data) => {
            const { roomId } = data;
            const dice = Math.floor(Math.random() * 6) + 1;
            this.io.to(`live:${roomId}`).emit('ludo:dice-rolled', {
                userId: socket.userId,
                dice,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('ludo:move-token', (data) => {
            const { roomId, tokenIndex, newPosition } = data;
            this.io.to(`live:${roomId}`).emit('ludo:token-moved', {
                userId: socket.userId,
                tokenIndex,
                newPosition,
                timestamp: new Date().toISOString()
            });
        });

        // ============ GENERAL EVENTS ============

        socket.on('live:heartbeat', () => {
            socket.emit('live:heartbeat-ack', { timestamp: new Date().toISOString() });
        });

        socket.on('live:disconnect-timeout', async (data) => {
            const { roomId } = data;
            try {
                const liveGame = await LiveGame.findById(roomId);
                if (!liveGame) return;
                const player = liveGame.players.find(p => p.user.toString() === socket.userId);
                if (player) {
                    player.status = 'disconnected';
                    await liveGame.save();
                    this.io.to(`live:${roomId}`).emit('live:player-disconnected', {
                        userId: socket.userId,
                        seat: player.seat
                    });
                }
            } catch (error) {
                CLOG.error('Live disconnect error:', error);
            }
        });
    }

    /**
     * Evaluate Teen Patti hand ranking
     * Returns: { rank, name, highCard }
     * Rank: 6=Trail, 5=Pure Sequence, 4=Sequence, 3=Color, 2=Pair, 1=High Card
     */
    evaluateTeenPattiHand(cards) {
        if (!cards || cards.length !== 3) {
            return { rank: 0, name: 'Invalid', highCard: 0 };
        }

        // Parse cards
        const parsed = cards.map(card => {
            const value = card.slice(0, -1);
            const suit = card.slice(-1);
            const valueMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
            return { value: valueMap[value], suit, original: card };
        });

        // Sort by value descending
        parsed.sort((a, b) => b.value - a.value);

        const values = parsed.map(p => p.value);
        const suits = parsed.map(p => p.suit);

        // Check for Trail (Three of a Kind)
        if (values[0] === values[1] && values[1] === values[2]) {
            return { rank: 6, name: 'Trail', highCard: values[0] };
        }

        // Check for Pure Sequence (Straight Flush)
        const isSameSuit = suits[0] === suits[1] && suits[1] === suits[2];
        const isSequence = (values[0] - values[1] === 1 && values[1] - values[2] === 1) ||
            (values[0] === 14 && values[1] === 3 && values[2] === 2); // A-2-3

        if (isSameSuit && isSequence) {
            return { rank: 5, name: 'Pure Sequence', highCard: values[0] };
        }

        // Check for Sequence (Straight)
        if (isSequence) {
            return { rank: 4, name: 'Sequence', highCard: values[0] };
        }

        // Check for Color (Flush)
        if (isSameSuit) {
            return { rank: 3, name: 'Color', highCard: values[0] };
        }

        // Check for Pair
        if (values[0] === values[1] || values[1] === values[2]) {
            const pairValue = values[0] === values[1] ? values[0] : values[1];
            return { rank: 2, name: 'Pair', highCard: pairValue };
        }

        // High Card
        return { rank: 1, name: 'High Card', highCard: values[0] };
    }

    /**
     * Determine Teen Patti winner between two players
     */
    determineTeenPattiWinner(liveGame) {
        const activePlayers = liveGame.players.filter(p => p.status === 'active');

        if (activePlayers.length === 0) return null;
        if (activePlayers.length === 1) return { user: activePlayers[0].user, hand: null };

        let winner = activePlayers[0];
        let bestHand = this.evaluateTeenPattiHand(activePlayers[0].cards);

        for (let i = 1; i < activePlayers.length; i++) {
            const hand = this.evaluateTeenPattiHand(activePlayers[i].cards);

            if (hand.rank > bestHand.rank) {
                winner = activePlayers[i];
                bestHand = hand;
            } else if (hand.rank === bestHand.rank && hand.highCard > bestHand.highCard) {
                winner = activePlayers[i];
                bestHand = hand;
            }
        }

        return { user: winner.user, hand: bestHand };
    }

    /**
     * Handle disconnection
     */
    handleDisconnection(socket) {
        socket.on('disconnect', (reason) => {
            CLOG.info(`🔴 Socket disconnected: ${socket.id} (Reason: ${reason})`);

            if (socket.isAuthenticated) {
                this.connectedUsers.delete(socket.userId);

                socket.broadcast.emit('user:offline', {
                    userId: socket.userId,
                    timestamp: new Date().toISOString(),
                });
            }

            // Clean up game rooms
            this.gameRooms.forEach((room, gameId) => {
                if (room.players.has(socket.userId || socket.id)) {
                    room.players.delete(socket.userId || socket.id);

                    this.io.to(`game:${gameId}`).emit('game:player-disconnected', {
                        userId: socket.userId,
                        reason,
                        timestamp: new Date().toISOString(),
                    });
                }
            });

            // Remove empty game rooms
            for (const [gameId, room] of this.gameRooms) {
                if (room.players.size === 0) {
                    this.gameRooms.delete(gameId);
                }
            }
        });
    }

    /**
     * Handle socket errors
     */
    handleErrors(socket) {
        socket.on('error', (error) => {
            CLOG.error(`❌ Socket error for ${socket.id}:`, error.message);

            socket.emit('server:error', {
                message: 'An error occurred',
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('connect_error', (error) => {
            CLOG.error(`❌ Socket connection error:`, error.message);
        });

        socket.on('connect_timeout', (timeout) => {
            CLOG.error(`⏰ Socket connection timeout:`, timeout);
        });
    }

    /**
     * Setup periodic tasks
     */
    setupPeriodicTasks() {
        setInterval(() => {
            if (this.io) {
                const stats = {
                    onlineUsers: this.connectedUsers.size,
                    activeRooms: this.gameRooms.size,
                    totalConnections: this.io.engine?.clientsCount || 0,
                    timestamp: new Date().toISOString(),
                };

                this.io.emit('server:stats', stats);

                CLOG.info(`📊 Socket Stats - Users: ${stats.onlineUsers}, Rooms: ${stats.activeRooms}, Connections: ${stats.totalConnections}`);
            }
        }, 30000);

        setInterval(() => {
            const now = Date.now();
            const maxInactiveTime = 30 * 60 * 1000;

            for (const [gameId, room] of this.gameRooms) {
                if (room.players.size === 0 &&
                    (now - room.createdAt.getTime()) > maxInactiveTime) {
                    this.gameRooms.delete(gameId);
                    CLOG.info(`🧹 Cleaned up inactive room: ${gameId}`);
                }
            }
        }, 300000);

        setInterval(() => {
            if (this.io) {
                this.io.emit('server:heartbeat', {
                    timestamp: new Date().toISOString(),
                });
            }
        }, 60000);
    }

    /**
     * Get current socket statistics
     */
    getStats() {
        return {
            connectedUsers: this.connectedUsers.size,
            activeRooms: this.gameRooms.size,
            totalConnections: this.io?.engine?.clientsCount || 0,
            uptime: process.uptime(),
            rooms: Array.from(this.gameRooms.entries()).map(([id, room]) => ({
                gameId: id,
                type: room.type,
                playerCount: room.players.size,
                createdAt: room.createdAt,
            })),
        };
    }

    /**
     * Broadcast to all clients
     */
    broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    /**
     * Send to specific user
     */
    sendToUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user:${userId}`).emit(event, data);
        }
    }

    /**
     * Send to game room
     */
    sendToGame(gameId, event, data) {
        if (this.io) {
            this.io.to(`game:${gameId}`).emit(event, data);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        CLOG.info('Shutting down socket server...');

        if (this.io) {
            this.io.emit('server:shutdown', {
                message: 'Server is shutting down',
                timestamp: new Date().toISOString(),
            });

            await new Promise((resolve) => {
                this.io.close(() => {
                    CLOG.success('Socket server closed');
                    resolve();
                });
            });
        }
    }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;

