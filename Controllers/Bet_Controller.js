import { Bet, Game, Team, Wallet, Transaction, GameStats, Contest } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler, AppError } from '../Utils/errorHandler.js';

class BetController {

  // ============================================
  // PLACE BET
  // ============================================

  /**
   * @desc    Place a bet
   * @route   POST /api/v1/bets/place
   * @access  Private
   */
  static placeBet = asyncHandler(async (req, res) => {
    const { gameId, betType, betOption, amount, odds, contestId } = req.body;

    // Validate game
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    // Check game status
    if (game.status !== 'upcoming' && game.status !== 'live') {
      return res.status(400).json(
        ApiResponse.badRequest('Game is not accepting bets')
      );
    }

    // Validate amount
    const minBet = await Setting.get('min_bet_amount', 10);
    const maxBet = await Setting.get('max_bet_amount', 10000);

    if (amount < minBet) {
      return res.status(400).json(
        ApiResponse.badRequest(`Minimum bet amount is ₹${minBet}`)
      );
    }

    if (amount > maxBet) {
      return res.status(400).json(
        ApiResponse.badRequest(`Maximum bet amount is ₹${maxBet}`)
      );
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (wallet.availableBalance < amount) {
      return res.status(400).json(
        ApiResponse.badRequest('Insufficient balance')
      );
    }

    // Check daily bet limit
    await wallet.resetDailyLimits();
    if (wallet.limits.dailyBetAmount + amount > wallet.limits.dailyLimit) {
      return res.status(400).json(
        ApiResponse.badRequest('Daily betting limit exceeded')
      );
    }

    // Validate betting option
    const betOptionConfig = game.bettingOptions?.find(opt => opt.type === betType);
    if (betOptionConfig && !betOptionConfig.options?.find(o => o.value === betOption)) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid betting option')
      );
    }

    // Check max teams per user
    const existingBets = await Bet.countDocuments({ 
      user: req.user._id, 
      game: gameId 
    });
    
    const maxTeams = game.maxTeamsPerUser || 6;
    if (existingBets >= maxTeams) {
      return res.status(400).json(
        ApiResponse.badRequest(`Maximum ${maxTeams} teams allowed per game`)
      );
    }

    // Calculate potential win
    const finalOdds = odds || betOptionConfig?.options?.find(o => o.value === betOption)?.odds || 1;
    const potentialWin = Math.round(amount * finalOdds * 100) / 100;

    // Deduct from wallet
    await wallet.deductMoney(amount, 'main');
    wallet.limits.dailyBetAmount += amount;
    await wallet.save();

    // Create bet
    const bet = await Bet.create({
      user: req.user._id,
      game: gameId,
      gameType: game.type,
      betType,
      betOption,
      odds: finalOdds,
      amount,
      potentialWin,
      status: 'active',
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent']
    });

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'bet_placed',
      amount: amount,
      netAmount: amount,
      balanceBefore: wallet.mainBalance + amount,
      balanceAfter: wallet.mainBalance,
      status: 'completed',
      game: gameId,
      bet: bet._id,
      description: `Bet placed on ${game.name}`,
      ipAddress: req.ip
    });

    // Join contest if applicable
    if (contestId) {
      const contest = await Contest.findById(contestId);
      if (contest && contest.status === 'upcoming') {
        await contest.joinContest(req.user._id, bet._id);
      }
    }

    // Notify via socket
    if (global.socketManager) {
      global.socketManager.sendToGame(gameId, 'bet:placed', {
        betId: bet._id,
        userId: req.user._id,
        betType,
        amount,
        odds: finalOdds,
        timestamp: new Date()
      });
    }

    CLOG.success('Bet placed:', req.user.uid, 'Game:', gameId, 'Amount:', amount);

    res.status(201).json(
      ApiResponse.created({
        bet: {
          id: bet._id,
          game: game.name,
          betType,
          betOption,
          amount,
          odds: finalOdds,
          potentialWin,
          status: bet.status
        },
        balance: wallet.availableBalance
      }, 'Bet placed successfully')
    );
  });

  /**
   * @desc    Create fantasy team (Dream11 style)
   * @route   POST /api/v1/bets/create-team
   * @access  Private
   */
  static createFantasyTeam = asyncHandler(async (req, res) => {
    const { gameId, teamName, players, captainId, viceCaptainId } = req.body;

    // Validate game
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    if (!game.fantasyRules?.enabled) {
      return res.status(400).json(
        ApiResponse.badRequest('Fantasy mode is not enabled for this game')
      );
    }

    // Validate players array
    if (!players || players.length !== 11) {
      return res.status(400).json(
        ApiResponse.badRequest('Team must have exactly 11 players')
      );
    }

    // Validate credits
    const totalCredits = players.reduce((sum, p) => sum + (p.credits || 0), 0);
    const maxCredits = game.fantasyRules.totalCredits || 100;
    
    if (totalCredits > maxCredits) {
      return res.status(400).json(
        ApiResponse.badRequest(`Total credits cannot exceed ${maxCredits}`)
      );
    }

    // Create team
    const team = await Team.create({
      name: teamName,
      user: req.user._id,
      game: gameId,
      players: players.map(p => ({
        ...p,
        isCaptain: p.id === captainId,
        isViceCaptain: p.id === viceCaptainId
      })),
      totalCredits,
      matchInfo: {
        matchId: gameId,
        matchName: game.name,
        team1: game.teams[0]?.name,
        team2: game.teams[1]?.name
      }
    });

    // Validate team composition
    const isValid = team.validateTeam();
    if (!isValid) {
      await Team.findByIdAndDelete(team._id);
      return res.status(400).json(
        ApiResponse.badRequest(team.validationErrors.join(', '))
      );
    }

    await team.save();

    CLOG.success('Fantasy team created:', req.user.uid, 'Team:', teamName);

    res.status(201).json(
      ApiResponse.created({
        team: {
          id: team._id,
          name: team.name,
          totalCredits: team.totalCredits,
          players: team.players.length,
          captain: team.captain?.name,
          viceCaptain: team.viceCaptain?.name
        }
      }, 'Team created successfully')
    );
  });

  /**
   * @desc    Edit fantasy team
   * @route   PUT /api/v1/bets/teams/:teamId
   * @access  Private
   */
  static editFantasyTeam = asyncHandler(async (req, res) => {
    const { players, captainId, viceCaptainId } = req.body;
    
    const team = await Team.findOne({ 
      _id: req.params.teamId, 
      user: req.user._id 
    });

    if (!team) {
      return res.status(404).json(
        ApiResponse.notFound('Team not found')
      );
    }

    // Check if game has started
    const game = await Game.findById(team.game);
    if (game.status !== 'upcoming') {
      return res.status(400).json(
        ApiResponse.badRequest('Cannot edit team after game has started')
      );
    }

    // Update players
    if (players) {
      team.players = players.map(p => ({
        ...p,
        isCaptain: p.id === captainId,
        isViceCaptain: p.id === viceCaptainId
      }));
      
      team.totalCredits = players.reduce((sum, p) => sum + (p.credits || 0), 0);
    }

    // Update captain/vice-captain
    if (captainId) await team.setCaptain(captainId);
    if (viceCaptainId) await team.setViceCaptain(viceCaptainId);

    // Re-validate
    const isValid = team.validateTeam();
    if (!isValid) {
      return res.status(400).json(
        ApiResponse.badRequest(team.validationErrors.join(', '))
      );
    }

    await team.save();

    res.status(200).json(
      ApiResponse.success({ team }, 'Team updated successfully')
    );
  });

  // ============================================
  // BET HISTORY
  // ============================================

  /**
   * @desc    Get user bets
   * @route   GET /api/v1/bets/my-bets
   * @access  Private
   */
  static getMyBets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, gameType } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (gameType) filters.gameType = gameType;

    const bets = await Bet.getUserBets(req.user._id, parseInt(page), parseInt(limit));
    const total = await Bet.countDocuments({ user: req.user._id, ...filters });

    // Calculate summary
    const summary = await Bet.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalWinnings: { $sum: '$result.winAmount' }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        bets,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Bets fetched successfully')
    );
  });

  /**
   * @desc    Get user teams
   * @route   GET /api/v1/bets/my-teams
   * @access  Private
   */
  static getMyTeams = asyncHandler(async (req, res) => {
    const { gameId, page = 1, limit = 20 } = req.query;

    const filters = { user: req.user._id };
    if (gameId) filters.game = gameId;

    const teams = await Team.find(filters)
      .populate('game', 'name type status startTime')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Team.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        teams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Teams fetched successfully')
    );
  });

  /**
   * @desc    Get team details
   * @route   GET /api/v1/bets/teams/:teamId
   * @access  Private
   */
  static getTeamDetails = asyncHandler(async (req, res) => {
    const team = await Team.findById(req.params.teamId)
      .populate('game', 'name type status startTime')
      .lean();

    if (!team) {
      return res.status(404).json(
        ApiResponse.notFound('Team not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(team, 'Team details fetched successfully')
    );
  });

  /**
   * @desc    Get bet details
   * @route   GET /api/v1/bets/:betId
   * @access  Private
   */
  static getBetDetails = asyncHandler(async (req, res) => {
    const bet = await Bet.findById(req.params.betId)
      .populate('game', 'name type status startTime result')
      .lean();

    if (!bet) {
      return res.status(404).json(
        ApiResponse.notFound('Bet not found')
      );
    }

    // Check ownership
    if (bet.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json(
        ApiResponse.forbidden('Not authorized to view this bet')
      );
    }

    res.status(200).json(
      ApiResponse.success(bet, 'Bet details fetched successfully')
    );
  });

  // ============================================
  // BET STATS
  // ============================================

  /**
   * @desc    Get betting statistics
   * @route   GET /api/v1/bets/stats
   * @access  Private
   */
  static getBetStats = asyncHandler(async (req, res) => {
    const stats = await Bet.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalWon: { 
            $sum: { 
              $cond: [{ $eq: ['$status', 'won'] }, '$result.winAmount', 0] 
            }
          },
          totalLost: {
            $sum: {
              $cond: [{ $eq: ['$status', 'lost'] }, '$amount', 0]
            }
          },
          wonBets: {
            $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] }
          },
          lostBets: {
            $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] }
          }
        }
      }
    ]);

    const todayStats = await Bet.aggregate([
      { 
        $match: { 
          user: req.user._id,
          createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
        } 
      },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        overall: stats[0] || { totalBets: 0, totalAmount: 0, totalWon: 0, totalLost: 0 },
        today: todayStats[0] || { totalBets: 0, totalAmount: 0 }
      }, 'Bet statistics fetched successfully')
    );
  });
}

export default BetController;