import { Wallet, Transaction, Setting } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';
import IDGenerator from '../Utils/generateId.js';

class WalletController {

  // ============================================
  // BALANCE
  // ============================================

  /**
   * @desc    Get wallet balance
   * @route   GET /api/v1/wallet/balance
   * @access  Private
   */
  static getBalance = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json(
        ApiResponse.notFound('Wallet not found')
      );
    }

    res.status(200).json(
      ApiResponse.success({
        mainBalance: wallet.mainBalance,
        bonusBalance: wallet.bonusBalance,
        winningBalance: wallet.winningBalance,
        lockedAmount: wallet.lockedAmount,
        totalBalance: wallet.totalBalance,
        availableBalance: wallet.availableBalance,
        withdrawableBalance: wallet.withdrawableBalance,
      }, 'Balance fetched successfully')
    );
  });

  // ============================================
  // DEPOSIT
  // ============================================

  /**
   * @desc    Initiate deposit
   * @route   POST /api/v1/wallet/deposit
   * @access  Private
   */
  static initiateDeposit = asyncHandler(async (req, res) => {
    const { amount, paymentMethod = 'upi' } = req.body;

    // Validate amount
    const minDeposit = await Setting.get('min_deposit', 100);
    const maxDeposit = await Setting.get('max_deposit', 50000);

    if (amount < minDeposit) {
      return res.status(400).json(
        ApiResponse.badRequest(`Minimum deposit amount is ₹${minDeposit}`)
      );
    }

    if (amount > maxDeposit) {
      return res.status(400).json(
        ApiResponse.badRequest(`Maximum deposit amount is ₹${maxDeposit}`)
      );
    }

    // Check daily deposit limit
    const wallet = await Wallet.findOne({ user: req.user._id });
    await wallet.resetDailyLimits();
    
    const dailyLimit = wallet.limits.dailyLimit || 10000;
    if (wallet.limits.dailyDeposit + amount > dailyLimit) {
      return res.status(400).json(
        ApiResponse.badRequest('Daily deposit limit exceeded')
      );
    }

    // Create transaction record
    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      amount: amount,
      fee: 0,
      tax: 0,
      netAmount: amount,
      balanceBefore: wallet.mainBalance,
      balanceAfter: wallet.mainBalance + amount,
      status: 'pending',
      paymentMethod,
      description: `Deposit of ₹${amount}`,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    });

    // Generate order ID for payment gateway
    const orderId = `ORDER_${Date.now()}_${IDGenerator.generateTransactionRef()}`;

    CLOG.info('Deposit initiated:', req.user.uid, 'Amount:', amount);

    res.status(200).json(
      ApiResponse.success({
        transactionId: transaction._id,
        reference: transaction.reference,
        orderId,
        amount,
        paymentMethod,
      }, 'Deposit initiated. Please complete the payment.')
    );
  });

  /**
   * @desc    Confirm deposit (after payment gateway callback)
   * @route   POST /api/v1/wallet/deposit/confirm
   * @access  Private
   */
  static confirmDeposit = asyncHandler(async (req, res) => {
    const { transactionId, gatewayReference, gatewayResponse } = req.body;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: req.user._id,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json(
        ApiResponse.notFound('Transaction not found or already processed')
      );
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

    // Update wallet balance
    await wallet.addMoney(transaction.netAmount, 'main');

    // Update transaction
    await transaction.complete({ gatewayReference, ...gatewayResponse });

    // Update daily deposit limit
    wallet.limits.dailyDeposit += transaction.netAmount;
    await wallet.save();

    CLOG.success('Deposit confirmed:', req.user.uid, 'Amount:', transaction.netAmount);

    // Send notification
    if (global.socketManager) {
      global.socketManager.sendToUser(req.user._id.toString(), 'wallet:updated', {
        type: 'deposit',
        amount: transaction.netAmount,
        balance: wallet.totalBalance,
      });
    }

    res.status(200).json(
      ApiResponse.success({
        transaction,
        balance: {
          mainBalance: wallet.mainBalance,
          totalBalance: wallet.totalBalance,
          availableBalance: wallet.availableBalance,
        }
      }, 'Deposit successful')
    );
  });

  // ============================================
  // WITHDRAWAL
  // ============================================

  /**
   * @desc    Initiate withdrawal
   * @route   POST /api/v1/wallet/withdraw
   * @access  Private
   */
  static initiateWithdrawal = asyncHandler(async (req, res) => {
    const { amount, paymentMethod, upiId, accountNumber, ifscCode } = req.body;

    // Validate amount
    const minWithdrawal = await Setting.get('min_withdrawal', 200);
    const maxWithdrawal = await Setting.get('max_withdrawal', 20000);

    if (amount < minWithdrawal) {
      return res.status(400).json(
        ApiResponse.badRequest(`Minimum withdrawal amount is ₹${minWithdrawal}`)
      );
    }

    if (amount > maxWithdrawal) {
      return res.status(400).json(
        ApiResponse.badRequest(`Maximum withdrawal amount is ₹${maxWithdrawal}`)
      );
    }

    // Check KYC
    const requireKYC = await Setting.get('kyc_required_for_withdrawal', true);
    if (requireKYC) {
      const { KYC } = await import('../Models/index.js');
      const kyc = await KYC.findOne({ user: req.user._id });
      
      if (!kyc || kyc.status !== 'verified') {
        return res.status(403).json(
          ApiResponse.forbidden('KYC verification is required for withdrawals')
        );
      }
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

    // Check balance
    if (wallet.withdrawableBalance < amount) {
      return res.status(400).json(
        ApiResponse.badRequest('Insufficient withdrawable balance')
      );
    }

    // Calculate processing fee
    const feePercentage = await Setting.get('withdrawal_fee_percentage', 2);
    const processingFee = Math.round((amount * feePercentage / 100) * 100) / 100;
    const netAmount = amount - processingFee;

    // Create withdrawal request
    const { Withdrawal } = await import('../Models/index.js');
    
    const withdrawal = await Withdrawal.create({
      user: req.user._id,
      amount,
      processingFee,
      netAmount,
      paymentMethod,
      paymentDetails: {
        upiId,
        accountNumber,
        ifscCode,
      },
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    });

    // Lock amount in wallet
    await wallet.lockAmount(amount);

    CLOG.info('Withdrawal initiated:', req.user.uid, 'Amount:', amount);

    res.status(200).json(
      ApiResponse.success({
        withdrawalId: withdrawal._id,
        amount,
        processingFee,
        netAmount,
        status: withdrawal.status,
      }, 'Withdrawal request submitted. It will be processed shortly.')
    );
  });

  // ============================================
  // TRANSACTION HISTORY
  // ============================================

  /**
   * @desc    Get transaction history
   * @route   GET /api/v1/wallet/transactions
   * @access  Private
   */
  static getTransactionHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type, status, startDate, endDate } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.getUserTransactions(
      req.user._id,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    const total = await Transaction.countDocuments({ user: req.user._id, ...filters });

    // Calculate summary
    const summary = await Transaction.aggregate([
      { $match: { user: req.user._id, status: 'completed' } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        transactions,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Transaction history fetched successfully')
    );
  });

  /**
   * @desc    Get withdrawal history
   * @route   GET /api/v1/wallet/withdrawals
   * @access  Private
   */
  static getWithdrawalHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    const { Withdrawal } = await import('../Models/index.js');
    
    const withdrawals = await Withdrawal.getUserWithdrawals(
      req.user._id,
      parseInt(page),
      parseInt(limit)
    );

    const total = await Withdrawal.countDocuments({ user: req.user._id });

    res.status(200).json(
      ApiResponse.success({
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Withdrawal history fetched successfully')
    );
  });

  /**
   * @desc    Get wallet summary/stats
   * @route   GET /api/v1/wallet/summary
   * @access  Private
   */
  static getWalletSummary = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ user: req.user._id });

    // Get this month's stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          createdAt: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        balance: {
          main: wallet.mainBalance,
          bonus: wallet.bonusBalance,
          winning: wallet.winningBalance,
          total: wallet.totalBalance,
          available: wallet.availableBalance,
        },
        totals: {
          deposited: wallet.totalDeposited,
          withdrawn: wallet.totalWithdrawn,
          won: wallet.totalWon,
          lost: wallet.totalLost,
        },
        monthlyStats,
        limits: wallet.limits,
      }, 'Wallet summary fetched successfully')
    );
  });
}

export default WalletController;