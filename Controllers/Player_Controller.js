import { Player, Team, Game } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';

class PlayerController {

  // ============================================
  // PLAYER LISTINGS
  // ============================================

  /**
   * @desc    Get all players with filters
   * @route   GET /api/v1/players
   * @access  Public
   */
  static getPlayers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      team, 
      role, 
      search,
      isActive = true,
      sortBy = 'fantasyCredits',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    
    if (team) filters['currentTeam.name'] = team;
    if (role) filters.primaryRole = role;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { shortName: { $regex: search, $options: 'i' } },
        { searchKeywords: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const players = await Player.find(filters)
      .select('name shortName image primaryRole secondaryRole currentTeam fantasyCredits injuryStatus careerStats')
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Player.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        players,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Players fetched successfully')
    );
  });

  /**
   * @desc    Get player by ID
   * @route   GET /api/v1/players/:id
   * @access  Public
   */
  static getPlayerById = asyncHandler(async (req, res) => {
    const player = await Player.findById(req.params.id).lean();

    if (!player) {
      return res.status(404).json(
        ApiResponse.notFound('Player not found')
      );
    }

    // Get player's recent performance in current games
    const recentGames = await Game.find({
      status: { $in: ['live', 'completed'] },
      'teams.players.name': player.name
    })
      .select('name type status startTime teams')
      .sort({ startTime: -1 })
      .limit(10)
      .lean();

    // Get player's fantasy stats
    const fantasyStats = await Team.aggregate([
      { $unwind: '$players' },
      { 
        $match: { 
          'players.name': player.name,
          isComplete: true
        } 
      },
      {
        $group: {
          _id: null,
          totalTeams: { $sum: 1 },
          avgPoints: { $avg: '$players.points' },
          maxPoints: { $max: '$players.points' },
          totalPoints: { $sum: '$players.points' }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        player,
        recentGames,
        fantasyStats: fantasyStats[0] || { totalTeams: 0, avgPoints: 0 }
      }, 'Player details fetched successfully')
    );
  });

  /**
   * @desc    Get players by team
   * @route   GET /api/v1/players/team/:teamName
   * @access  Public
   */
  static getPlayersByTeam = asyncHandler(async (req, res) => {
    const { teamName } = req.params;
    
    const players = await Player.findByTeam(teamName);

    // Group by role
    const grouped = {
      batsmen: players.filter(p => p.primaryRole === 'batsman'),
      bowlers: players.filter(p => p.primaryRole === 'bowler'),
      allRounders: players.filter(p => p.primaryRole === 'all-rounder'),
      wicketKeepers: players.filter(p => p.primaryRole === 'wicket-keeper')
    };

    res.status(200).json(
      ApiResponse.success({
        team: teamName,
        totalPlayers: players.length,
        grouped,
        allPlayers: players
      }, 'Team players fetched successfully')
    );
  });

  /**
   * @desc    Get players by role
   * @route   GET /api/v1/players/role/:role
   * @access  Public
   */
  static getPlayersByRole = asyncHandler(async (req, res) => {
    const { role } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const validRoles = ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'];
    if (!validRoles.includes(role)) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid role')
      );
    }

    const players = await Player.findByRole(role);
    const total = players.length;

    const paginatedPlayers = players.slice(
      (parseInt(page) - 1) * parseInt(limit),
      parseInt(page) * parseInt(limit)
    );

    res.status(200).json(
      ApiResponse.success({
        players: paginatedPlayers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Players fetched by role')
    );
  });

  /**
   * @desc    Search players
   * @route   GET /api/v1/players/search
   * @access  Public
   */
  static searchPlayers = asyncHandler(async (req, res) => {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json(
        ApiResponse.badRequest('Search query must be at least 2 characters')
      );
    }

    const players = await Player.searchPlayers(q);
    
    res.status(200).json(
      ApiResponse.success({
        players: players.slice(0, parseInt(limit)),
        totalResults: players.length,
        query: q
      }, 'Search results fetched')
    );
  });

  /**
   * @desc    Get top players by points
   * @route   GET /api/v1/players/top
   * @access  Public
   */
  static getTopPlayers = asyncHandler(async (req, res) => {
    const { limit = 10, role } = req.query;

    const filters = { isActive: true };
    if (role) filters.primaryRole = role;

    // Get players sorted by recent performance
    const players = await Player.aggregate([
      { $match: filters },
      { 
        $addFields: {
          avgFantasyPoints: { 
            $avg: '$recentMatches.points' 
          }
        }
      },
      { $sort: { avgFantasyPoints: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          shortName: 1,
          image: 1,
          primaryRole: 1,
          currentTeam: 1,
          fantasyCredits: 1,
          avgFantasyPoints: 1,
          careerStats: 1
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({ players }, 'Top players fetched')
    );
  });

  // ============================================
  // PLAYER STATS
  // ============================================

  /**
   * @desc    Get player statistics
   * @route   GET /api/v1/players/:id/stats
   * @access  Public
   */
  static getPlayerStats = asyncHandler(async (req, res) => {
    const player = await Player.findById(req.params.id)
      .select('name careerStats recentMatches tournamentStats')
      .lean();

    if (!player) {
      return res.status(404).json(
        ApiResponse.notFound('Player not found')
      );
    }

    // Calculate form (last 5 matches)
    const recentForm = player.recentMatches
      ?.slice(-5)
      .map(match => ({
        match: match.matchName,
        date: match.date,
        runs: match.batting?.runs || 0,
        wickets: match.bowling?.wickets || 0,
        catches: match.fielding?.catches || 0,
        points: match.points || 0,
        isManOfMatch: match.isManOfMatch
      }))
      .reverse();

    res.status(200).json(
      ApiResponse.success({
        player: {
          name: player.name,
          role: player.primaryRole,
          team: player.currentTeam?.name
        },
        careerStats: player.careerStats,
        tournamentStats: player.tournamentStats,
        recentForm,
        totalRecentMatches: player.recentMatches?.length || 0
      }, 'Player stats fetched successfully')
    );
  });

  /**
   * @desc    Compare players
   * @route   POST /api/v1/players/compare
   * @access  Public
   */
  static comparePlayers = asyncHandler(async (req, res) => {
    const { playerIds } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 2) {
      return res.status(400).json(
        ApiResponse.badRequest('At least 2 player IDs are required')
      );
    }

    if (playerIds.length > 5) {
      return res.status(400).json(
        ApiResponse.badRequest('Maximum 5 players can be compared')
      );
    }

    const players = await Player.find({ _id: { $in: playerIds } })
      .select('name shortName image primaryRole currentTeam fantasyCredits careerStats recentMatches')
      .lean();

    res.status(200).json(
      ApiResponse.success({ players }, 'Players compared successfully')
    );
  });

  // ============================================
  // ADMIN: PLAYER MANAGEMENT
  // ============================================

  /**
   * @desc    Create player (Admin)
   * @route   POST /api/v1/players
   * @access  Private (Admin)
   */
  static createPlayer = asyncHandler(async (req, res) => {
    const playerData = req.body;
    
    const player = await Player.create(playerData);

    CLOG.success('Player created:', player.name);

    res.status(201).json(
      ApiResponse.created({ player }, 'Player created successfully')
    );
  });

  /**
   * @desc    Update player (Admin)
   * @route   PUT /api/v1/players/:id
   * @access  Private (Admin)
   */
  static updatePlayer = asyncHandler(async (req, res) => {
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!player) {
      return res.status(404).json(
        ApiResponse.notFound('Player not found')
      );
    }

    CLOG.success('Player updated:', player.name);

    res.status(200).json(
      ApiResponse.success({ player }, 'Player updated successfully')
    );
  });

  /**
   * @desc    Update player match stats (Admin)
   * @route   PUT /api/v1/players/:id/match-stats
   * @access  Private (Admin)
   */
  static updateMatchStats = asyncHandler(async (req, res) => {
    const player = await Player.findById(req.params.id);

    if (!player) {
      return res.status(404).json(
        ApiResponse.notFound('Player not found')
      );
    }

    await player.updateMatchStats(req.body);
    await player.calculateFantasyCredits();

    CLOG.success('Player stats updated:', player.name);

    res.status(200).json(
      ApiResponse.success({ player }, 'Player stats updated')
    );
  });

  /**
   * @desc    Bulk import players (Admin)
   * @route   POST /api/v1/players/bulk-import
   * @access  Private (Admin)
   */
  static bulkImportPlayers = asyncHandler(async (req, res) => {
    const { players } = req.body;

    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json(
        ApiResponse.badRequest('Players array is required')
      );
    }

    const created = await Player.insertMany(players, { ordered: false });

    CLOG.success(`Bulk imported ${created.length} players`);

    res.status(201).json(
      ApiResponse.created({ 
        importedCount: created.length,
        total: players.length 
      }, 'Players imported successfully')
    );
  });

  /**
   * @desc    Delete player (Admin)
   * @route   DELETE /api/v1/players/:id
   * @access  Private (Admin)
   */
  static deletePlayer = asyncHandler(async (req, res) => {
    const player = await Player.findByIdAndDelete(req.params.id);

    if (!player) {
      return res.status(404).json(
        ApiResponse.notFound('Player not found')
      );
    }

    CLOG.warn('Player deleted:', player.name);

    res.status(200).json(
      ApiResponse.success(null, 'Player deleted successfully')
    );
  });
}

export default PlayerController;