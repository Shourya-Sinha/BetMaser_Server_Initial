import { LiveGame, Game, User, Wallet, Transaction, Bet } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';
import IDGenerator from '../Utils/generateId.js';

class LiveGameController {

  // ============================================
  // ROOM MANAGEMENT
  // ============================================

  /**
   * @desc    Create live game room (for Teen Patti, Ludo, Poker)
   * @route   POST /api/v1/live-games/create
   * @access  Private
   */
  static createRoom = asyncHandler(async (req, res) => {
    const { gameId, variant, blindAmount, maxPlayers = 6 } = req.body;

    // Validate game
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    if (!['teenpatti', 'ludo', 'poker'].includes(game.type)) {
      return res.status(400).json(
        ApiResponse.badRequest('Live rooms only available for card/board games')
      );
    }

    // Check if user is already in an active room
    const existingRoom = await LiveGame.getUserActiveGame(req.user._id);
    if (existingRoom) {
      return res.status(400).json(
        ApiResponse.badRequest('You are already in an active game room')
      );
    }

    // Generate room code
    const roomCode = IDGenerator.generateRoomCode();

    // Create live game
    const liveGame = await LiveGame.create({
      game: gameId,
      roomCode,
      state: 'waiting',
      currentRound: 0,
      settings: {
        turnTimer: 30,
        autoStart: true,
        minPlayers: 2,
        maxPlayers,
        allowSpectators: true
      },
      table: {
        minBet: blindAmount || 10,
        maxBet: blindAmount ? blindAmount * 10 : 1000,
        blind: {
          small: blindAmount || 10,
          big: (blindAmount || 10) * 2
        }
      },
      gameData: {
        teenpatti: game.type === 'teenpatti' ? {
          variant: variant || 'classic',
          bootAmount: blindAmount || 10,
          chaalLimit: 128,
          showLimit: 256
        } : undefined,
        ludo: game.type === 'ludo' ? {
          board: Array(52).fill(0),
          dice: [],
          currentPlayer: 0,
          tokens: []
        } : undefined,
        poker: game.type === 'poker' ? {
          variant: variant || 'texas_holdem',
          stage: 'pre_flop'
        } : undefined
      }
    });

    // Add creator as first player
    await liveGame.addPlayer(req.user._id, 1);

    CLOG.success('Live game room created:', roomCode);

    res.status(201).json(
      ApiResponse.created({
        room: {
          id: liveGame._id,
          roomCode: liveGame.roomCode,
          gameType: game.type,
          state: liveGame.state,
          players: liveGame.players.length,
          maxPlayers: liveGame.settings.maxPlayers
        }
      }, 'Game room created successfully')
    );
  });

