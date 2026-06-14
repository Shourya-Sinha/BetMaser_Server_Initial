import { Payment, Transaction, Wallet, Setting } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';
import crypto from 'crypto';

class PaymentController {

  // ============================================
  // CREATE ORDER
  // ============================================

  /**
   * @desc    Create payment order
   * @route   POST /api/v1/payments/create-order
   * @access  Private
   */
  static createOrder = asyncHandler(async (req, res) => {
    const { amount, gateway = 'razorpay' } = req.body;

    // Validate amount
    const minDeposit = await Setting.get('min_deposit', 100);
    const maxDeposit = await Setting.get('max_deposit', 50000);

    if (amount < minDeposit) {
      return res.status(400).json(
        ApiResponse.badRequest(`Minimum deposit is ₹${minDeposit}`)
      );
    }

    if (amount > maxDeposit) {
      return res.status(400).json(
        ApiResponse.badRequest(`Maximum deposit is ₹${maxDeposit}`)
      );
    }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const receiptId = `RCPT_${req.user.uid}_${Date.now()}`;

    // Create payment record
    const payment = await Payment.create({
      user: req.user._id,
      orderId,
      receiptId,
      amount,
      currency: 'INR',
      gateway,
      status: 'created',
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent']
    });

    // Create Razorpay order if using Razorpay
    let gatewayOrder = null;
    if (gateway === 'razorpay') {
      // This would use Razorpay SDK in production
      gatewayOrder = {
        id: `order_${Date.now()}`,
        amount: amount * 100, // Razorpay expects amount in paise
        currency: 'INR',
        receipt: receiptId,
        status: 'created'
      };

      payment.gatewayOrderId = gatewayOrder.id;
      await payment.save();
    }

    CLOG.info('Payment order created:', orderId);

    res.status(201).json(
      ApiResponse.created({
        payment: {
          id: payment._id,
          orderId: payment.orderId,
          amount: payment.amount,
          currency: payment.currency,
          gateway: payment.gateway,
          status: payment.status
        },
        gatewayOrder: gatewayOrder ? {
          id: gatewayOrder.id,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency
        } : null
      }, 'Payment order created')
    );
  });

  /**
   * @desc    Verify payment (Razorpay webhook/callback)
   * @route   POST /api/v1/payments/verify
   * @access  Public (with signature verification)
   */
  static verifyPayment = asyncHandler(async (req, res) => {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderId 
    } = req.body;

    // Find payment record
    const payment = await Payment.findOne({ 
      $or: [
        { orderId: orderId || razorpay_order_id },
        { gatewayOrderId: razorpay_order_id }
      ]
    });

    if (!payment) {
      return res.status(404).json(
        ApiResponse.notFound('Payment record not found')
      );
    }

    // Verify signature (Razorpay)
    if (razorpay_signature) {
      const sign = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign)
        .digest('hex');

      if (expectedSign !== razorpay_signature) {
        await payment.updateStatus('failed', { 
          error: 'Signature verification failed' 
        });

        return res.status(400).json(
          ApiResponse.badRequest('Payment verification failed')
        );
      }
    }

    // Update payment record
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.gatewaySignature = razorpay_signature;
    await payment.updateStatus('completed', {
      razorpay_order_id,
      razorpay_payment_id,
      verified: true
    });

    await payment.verifyPayment();

    // Add money to wallet
    const wallet = await Wallet.findOne({ user: payment.user });
    await wallet.addMoney(payment.amount, 'main');

    // Create transaction record
    await Transaction.create({
      user: payment.user,
      type: 'deposit',
      amount: payment.amount,
      fee: 0,
      tax: 0,
      netAmount: payment.amount,
      balanceBefore: wallet.mainBalance - payment.amount,
      balanceAfter: wallet.mainBalance,
      status: 'completed',
      paymentMethod: payment.method || 'razorpay',
      gatewayReference: razorpay_payment_id,
      description: `Deposit via ${payment.gateway}`,
      ipAddress: req.ip
    });

    // Update payment with transaction reference
    payment.transaction = transaction._id;
    await payment.save();

    // Check for first deposit bonus
    const firstDepositBonus = await Setting.get('first_deposit_bonus_percentage', 100);
    const maxBonus = await Setting.get('max_bonus_amount', 500);
    
    const depositCount = await Transaction.countDocuments({ 
      user: payment.user, 
      type: 'deposit',
      status: 'completed'
    });

    if (depositCount === 1 && firstDepositBonus > 0) {
      const bonusAmount = Math.min(
        Math.round(payment.amount * firstDepositBonus / 100),
        maxBonus
      );
      
      if (bonusAmount > 0) {
        await wallet.addMoney(bonusAmount, 'bonus');
        
        await Transaction.create({
          user: payment.user,
          type: 'bonus',
          amount: bonusAmount,
          netAmount: bonusAmount,
          balanceBefore: wallet.bonusBalance - bonusAmount,
          balanceAfter: wallet.bonusBalance,
          status: 'completed',
          description: 'First deposit bonus'
        });
      }
    }

