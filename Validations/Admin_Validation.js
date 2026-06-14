import { body } from 'express-validator';

const adminValidation = {
  toggleBlock: [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  ],

  updateRole: [
    body('role')
      .notEmpty().withMessage('Role is required')
      .isIn(['user', 'admin', 'manager']).withMessage('Invalid role'),
  ],

  rejectKYC: [
    body('reason')
      .trim()
      .notEmpty().withMessage('Rejection reason is required')
      .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  ],

  processWithdrawal: [
    body('action')
      .notEmpty().withMessage('Action is required')
      .isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    
    body('reason')
      .if(body('action').equals('reject'))
      .trim()
      .notEmpty().withMessage('Rejection reason is required'),
    
    body('transactionId')
      .if(body('action').equals('approve'))
      .trim()
      .notEmpty().withMessage('Transaction ID is required'),
  ],

  createGame: [
    body('name')
      .trim()
      .notEmpty().withMessage('Game name is required')
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    
    body('type')
      .notEmpty().withMessage('Game type is required')
      .isIn(['cricket', 'football', 'teenpatti', 'ludo', 'poker', 'rummy', 'other'])
      .withMessage('Invalid game type'),
    
    body('startTime')
      .notEmpty().withMessage('Start time is required')
      .isISO8601().withMessage('Invalid date format'),
    
    body('entryFee')
      .notEmpty().withMessage('Entry fee is required')
      .isNumeric().withMessage('Entry fee must be a number')
      .custom(value => value >= 0).withMessage('Entry fee cannot be negative'),
    
    body('prizePool')
      .notEmpty().withMessage('Prize pool is required')
      .isNumeric().withMessage('Prize pool must be a number')
      .custom(value => value >= 0).withMessage('Prize pool cannot be negative'),
    
    body('maxPlayers')
      .notEmpty().withMessage('Max players is required')
      .isInt({ min: 2 }).withMessage('Minimum 2 players required'),
  ],

  updateGame: [
    body('name')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    
    body('status')
      .optional()
      .isIn(['upcoming', 'live', 'completed', 'cancelled']),
    
    body('entryFee')
      .optional()
      .isNumeric(),
    
    body('prizePool')
      .optional()
      .isNumeric(),
  ],

  declareResult: [
    body('results')
      .notEmpty().withMessage('Results are required')
      .isObject().withMessage('Results must be an object'),
  ],

  createBanner: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required'),
    
    body('image.url')
      .notEmpty().withMessage('Image URL is required'),
    
    body('position')
      .notEmpty().withMessage('Position is required')
      .isIn(['home_top', 'home_middle', 'home_bottom', 'game_list', 'sidebar', 'popup']),
  ],
};

export default adminValidation;