  /**
   * @desc    Join live game room
   * @route   POST /api/v1/live-games/join
   * @access  Private
   */
  static joinRoom = asyncHandler(async (req, res) => {
    const { roomCode, seat } = req.body;

    const liveGame = await LiveGame.findByRoomCode(roomCode);
    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    if (liveGame.state !== 'waiting') {
      return res.status(400).json(
        ApiResponse.badRequest('Game has already started')
      );
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.user._id });
    const minBalance = liveGame.table.minBet * 10; // Need 10x min bet
    
    if (wallet.availableBalance < minBalance) {
      return res.status(400).json(
        ApiResponse.badRequest(`Minimum balance of ₹${minBalance} required to join`)
      );
    }

    // Add player
    await liveGame.addPlayer(req.user._id, seat || liveGame.players.length + 1);

    // Notify room
    if (global.socketManager) {
      global.socketManager.sendToGame(liveGame.game.toString(), 'room:player-joined', {
        roomCode,
        userId: req.user._id,
        playerCount: liveGame.players.length
      });
    }

    CLOG.info('Player joined room:', roomCode, req.user.uid);

    res.status(200).json(
      ApiResponse.success({
        room: {
          id: liveGame._id,
          roomCode: liveGame.roomCode,
          players: liveGame.players.map(p => ({
            seat: p.seat,
            status: p.status
          })),
          state: liveGame.state
        }
      }, 'Joined room successfully')
    );
  });

  /**
   * @desc    Leave live game room
   * @route   POST /api/v1/live-games/leave
   * @access  Private
   */
  static leaveRoom = asyncHandler(async (req, res) => {
    const { roomId } = req.body;

    const liveGame = await LiveGame.findById(roomId);
    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    await liveGame.removePlayer(req.user._id);

    if (global.socketManager) {
      global.socketManager.sendToGame(liveGame.game.toString(), 'room:player-left', {
        roomId,
        userId: req.user._id,
        playerCount: liveGame.players.length
      });
    }

    res.status(200).json(
      ApiResponse.success(null, 'Left room successfully')
    );
  });

  /**
   * @desc    Get available rooms
   * @route   GET /api/v1/live-games/rooms
   * @access  Public
   */
  static getAvailableRooms = asyncHandler(async (req, res) => {
    const { gameType, page = 1, limit = 20 } = req.query;

    const filters = { state: { $in: ['waiting', 'in_progress'] } };
    
    if (gameType) {
      // Populate game to filter by type
      const games = await Game.find({ type: gameType }).select('_id');
      filters.game = { $in: games.map(g => g._id) };
    }

    const rooms = await LiveGame.find(filters)
      .populate('game', 'name type')
      .populate('players.user', 'fullName uid profilePicture')
      .select('roomCode state currentRound players settings table')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await LiveGame.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        rooms: rooms.map(room => ({
          id: room._id,
          roomCode: room.roomCode,
          gameName: room.game?.name,
          gameType: room.game?.type,
          state: room.state,
          players: room.players?.length || 0,
          maxPlayers: room.settings?.maxPlayers,
          minBet: room.table?.minBet,
          currentRound: room.currentRound
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Available rooms fetched')
    );
  });

  /**
   * @desc    Get room details
   * @route   GET /api/v1/live-games/rooms/:roomCode
   * @access  Public
   */
  static getRoomDetails = asyncHandler(async (req, res) => {
    const liveGame = await LiveGame.findByRoomCode(req.params.roomCode)
      .populate('game', 'name type status')
      .populate('players.user', 'fullName uid profilePicture')
      .lean();

    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    // Hide other players' cards
    const sanitizedPlayers = liveGame.players.map(p => ({
      seat: p.seat,
      status: p.status,
      balance: p.balance,
      currentBet: p.currentBet,
      isTurn: p.isTurn,
      isDealer: p.isDealer,
      user: p.user,
      // Only show cards if it's the requesting user's cards
      cards: req.user && p.user?._id?.toString() === req.user._id.toString() 
        ? p.cards 
        : p.cards?.map(() => '**')
    }));

    res.status(200).json(
      ApiResponse.success({
        room: {
          ...liveGame,
          players: sanitizedPlayers
        }
      }, 'Room details fetched')
    );
  });

  // ============================================
  // GAME ACTIONS
  // ============================================

  /**
   * @desc    Start game round
   * @route   POST /api/v1/live-games/:id/start
   * @access  Private
   */
  static startRound = asyncHandler(async (req, res) => {
    const liveGame = await LiveGame.findById(req.params.id);

    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    if (liveGame.state !== 'waiting') {
      return res.status(400).json(
        ApiResponse.badRequest('Game already started')
      );
    }

    await liveGame.startRound();

    // Notify all players
    if (global.socketManager) {
      global.socketManager.sendToGame(liveGame.game.toString(), 'game:round-started', {
        roomId: liveGame._id,
        round: liveGame.currentRound,
        potAmount: liveGame.table.potAmount
      });
    }

    res.status(200).json(
      ApiResponse.success({
        room: {
          id: liveGame._id,
          state: liveGame.state,
          round: liveGame.currentRound
        }
      }, 'Round started')
    );
  });

  /**
   * @desc    Place bet/action in live game
   * @route   POST /api/v1/live-games/:id/action
   * @access  Private
   */
  static performAction = asyncHandler(async (req, res) => {
    const { action, amount } = req.body;
    const liveGame = await LiveGame.findById(req.params.id);

    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    if (liveGame.state !== 'in_progress') {
      return res.status(400).json(
        ApiResponse.badRequest('Game is not in progress')
      );
    }

    const player = liveGame.players.find(
      p => p.user.toString() === req.user._id.toString()
    );

    if (!player || !player.isTurn) {
      return res.status(400).json(
        ApiResponse.badRequest('Not your turn')
      );
    }

    switch (action) {
      case 'bet':
      case 'call':
      case 'raise':
        await liveGame.placeBet(req.user._id, amount);
        break;
      
      case 'fold':
        await liveGame.fold(req.user._id);
        break;
      
      case 'check':
        player.lastAction = 'check';
        liveGame.nextTurn();
        await liveGame.save();
        break;
      
      case 'see':
        player.lastAction = 'see';
        liveGame.nextTurn();
        await liveGame.save();
        break;
      
      default:
        return res.status(400).json(
          ApiResponse.badRequest('Invalid action')
        );
    }

    // Notify room
    if (global.socketManager) {
      global.socketManager.sendToGame(liveGame.game.toString(), 'game:action-performed', {
        roomId: liveGame._id,
        userId: req.user._id,
        action,
        amount,
        potAmount: liveGame.table.potAmount
      });
    }

    res.status(200).json(
      ApiResponse.success({
        action,
        potAmount: liveGame.table.potAmount,
        currentTurn: liveGame.players.find(p => p.isTurn)?.user
      }, 'Action performed')
    );
  });

  /**
   * @desc    Get game state (for reconnection)
   * @route   GET /api/v1/live-games/:id/state
   * @access  Private
   */
  static getGameState = asyncHandler(async (req, res) => {
    const liveGame = await LiveGame.findById(req.params.id)
      .populate('players.user', 'fullName uid profilePicture')
      .lean();

    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    // Check if user is in game
    const isPlayer = liveGame.players.some(
      p => p.user?._id?.toString() === req.user._id.toString()
    );

    if (!isPlayer && liveGame.state === 'in_progress') {
      return res.status(403).json(
        ApiResponse.forbidden('Not a player in this game')
      );
    }

    // Return full state for player, limited for spectators
    const gameState = {
      roomId: liveGame._id,
      roomCode: liveGame.roomCode,
      state: liveGame.state,
      currentRound: liveGame.currentRound,
      potAmount: liveGame.table.potAmount,
      currentBet: liveGame.table.currentBet,
      communityCards: liveGame.table.communityCards,
      players: liveGame.players.map(p => ({
        seat: p.seat,
        status: p.status,
        balance: p.balance,
        currentBet: p.currentBet,
        isTurn: p.isTurn,
        isDealer: p.isDealer,
        lastAction: p.lastAction,
        user: p.user,
        cards: isPlayer && p.user?._id?.toString() === req.user._id.toString() 
          ? p.cards 
          : p.cards?.length || 0
      })),
      yourCards: liveGame.players.find(
        p => p.user?._id?.toString() === req.user._id.toString()
      )?.cards || []
    };

    res.status(200).json(
      ApiResponse.success(gameState, 'Game state fetched')
    );
  });

  /**
   * @desc    Send chat in live game
   * @route   POST /api/v1/live-games/:id/chat
   * @access  Private
   */
  static sendChat = asyncHandler(async (req, res) => {
    const { message, type = 'text' } = req.body;
    const liveGame = await LiveGame.findById(req.params.id);

    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    liveGame.chat.push({
      user: req.user._id,
      message: message.substring(0, 200),
      type,
      timestamp: new Date()
    });

    // Keep only last 100 messages
    if (liveGame.chat.length > 100) {
      liveGame.chat = liveGame.chat.slice(-100);
    }

    await liveGame.save();

    if (global.socketManager) {
      global.socketManager.sendToGame(liveGame.game.toString(), 'chat:message', {
        roomId: liveGame._id,
        userId: req.user._id,
        message,
        type
      });
    }

    res.status(200).json(
      ApiResponse.success(null, 'Message sent')
    );
  });

  /**
   * @desc    Get chat history
   * @route   GET /api/v1/live-games/:id/chat
   * @access  Private
   */
  static getChatHistory = asyncHandler(async (req, res) => {
    const liveGame = await LiveGame.findById(req.params.id)
      .select('chat')
      .populate('chat.user', 'fullName uid')
      .lean();

    if (!liveGame) {
      return res.status(404).json(
        ApiResponse.notFound('Room not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        messages: liveGame.chat?.slice(-50) || []
      }, 'Chat history fetched')
    );
  });
}

export default LiveGameController;