    // Notify user via socket
    if (global.socketManager) {
      global.socketManager.sendToUser(payment.user.toString(), 'wallet:updated', {
        type: 'deposit',
        amount: payment.amount,
        balance: wallet.totalBalance
      });
    }

    CLOG.success('Payment verified:', payment.orderId);

    res.status(200).json(
      ApiResponse.success({
        payment: {
          id: payment._id,
          orderId: payment.orderId,
          amount: payment.amount,
          status: 'completed'
        },
        wallet: {
          balance: wallet.totalBalance,
          availableBalance: wallet.availableBalance
        }
      }, 'Payment verified and balance updated')
    );
  });

  /**
   * @desc    Handle Razorpay webhook
   * @route   POST /api/v1/payments/webhook/razorpay
   * @access  Public (with signature verification)
   */
  static razorpayWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      CLOG.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    CLOG.info('Razorpay webhook received:', event.event);

    switch (event.event) {
      case 'payment.captured':
        await PaymentController.handlePaymentCaptured(event.payload.payment.entity);
        break;
      
      case 'payment.failed':
        await PaymentController.handlePaymentFailed(event.payload.payment.entity);
        break;
      
      case 'order.paid':
        await PaymentController.handleOrderPaid(event.payload.order.entity);
        break;
      
      default:
        CLOG.info('Unhandled webhook event:', event.event);
    }

    res.status(200).json({ status: 'ok' });
  });

  /**
   * @desc    Handle payment captured event
   */
  static handlePaymentCaptured = async (paymentEntity) => {
    const { order_id, id: payment_id, amount, status } = paymentEntity;

    const payment = await Payment.findOne({ gatewayOrderId: order_id });
    if (!payment) return;

    if (status === 'captured') {
      payment.gatewayPaymentId = payment_id;
      await payment.updateStatus('completed', { payment_id, status });

      // Add to wallet
      const wallet = await Wallet.findOne({ user: payment.user });
      await wallet.addMoney(amount / 100, 'main'); // Convert paise to rupees

      CLOG.success('Payment captured via webhook:', order_id);
    }
  };

  /**
   * @desc    Handle payment failed event
   */
  static handlePaymentFailed = async (paymentEntity) => {
    const { order_id, id: payment_id, error_description } = paymentEntity;

    const payment = await Payment.findOne({ gatewayOrderId: order_id });
    if (!payment) return;

    await payment.updateStatus('failed', {
      error: error_description,
      payment_id
    });

    CLOG.error('Payment failed:', order_id);
  };

  // ============================================
  // PAYMENT HISTORY
  // ============================================

  /**
   * @desc    Get payment history
   * @route   GET /api/v1/payments/history
   * @access  Private
   */
  static getPaymentHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, gateway } = req.query;

    const filters = { user: req.user._id };
    if (status) filters.status = status;
    if (gateway) filters.gateway = gateway;

    const payments = await Payment.find(filters)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Payment.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Payment history fetched successfully')
    );
  });

  /**
   * @desc    Get payment details
   * @route   GET /api/v1/payments/:id
   * @access  Private
   */
  static getPaymentDetails = asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id
    }).lean();

    if (!payment) {
      return res.status(404).json(
        ApiResponse.notFound('Payment not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(payment, 'Payment details fetched successfully')
    );
  });

  /**
   * @desc    Refund payment (Admin)
   * @route   POST /api/v1/payments/:id/refund
   * @access  Private (Admin only)
   */
  static refundPayment = asyncHandler(async (req, res) => {
    const { amount, reason } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json(
        ApiResponse.notFound('Payment not found')
      );
    }

    if (payment.status !== 'completed') {
      return res.status(400).json(
        ApiResponse.badRequest('Only completed payments can be refunded')
      );
    }

    // Process refund via gateway (Razorpay)
    const refundAmount = amount || payment.amount;
    
    await payment.refund(refundAmount);

    // Deduct from wallet
    const wallet = await Wallet.findOne({ user: payment.user });
    if (wallet.mainBalance >= refundAmount) {
      await wallet.deductMoney(refundAmount, 'main');
    }

    // Create refund transaction
    await Transaction.create({
      user: payment.user,
      type: 'refund',
      amount: refundAmount,
      netAmount: refundAmount,
      balanceBefore: wallet.mainBalance + refundAmount,
      balanceAfter: wallet.mainBalance,
      status: 'completed',
      description: `Refund: ${reason || 'Admin refund'}`,
      verifiedBy: req.user._id
    });

    CLOG.warn('Payment refunded:', payment.orderId, 'Amount:', refundAmount);

    res.status(200).json(
      ApiResponse.success({ payment }, 'Payment refunded successfully')
    );
  });
}

export default PaymentController;