import { body, query } from 'express-validator';

const userValidation = {
  updateProfile: [
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Full name can only contain letters and spaces'),

    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),

    body('gender')
      .optional()
      .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
      .withMessage('Invalid gender'),

    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Invalid date of birth'),

    body('state')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('State name cannot exceed 50 characters'),

    body('city')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('City name cannot exceed 50 characters'),

    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Address cannot exceed 500 characters'),

    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio cannot exceed 500 characters'),

    body('preferredSport')
      .optional()
      .isIn(['cricket', 'football', 'both'])
      .withMessage('Preferred sport must be cricket, football, or both')
  ],

  changeUsername: [
    body('newUsername')
      .trim()
      .notEmpty()
      .withMessage('New username is required')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),

    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  submitKYC: [
    body('panNumber')
      .trim()
      .notEmpty()
      .withMessage('PAN number is required')
      .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
      .withMessage('Invalid PAN number'),

    body('aadhaarNumber')
      .trim()
      .notEmpty()
      .withMessage('Aadhaar number is required')
      .matches(/^\d{12}$/)
      .withMessage('Aadhaar number must be exactly 12 digits'),

    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Full name must be between 3 and 100 characters'),

    body('dateOfBirth')
      .notEmpty()
      .withMessage('Date of birth is required')
      .isISO8601()
      .withMessage('Invalid date of birth'),

    body('address')
      .trim()
      .notEmpty()
      .withMessage('Address is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Address must be between 10 and 500 characters'),

    body('documentType')
      .isIn([
        'pan',
        'aadhaar',
        'driving_license',
        'voter_id',
        'passport'
      ])
      .withMessage('Invalid document type'),

    body('documentFrontImage')
      .notEmpty()
      .withMessage('Document front image is required')
      .isURL()
      .withMessage('Invalid image URL'),

    body('documentBackImage')
      .optional({ nullable: true, checkFalsy: true })
      .isURL()
      .withMessage('Invalid image URL'),

    body('selfieImage')
      .notEmpty()
      .withMessage('Selfie image is required')
      .isURL()
      .withMessage('Invalid image URL')
  ],

  deactivateAccount: [
    body('password')
      .notEmpty()
      .withMessage('Password is required'),

    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason cannot exceed 500 characters'),

    body('confirmation')
      .equals('true')
      .withMessage('You must confirm account deactivation')
  ],

  transactionQuery: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be greater than 0'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),

    query('type')
      .optional()
      .isIn(['credit', 'debit', 'all'])
      .withMessage('Invalid transaction type')
  ],

  betHistoryQuery: [
    query('page')
      .optional()
      .isInt({ min: 1 }),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 }),

    query('status')
      .optional()
      .isIn(['won', 'lost', 'pending', 'cancelled', 'all']),

    query('gameType')
      .optional()
      .isIn(['cricket', 'football', 'teenpatti', 'ludo', 'all'])
  ]
};

export default userValidation;


// import Joi from 'joi';

// // Profile validation schemas
// const updateProfile = Joi.object({
//   fullName: Joi.string()
//     .min(2)
//     .max(100)
//     .trim()
//     .pattern(/^[a-zA-Z\s]+$/)
//     .messages({
//       'string.min': 'Full name must be at least 2 characters long',
//       'string.max': 'Full name cannot exceed 100 characters',
//       'string.pattern.base': 'Full name can only contain letters and spaces',
//     }),
  
//   email: Joi.string()
//     .email()
//     .lowercase()
//     .trim()
//     .messages({
//       'string.email': 'Please provide a valid email address',
//     }),
  
//   gender: Joi.string()
//     .valid('male', 'female', 'other', 'prefer-not-to-say')
//     .messages({
//       'any.only': 'Gender must be one of: male, female, other, prefer-not-to-say',
//     }),
  
//   dateOfBirth: Joi.date()
//     .max('now')
//     .min('1900-01-01')
//     .messages({
//       'date.max': 'Date of birth cannot be in the future',
//       'date.min': 'Please provide a valid date of birth',
//     }),
  
//   state: Joi.string()
//     .trim()
//     .max(50)
//     .messages({
//       'string.max': 'State name cannot exceed 50 characters',
//     }),
  
//   city: Joi.string()
//     .trim()
//     .max(50)
//     .messages({
//       'string.max': 'City name cannot exceed 50 characters',
//     }),
  
//   address: Joi.string()
//     .trim()
//     .max(500)
//     .messages({
//       'string.max': 'Address cannot exceed 500 characters',
//     }),
  
//   bio: Joi.string()
//     .trim()
//     .max(500)
//     .messages({
//       'string.max': 'Bio cannot exceed 500 characters',
//     }),
  
//   preferredSport: Joi.string()
//     .valid('cricket', 'football', 'both')
//     .messages({
//       'any.only': 'Preferred sport must be cricket, football, or both',
//     }),
// }).min(1).messages({
//   'object.min': 'Please provide at least one field to update',
// });

// // Change username validation
// const changeUsername = Joi.object({
//   newUsername: Joi.string()
//     .required()
//     .min(3)
//     .max(30)
//     .trim()
//     .pattern(/^[a-zA-Z0-9_]+$/)
//     .messages({
//       'string.required': 'New username is required',
//       'string.min': 'Username must be at least 3 characters long',
//       'string.max': 'Username cannot exceed 30 characters',
//       'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
//     }),
  
