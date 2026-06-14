import { Router } from "express";

const router = Router();

import AuthController from '../Controllers/Auth_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import authValidation from '../Validations/Auth_Validation.js';

// Rate limiters
const loginLimiter = AuthMiddleware.createRateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes
const otpLimiter = AuthMiddleware.createRateLimiter(60 * 60 * 1000, 3); // 3 OTP requests per hour

// Public routes
router.post(
  '/register',
  ValidationMiddleware.sanitize,
  authValidation.register,
  ValidationMiddleware.validate,
  AuthController.register
);

router.post(
  '/verify-otp',
  otpLimiter,
  authValidation.verifyOTP,
  ValidationMiddleware.validate,
  AuthController.verifyOTP
);

router.post(
  '/login',
  loginLimiter,
  ValidationMiddleware.sanitize,
  authValidation.login,
  ValidationMiddleware.validate,
  AuthController.login
);

router.post(
  '/login-uid',
  loginLimiter,
  ValidationMiddleware.sanitize,
  authValidation.loginUID,
  ValidationMiddleware.validate,
  AuthController.loginWithUID
);

router.post(
  '/refresh-token',
  authValidation.refreshToken,
  ValidationMiddleware.validate,
  AuthController.refreshToken
);

router.post(
  '/forgot-password',
  otpLimiter,
  authValidation.forgotPassword,
  ValidationMiddleware.validate,
  AuthController.forgotPassword
);

router.post(
  '/reset-password',
  authValidation.resetPassword,
  ValidationMiddleware.validate,
  AuthController.resetPassword
);

router.post(
  '/resend-otp',
  otpLimiter,
  authValidation.resendOTP,
  ValidationMiddleware.validate,
  AuthController.resendOTP
);

// Protected routes (require authentication)
router.use(AuthMiddleware.authenticate);

router.post(
  '/change-password',
  authValidation.changePassword,
  ValidationMiddleware.validate,
  AuthController.changePassword
);

router.post('/logout', AuthController.logout);

router.post('/enable-2fa', AuthController.enable2FA);

router.post('/verify-2fa', AuthController.verify2FA);

export default router;