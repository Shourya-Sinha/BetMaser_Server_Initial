import { User, Wallet, GameStats, KYC, Security, Referral } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';
import PasswordUtils from '../Utils/passwordUtils.js';

class UserController {

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  /**
   * @desc    Get user profile
   * @route   GET /api/v1/users/profile
   * @access  Private
   */
  static getProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;

    // Get full profile with all related data
    // ✅ Find user directly using the model
    const user = await User.findById(userId)
      .select('-password -loginHistory');

    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    // Fetch related data in parallel
    const [wallet, kyc, gameStats, referral] = await Promise.allSettled([
      Wallet.findOne({ user: userId }),
      KYC.findOne({ user: userId }),
      GameStats.findOne({ user: userId }),
      Referral.findOne({ user: userId }),
    ]);

    // Build response
    const profileData = {
      user: {
        _id: user._id,
        uid: user.uid,
        username: user.username,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        profilePicture: user.profilePicture,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        isBlocked: user.isBlocked,
        address: user.address,
        preferences: user.preferences,
        lastActiveAt: user.lastActiveAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      wallet: wallet.status === 'fulfilled' ? {
        balance: wallet.value?.mainBalance || 0,
        mainBalance: wallet.value?.mainBalance || 0,
        bonusBalance: wallet.value?.bonusBalance || 0,
        winningBalance: wallet.value?.winningBalance || 0,
        availableBalance: wallet.value?.availableBalance || 0,
      } : null,
      kyc: kyc.status === 'fulfilled' ? {
        status: kyc.value?.status || 'not_submitted',
        panNumber: kyc.value?.panNumber,
        aadhaarNumber: kyc.value?.aadhaarNumber,
        isVerified: kyc.value?.isVerified || false,
        submittedAt: kyc.value?.submittedAt,
        verifiedAt: kyc.value?.verifiedAt,
      } : { status: 'not_submitted' },
      gameStats: gameStats.status === 'fulfilled' ? {
        totalGames: gameStats.value?.totalGames || 0,
        wins: gameStats.value?.wins || 0,
        losses: gameStats.value?.losses || 0,
        winRate: gameStats.value?.winRate || 0,
        totalWinnings: gameStats.value?.totalWinnings || 0,
      } : null,
      referral: referral.status === 'fulfilled' ? {
        referralCode: referral.value?.referralCode,
        totalReferrals: referral.value?.totalReferrals || 0,
        totalEarnings: referral.value?.totalEarnings || 0,
      } : null,
    };

    res.status(200).json(
      ApiResponse.success(profileData, 'Profile fetched successfully')
    );
  });

  /**
   * @desc    Update user profile
   * @route   PUT /api/v1/users/profile
   * @access  Private
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const { fullName, email, dateOfBirth, gender, address, preferences, } = req.body;
    const user = req.user;
    const userId = req.user._id || req.user.id;

    const updateData = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (address !== undefined) updateData.address = address;
    if (preferences !== undefined) updateData.preferences = preferences;

    // Check if email is already taken
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(409).json(
          ApiResponse.error('Email already in use', 409)
        );
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -loginHistory');

    if (!updatedUser) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(
        { user: updatedUser },
        'Profile updated successfully'
      )
    );
  });

  /**
   * @desc    Update profile picture
   * @route   PUT /api/v1/users/profile-picture
   * @access  Private
   */
  static updateProfilePicture = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { url, publicId } = req.body;

    if (!url) {
      return res.status(400).json(
        ApiResponse.badRequest('Image URL is required')
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          profilePicture: {
            url,
            publicId: publicId || null,
            uploadedAt: new Date(),
          },
        },
      },
      { new: true }
    ).select('-password -loginHistory');

    res.status(200).json(
      ApiResponse.success(
        { user: updatedUser },
        'Profile picture updated successfully'
      )
    );
  });

  /**
   * @desc    Change UID (username)
   * @route   PUT /api/v1/users/change-uid
   * @access  Private
   */
  static changeUsername = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { newUsername } = req.body;

    // Check if username is already taken
    const existingUser = await User.findOne({
      username: newUsername,
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(409).json(
        ApiResponse.error('Username already taken', 409)
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { username: newUsername } },
      { new: true, runValidators: true }
    ).select('-password -loginHistory');

    res.status(200).json(
      ApiResponse.success(
        { user: updatedUser },
        'Username changed successfully'
      )
    );
  });

  // ============================================
  // WALLET INFO
  // ============================================

  /**
   * @desc    Get wallet balance
   * @route   GET /api/v1/users/wallet
   * @access  Private
   */
  static getWallet = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(404).json(
        ApiResponse.notFound('Wallet not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({ wallet }, 'Wallet fetched successfully')
    );
  });

  /**
   * @desc    Get wallet transaction history
   * @route   GET /api/v1/users/transactions
   * @access  Private
   */
  static getTransactions = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(200).json(
        ApiResponse.success({ transactions: [], total: 0 }, 'No transactions')
      );
    }

    // Get transactions with pagination
    const transactions = wallet.transactions
      ?.sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * limit, page * limit) || [];

    const total = wallet.transactions?.length || 0;

    res.status(200).json(
      ApiResponse.success(
        { transactions, total, page: Number(page), totalPages: Math.ceil(total / limit) },
        'Transactions fetched successfully'
      )
    );
  });

  // ============================================
  // GAME STATISTICS
  // ============================================

  /**
   * @desc    Get game statistics
   * @route   GET /api/v1/users/game-stats
   * @access  Private
   */
  static getGameStats = asyncHandler(async (req, res) => {
    const gameStats = await GameStats.findOne({ user: req.user._id });

    if (!gameStats) {
      return res.status(404).json(
        ApiResponse.notFound('Game stats not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        overall: gameStats.overall,
        cricket: gameStats.cricket,
        football: gameStats.football,
        teenpatti: gameStats.teenpatti,
        ludo: gameStats.ludo,
        poker: gameStats.poker,
        rummy: gameStats.rummy,
        monthlyStats: gameStats.monthlyStats?.slice(-12), // Last 12 months
        achievements: gameStats.achievements,
      }, 'Game statistics fetched successfully')
    );
  });

  /**
   * @desc    Get betting history
   * @route   GET /api/v1/users/bet-history
   * @access  Private
   */
  static getBetHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, gameType } = req.query;

    const { Bet } = await import('../Models/index.js');

    const filters = { user: req.user._id };
    if (status) filters.status = status;
    if (gameType) filters.gameType = gameType;

    const bets = await Bet.getUserBets(req.user._id, parseInt(page), parseInt(limit));
    const total = await Bet.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        bets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Bet history fetched successfully')
    );
  });

  /**
   * @desc    Get game history
   * @route   GET /api/v1/users/game-history
   * @access  Private
   */
  static getGameHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const { Game } = await import('../Models/index.js');

    const games = await Game.find({
      'participants.user': req.user._id
    })
      .select('name type status startTime prizePool entryFee result')
      .sort({ startTime: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Game.countDocuments({
      'participants.user': req.user._id
    });

    res.status(200).json(
      ApiResponse.success({
        games,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Game history fetched successfully')
    );
  });

  // ============================================
  // KYC MANAGEMENT
  // ============================================

  /**
   * @desc    Get KYC status
   * @route   GET /api/v1/users/kyc
   * @access  Private
   */
  static getKYC = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;

    const kyc = await KYC.findOne({ user: userId });

    if (!kyc) {
      return res.status(404).json(
        ApiResponse.notFound('KYC record not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        status: kyc.status,
        isComplete: kyc.isComplete,
        isFullyVerified: kyc.isFullyVerified,
        verificationProgress: kyc.verificationProgress,
        panCard: {
          verified: kyc.panCard.verified,
          submitted: !!kyc.panCard.number
        },
        aadharCard: {
          verified: kyc.aadharCard.verified,
          submitted: !!kyc.aadharCard.number
        },
        bankDetails: {
          verified: kyc.bankDetails.verified,
          submitted: !!kyc.bankDetails.accountNumber
        },
        upiDetails: {
          verified: kyc.upiDetails.verified,
          submitted: !!kyc.upiDetails.upiId
        },
        submittedAt: kyc.submittedAt,
        verifiedAt: kyc.verifiedAt
      }, 'KYC status fetched successfully')
    );
  });

  /**
   * @desc    Submit KYC documents
   * @route   POST /api/v1/users/kyc
   * @access  Private
   */
  static submitKYC = asyncHandler(async (req, res) => {
    const {
      panNumber, panName, panDOB,
      aadharNumber, aadharName, aadharDOB,
      accountNumber, confirmAccountNumber, accountHolderName, ifscCode,
      upiId
    } = req.body;

    // Validate PAN
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid PAN card number')
      );
    }

    // Validate Aadhar
    if (aadharNumber && !/^\d{12}$/.test(aadharNumber)) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid Aadhar number')
      );
    }

    // Validate IFSC
    if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid IFSC code')
      );
    }

    // Validate account numbers match
    if (accountNumber && accountNumber !== confirmAccountNumber) {
      return res.status(400).json(
        ApiResponse.badRequest('Account numbers do not match')
      );
    }

    let kyc = await KYC.findOne({ user: req.user._id });

    if (!kyc) {
      kyc = new KYC({ user: req.user._id });
    }

    // Update PAN details
    if (panNumber) {
      kyc.panCard.number = panNumber;
      kyc.panCard.name = panName;
      if (panDOB) kyc.panCard.dateOfBirth = panDOB;
    }

    // Update Aadhar details
    if (aadharNumber) {
      kyc.aadharCard.number = aadharNumber;
      kyc.aadharCard.name = aadharName;
      if (aadharDOB) kyc.aadharCard.dateOfBirth = aadharDOB;
    }

    // Update Bank details
    if (accountNumber) {
      kyc.bankDetails.accountNumber = accountNumber;
      kyc.bankDetails.confirmAccountNumber = confirmAccountNumber;
      kyc.bankDetails.accountHolderName = accountHolderName;
      kyc.bankDetails.ifscCode = ifscCode;
    }

    // Update UPI details
    if (upiId) {
      kyc.upiDetails.upiId = upiId;
    }

    // Handle file uploads if any
    if (req.files) {
      if (req.files.panImage) {
        kyc.panCard.image = {
          url: req.files.panImage[0].path,
          publicId: req.files.panImage[0].filename,
          uploadedAt: new Date()
        };
      }
      if (req.files.aadharFront) {
        kyc.aadharCard.frontImage = {
          url: req.files.aadharFront[0].path,
          publicId: req.files.aadharFront[0].filename,
          uploadedAt: new Date()
        };
      }
      if (req.files.aadharBack) {
        kyc.aadharCard.backImage = {
          url: req.files.aadharBack[0].path,
          publicId: req.files.aadharBack[0].filename,
          uploadedAt: new Date()
        };
      }
    }

    // Update status
    if (!kyc.submittedAt) {
      kyc.submittedAt = new Date();
    }
    kyc.status = 'submitted';

    await kyc.save();

    CLOG.success('KYC submitted:', req.user.uid);

    res.status(200).json(
      ApiResponse.success({ kyc }, 'KYC documents submitted successfully')
    );
  });

  // ============================================
  // REFERRAL
  // ============================================

  /**
   * @desc    Get referral info
   * @route   GET /api/v1/users/referral
   * @access  Private
   */
  static getReferral = asyncHandler(async (req, res) => {
    const referral = await Referral.findOne({ user: req.user._id });

    if (!referral) {
      return res.status(404).json(
        ApiResponse.notFound('Referral record not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        referralCode: referral.referralCode,
        stats: referral.stats,
        tier: referral.tier,
        referrals: referral.referrals?.slice(-20), // Last 20 referrals
        earnings: referral.earnings?.slice(-20), // Last 20 earnings
        totalPendingEarnings: referral.totalPendingEarnings,
        totalCreditedEarnings: referral.totalCreditedEarnings,
      }, 'Referral info fetched successfully')
    );
  });

  /**
   * @desc    Get referral leaderboard
   * @route   GET /api/v1/users/referral-leaderboard
   * @access  Public
   */
  static getReferralLeaderboard = asyncHandler(async (req, res) => {
    const topReferrers = await Referral.getTopReferrers(10);

    res.status(200).json(
      ApiResponse.success(topReferrers, 'Referral leaderboard fetched successfully')
    );
  });

  // ============================================
  // NOTIFICATIONS
  // ============================================

  /**
   * @desc    Get user notifications
   * @route   GET /api/v1/users/notifications
   * @access  Private
   */
  static getNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const { Notification } = await import('../Models/index.js');

    const notifications = await Notification.getUserNotifications(
      req.user._id,
      parseInt(page),
      parseInt(limit)
    );

    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.status(200).json(
      ApiResponse.success({
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }, 'Notifications fetched successfully')
    );
  });

  /**
   * @desc    Mark notification as read
   * @route   PUT /api/v1/users/notifications/:id/read
   * @access  Private
   */
  static markNotificationRead = asyncHandler(async (req, res) => {
    const { Notification } = await import('../Models/index.js');

    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json(
        ApiResponse.notFound('Notification not found')
      );
    }

    await notification.markAsRead();

    res.status(200).json(
      ApiResponse.success(null, 'Notification marked as read')
    );
  });

  /**
   * @desc    Mark all notifications as read
   * @route   PUT /api/v1/users/notifications/read-all
   * @access  Private
   */
  static markAllNotificationsRead = asyncHandler(async (req, res) => {
    const { Notification } = await import('../Models/index.js');

    await Notification.markAllAsRead(req.user._id);

    res.status(200).json(
      ApiResponse.success(null, 'All notifications marked as read')
    );
  });

  // ============================================
  // SECURITY
  // ============================================

  /**
   * @desc    Get security info
   * @route   GET /api/v1/users/security
   * @access  Private
   */
  static getSecurityInfo = asyncHandler(async (req, res) => {
    const security = await Security.findOne({ user: req.user._id })
      .select('-securityQuestions.answer -twoFactorAuth.secret -passwordReset.token');

    if (!security) {
      return res.status(404).json(
        ApiResponse.notFound('Security record not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        twoFactorEnabled: security.twoFactorAuth.enabled,
        lastPasswordChange: security.lastPasswordChange,
        trustedDevices: security.trustedDevices,
        activeSessions: security.activeSessions?.filter(s => s.isActive),
        loginAttempts: security.loginAttempts,
      }, 'Security info fetched successfully')
    );
  });

  /**
   * @desc    Deactivate account
   * @route   POST /api/v1/users/deactivate
   * @access  Private
   */
  static deactivateAccount = asyncHandler(async (req, res) => {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const { isValid } = await PasswordUtils.verifyPassword(user.password, password);
    if (!isValid) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid password')
      );
    }

    user.isActive = false;
    await user.save();

    CLOG.warn('Account deactivated:', user.uid);

    res.status(200).json(
      ApiResponse.success(null, 'Account deactivated successfully')
    );
  });

  /**
   * @desc    Logout from all devices
   * @route   POST /api/v1/users/logout-all
   * @access  Private
   */
  static logoutAll = asyncHandler(async (req, res) => {
    const security = await Security.findOne({ user: req.user._id });

    if (security) {
      security.activeSessions = [];
      security.trustedDevices = [];
      await security.save();
    }

    CLOG.info('Logged out from all devices:', req.user.uid);

    res.status(200).json(
      ApiResponse.success(null, 'Logged out from all devices successfully')
    );
  });
}

export default UserController;