//   password: Joi.string()
//     .required()
//     .min(6)
//     .max(128)
//     .messages({
//       'string.required': 'Password is required to change username',
//       'string.min': 'Password must be at least 6 characters long',
//     }),
// });

// // KYC submission validation
// const submitKYC = Joi.object({
//   panNumber: Joi.string()
//     .required()
//     .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
//     .messages({
//       'string.required': 'PAN number is required',
//       'string.pattern.base': 'Please provide a valid PAN number (e.g., ABCDE1234F)',
//     }),
  
//   aadhaarNumber: Joi.string()
//     .required()
//     .pattern(/^\d{12}$/)
//     .messages({
//       'string.required': 'Aadhaar number is required',
//       'string.pattern.base': 'Aadhaar number must be exactly 12 digits',
//     }),
  
//   fullName: Joi.string()
//     .required()
//     .min(3)
//     .max(100)
//     .trim()
//     .messages({
//       'string.required': 'Full name as per document is required',
//       'string.min': 'Full name must be at least 3 characters long',
//       'string.max': 'Full name cannot exceed 100 characters',
//     }),
  
//   dateOfBirth: Joi.date()
//     .required()
//     .max('now')
//     .messages({
//       'any.required': 'Date of birth is required',
//       'date.max': 'Date of birth cannot be in the future',
//     }),
  
//   address: Joi.string()
//     .required()
//     .min(10)
//     .max(500)
//     .trim()
//     .messages({
//       'string.required': 'Address is required',
//       'string.min': 'Address must be at least 10 characters long',
//       'string.max': 'Address cannot exceed 500 characters',
//     }),
  
//   documentType: Joi.string()
//     .valid('pan', 'aadhaar', 'driving_license', 'voter_id', 'passport')
//     .messages({
//       'any.only': 'Invalid document type',
//     }),
  
//   documentFrontImage: Joi.string()
//     .required()
//     .uri()
//     .messages({
//       'string.required': 'Document front image is required',
//       'string.uri': 'Please provide a valid image URL',
//     }),
  
//   documentBackImage: Joi.string()
//     .uri()
//     .allow('', null)
//     .messages({
//       'string.uri': 'Please provide a valid image URL',
//     }),
  
//   selfieImage: Joi.string()
//     .required()
//     .uri()
//     .messages({
//       'string.required': 'Selfie image is required',
//       'string.uri': 'Please provide a valid image URL',
//     }),
// });

// // Deactivate account validation
// const deactivateAccount = Joi.object({
//   password: Joi.string()
//     .required()
//     .messages({
//       'string.required': 'Password is required to deactivate account',
//     }),
  
//   reason: Joi.string()
//     .max(500)
//     .trim()
//     .messages({
//       'string.max': 'Reason cannot exceed 500 characters',
//     }),
  
//   confirmation: Joi.boolean()
//     .valid(true)
//     .required()
//     .messages({
//       'any.required': 'Please confirm account deactivation',
//       'any.only': 'You must confirm deactivation',
//     }),
// });

// // Wallet amount validation (for internal use)
// const walletAmount = Joi.object({
//   amount: Joi.number()
//     .required()
//     .positive()
//     .min(10)
//     .max(100000)
//     .precision(2)
//     .messages({
//       'number.base': 'Amount must be a valid number',
//       'number.required': 'Amount is required',
//       'number.positive': 'Amount must be positive',
//       'number.min': 'Minimum amount is ₹10',
//       'number.max': 'Maximum amount is ₹1,00,000',
//       'number.precision': 'Amount can have maximum 2 decimal places',
//     }),
// });

// // Transaction query validation (for internal use)
// const transactionQuery = Joi.object({
//   page: Joi.number()
//     .integer()
//     .min(1)
//     .default(1)
//     .messages({
//       'number.base': 'Page must be a number',
//       'number.min': 'Page must be at least 1',
//     }),
  
//   limit: Joi.number()
//     .integer()
//     .min(1)
//     .max(50)
//     .default(10)
//     .messages({
//       'number.min': 'Limit must be at least 1',
//       'number.max': 'Maximum limit is 50',
//     }),
  
//   type: Joi.string()
//     .valid('credit', 'debit', 'all')
//     .default('all')
//     .messages({
//       'any.only': 'Type must be credit, debit, or all',
//     }),
  
//   startDate: Joi.date()
//     .max('now')
//     .messages({
//       'date.max': 'Start date cannot be in the future',
//     }),
  
//   endDate: Joi.date()
//     .max('now')
//     .messages({
//       'date.max': 'End date cannot be in the future',
//     }),
// });

// // Bet history query validation (for internal use)
// const betHistoryQuery = Joi.object({
//   page: Joi.number()
//     .integer()
//     .min(1)
//     .default(1),
  
//   limit: Joi.number()
//     .integer()
//     .min(1)
//     .max(50)
//     .default(10),
  
//   status: Joi.string()
//     .valid('won', 'lost', 'pending', 'cancelled', 'all')
//     .default('all'),
  
//   gameType: Joi.string()
//     .valid('cricket', 'football', 'teenpatti', 'ludo', 'all')
//     .default('all'),
  
//   startDate: Joi.date(),
//   endDate: Joi.date(),
// });

// // Export all validations
// export const userValidation = {
//   updateProfile,
//   changeUsername,
//   submitKYC,
//   deactivateAccount,
//   walletAmount,
//   transactionQuery,
//   betHistoryQuery,
// };

// export default userValidation;