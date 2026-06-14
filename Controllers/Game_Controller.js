import { Game, Bet, Contest, Team, Player, Transaction, Wallet, Setting } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler, AppError } from '../Utils/errorHandler.js';
import CricketDataService from '../Services/cricketDataService.js';
import FootballDataService from '../Services/footballDataService.js';

class GameController {

  // ============================================
  // GAME LISTINGS
  // ============================================

  /**
   * @desc    Get all games with filters
   * @route   GET /api/v1/games
   * @access  Public
   */
  static getGames = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      isFeatured,
      search,
      sortBy = 'startTime',
      sortOrder = 'asc',
      source = 'all' // 'api', 'db', or 'all'
    } = req.query;

    let games = [];
    let liveCount = 0;
    let upcomingCount = 0;
    let total = 0;

    // ✅ Fetch from Live API (Cricket/Football)
    if (source === 'all' || source === 'api') {
      if (!type || type === 'cricket') {
        try {
          let apiGames = [];

          if (status === 'live') {
            apiGames = await CricketDataService.getLiveMatches('international');
          } else if (status === 'upcoming') {
            apiGames = await CricketDataService.getUpcomingMatches('international');
          } else if (status === 'completed') {
            apiGames = await CricketDataService.getRecentMatches('international');
          } else {
            // Get all
            apiGames = await CricketDataService.getAllMatches('international');
          }

          // Add API source tag
          apiGames = apiGames.map(g => ({ ...g, source: 'api' }));
          games = [...games, ...apiGames];
        } catch (error) {
          CLOG.error('Error fetching cricket API data:', error.message);
        }
      }

      if (!type || type === 'football') {
        try {
          let footballGames = [];

          if (status === 'live') {
            footballGames = await FootballDataService.getLiveMatches();
          } else if (status === 'upcoming') {
            footballGames = await FootballDataService.getUpcomingMatches();
          } else if (status === 'completed') {
            footballGames = await FootballDataService.getCompletedMatches();
          } else {
            footballGames = await FootballDataService.getAllMatches();
          }

          footballGames = footballGames.map(g => ({ ...g, source: 'api' }));
          games = [...games, ...footballGames];

          console.log(`⚽ Added ${footballGames.length} football matches`);
        } catch (error) {
          CLOG.error('Football fetch error:', error.message);
        }
      }

    }

    // ✅ Fetch from Database (Small games: Teen Patti, Ludo, etc.)
    if (source === 'all' || source === 'db') {
      const dbFilters = {};

      if (type && type !== 'cricket' && type !== 'football') {
        dbFilters.type = type;
      } else if (type === 'cricket' || type === 'football') {
        // If only sports requested, don't include DB games
        dbFilters.type = { $in: ['teenpatti', 'ludo', 'poker', 'rummy'] };
      }

      if (status) dbFilters.status = status;
      if (!status) dbFilters.status = { $in: ['upcoming', 'live'] };
      if (isFeatured) dbFilters.isFeatured = isFeatured === 'true';
      if (search) {
        dbFilters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const dbGames = await Game.find(dbFilters)
        .select('name type status startTime endTime entryFee prizePool currentPlayers maxPlayers teams odds images isFeatured')
        .sort({ startTime: 1 })
        .lean();

      // Add DB source tag
      const dbGamesWithSource = dbGames.map(g => ({
        ...g,
        id: g._id.toString(),
        source: 'db'
      }));
      games = [...games, ...dbGamesWithSource];
    }

    // Apply search filter to all games
    if (search) {
      const searchLower = search.toLowerCase();
      games = games.filter(g =>
        g.name?.toLowerCase().includes(searchLower) ||
        g.teams?.home?.toLowerCase().includes(searchLower) ||
        g.teams?.away?.toLowerCase().includes(searchLower)
      );
    }

    // Count by status
    liveCount = games.filter(g => g.status === 'live').length;
    upcomingCount = games.filter(g => g.status === 'upcoming').length;
    total = games.length;

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedGames = games.slice(startIndex, startIndex + parseInt(limit));

    res.status(200).json(
      ApiResponse.success({
        games: paginatedGames,
        liveCount,
        upcomingCount,
        totalGames: total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }, 'Games fetched successfully')
    );
  });

  /**
   * @desc    Get live games
   * @route   GET /api/v1/games/live
   * @access  Public
   */
  static getLiveGames = asyncHandler(async (req, res) => {
    let games = [];

    // ✅ Fetch live cricket from API
    try {
      const cricketGames = await CricketDataService.getLiveMatches('international');
      games = [...games, ...cricketGames];
    } catch (error) {
      CLOG.error('Live cricket API error:', error.message);
    }

    // ✅ Fetch live small games from DB
    const dbGames = await Game.find({
      status: 'live',
      type: { $in: ['teenpatti', 'ludo', 'poker', 'rummy'] }
    })
      .select('name type startTime teams odds entryFee prizePool currentPlayers maxPlayers')
      .sort({ startTime: -1 })
      .lean();

    const dbGamesFormatted = dbGames.map(g => ({ ...g, id: g._id.toString(), source: 'db' }));
    games = [...games, ...dbGamesFormatted];

    res.status(200).json(
      ApiResponse.success({
        games,
        count: games.length
      }, 'Live games fetched successfully')
    );
  });

  /**
   * @desc    Get upcoming games
   * @route   GET /api/v1/games/upcoming
   * @access  Public
   */
  static getUpcomingGames = asyncHandler(async (req, res) => {
    let games = [];

    // ✅ Fetch upcoming cricket from API
    try {
      const cricketGames = await CricketDataService.getUpcomingMatches('international');
      games = [...games, ...cricketGames];
    } catch (error) {
      CLOG.error('Upcoming cricket API error:', error.message);
    }

    // ✅ Fetch upcoming small games from DB
    const dbGames = await Game.find({
      status: 'upcoming',
      type: { $in: ['teenpatti', 'ludo', 'poker', 'rummy'] }
    })
      .select('name type startTime entryFee prizePool currentPlayers maxPlayers odds')
      .sort({ startTime: 1 })
      .lean();

    const dbGamesFormatted = dbGames.map(g => ({ ...g, id: g._id.toString(), source: 'db' }));
    games = [...games, ...dbGamesFormatted];

    res.status(200).json(
      ApiResponse.success(games, 'Upcoming games fetched successfully')
    );
  });

  /**
   * @desc    Get featured games
   * @route   GET /api/v1/games/featured
   * @access  Public
   */
  static getFeaturedGames = asyncHandler(async (req, res) => {
    let games = [];

    // Get featured from DB
    const featured = await Game.find({
      isFeatured: true,
      status: { $in: ['upcoming', 'live'] }
    })
      .select('name type startTime entryFee prizePool currentPlayers maxPlayers images odds')
      .sort({ startTime: 1 })
      .limit(10)
      .lean();

    games = featured.map(g => ({ ...g, id: g._id.toString(), source: 'db' }));

    // Also add live cricket matches as featured
    try {
      const liveCricket = await CricketDataService.getLiveMatches('international');
      const featuredCricket = liveCricket.slice(0, 5).map(g => ({ ...g, isFeatured: true }));
      games = [...featuredCricket, ...games];
    } catch (error) {
      CLOG.error('Featured cricket error:', error.message);
    }

    res.status(200).json(
      ApiResponse.success(games, 'Featured games fetched successfully')
    );
  });

  // ============================================
  // GAME DETAILS
  // ============================================

  /**
   * @desc    Get game by ID
   * @route   GET /api/v1/games/:id
   * @access  Public
   */
  static getGameById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // ✅ Check if it's a cricket API match
    if (id.startsWith('cricket-')) {
      const matchId = id.replace('cricket-', '');
      const scoreData = await CricketDataService.getMatchScore(matchId);

      if (scoreData) {
        return res.status(200).json(
          ApiResponse.success({
            game: scoreData,
            source: 'api'
          }, 'Match details fetched successfully')
        );
      }

      return res.status(404).json(
        ApiResponse.notFound('Match not found')
      );
    }

    // ✅ Check if it's a DB game
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      const game = await Game.findById(id)
        .populate('teams.players', 'name role image fantasyCredits')
        .lean();

      if (!game) {
        return res.status(404).json(
          ApiResponse.notFound('Game not found')
        );
      }

      const contests = await Contest.find({
        game: game._id,
        status: { $in: ['upcoming', 'live'] }
      })
        .select('name type entryFee prizePool maxPlayers currentPlayers')
        .lean();

      let userBet = null;
      let userTeams = null;

      if (req.user) {
        userBet = await Bet.findOne({ user: req.user._id, game: game._id }).lean();
        userTeams = await Team.find({ user: req.user._id, game: game._id }).lean();
      }

      return res.status(200).json(
        ApiResponse.success({
          game: { ...game, id: game._id.toString(), source: 'db' },
          contests,
          userBet,
          userTeams,
          totalContests: contests.length
        }, 'Game details fetched successfully')
      );
    }

    // Small game ID
    const smallGame = getSmallGameById(id);
    if (smallGame) {
      return res.status(200).json(
        ApiResponse.success({ game: smallGame, source: 'system' }, 'Game details fetched')
      );
    }

    res.status(404).json(
      ApiResponse.notFound('Game not found')
    );
  });

  static getMatchScore = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const matchId = id.replace('cricket-', '');

    const scoreData = await CricketDataService.getMatchScore(matchId);

    if (scoreData) {
      return res.status(200).json(
        ApiResponse.success(scoreData, 'Score fetched successfully')
      );
    }

    res.status(404).json(
      ApiResponse.notFound('Score not available')
    );
  });

  /**
   * @desc    Get game odds
   * @route   GET /api/v1/games/:id/odds
   * @access  Public
   */
  static getGameOdds = asyncHandler(async (req, res) => {
    const game = await Game.findById(req.params.id)
      .select('odds bettingOptions')
      .lean();

    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        odds: game.odds,
        bettingOptions: game.bettingOptions
      }, 'Game odds fetched successfully')
    );
  });

  /**
   * @desc    Get game players (for fantasy team creation)
   * @route   GET /api/v1/games/:id/players
   * @access  Public
   */
  static getGamePlayers = asyncHandler(async (req, res) => {
    const game = await Game.findById(req.params.id)
      .select('teams fantasyRules')
      .populate('teams.players', 'name role team image fantasyCredits careerStats')
      .lean();

    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    // Flatten all players with team info
    const players = [];
    game.teams.forEach(team => {
      team.players.forEach(player => {
        players.push({
          ...player,
          teamName: team.name,
          teamShortName: team.shortName
        });
      });
    });

    res.status(200).json(
      ApiResponse.success({
        players,
        fantasyRules: game.fantasyRules,
        totalPlayers: players.length
      }, 'Game players fetched successfully')
    );
  });

  /**
   * @desc    Get game leaderboard
   * @route   GET /api/v1/games/:id/leaderboard
   * @access  Public
   */
  static getGameLeaderboard = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    const leaderboard = await Team.getLeaderboard(
      req.params.id,
      parseInt(limit)
    );

    res.status(200).json(
      ApiResponse.success({
        leaderboard,
        game: {
          name: game.name,
          type: game.type,
          status: game.status
        }
      }, 'Leaderboard fetched successfully')
    );
  });

  // ============================================
  // CONTESTS
  // ============================================

  /**
   * @desc    Get game contests
   * @route   GET /api/v1/games/:id/contests
   * @access  Public
   */
  static getGameContests = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;

    const filters = {
      game: req.params.id,
      status: { $in: ['upcoming', 'live'] }
    };

    if (type) filters.type = type;

    const contests = await Contest.find(filters)
      .select('name type entryFee prizePool maxPlayers currentPlayers prizeDistribution')
      .sort({ entryFee: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Contest.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        contests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Contests fetched successfully')
    );
  });

  /**
   * @desc    Get contest details
   * @route   GET /api/v1/games/:gameId/contests/:contestId
   * @access  Public
   */
  static getContestDetails = asyncHandler(async (req, res) => {
    const contest = await Contest.findOne({
      _id: req.params.contestId,
      game: req.params.gameId
    })
      .populate('participants.user', 'fullName uid profilePicture')
      .lean();

    if (!contest) {
      return res.status(404).json(
        ApiResponse.notFound('Contest not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(contest, 'Contest details fetched successfully')
    );
  });

  /**
   * @desc    Join contest
   * @route   POST /api/v1/games/:gameId/contests/:contestId/join
   * @access  Private
   */
  static joinContest = asyncHandler(async (req, res) => {
    const { teamId } = req.body;

    const contest = await Contest.findOne({
      _id: req.params.contestId,
      game: req.params.gameId
    });

    if (!contest) {
      return res.status(404).json(
        ApiResponse.notFound('Contest not found')
      );
    }

    if (contest.status !== 'upcoming') {
      return res.status(400).json(
        ApiResponse.badRequest('Contest is not open for joining')
      );
    }

    if (contest.currentPlayers >= contest.maxPlayers) {
      return res.status(400).json(
        ApiResponse.badRequest('Contest is full')
      );
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (wallet.availableBalance < contest.entryFee) {
      return res.status(400).json(
        ApiResponse.badRequest('Insufficient balance')
      );
    }

    // Verify team belongs to user
    if (teamId) {
      const team = await Team.findOne({ _id: teamId, user: req.user._id });
      if (!team) {
        return res.status(400).json(
          ApiResponse.badRequest('Invalid team')
        );
      }
    }

    // Deduct entry fee
    await wallet.deductMoney(contest.entryFee, 'main');

    // Add participant
    await contest.joinContest(req.user._id, teamId);

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'bet_placed',
      amount: contest.entryFee,
      netAmount: contest.entryFee,
      balanceBefore: wallet.mainBalance + contest.entryFee,
      balanceAfter: wallet.mainBalance,
      status: 'completed',
      game: req.params.gameId,
      description: `Joined contest: ${contest.name}`,
      ipAddress: req.ip
    });

    // Notify via socket
    if (global.socketManager) {
      global.socketManager.sendToGame(req.params.gameId, 'contest:player-joined', {
        contestId: contest._id,
        userId: req.user._id,
        spotsLeft: contest.maxPlayers - contest.currentPlayers
      });
    }

    CLOG.success('User joined contest:', req.user.uid, 'Contest:', contest.name);

    res.status(200).json(
      ApiResponse.success({
        contest: {
          id: contest._id,
          name: contest.name,
          currentPlayers: contest.currentPlayers,
          remainingSpots: contest.remainingSpots
        },
        balance: wallet.availableBalance
      }, 'Successfully joined contest')
    );
  });

  // ============================================
  // CATEGORIES & TYPES
  // ============================================

  /**
   * @desc    Get game categories
   * @route   GET /api/v1/games/categories
   * @access  Public
   */
  static getCategories = asyncHandler(async (req, res) => {
    // Get counts from DB and API
    let liveCricketCount = 0;
    let upcomingCricketCount = 0;

    try {
      const liveCricket = await CricketDataService.getLiveMatches('international');
      const upcomingCricket = await CricketDataService.getUpcomingMatches('international');
      liveCricketCount = liveCricket.length;
      upcomingCricketCount = upcomingCricket.length;
    } catch (error) {
      CLOG.error('Category count error:', error.message);
    }

    const categories = [
      {
        type: 'cricket',
        name: 'Cricket',
        icon: 'cricket',
        description: 'Create fantasy teams and win big',
        liveCount: liveCricketCount,
        upcomingCount: upcomingCricketCount,
        source: 'api',
      },
      {
        type: 'teenpatti',
        name: 'Teen Patti',
        icon: 'cards-playing-outline',
        description: 'Classic card game with real money',
        liveCount: await Game.countDocuments({ type: 'teenpatti', status: 'live' }),
        upcomingCount: await Game.countDocuments({ type: 'teenpatti', status: 'upcoming' }),
        source: 'db',
      },
      {
        type: 'ludo',
        name: 'Ludo',
        icon: 'dice-multiple',
        description: 'Play ludo and win cash prizes',
        liveCount: await Game.countDocuments({ type: 'ludo', status: 'live' }),
        upcomingCount: await Game.countDocuments({ type: 'ludo', status: 'upcoming' }),
        source: 'db',
      },
      {
        type: 'poker',
        name: 'Poker',
        icon: 'cards',
        description: "Texas Hold'em and more",
        liveCount: await Game.countDocuments({ type: 'poker', status: 'live' }),
        upcomingCount: await Game.countDocuments({ type: 'poker', status: 'upcoming' }),
        source: 'db',
      },
      {
        type: 'rummy',
        name: 'Rummy',
        icon: 'cards-playing',
        description: 'Play rummy tournaments',
        liveCount: await Game.countDocuments({ type: 'rummy', status: 'live' }),
        upcomingCount: await Game.countDocuments({ type: 'rummy', status: 'upcoming' }),
        source: 'db',
      },
    ];

    res.status(200).json(
      ApiResponse.success(categories, 'Categories fetched successfully')
    );
  });

  static getMatchSquad = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Only for cricket API matches
    if (id.startsWith('cricket-')) {
      const matchId = id.replace('cricket-', '');
      const squadData = await CricketDataService.getFantasySquad(matchId);

      if (squadData) {
        return res.status(200).json(
          ApiResponse.success(squadData, 'Squad fetched successfully')
        );
      }

      return res.status(404).json(
        ApiResponse.notFound('Squad not available for this match')
      );
    }

    // For DB games, return players from database
    const game = await Game.findById(id).populate('teams.players');
    if (game) {
      return res.status(200).json(
        ApiResponse.success({
          matchId: id,
          teams: game.teams,
        }, 'Squad fetched successfully')
      );
    }

    res.status(404).json(
      ApiResponse.notFound('Game not found')
    );
  });
}




function getSmallGameById(id) {
  const smallGames = {
    'teenpatti-classic': {
      id: 'teenpatti-classic',
      name: 'Teen Patti Classic',
      type: 'teenpatti',
      status: 'live',
      icon: 'cards-playing-outline',
      minPlayers: 2,
      maxPlayers: 6,
      entryFee: 50,
      prizePool: 500,
      color: '#4A148C',
    },
    'teenpatti-premium': {
      id: 'teenpatti-premium',
      name: 'Teen Patti Premium',
      type: 'teenpatti',
      status: 'live',
      icon: 'cards-playing-outline',
      minPlayers: 2,
      maxPlayers: 6,
      entryFee: 200,
      prizePool: 2000,
      color: '#6A1B9A',
    },
    'ludo-king': {
      id: 'ludo-king',
      name: 'Ludo King',
      type: 'ludo',
      status: 'live',
      icon: 'dice-multiple',
      minPlayers: 2,
      maxPlayers: 4,
      entryFee: 30,
      prizePool: 300,
      color: '#FF6F00',
    },
  };

  return smallGames[id] || null;
}

export default GameController;