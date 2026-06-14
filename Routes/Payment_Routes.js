import { Router } from 'express';
import PaymentController from '../Controllers/Payment_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import paymentValidation from '../Validations/Payment_Validation.js';

const router = Router();

// Public webhook (no auth)
router.post('/webhook/razorpay', PaymentController.razorpayWebhook);

// User routes (require authentication)
router.use(AuthMiddleware.authenticate);

// Create order and verify payment
router.post('/create-order',
  paymentValidation.createOrder,
  ValidationMiddleware.validate,
  PaymentController.createOrder
);

router.post('/verify',
  paymentValidation.verifyPayment,
  ValidationMiddleware.validate,
  PaymentController.verifyPayment
);

// Payment history
router.get('/history', PaymentController.getPaymentHistory);
router.get('/:id', PaymentController.getPaymentDetails);

// Admin refund
router.post('/:id/refund',
  AuthMiddleware.authorize('admin', 'super_admin'),
  paymentValidation.refundPayment,
  ValidationMiddleware.validate,
  PaymentController.refundPayment
);

export default router;