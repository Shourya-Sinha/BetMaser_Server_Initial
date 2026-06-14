import { body } from 'express-validator';
import { validatePhone, validatePassword, validateEmail } from '../Utils/validators.js';

const authValidation = {
  register: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .custom(validatePhone).withMessage('Invalid phone number'),
    
    body('password')
      .trim()
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .custom(validatePassword).withMessage('Password must contain at least 1 uppercase, 1 lowercase, and 1 number'),
    
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 3, max: 50 }).withMessage('Name must be between 3 and 50 characters'),
    
    body('email')
      .optional({ checkFalsy: true })
      .trim()
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
    
    body('referralCode')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 4, max: 10 }).withMessage('Invalid referral code')
  ],

  login: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .custom(validatePhone).withMessage('Invalid phone number'),
    
    body('password')
      .notEmpty().withMessage('Password is required')
  ],

  loginUID: [
    body('uid')
      .trim()
      .notEmpty().withMessage('UID is required'),
    
    body('password')
      .notEmpty().withMessage('Password is required')
  ],

  verifyOTP: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required'),
    
    body('otp')
      .trim()
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
      .isNumeric().withMessage('OTP must be numeric')
  ],

  forgotPassword: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .custom(validatePhone).withMessage('Invalid phone number')
  ],

  resetPassword: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required'),
    
    body('otp')
      .trim()
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    
    body('newPassword')
      .trim()
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .custom(validatePassword).withMessage('Password must contain at least 1 uppercase, 1 lowercase, and 1 number')
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .custom(validatePassword).withMessage('Password must contain at least 1 uppercase, 1 lowercase, and 1 number')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from current password');
        }
        return true;
      })
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required')
  ],
  resendOTP: [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .isLength({ min: 10, max: 10 }).withMessage('Phone must be 10 digits')
      .matches(/^[6-9]\d{9}$/).withMessage('Enter a valid phone number'),
],
};

export default authValidation;