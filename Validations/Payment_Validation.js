import { body } from 'express-validator';

const paymentValidation = {
  createOrder: [
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isNumeric().withMessage('Amount must be a number')
      .custom(value => value >= 100).withMessage('Minimum deposit is ₹100')
      .custom(value => value <= 50000).withMessage('Maximum deposit is ₹50,000'),
    
    body('gateway')
      .optional()
      .isIn(['razorpay', 'paytm', 'phonepe', 'google_pay'])
      .withMessage('Invalid gateway'),
  ],

  verifyPayment: [
    body('razorpay_order_id')
      .optional()
      .trim(),
    
    body('razorpay_payment_id')
      .optional()
      .trim(),
    
    body('razorpay_signature')
      .optional()
      .trim(),
    
    body('orderId')
      .optional()
      .trim(),
  ],

  refundPayment: [
    body('amount')
      .optional()
      .isNumeric().withMessage('Amount must be a number')
      .custom(value => value > 0).withMessage('Amount must be positive'),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Refund reason is required')
      .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  ],
};

export default paymentValidation;