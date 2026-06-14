import { body } from 'express-validator';

const walletValidation = {
  initiateDeposit: [
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isNumeric().withMessage('Amount must be a number')
      .custom(value => value >= 100).withMessage('Minimum deposit is ₹100'),
    
    body('paymentMethod')
      .optional()
      .isIn(['upi', 'bank_transfer', 'paytm', 'phonepe', 'google_pay', 'razorpay'])
      .withMessage('Invalid payment method'),
  ],

  confirmDeposit: [
    body('transactionId')
      .notEmpty().withMessage('Transaction ID is required')
      .isMongoId().withMessage('Invalid transaction ID'),
    
    body('gatewayReference')
      .notEmpty().withMessage('Gateway reference is required'),
  ],

  initiateWithdrawal: [
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isNumeric().withMessage('Amount must be a number')
      .custom(value => value >= 200).withMessage('Minimum withdrawal is ₹200')
      .custom(value => value <= 20000).withMessage('Maximum withdrawal is ₹20,000'),
    
    body('paymentMethod')
      .notEmpty().withMessage('Payment method is required')
      .isIn(['upi', 'bank_transfer']).withMessage('Invalid payment method'),
    
    body('upiId')
      .if(body('paymentMethod').equals('upi'))
      .notEmpty().withMessage('UPI ID is required')
      .matches(/^[\w.-]+@[\w]+$/).withMessage('Invalid UPI ID'),
    
    body('accountNumber')
      .if(body('paymentMethod').equals('bank_transfer'))
      .notEmpty().withMessage('Account number is required'),
    
    body('ifscCode')
      .if(body('paymentMethod').equals('bank_transfer'))
      .notEmpty().withMessage('IFSC code is required')
      .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code'),
  ],
};

export default walletValidation;