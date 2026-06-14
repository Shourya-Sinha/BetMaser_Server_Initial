import { Transaction, Withdrawal, Wallet } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';

class TransactionController {

  // ============================================
  // TRANSACTIONS
  // ============================================

  /**
   * @desc    Get all transactions (with filters)
   * @route   GET /api/v1/transactions
   * @access  Private
   */
  static getTransactions = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status, 
      startDate, 
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = { user: req.user._id };
    
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (minAmount || maxAmount) {
      filters.netAmount = {};
      if (minAmount) filters.netAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filters.netAmount.$lte = parseFloat(maxAmount);
    }
    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) filters.createdAt.$gte = new Date(startDate);
      if (endDate) filters.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const transactions = await Transaction.find(filters)
      .populate('game', 'name type')
      .populate('bet', 'betType betOption amount odds')
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Transaction.countDocuments(filters);

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
      }, 'Transactions fetched successfully')
    );
  });

  /**
   * @desc    Get transaction by ID
   * @route   GET /api/v1/transactions/:id
   * @access  Private
   */
  static getTransactionById = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('game', 'name type')
      .populate('bet', 'betType betOption amount odds')
      .lean();

    if (!transaction) {
      return res.status(404).json(
        ApiResponse.notFound('Transaction not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(transaction, 'Transaction fetched successfully')
    );
  });

  /**
   * @desc    Get transaction stats
   * @route   GET /api/v1/transactions/stats
   * @access  Private
   */
  static getTransactionStats = asyncHandler(async (req, res) => {
    const { period = 'monthly' } = req.query;

    let groupFormat;
    let startDate;

    switch (period) {
      case 'daily':
        groupFormat = '%Y-%m-%d';
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        groupFormat = '%Y-%U';
        startDate = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
      default:
        groupFormat = '%Y-%m';
        startDate = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const stats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          deposits: {
            $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$netAmount', 0] }
          },
          withdrawals: {
            $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$netAmount', 0] }
          },
          winnings: {
            $sum: { $cond: [{ $in: ['$type', ['bet_won', 'bonus']] }, '$netAmount', 0] }
          },
          losses: {
            $sum: { $cond: [{ $eq: ['$type', 'bet_placed'] }, '$netAmount', 0] }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json(
      ApiResponse.success({
        stats,
        period,
        startDate
      }, 'Transaction stats fetched successfully')
    );
  });

  // ============================================
  // WITHDRAWALS
  // ============================================

  /**
   * @desc    Get withdrawal requests
   * @route   GET /api/v1/transactions/withdrawals
   * @access  Private
   */
  static getWithdrawals = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const filters = { user: req.user._id };
    if (status) filters.status = status;

    const withdrawals = await Withdrawal.find(filters)
      .sort({ requestedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Withdrawal.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Withdrawals fetched successfully')
    );
  });

  /**
   * @desc    Get withdrawal by ID
   * @route   GET /api/v1/transactions/withdrawals/:id
   * @access  Private
   */
  static getWithdrawalById = asyncHandler(async (req, res) => {
    const withdrawal = await Withdrawal.findOne({
      _id: req.params.id,
      user: req.user._id
    }).lean();

    if (!withdrawal) {
      return res.status(404).json(
        ApiResponse.notFound('Withdrawal not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(withdrawal, 'Withdrawal fetched successfully')
    );
  });

  /**
   * @desc    Cancel pending withdrawal
   * @route   POST /api/v1/transactions/withdrawals/:id/cancel
   * @access  Private
   */
  static cancelWithdrawal = asyncHandler(async (req, res) => {
    const withdrawal = await Withdrawal.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending'
    });

    if (!withdrawal) {
      return res.status(404).json(
        ApiResponse.notFound('Withdrawal not found or cannot be cancelled')
      );
    }

    // Refund amount to wallet
    const wallet = await Wallet.findOne({ user: req.user._id });
    await wallet.unlockAmount(withdrawal.amount);

    // Update withdrawal status
    withdrawal.status = 'cancelled';
    withdrawal.statusHistory.push({
      status: 'cancelled',
      remark: 'Cancelled by user'
    });
    await withdrawal.save();

    CLOG.info('Withdrawal cancelled:', withdrawal._id);

    res.status(200).json(
      ApiResponse.success({ 
        withdrawal,
        balance: wallet.totalBalance 
      }, 'Withdrawal cancelled successfully')
    );
  });
}

export default TransactionController;