import { body } from 'express-validator';

const supportValidation = {
  createTicket: [
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isLength({ max: 200 }).withMessage('Subject cannot exceed 200 characters'),
    
    body('category')
      .notEmpty().withMessage('Category is required')
      .isIn(['account', 'payment', 'withdrawal', 'deposit', 'game', 'bet', 'kyc', 'bonus', 'technical', 'other'])
      .withMessage('Invalid category'),
    
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
    
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority'),
  ],

  replyTicket: [
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
  ],

  addFeedback: [
    body('rating')
      .notEmpty().withMessage('Rating is required')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Feedback cannot exceed 500 characters'),
  ],

  resolveTicket: [
    body('solution')
      .trim()
      .notEmpty().withMessage('Solution is required')
      .isLength({ max: 1000 }).withMessage('Solution cannot exceed 1000 characters'),
  ],

  addNote: [
    body('note')
      .trim()
      .notEmpty().withMessage('Note is required')
      .isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters'),
  ],
};

export default supportValidation;