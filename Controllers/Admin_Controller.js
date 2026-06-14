import { User, Wallet, KYC, Game, Bet, Transaction, Withdrawal, Notification, Setting, GameStats, Support, Banner, Payment } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler, AppError } from '../Utils/errorHandler.js';
import mongoose from 'mongoose';

class AdminController {

  // ============================================
  // DASHBOARD
  // ============================================

  /**
   * @desc    Get admin dashboard stats
   * @route   GET /api/v1/admin/dashboard
   * @access  Private (Admin only)
   */
  static getDashboard = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Get all stats in parallel
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisMonth,
      totalGames,
      liveGames,
      totalBets,
      betsToday,
      totalDeposits,
      depositsToday,
      totalWithdrawals,
      pendingWithdrawals,
      totalRevenue,
      revenueThisMonth,
      kycPending,
      supportTickets,
      openTickets,
      userStats
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true, isBlocked: false }),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      Game.countDocuments(),
      Game.countDocuments({ status: 'live' }),
      Bet.countDocuments(),
      Bet.countDocuments({ createdAt: { $gte: today } }),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } }
      ]),
      Withdrawal.countDocuments(),
      Withdrawal.countDocuments({ status: 'pending' }),
      Transaction.aggregate([
        { $match: { type: { $in: ['bet_placed', 'commission'] }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$fee' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: ['bet_placed', 'commission'] }, status: 'completed', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$fee' } } }
      ]),
      KYC.countDocuments({ status: 'submitted' }),
      Support.countDocuments(),
      Support.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Get daily stats for last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [dayBets, dayDeposits, dayNewUsers] = await Promise.all([
        Bet.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        Transaction.aggregate([
          { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: date, $lt: nextDate } } },
          { $group: { _id: null, total: { $sum: '$netAmount' } } }
        ]),
        User.countDocuments({ createdAt: { $gte: date, $lt: nextDate } })
      ]);

      last7Days.push({
        date: date.toISOString().split('T')[0],
        bets: dayBets,
        deposits: dayDeposits[0]?.total || 0,
        newUsers: dayNewUsers
      });
    }

    // Get game type distribution
    const gameDistribution = await Game.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Get top users by winnings
    const topUsers = await Wallet.find()
      .sort({ totalWon: -1 })
      .limit(10)
      .populate('user', 'fullName uid phone')
      .lean();

    res.status(200).json(
      ApiResponse.success({
        overview: {
          totalUsers,
          activeUsers,
          newUsersToday,
          newUsersThisMonth,
          totalGames,
          liveGames,
          totalBets,
          betsToday,
          totalDeposits: totalDeposits[0]?.total || 0,
          depositsToday: depositsToday[0]?.total || 0,
          totalWithdrawals,
          pendingWithdrawals,
          totalRevenue: totalRevenue[0]?.total || 0,
          revenueThisMonth: revenueThisMonth[0]?.total || 0,
          kycPending,
          supportTickets,
          openTickets
        },
        charts: {
          last7Days,
          gameDistribution,
          userRoles: userStats
        },
        topUsers: topUsers.map(w => ({
          userId: w.user?._id,
          name: w.user?.fullName,
          uid: w.user?.uid,
          totalWon: w.totalWon,
          balance: w.mainBalance
        }))
      }, 'Dashboard data fetched successfully')
    );
  });

  /**
   * @desc    Get revenue analytics
   * @route   GET /api/v1/admin/analytics
   * @access  Private (Admin only)
   */
  static getAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const revenueData = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          total: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Game-wise revenue
    const gameRevenue = await Bet.aggregate([
      {
        $match: {
          status: { $in: ['won', 'lost'] },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$gameType',
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalWon: { $sum: '$result.winAmount' }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        revenueData,
        gameRevenue,
        period: { start, end }
      }, 'Analytics data fetched successfully')
    );
  });

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * @desc    Get all users
   * @route   GET /api/v1/admin/users
   * @access  Private (Admin only)
   */
  static getUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      role, 
      isVerified, 
      isActive, 
      isBlocked,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    
    if (search) {
      filters.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { uid: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) filters.role = role;
    if (isVerified) filters.isVerified = isVerified === 'true';
    if (isActive) filters.isActive = isActive === 'true';
    if (isBlocked) filters.isBlocked = isBlocked === 'true';

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(filters)
      .select('-password -security')
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // Get wallet info for users
    const userIds = users.map(u => u._id);
    const wallets = await Wallet.find({ user: { $in: userIds } })
      .select('mainBalance bonusBalance winningBalance totalDeposited totalWithdrawn')
      .lean();

    const walletMap = {};
    wallets.forEach(w => {
      walletMap[w.user.toString()] = w;
    });

    const usersWithWallet = users.map(user => ({
      ...user,
      wallet: walletMap[user._id.toString()] || null
    }));

    const total = await User.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        users: usersWithWallet,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Users fetched successfully')
    );
  });

  /**
   * @desc    Get user details (admin view)
   * @route   GET /api/v1/admin/users/:userId
   * @access  Private (Admin only)
   */
  static getUserDetails = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    // Get all related data
    const [
      wallet,
      gameStats,
      kyc,
      security,
      referral,
      recentTransactions,
      recentBets
    ] = await Promise.all([
      Wallet.findOne({ user: user._id }).lean(),
      GameStats.findOne({ user: user._id }).lean(),
      KYC.findOne({ user: user._id }).lean(),
      Security.findOne({ user: user._id }).select('-securityQuestions.answer').lean(),
      Referral.findOne({ user: user._id }).lean(),
      Transaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
      Bet.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).populate('game', 'name type').lean()
    ]);

    res.status(200).json(
      ApiResponse.success({
        user,
        wallet,
        gameStats,
        kyc,
        security,
        referral,
        recentTransactions,
        recentBets
      }, 'User details fetched successfully')
    );
  });

  /**
   * @desc    Block/Unblock user
   * @route   PUT /api/v1/admin/users/:userId/toggle-block
   * @access  Private (Admin only)
   */
  static toggleUserBlock = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    user.isBlocked = !user.isBlocked;
    user.blockReason = user.isBlocked ? reason : null;
    user.blockedAt = user.isBlocked ? new Date() : null;
    await user.save();

    // Send notification
    await Notification.create({
      user: user._id,
      type: 'system',
      title: user.isBlocked ? 'Account Blocked' : 'Account Unblocked',
      message: user.isBlocked 
        ? `Your account has been blocked. Reason: ${reason}` 
        : 'Your account has been unblocked. You can now use all features.',
      priority: 'high'
    });

    // Notify via socket
    if (global.socketManager) {
      global.socketManager.sendToUser(user._id.toString(), 'account:status', {
        blocked: user.isBlocked,
        reason
      });
    }

    CLOG.warn(`User ${user.isBlocked ? 'blocked' : 'unblocked'}:`, user.uid);

    res.status(200).json(
      ApiResponse.success({ 
        user: { uid: user.uid, isBlocked: user.isBlocked } 
      }, `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`)
    );
  });

  /**
   * @desc    Update user role
   * @route   PUT /api/v1/admin/users/:userId/role
   * @access  Private (Super Admin only)
   */
  static updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    user.role = role;
    await user.save();

    CLOG.info('User role updated:', user.uid, 'to', role);

    res.status(200).json(
      ApiResponse.success({ user }, 'User role updated successfully')
    );
  });

  /**
   * @desc    Verify user manually
   * @route   PUT /api/v1/admin/users/:userId/verify
   * @access  Private (Admin only)
   */
  static verifyUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    user.isVerified = true;
    await user.save();

    CLOG.success('User verified:', user.uid);

    res.status(200).json(
      ApiResponse.success({ user }, 'User verified successfully')
    );
  });

  // ============================================
  // KYC MANAGEMENT
  // ============================================

  /**
   * @desc    Get pending KYC requests
   * @route   GET /api/v1/admin/kyc/pending
   * @access  Private (Admin only)
   */
  static getPendingKYC = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const kycs = await KYC.find({ status: 'submitted' })
      .populate('user', 'fullName uid phone email')
      .sort({ submittedAt: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await KYC.countDocuments({ status: 'submitted' });

    res.status(200).json(
      ApiResponse.success({
        kycs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Pending KYC requests fetched successfully')
    );
  });

  /**
   * @desc    Approve KYC
   * @route   PUT /api/v1/admin/kyc/:kycId/approve
   * @access  Private (Admin only)
   */
  static approveKYC = asyncHandler(async (req, res) => {
    const kyc = await KYC.findById(req.params.kycId);

    if (!kyc) {
      return res.status(404).json(
        ApiResponse.notFound('KYC record not found')
      );
    }

    await kyc.verify(req.user._id);

    // Send notification
    await Notification.create({
      user: kyc.user,
      type: 'kyc_verified',
      title: 'KYC Verified',
      message: 'Your KYC documents have been verified successfully.',
      priority: 'high'
    });

    CLOG.success('KYC approved:', kyc._id);

    res.status(200).json(
      ApiResponse.success({ kyc }, 'KYC approved successfully')
    );
  });

  /**
   * @desc    Reject KYC
   * @route   PUT /api/v1/admin/kyc/:kycId/reject
   * @access  Private (Admin only)
   */
  static rejectKYC = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const kyc = await KYC.findById(req.params.kycId);

    if (!kyc) {
      return res.status(404).json(
        ApiResponse.notFound('KYC record not found')
      );
    }

    await kyc.reject(req.user._id, reason);

    // Send notification
    await Notification.create({
      user: kyc.user,
      type: 'kyc_verified',
      title: 'KYC Rejected',
      message: `Your KYC has been rejected. Reason: ${reason}`,
      priority: 'high'
    });

    CLOG.warn('KYC rejected:', kyc._id, 'Reason:', reason);

    res.status(200).json(
      ApiResponse.success({ kyc }, 'KYC rejected')
    );
  });

  // ============================================
  // WITHDRAWAL MANAGEMENT
  // ============================================

  /**
   * @desc    Get pending withdrawals
   * @route   GET /api/v1/admin/withdrawals/pending
   * @access  Private (Admin only)
   */
  static getPendingWithdrawals = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const withdrawals = await Withdrawal.getPendingWithdrawals(
      parseInt(page),
      parseInt(limit)
    );

    const total = await Withdrawal.countDocuments({ status: 'pending' });

    res.status(200).json(
      ApiResponse.success({
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Pending withdrawals fetched successfully')
    );
  });

  /**
   * @desc    Process withdrawal (approve/reject)
   * @route   PUT /api/v1/admin/withdrawals/:withdrawalId/process
   * @access  Private (Admin only)
   */
  static processWithdrawal = asyncHandler(async (req, res) => {
    const { action, reason, transactionId } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.withdrawalId);

    if (!withdrawal) {
      return res.status(404).json(
        ApiResponse.notFound('Withdrawal not found')
      );
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json(
        ApiResponse.badRequest('Withdrawal already processed')
      );
    }

    const wallet = await Wallet.findOne({ user: withdrawal.user });

    if (action === 'approve') {
      await withdrawal.approve(req.user._id, transactionId);
      
      // Unlock and deduct from wallet
      await wallet.unlockAmount(withdrawal.amount);
      await wallet.deductMoney(withdrawal.netAmount, 'main');
      
      wallet.totalWithdrawn += withdrawal.netAmount;
      await wallet.save();

      // Create transaction
      await Transaction.create({
        user: withdrawal.user,
        type: 'withdrawal',
        amount: withdrawal.amount,
        fee: withdrawal.processingFee,
        netAmount: withdrawal.netAmount,
        balanceBefore: wallet.mainBalance + withdrawal.netAmount,
        balanceAfter: wallet.mainBalance,
        status: 'completed',
        description: 'Withdrawal processed',
        verifiedBy: req.user._id
      });

      // Notify user
      await Notification.create({
        user: withdrawal.user,
        type: 'withdrawal_success',
        title: 'Withdrawal Approved',
        message: `Your withdrawal of ₹${withdrawal.netAmount} has been processed.`,
        priority: 'high'
      });

      CLOG.success('Withdrawal approved:', withdrawal._id);

    } else if (action === 'reject') {
      await withdrawal.reject(req.user._id, reason);
      
      // Refund amount to wallet
      await wallet.unlockAmount(withdrawal.amount);

      // Notify user
      await Notification.create({
        user: withdrawal.user,
        type: 'withdrawal_success',
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request has been rejected. Reason: ${reason}`,
        priority: 'high'
      });

      CLOG.warn('Withdrawal rejected:', withdrawal._id);
    }

    // Notify via socket
    if (global.socketManager) {
      global.socketManager.sendToUser(withdrawal.user.toString(), 'wallet:updated', {
        balance: wallet.totalBalance
      });
    }

    res.status(200).json(
      ApiResponse.success({ withdrawal }, `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`)
    );
  });

  // ============================================
  // GAME MANAGEMENT (Admin)
  // ============================================

  /**
   * @desc    Create game (admin)
   * @route   POST /api/v1/admin/games
   * @access  Private (Admin only)
   */
  static createGame = asyncHandler(async (req, res) => {
    const gameData = { ...req.body, createdBy: req.user._id };
    
    const game = await Game.create(gameData);

    CLOG.success('Game created by admin:', game.name);

    res.status(201).json(
      ApiResponse.created({ game }, 'Game created successfully')
    );
  });

  /**
   * @desc    Update game (admin)
   * @route   PUT /api/v1/admin/games/:gameId
   * @access  Private (Admin only)
   */
  static updateGame = asyncHandler(async (req, res) => {
    const game = await Game.findByIdAndUpdate(
      req.params.gameId,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    CLOG.success('Game updated by admin:', game.name);

    res.status(200).json(
      ApiResponse.success({ game }, 'Game updated successfully')
    );
  });

  /**
   * @desc    Declare game result
   * @route   POST /api/v1/admin/games/:gameId/declare-result
   * @access  Private (Admin only)
   */
  static declareGameResult = asyncHandler(async (req, res) => {
    const { winnerId, winningTeam, results } = req.body;
    
    const game = await Game.findById(req.params.gameId);
    if (!game) {
      return res.status(404).json(
        ApiResponse.notFound('Game not found')
      );
    }

    // End game
    await game.endGame(winnerId, winningTeam);

    // Settle all bets for this game
    const bets = await Bet.find({ game: game._id, status: 'active' });
    
    for (const bet of bets) {
      let won = false;
      let winAmount = 0;

      // Check if bet matches result
      if (results && results[bet.betType]) {
        won = results[bet.betType] === bet.betOption;
      }

      if (won) {
        winAmount = bet.potentialWin;
        await bet.settleBet(true, winAmount);

        // Add winnings to user wallet
        const wallet = await Wallet.findOne({ user: bet.user });
        await wallet.addMoney(winAmount, 'winning');

        // Create winning transaction
        await Transaction.create({
          user: bet.user,
          type: 'bet_won',
          amount: winAmount,
          netAmount: winAmount,
          balanceBefore: wallet.winningBalance - winAmount,
          balanceAfter: wallet.winningBalance,
          status: 'completed',
          game: game._id,
          bet: bet._id,
          description: `Won bet on ${game.name}`
        });

        // Update game stats
        const gameStats = await GameStats.findOne({ user: bet.user });
        if (gameStats) {
          await gameStats.updateGameResult(game.type, true, bet.amount, winAmount);
        }
      } else {
        await bet.settleBet(false, 0);

        // Update game stats for loss
        const gameStats = await GameStats.findOne({ user: bet.user });
        if (gameStats) {
          await gameStats.updateGameResult(game.type, false, bet.amount, 0);
        }
      }

      // Notify user
      await Notification.create({
        user: bet.user,
        type: won ? 'bet_won' : 'bet_lost',
        title: won ? 'You Won!' : 'Better luck next time',
        message: won 
          ? `Congratulations! You won ₹${winAmount} on ${game.name}` 
          : `You lost ₹${bet.amount} on ${game.name}`,
        game: game._id,
        bet: bet._id,
        priority: 'high'
      });
    }

    CLOG.success('Game result declared:', game.name);

    res.status(200).json(
      ApiResponse.success({ 
        game,
        totalBetsSettled: bets.length 
      }, 'Game result declared successfully')
    );
  });

  // ============================================
  // SETTINGS MANAGEMENT
  // ============================================

  /**
   * @desc    Get all settings
   * @route   GET /api/v1/admin/settings
   * @access  Private (Admin only)
   */
  static getSettings = asyncHandler(async (req, res) => {
    const { category } = req.query;
    const settings = await Setting.getAll(category);

    res.status(200).json(
      ApiResponse.success(settings, 'Settings fetched successfully')
    );
  });

  /**
   * @desc    Update setting
   * @route   PUT /api/v1/admin/settings/:key
   * @access  Private (Admin only)
   */
  static updateSetting = asyncHandler(async (req, res) => {
    const { value } = req.body;
    const setting = await Setting.set(req.params.key, value, req.user._id);

    CLOG.info('Setting updated:', req.params.key);

    res.status(200).json(
      ApiResponse.success({ setting }, 'Setting updated successfully')
    );
  });

  /**
   * @desc    Bulk update settings
   * @route   PUT /api/v1/admin/settings/bulk
   * @access  Private (Admin only)
   */
  static bulkUpdateSettings = asyncHandler(async (req, res) => {
    const { settings } = req.body;
    await Setting.bulkUpdate(settings, req.user._id);

    res.status(200).json(
      ApiResponse.success(null, 'Settings updated successfully')
    );
  });

  // ============================================
  // BANNER MANAGEMENT
  // ============================================

  /**
   * @desc    Get all banners
   * @route   GET /api/v1/admin/banners
   * @access  Private (Admin only)
   */
  static getBanners = asyncHandler(async (req, res) => {
    const banners = await Banner.find().sort({ displayOrder: 1 });

    res.status(200).json(
      ApiResponse.success(banners, 'Banners fetched successfully')
    );
  });

  /**
   * @desc    Create banner
   * @route   POST /api/v1/admin/banners
   * @access  Private (Admin only)
   */
  static createBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json(
      ApiResponse.created({ banner }, 'Banner created successfully')
    );
  });

  /**
   * @desc    Update banner
   * @route   PUT /api/v1/admin/banners/:bannerId
   * @access  Private (Admin only)
   */
  static updateBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findByIdAndUpdate(
      req.params.bannerId,
      req.body,
      { new: true }
    );

    if (!banner) {
      return res.status(404).json(
        ApiResponse.notFound('Banner not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({ banner }, 'Banner updated successfully')
    );
  });
}

export default AdminController;